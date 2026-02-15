import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z, ZodError } from 'zod';
import axios, { type AxiosRequestConfig, type AxiosError } from 'axios';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type Tool,
  type CallToolResult,
  type CallToolRequest,
  type GetPromptRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { McpToolDefinition } from "./tools/index.js";
import { BaseTool } from "./tools/baseTool.js";
import { coursesToolsMap } from './tools/courses.js';
import { enrollmentsToolsMap } from './tools/enrollments.js';
import { usersToolsMap } from './tools/users.js';
import { notificationsToolsMap } from './tools/notifications.js';
import { getPrompts, getPromptMessages } from './prompts/index.js';
import './prompts/courseEnrollmentReport.js';
import './prompts/learnerProgress.js';
import './prompts/teamTrainingStatus.js';
import './prompts/courseRecommendations.js';

/**
 * A tool entry can be either a declarative McpToolDefinition or a class-based BaseTool.
 */
export type ToolEntry = McpToolDefinition | BaseTool;

/**
 * Type definition for JSON objects
 */
type JsonObject = Record<string, any>;

/**
 * Server configuration
 */
export const SERVER_NAME = "docebo-mcp-server";
export const SERVER_VERSION = "0.3.0";
export const CHARACTER_LIMIT = 25000;

/**
 * Combined tool entry map from all tool sources.
 * Supports both declarative McpToolDefinition and class-based BaseTool instances.
 */
export const toolDefinitionMap: Map<string, ToolEntry> = new Map([
  ...coursesToolsMap,
  ...enrollmentsToolsMap,
  ...usersToolsMap,
  ...notificationsToolsMap,
]);

/**
 * Security schemes for the API
 */
export const securitySchemes = {
  "bearerAuth": {
    "type": "http",
    "name": "Authorization",
    "in": "header",
    "scheme": "bearer"
  }
};

/**
 * Creates and configures an MCP Server instance with tool handlers.
 *
 * @returns Configured Server instance
 */
export function createServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, prompts: {} } }
  );

  // --- Prompt handlers ---
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const prompts = getPrompts().map(p => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments?.map(a => ({
        name: a.name,
        description: a.description,
        required: a.required ?? false,
      })),
    }));
    return { prompts };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest) => {
    const { name, arguments: args } = request.params;
    const messages = getPromptMessages(name, args ?? {});
    return { messages };
  });

  // --- Tool handlers ---
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const toolsForClient: Tool[] = Array.from(toolDefinitionMap.values()).map(entry => {
      if (entry instanceof BaseTool) {
        return entry.getToolDefinition();
      }
      return {
        name: entry.name,
        description: entry.description,
        inputSchema: entry.inputSchema,
        ...(entry.annotations && { annotations: entry.annotations }),
      };
    });
    return { tools: toolsForClient };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest, extra?: any): Promise<CallToolResult> => {
    const { name: toolName, arguments: toolArgs } = request.params;
    const entry = toolDefinitionMap.get(toolName);
    if (!entry) {
      console.error(`Error: Unknown tool requested: ${toolName}`);
      return { content: [{ type: "text", text: `Error: Unknown tool requested: ${toolName}` }], isError: true };
    }
    console.error(`Executing tool "${toolName}" with arguments ${JSON.stringify(toolArgs)}`);

    // Resolve the bearer token from the transport (OAuth resource server flow)
    const authToken = extra?.authInfo?.token;
    // Resolve the API base URL (set by tenant middleware)
    const apiBaseUrl = extra?.apiBaseUrl as string | undefined;

    // Class-based tools handle their own validation and execution
    if (entry instanceof BaseTool) {
      return entry.handleRequest(toolArgs ?? {}, authToken, apiBaseUrl);
    }

    return await executeApiTool(toolName, entry, toolArgs ?? {}, authToken, apiBaseUrl);
  });

  return server;
}

/**
 * Executes an API tool with the provided arguments
 */
async function executeApiTool(
  toolName: string,
  definition: McpToolDefinition,
  toolArgs: JsonObject,
  bearerToken?: string,
  apiBaseUrl?: string
): Promise<CallToolResult> {
  try {
    // Validate arguments against the Zod schema (or fall back to permissive validation)
    let validatedArgs: JsonObject;
    try {
      const zodSchema = definition.zodSchema ?? z.object({}).passthrough();
      const argsToParse = (typeof toolArgs === 'object' && toolArgs !== null) ? toolArgs : {};
      validatedArgs = zodSchema.parse(argsToParse) as JsonObject;
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const validationErrorMessage = `Invalid arguments for tool '${toolName}': ${error.issues.map((e) => `${e.path.join('.')} (${e.code}): ${e.message}`).join(', ')}`;
        return { content: [{ type: 'text', text: validationErrorMessage }], isError: true };
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: `Internal error during validation setup: ${errorMessage}` }], isError: true };
      }
    }

    // Prepare URL, query parameters, headers, and request body
    let urlPath = definition.pathTemplate;
    const queryParams: Record<string, any> = {};
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    let requestBodyData: any = undefined;

    // Apply parameters to the URL path, query, or headers
    definition.executionParameters.forEach((param) => {
      const value = validatedArgs[param.name];
      if (typeof value !== 'undefined' && value !== null) {
        if (param.in === 'path') {
          urlPath = urlPath.replace(`{${param.name}}`, encodeURIComponent(String(value)));
        }
        else if (param.in === 'query') {
          queryParams[param.name] = value;
        }
        else if (param.in === 'header') {
          headers[param.name.toLowerCase()] = String(value);
        }
      }
    });

    // Ensure all path parameters are resolved
    if (urlPath.includes('{')) {
      throw new Error(`Failed to resolve path parameters: ${urlPath}`);
    }

    // Construct the full URL
    // Ensure a single slash separates base URL and path
    const base = apiBaseUrl?.replace(/\/+$/, '') ?? '';
    const pathPart = urlPath.replace(/^\/+/, '');
    const requestUrl = base ? `${base}/${pathPart}` : urlPath;

    // Handle request body if needed
    if (definition.requestBodyContentType && typeof validatedArgs['requestBody'] !== 'undefined') {
      requestBodyData = validatedArgs['requestBody'];
      headers['content-type'] = definition.requestBodyContentType;
    }

    // Apply bearer token if available (from OAuth authInfo)
    if (bearerToken) {
      headers['authorization'] = `Bearer ${bearerToken}`;
      console.error(`Applied Bearer token for outbound API call`);
    } else if (definition.securityRequirements?.length > 0) {
      console.warn(`Tool '${toolName}' requires authentication, but no bearer token available.`);
    }

    // Prepare the axios request configuration
    const config: AxiosRequestConfig = {
      method: definition.method.toUpperCase(),
      url: requestUrl,
      params: queryParams,
      headers: headers,
      timeout: 30000,
      ...(requestBodyData !== undefined && { data: requestBodyData }),
    };

    console.error(`Executing tool "${toolName}": ${config.method} ${config.url}`);

    const response = await axios(config);

    // Extract response_format (consumed locally, not sent to API)
    const responseFormat = validatedArgs['response_format'] as string | undefined;

    // Process and format the response
    let responseText = '';
    const contentType = response.headers['content-type']?.toLowerCase() || '';

    if (responseFormat === 'markdown' && definition.method.toLowerCase() === 'get' &&
        contentType.includes('application/json') && typeof response.data === 'object' && response.data !== null) {
      responseText = formatAsMarkdown(response.data, toolName);
    } else if (contentType.includes('application/json') && typeof response.data === 'object' && response.data !== null) {
      try {
        responseText = JSON.stringify(response.data, null, 2);
      } catch (e) {
        responseText = "[Stringify Error]";
      }
    }
    else if (typeof response.data === 'string') {
      responseText = response.data;
    }
    else if (response.data !== undefined && response.data !== null) {
      responseText = String(response.data);
    }
    else {
      responseText = `(Status: ${response.status} - No body content)`;
    }

    // Append pagination metadata for GET endpoints
    if (definition.method.toLowerCase() === 'get' && typeof response.data === 'object' && response.data !== null) {
      const paginationSummary = extractPaginationMetadata(response.data);
      if (paginationSummary) {
        responseText += '\n\n' + paginationSummary;
      }
    }

    // Truncate oversized responses to stay within LLM context limits
    if (responseText.length > CHARACTER_LIMIT) {
      responseText = responseText.substring(0, CHARACTER_LIMIT) +
        '\n\n[Response truncated. Use pagination (page, page_size) or filters to narrow results.]';
    }

    return {
      content: [
        {
          type: "text",
          text: `API Response (Status: ${response.status}):\n${responseText}`
        }
      ],
    };

  } catch (error: unknown) {
    let errorMessage: string;

    if (axios.isAxiosError(error)) {
      errorMessage = formatApiError(error);
    }
    else if (error instanceof Error) {
      errorMessage = error.message;
    }
    else {
      errorMessage = 'Unexpected error: ' + String(error);
    }

    console.error(`Error during execution of tool '${toolName}':`, errorMessage);
    return { content: [{ type: "text", text: errorMessage }], isError: true };
  }
}

/**
 * Formats API response data as concise markdown summary.
 * Extracts items from Docebo's standard response structure and summarizes key fields.
 */
export function formatAsMarkdown(data: any, toolName: string): string {
  const MAX_ITEMS = 50;
  const lines: string[] = [];

  // Docebo responses typically wrap data in a `data` property
  const payload = data?.data ?? data;

  // Handle list responses (items array)
  const items = payload?.items ?? (Array.isArray(payload) ? payload : null);
  if (items && Array.isArray(items)) {
    lines.push(`## ${toolName} Results`);
    lines.push('');
    const displayItems = items.slice(0, MAX_ITEMS);

    for (const item of displayItems) {
      // Build a summary line from key fields
      const id = item.id_course ?? item.id ?? item.user_id ?? item.id_user ?? '';
      const name = item.name ?? item.username ?? item.course_name ?? '';
      const status = item.status ?? '';

      let summary = `- **${name || `ID: ${id}`}**`;
      if (id && name) summary += ` (ID: ${id})`;
      if (status) summary += ` — ${status}`;

      // Add extra relevant fields
      const extras: string[] = [];
      if (item.email) extras.push(`email: ${item.email}`);
      if (item.course_type ?? item.type) extras.push(`type: ${item.course_type ?? item.type}`);
      if (item.completion_percentage !== undefined) extras.push(`completion: ${item.completion_percentage}%`);
      if (item.score !== undefined) extras.push(`score: ${item.score}`);
      if (item.category) extras.push(`category: ${item.category}`);

      if (extras.length > 0) summary += ` | ${extras.join(', ')}`;
      lines.push(summary);
    }

    if (items.length > MAX_ITEMS) {
      lines.push('');
      lines.push(`_...and ${items.length - MAX_ITEMS} more items (use pagination to see all)_`);
    }
  } else if (typeof payload === 'object' && payload !== null) {
    // Single record response
    lines.push(`## ${toolName} Result`);
    lines.push('');
    for (const [key, value] of Object.entries(payload)) {
      if (value !== null && value !== undefined && typeof value !== 'object') {
        lines.push(`- **${key}**: ${value}`);
      }
    }
  }

  return lines.length > 0 ? lines.join('\n') : JSON.stringify(data, null, 2);
}

/**
 * Extracts pagination metadata from Docebo API response and returns a summary line.
 */
export function extractPaginationMetadata(data: any): string | null {
  const payload = data?.data ?? data;

  const totalCount = payload?.total_count ?? payload?.count ?? null;
  const currentPage = payload?.current_page ?? null;
  const pageSize = payload?.page_size ?? null;
  const hasMore = payload?.has_more_data ?? payload?.has_more ?? null;

  if (totalCount === null && currentPage === null && hasMore === null) {
    return null;
  }

  const parts: string[] = ['--- Pagination:'];
  if (totalCount !== null) parts.push(`total_count=${totalCount}`);
  if (currentPage !== null) parts.push(`current_page=${currentPage}`);
  if (pageSize !== null) parts.push(`page_size=${pageSize}`);
  if (hasMore !== null) parts.push(`has_more=${hasMore}`);

  return parts.join(' ');
}

/**
 * Formats API errors for better readability
 */
function formatApiError(error: AxiosError): string {
  let message = 'API request failed.';
  if (error.response) {
    message = `API Error: Status ${error.response.status} (${error.response.statusText || 'Status text not available'}). `;
    const responseData = error.response.data;
    const MAX_LEN = 200;
    if (typeof responseData === 'string') {
      message += `Response: ${responseData.substring(0, MAX_LEN)}${responseData.length > MAX_LEN ? '...' : ''}`;
    }
    else if (responseData) {
      try {
        const jsonString = JSON.stringify(responseData);
        message += `Response: ${jsonString.substring(0, MAX_LEN)}${jsonString.length > MAX_LEN ? '...' : ''}`;
      } catch {
        message += 'Response: [Could not serialize data]';
      }
    }
    else {
      message += 'No response body received.';
    }
  } else if (error.request) {
    message = 'API Network Error: No response received from server.';
    if (error.code) message += ` (Code: ${error.code})`;
  } else {
    message += `API Request Setup Error: ${error.message}`;
  }
  return message;
}

