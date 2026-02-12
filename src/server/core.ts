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
export const SERVER_VERSION = "0.1.0";
export const API_BASE_URL = process.env.API_BASE_URL;

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
 * Type definition for cached OAuth tokens
 */
export interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

/**
 * Declare global __oauthTokenCache property for TypeScript
 */
declare global {
  var __oauthTokenCache: Record<string, TokenCacheEntry> | undefined;
}

/**
 * Options for creating a server instance
 */
export interface CreateServerOptions {
  /** Optional callback to resolve the bearer token dynamically (e.g. via OAuth) */
  getAccessToken?: () => Promise<string | undefined>;
}

/**
 * Creates and configures an MCP Server instance with tool handlers.
 *
 * @param options Optional configuration
 * @returns Configured Server instance
 */
export function createServer(options?: CreateServerOptions): Server {
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

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest, context?: any): Promise<CallToolResult> => {
    const { name: toolName, arguments: toolArgs } = request.params;
    const entry = toolDefinitionMap.get(toolName);
    if (!entry) {
      console.error(`Error: Unknown tool requested: ${toolName}`);
      return { content: [{ type: "text", text: `Error: Unknown tool requested: ${toolName}` }], isError: true };
    }
    console.error(`Executing tool "${toolName}" with arguments ${JSON.stringify(toolArgs)} and securitySchemes ${JSON.stringify(securitySchemes)}`);

    // If a dynamic token provider is configured, resolve the token and set it in env
    if (options?.getAccessToken) {
      const token = await options.getAccessToken();
      if (token) {
        process.env.BEARER_TOKEN_BEARERAUTH = token;
      }
    }

    // Class-based tools handle their own validation and execution
    if (entry instanceof BaseTool) {
      return entry.handleRequest(toolArgs ?? {});
    }

    return await executeApiTool(toolName, entry, toolArgs ?? {}, securitySchemes, context?.bearerToken);
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
  allSecuritySchemes: Record<string, any>,
  bearerToken?: string
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
    const apiBaseUrl = process.env.API_BASE_URL;
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

    // Apply security requirements if available
    const appliedSecurity = definition.securityRequirements?.find(req => {
      return Object.entries(req).every(([schemeName, scopesArray]) => {
        const scheme = allSecuritySchemes[schemeName];
        if (!scheme) return false;

        if (scheme.type === 'apiKey') {
          return !!process.env[`API_KEY_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
        }

        if (scheme.type === 'http') {
          if (scheme.scheme?.toLowerCase() === 'bearer') {
            return !!process.env[`BEARER_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
          }
          else if (scheme.scheme?.toLowerCase() === 'basic') {
            return !!process.env[`BASIC_USERNAME_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`] &&
              !!process.env[`BASIC_PASSWORD_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
          }
        }

        return false;
      });
    });

    // If we found matching security scheme(s), apply them
    if (appliedSecurity) {
      for (const [schemeName, scopesArray] of Object.entries(appliedSecurity)) {
        const scheme = allSecuritySchemes[schemeName];

        if (scheme?.type === 'apiKey') {
          const apiKey = process.env[`API_KEY_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
          if (apiKey) {
            if (scheme.in === 'header') {
              headers[scheme.name.toLowerCase()] = apiKey;
              console.error(`Applied API key '${schemeName}' in header '${scheme.name}'`);
            }
            else if (scheme.in === 'query') {
              queryParams[scheme.name] = apiKey;
              console.error(`Applied API key '${schemeName}' in query parameter '${scheme.name}'`);
            }
            else if (scheme.in === 'cookie') {
              headers['cookie'] = `${scheme.name}=${apiKey}${headers['cookie'] ? `; ${headers['cookie']}` : ''}`;
              console.error(`Applied API key '${schemeName}' in cookie '${scheme.name}'`);
            }
          }
        }
        else if (scheme?.type === 'http') {
          if (scheme.scheme?.toLowerCase() === 'bearer') {
            const token = bearerToken || process.env[`BEARER_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];

            if (token) {
              headers['authorization'] = `Bearer ${token}`;
              console.error(`Applied Bearer token for '${schemeName}'`);
            }
          }
        }
      }
    }
    else if (definition.securityRequirements?.length > 0) {
      const securityRequirementsString = definition.securityRequirements
        .map(req => {
          const parts = Object.entries(req)
            .map(([name, scopesArray]) => {
              const scopes = scopesArray as string[];
              if (scopes.length === 0) return name;
              return `${name} (scopes: ${scopes.join(', ')})`;
            })
            .join(' AND ');
          return `[${parts}]`;
        })
        .join(' OR ');

      console.warn(`Tool '${toolName}' requires security: ${securityRequirementsString}, but no suitable credentials found.`);
    }

    // Prepare the axios request configuration
    const config: AxiosRequestConfig = {
      method: definition.method.toUpperCase(),
      url: requestUrl,
      params: queryParams,
      headers: headers,
      ...(requestBodyData !== undefined && { data: requestBodyData }),
    };

    console.error(`Executing tool "${toolName}": ${config.method} ${config.url}`);

    const response = await axios(config);

    // Process and format the response
    let responseText = '';
    const contentType = response.headers['content-type']?.toLowerCase() || '';

    if (contentType.includes('application/json') && typeof response.data === 'object' && response.data !== null) {
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

