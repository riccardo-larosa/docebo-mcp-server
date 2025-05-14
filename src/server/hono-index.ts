import path from 'node:path';
// import { fileURLToPath } from 'node:url';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z, ZodError } from 'zod';
import { jsonSchemaToZod } from 'json-schema-to-zod';
import axios, { type AxiosRequestConfig, type AxiosError } from 'axios';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
  type CallToolResult,
  type CallToolRequest
} from "@modelcontextprotocol/sdk/types.js";
import { setupStreamableHttpServer } from "./hono-server.js";
import { McpToolDefinition } from "./tools/index.js";
import { coursesToolsMap } from './tools/courses.js';
import { classroomsToolsMap } from './tools/classrooms.js';

// import { getBearerToken } from "./auth.js";

import dotenv from 'dotenv';

dotenv.config();

/**
 * Type definition for JSON objects
 */
type JsonObject = Record<string, any>;


/**
 * Server configuration
 */
export const SERVER_NAME = "docebo-mcp-server";
export const SERVER_VERSION = "0.1.0";
export const API_BASE_URL = "https://riccardo-lr-test.docebosaas.com/";

/**
 * MCP Server instance
 */
const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

// Combine dynamically loaded tools with others
const toolDefinitionMap: Map<string, McpToolDefinition> = new Map([
  ...coursesToolsMap,
  ...classroomsToolsMap,
  // add more tools here
]);

// console.error('Final combined tool map:', Array.from(toolDefinitionMap.keys()));


const securitySchemes = {
  "bearerAuth": {
    "type": "http",
    "name": "Authorization",
    "in": "header",
    "scheme": "bearer"
  }
};


server.setRequestHandler(ListToolsRequestSchema, async () => {
  const toolsForClient: Tool[] = Array.from(toolDefinitionMap.values()).map(def => ({
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema
  }));
  return { tools: toolsForClient };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest, context?: any): Promise<CallToolResult> => {
  const { name: toolName, arguments: toolArgs } = request.params;
  const toolDefinition = toolDefinitionMap.get(toolName);
  if (!toolDefinition) {
    console.error(`Error: Unknown tool requested: ${toolName}`);
    return { content: [{ type: "text", text: `Error: Unknown tool requested: ${toolName}` }] };
  }
  console.log(`Executing tool "${toolName}" with arguments ${JSON.stringify(toolArgs)} and securitySchemes ${JSON.stringify(securitySchemes)}`);
  return await executeApiTool(toolName, toolDefinition, toolArgs ?? {}, securitySchemes, context?.bearerToken);
});



/**
 * Type definition for cached OAuth tokens
 */
interface TokenCacheEntry {
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
 * Executes an API tool with the provided arguments
 * 
 * @param toolName Name of the tool to execute
 * @param definition Tool definition
 * @param toolArgs Arguments provided by the user
 * @param allSecuritySchemes Security schemes from the OpenAPI spec
 * @returns Call tool result
 */
async function executeApiTool(
  toolName: string,
  definition: McpToolDefinition,
  toolArgs: JsonObject,
  allSecuritySchemes: Record<string, any>,
  bearerToken?: string
): Promise<CallToolResult> {
  try {
    // Validate arguments against the input schema
    let validatedArgs: JsonObject;
    try {
      const zodSchema = getZodSchemaFromJsonSchema(definition.inputSchema, toolName);
      const argsToParse = (typeof toolArgs === 'object' && toolArgs !== null) ? toolArgs : {};
      validatedArgs = zodSchema.parse(argsToParse);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const validationErrorMessage = `Invalid arguments for tool '${toolName}': ${error.errors.map(e => `${e.path.join('.')} (${e.code}): ${e.message}`).join(', ')}`;
        return { content: [{ type: 'text', text: validationErrorMessage }] };
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: `Internal error during validation setup: ${errorMessage}` }] };
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
    const requestUrl = API_BASE_URL ? `${API_BASE_URL}${urlPath}` : urlPath;

    // Handle request body if needed
    if (definition.requestBodyContentType && typeof validatedArgs['requestBody'] !== 'undefined') {
      requestBodyData = validatedArgs['requestBody'];
      headers['content-type'] = definition.requestBodyContentType;
    }


    // Apply security requirements if available
    // Security requirements use OR between array items and AND within each object
    const appliedSecurity = definition.securityRequirements?.find(req => {
      // Try each security requirement (combined with OR)
      return Object.entries(req).every(([schemeName, scopesArray]) => {
        const scheme = allSecuritySchemes[schemeName];
        if (!scheme) return false;

        // API Key security (header, query, cookie)
        if (scheme.type === 'apiKey') {
          return !!process.env[`API_KEY_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
        }

        // HTTP security (basic, bearer)
        if (scheme.type === 'http') {
          if (scheme.scheme?.toLowerCase() === 'bearer') {
            // console.log(`Checking BEARER_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`);
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
      // Apply each security scheme from this requirement (combined with AND)
      for (const [schemeName, scopesArray] of Object.entries(appliedSecurity)) {
        const scheme = allSecuritySchemes[schemeName];

        // API Key security
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
              // Add the cookie, preserving other cookies if they exist
              headers['cookie'] = `${scheme.name}=${apiKey}${headers['cookie'] ? `; ${headers['cookie']}` : ''}`;
              console.error(`Applied API key '${schemeName}' in cookie '${scheme.name}'`);
            }
          }
        }
        // HTTP security (Bearer or Basic)
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
    // Log warning if security is required but not available
    else if (definition.securityRequirements?.length > 0) {
      // First generate a more readable representation of the security requirements
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

    // Log request info to stderr (doesn't affect MCP output)
    console.error(`Executing tool "${toolName}": ${config.method} ${config.url}`);

    // Execute the request
    const response = await axios(config);

    // Process and format the response
    let responseText = '';
    const contentType = response.headers['content-type']?.toLowerCase() || '';

    // Handle JSON responses
    if (contentType.includes('application/json') && typeof response.data === 'object' && response.data !== null) {
      try {
        responseText = JSON.stringify(response.data, null, 2);
      } catch (e) {
        responseText = "[Stringify Error]";
      }
    }
    // Handle string responses
    else if (typeof response.data === 'string') {
      responseText = response.data;
    }
    // Handle other response types
    else if (response.data !== undefined && response.data !== null) {
      responseText = String(response.data);
    }
    // Handle empty responses
    else {
      responseText = `(Status: ${response.status} - No body content)`;
    }

    // Return formatted response
    return {
      content: [
        {
          type: "text",
          text: `API Response (Status: ${response.status}):\n${responseText}`
        }
      ],
    };

  } catch (error: unknown) {
    // Handle errors during execution
    let errorMessage: string;

    // Format Axios errors specially
    if (axios.isAxiosError(error)) {
      errorMessage = formatApiError(error);
    }
    // Handle standard errors
    else if (error instanceof Error) {
      errorMessage = error.message;
    }
    // Handle unexpected error types
    else {
      errorMessage = 'Unexpected error: ' + String(error);
    }

    // Log error to stderr
    console.error(`Error during execution of tool '${toolName}':`, errorMessage);

    // Return error message to client
    return { content: [{ type: "text", text: errorMessage }] };
  }
}



/**
 * Formats API errors for better readability
 * 
 * @param error Axios error
 * @returns Formatted error message
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

/**
* Converts a JSON Schema to a Zod schema for runtime validation
* 
* @param jsonSchema JSON Schema
* @param toolName Tool name for error reporting
* @returns Zod schema
*/
function getZodSchemaFromJsonSchema(jsonSchema: any, toolName: string): z.ZodTypeAny {
  if (typeof jsonSchema !== 'object' || jsonSchema === null) {
    return z.object({}).passthrough();
  }
  try {
    const zodSchemaString = jsonSchemaToZod(jsonSchema);
    const zodSchema = eval(zodSchemaString);
    if (typeof zodSchema?.parse !== 'function') {
      throw new Error('Eval did not produce a valid Zod schema.');
    }
    return zodSchema as z.ZodTypeAny;
  } catch (err: any) {
    console.error(`Failed to generate/evaluate Zod schema for '${toolName}':`, err);
    return z.object({}).passthrough();
  }
}


/**
 * Cleanup function for graceful shutdown
 */
async function cleanup() {
  console.error("Shutting down MCP server...");
  process.exit(0);
}


/**
 * Main function to start the server
 */
async function main() {
  // Set up StreamableHTTP transport
  try {
    await setupStreamableHttpServer(server, 3000);
  } catch (error) {
    console.error("Error setting up StreamableHTTP server:", error);
    process.exit(1);
  }
}


// Register signal handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start the server
main().catch((error) => {
  console.error("Fatal error in main execution:", error);
  process.exit(1);
});
