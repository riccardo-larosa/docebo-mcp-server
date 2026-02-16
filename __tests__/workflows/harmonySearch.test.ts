import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios
const mockAxios = vi.fn();
vi.mock('axios', () => ({
  default: Object.assign(
    (...args: any[]) => mockAxios(...args),
    {
      isAxiosError: (e: any) => e?.isAxiosError === true,
      post: (...args: any[]) => mockAxios(...args),
    }
  ),
}));

const { HarmonySearchTool } = await import('../../src/server/tools/workflows/harmonySearch.js');

const BOOTSTRAP_RESPONSE = {
  status: 200,
  data: {
    data: {
      ai: {
        geppetto: {
          chat: {
            start_url: 'https://geppetto.example.com/start',
            message_stream_url: 'https://geppetto.example.com/stream',
          },
        },
      },
    },
  },
};

const AUTH_RESPONSE = {
  status: 200,
  data: { data: { token: 'geppetto-token-123' } },
};

const SESSION_RESPONSE = {
  status: 200,
  data: { session: 'session-abc' },
};

const SSE_STREAM = [
  'event:message',
  'data:{"text":"Here are some results"}',
  '',
  'event:sources',
  'data:{"items":[{"title":"Course A"}]}',
  '',
  'event:done',
  'data:null',
  '',
].join('\n');

const STREAM_RESPONSE = {
  status: 200,
  data: SSE_STREAM,
};

describe('HarmonySearchTool', () => {
  const tool = new HarmonySearchTool();
  const token = 'test-token';
  const apiBaseUrl = 'https://acme.docebosaas.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name and annotations', () => {
    expect(tool.name).toBe('harmony_search');
    const def = tool.getToolDefinition();
    expect(def.annotations?.readOnlyHint).toBe(true);
    expect(def.annotations?.destructiveHint).toBe(false);
  });

  it('should require query', async () => {
    const result = await tool.handleRequest({}, token, apiBaseUrl);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('query');
  });

  it('should execute full 4-step flow and return parsed events', async () => {
    // Step 1: bootstrap
    mockAxios.mockResolvedValueOnce(BOOTSTRAP_RESPONSE);
    // Step 2: geppetto auth
    mockAxios.mockResolvedValueOnce(AUTH_RESPONSE);
    // Step 3: start session
    mockAxios.mockResolvedValueOnce(SESSION_RESPONSE);
    // Step 4: message stream
    mockAxios.mockResolvedValueOnce(STREAM_RESPONSE);

    const result = await tool.handleRequest({ query: 'compliance training' }, token, apiBaseUrl);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.query).toBe('compliance training');
    expect(data.sessionId).toBe('session-abc');
    expect(data.events).toHaveLength(3);
    expect(data.events[0].event).toBe('message');
    expect(data.events[0].data).toEqual({ text: 'Here are some results' });
    expect(data.events[1].event).toBe('sources');
    expect(data.events[2].event).toBe('done');
    expect(data.rawStream).toBe(SSE_STREAM);
  });

  it('should handle missing geppetto URLs in bootstrap', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: {} },
    });

    const result = await tool.handleRequest({ query: 'test' }, token, apiBaseUrl);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Geppetto URLs not found');
  });

  it('should handle missing geppetto token', async () => {
    mockAxios.mockResolvedValueOnce(BOOTSTRAP_RESPONSE);
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: {} },
    });

    const result = await tool.handleRequest({ query: 'test' }, token, apiBaseUrl);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Geppetto token not found');
  });

  it('should handle missing session ID', async () => {
    mockAxios.mockResolvedValueOnce(BOOTSTRAP_RESPONSE);
    mockAxios.mockResolvedValueOnce(AUTH_RESPONSE);
    mockAxios.mockResolvedValueOnce({ status: 200, data: {} });

    const result = await tool.handleRequest({ query: 'test' }, token, apiBaseUrl);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Session ID not found');
  });

  it('should handle missing authentication token', async () => {
    const result = await tool.handleRequest({ query: 'test' }, undefined, apiBaseUrl);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('authentication');
  });

  it('should handle missing API base URL', async () => {
    const result = await tool.handleRequest({ query: 'test' }, token, undefined);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('API base URL');
  });

  it('should handle SSE events with non-JSON data', async () => {
    const plainTextStream = [
      'event:status',
      'data:processing',
      '',
      'event:message',
      'data:{"text":"result"}',
      '',
    ].join('\n');

    mockAxios.mockResolvedValueOnce(BOOTSTRAP_RESPONSE);
    mockAxios.mockResolvedValueOnce(AUTH_RESPONSE);
    mockAxios.mockResolvedValueOnce(SESSION_RESPONSE);
    mockAxios.mockResolvedValueOnce({ status: 200, data: plainTextStream });

    const result = await tool.handleRequest({ query: 'test' }, token, apiBaseUrl);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.events[0].event).toBe('status');
    expect(data.events[0].data).toBe('processing');
    expect(data.events[1].data).toEqual({ text: 'result' });
  });

  it('should handle bootstrap API error', async () => {
    const error = new Error('Server error') as any;
    error.isAxiosError = true;
    error.response = { status: 500, statusText: 'Internal Server Error', data: 'Bootstrap failed' };
    mockAxios.mockRejectedValueOnce(error);

    const result = await tool.handleRequest({ query: 'test' }, token, apiBaseUrl);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('500');
  });

  it('should pass geppetto token to session and stream calls', async () => {
    mockAxios.mockResolvedValueOnce(BOOTSTRAP_RESPONSE);
    mockAxios.mockResolvedValueOnce(AUTH_RESPONSE);
    mockAxios.mockResolvedValueOnce(SESSION_RESPONSE);
    mockAxios.mockResolvedValueOnce(STREAM_RESPONSE);

    await tool.handleRequest({ query: 'test' }, token, apiBaseUrl);

    // Call 3 = start session (axios.post called as mockAxios)
    const sessionCall = mockAxios.mock.calls[2];
    expect(sessionCall[0]).toBe('https://geppetto.example.com/start');
    expect(sessionCall[2].headers.Authorization).toBe('Bearer geppetto-token-123');

    // Call 4 = message stream
    const streamCall = mockAxios.mock.calls[3];
    expect(streamCall[0]).toBe('https://geppetto.example.com/stream');
    expect(streamCall[1].message).toBe('test');
    expect(streamCall[1].session).toBe('session-abc');
    expect(streamCall[2].headers.Authorization).toBe('Bearer geppetto-token-123');
  });
});
