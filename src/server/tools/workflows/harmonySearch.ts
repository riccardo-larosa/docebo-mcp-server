import { z } from 'zod';
import axios from 'axios';
import { BaseTool } from '../baseTool.js';
import { DoceboApiClient } from '../doceboApi.js';

const schema = z.object({
  query: z.string().describe('The search query to send to Harmony Search'),
});

interface BootstrapResponse {
  data: {
    ai?: {
      geppetto?: {
        chat?: {
          start_url?: string;
          message_stream_url?: string;
        };
      };
    };
  };
}

interface GeppettoAuthResponse {
  data: { token: string };
}

interface StartSessionResponse {
  session: string;
}

interface SseEvent {
  event: string;
  data: unknown;
}

function parseSseStream(text: string): SseEvent[] {
  const lines = text.split('\n');
  const events: SseEvent[] = [];
  let current: { event?: string; data?: string } = {};

  for (const line of lines) {
    if (line.startsWith('event:')) {
      current.event = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      current.data = line.substring(5).trim();
    } else if (line === '' && current.event) {
      let parsed: unknown;
      try {
        parsed = current.data ? JSON.parse(current.data) : null;
      } catch {
        parsed = current.data;
      }
      events.push({ event: current.event, data: parsed });
      current = {};
    }
  }

  return events;
}

export class HarmonySearchTool extends BaseTool {
  name = 'harmony_search';
  description = `Purpose: Search Docebo content using Harmony Search (RAG-powered). Queries the platform's AI search to find relevant courses, learning objects, and knowledge base content.

Returns: Search results including parsed SSE events with answer content and source references.

Usage Guidance:
  - Provide a natural language search query.
  - This tool calls multiple internal APIs (bootstrap, auth, session, search stream).
  - Results come from the platform's AI-powered search engine.`;
  zodSchema = schema;
  annotations = {
    title: 'Harmony Search',
    readOnlyHint: true as const,
    destructiveHint: false as const,
    idempotentHint: true as const,
    openWorldHint: false as const,
  };

  async process(input: z.infer<typeof schema>, bearerToken?: string, apiBaseUrl?: string): Promise<unknown> {
    if (!bearerToken) throw new Error('Missing authentication token');
    if (!apiBaseUrl) throw new Error('Missing API base URL');

    const api = new DoceboApiClient(bearerToken, apiBaseUrl);

    // Step 1: Get Geppetto URLs from bootstrap
    const bootstrap = await api.get<BootstrapResponse>('manage/v1/site/bootstrap');
    const geppettoStartUrl = bootstrap?.data?.ai?.geppetto?.chat?.start_url;
    const geppettoMessageStreamUrl = bootstrap?.data?.ai?.geppetto?.chat?.message_stream_url;

    if (!geppettoStartUrl || !geppettoMessageStreamUrl) {
      throw new Error('Geppetto URLs not found in bootstrap response. Harmony Search may not be enabled for this tenant.');
    }

    // Step 2: Get Geppetto auth token
    const authResponse = await api.get<GeppettoAuthResponse>('manage/v1/globalsearch/ai/auth');
    const geppettoToken = authResponse?.data?.token;

    if (!geppettoToken) {
      throw new Error('Geppetto token not found in auth response');
    }

    // Step 3: Start Geppetto session
    const startSessionResponse = await axios.post<StartSessionResponse>(
      geppettoStartUrl,
      {},
      {
        headers: {
          Authorization: `Bearer ${geppettoToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 30000,
      },
    );

    const sessionId = startSessionResponse.data?.session;
    if (!sessionId) {
      throw new Error('Session ID not found in start session response');
    }

    // Step 4: Send search query via message stream
    const messageResponse = await axios.post(
      geppettoMessageStreamUrl,
      {
        message: input.query,
        session: sessionId,
        resources: [],
        enable_general_knowledge: false,
      },
      {
        headers: {
          Authorization: `Bearer ${geppettoToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 60000,
        responseType: 'text',
        transformResponse: [(data: string) => data],
      },
    );

    const rawStream = messageResponse.data as string;
    const events = parseSseStream(rawStream);

    return {
      query: input.query,
      sessionId,
      events,
      rawStream,
    };
  }
}
