/**
 * StreamableHTTP server setup for HTTP-based MCP communication using Hono
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { v4 as uuid } from 'uuid';
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InitializeRequestSchema, JSONRPCError } from "@modelcontextprotocol/sdk/types.js";
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import { resolveTenantApiBaseUrl } from './tenant.js';
import { logger } from './logger.js';

// Import server configuration constants
import { SERVER_NAME, SERVER_VERSION } from './hono-index.js';

// Constants
const SESSION_ID_HEADER_NAME = "mcp-session-id";
const JSON_RPC = "2.0";

/**
 * Configuration for the OAuth resource server behavior.
 * When provided, the server acts as an OAuth 2.0 Protected Resource (RFC 9728)
 * and requires Bearer tokens on /mcp requests.
 */
export interface OAuthResourceConfig {
  /** Public URL of this MCP server (e.g. "https://mcp.example.com") */
  mcpServerUrl: string;
  /** Docebo instance URL acting as the OAuth authorization server (undefined in multi-tenant mode) */
  authorizationServerUrl?: string;
}

/**
 * Hono environment type for typed context variables.
 */
type HonoEnv = {
  Variables: {
    bearerToken: string;
    apiBaseUrl: string;
  };
};

/**
 * StreamableHTTP MCP Server handler.
 *
 * Each MCP session needs its own Server instance (the SDK binds one transport
 * per Server). We accept a factory function that creates a fresh Server for
 * every new session while reusing the same tool/prompt registration logic.
 */
class MCPStreamableHttpServer {
  private serverFactory: () => Server;
  // Store active transports by session ID
  transports: {[sessionId: string]: StreamableHTTPServerTransport} = {};
  // Store per-session Server instances so they can be cleaned up
  private servers: {[sessionId: string]: Server} = {};
  sessionTokens: {[sessionId: string]: string} = {};

  constructor(serverFactory: () => Server) {
    this.serverFactory = serverFactory;
  }

  /**
   * Handle GET requests (typically used for static files)
   */
  async handleGetRequest(c: any) {
    return c.text('Method Not Allowed', 405, {
      'Allow': 'POST'
    });
  }

  /**
   * Handle POST requests (all MCP communication)
   */
  async handlePostRequest(c: any) {
    const sessionId = c.req.header(SESSION_ID_HEADER_NAME);

    try {
      const body = await c.req.json();

      // Convert Fetch Request to Node.js req/res
      const { req, res } = toReqRes(c.req.raw);

      // If the auth middleware stored a bearer token, attach AuthInfo to the
      // Node.js request so the SDK propagates it as extra.authInfo to handlers.
      const bearerToken: string | undefined = c.get('bearerToken');
      const apiBaseUrl: string | undefined = c.get('apiBaseUrl');
      if (bearerToken) {
        (req as any).auth = { token: bearerToken, clientId: 'oauth', scopes: [], apiBaseUrl };
      } else {
        // Even without a bearer token, thread apiBaseUrl through auth so the
        // SDK passes it as extra.authInfo to tool handlers.
        (req as any).auth = { apiBaseUrl };
      }

      // Reuse existing transport if we have a session ID
      if (sessionId && this.transports[sessionId]) {
        const transport = this.transports[sessionId];

        // Handle the request with the transport
        await transport.handleRequest(req, res, body);

        // Convert Node.js response back to Fetch Response
        return toFetchResponse(res);
      }

      // Create new transport for initialize requests
      if (!sessionId && this.isInitializeRequest(body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => uuid(),
        });

        // Add error handler
        transport.onerror = (err) => {
          logger.error({ event: 'transport_error', error: String(err) });
        };

        // Create a fresh Server instance for this session and connect it
        const sessionServer = this.serverFactory();
        await sessionServer.connect(transport);

        // Handle the request with the transport
        await transport.handleRequest(req, res, body);

        // Store the transport if we have a session ID
        const newSessionId = transport.sessionId;
        if (newSessionId) {
          // Extract client name from initialize params
          const initBody = Array.isArray(body) ? body[0] : body;
          const clientName = initBody?.params?.clientInfo?.name;

          logger.info({
            event: 'session',
            action: 'created',
            session_id: newSessionId,
            ...(clientName && { client: clientName }),
          });

          this.transports[newSessionId] = transport;
          this.servers[newSessionId] = sessionServer;

          // Set up clean-up for when the transport is closed
          transport.onclose = () => {
            logger.info({ event: 'session', action: 'closed', session_id: newSessionId });
            delete this.transports[newSessionId];
            delete this.servers[newSessionId];
          };
        }

        // Convert Node.js response back to Fetch Response
        return toFetchResponse(res);
      }

      // Invalid request (no session ID and not initialize)
      return c.json(
        this.createErrorResponse("Bad Request: invalid session ID or method."),
        400
      );
    } catch (error) {
      logger.error({
        event: 'mcp_request_error',
        session_id: sessionId ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        this.createErrorResponse("Internal server error."),
        500
      );
    }
  }

  /**
   * Create a JSON-RPC error response
   * @param message Error message
   * @param code Error code (default: -32000)
   */
  private createErrorResponse(message: string, code: number = -32000): JSONRPCError {
    return {
      jsonrpc: JSON_RPC,
      error: {
        code: code,
        message: message,
      },
      id: uuid(),
    };
  }

  /**
   * Check if the request is an initialize request
   */
  private isInitializeRequest(body: any): boolean {
    const isInitial = (data: any) => {
      return InitializeRequestSchema.safeParse(data).success;
    };

    if (Array.isArray(body)) {
      return body.some(request => isInitial(request));
    }

    return isInitial(body);
  }
}

/**
 * Sets up a web server for the MCP server using StreamableHTTP transport
 *
 * @param serverFactory Factory function that creates a new MCP Server instance per session
 * @param port The port to listen on (default: 3000)
 * @param oauthConfig Optional OAuth resource server configuration
 * @returns The Hono app instance
 */
export async function setupStreamableHttpServer(serverFactory: () => Server, port = 3000, oauthConfig?: OAuthResourceConfig) {
  // Create Hono app
  const app = new Hono<HonoEnv>();

  // Enable CORS
  app.use('*', cors());

  // Tenant resolution middleware — sets apiBaseUrl on context
  const apiBaseUrlEnv = process.env.API_BASE_URL;
  app.use('*', async (c, next) => {
    const host = c.req.header('host');
    const apiBaseUrl = resolveTenantApiBaseUrl(host, apiBaseUrlEnv);
    if (!apiBaseUrl) {
      return c.text('Bad Request: cannot resolve tenant', 400);
    }
    c.set('apiBaseUrl', apiBaseUrl);
    await next();
  });

  // Create MCP handler
  const mcpHandler = new MCPStreamableHttpServer(serverFactory);

  // Add a simple health check endpoint
  app.get('/health', (c) => {
    return c.json({ status: 'OK', server: SERVER_NAME, version: SERVER_VERSION });
  });

  // --- OAuth 2.0 Protected Resource metadata & auth middleware ---
  if (oauthConfig) {
    const resourceMetadataUrl = `${oauthConfig.mcpServerUrl.replace(/\/+$/, '')}/.well-known/oauth-protected-resource`;

    const mcpBase = oauthConfig.mcpServerUrl.replace(/\/+$/, '');

    // Helper: resolve the auth server base URL for this request
    const getAuthServerBase = (c: any): string => {
      if (oauthConfig!.authorizationServerUrl) {
        return oauthConfig!.authorizationServerUrl.replace(/\/+$/, '');
      }
      // Multi-tenant: derive from apiBaseUrl (set by tenant middleware)
      return (c.get('apiBaseUrl') as string).replace(/\/+$/, '');
    };

    // RFC 9728 — Protected Resource Metadata
    app.get('/.well-known/oauth-protected-resource', (c) => {
      return c.json({
        resource: oauthConfig.mcpServerUrl,
        authorization_servers: [mcpBase],
        scopes_supported: [],
        bearer_methods_supported: ['header'],
      });
    });

    // RFC 8414 — Authorization Server Metadata
    app.get('/.well-known/oauth-authorization-server', (c) => {
      const authServerBase = getAuthServerBase(c);

      return c.json({
        issuer: authServerBase,
        authorization_endpoint: `${authServerBase}/oauth2/authorize`,
        token_endpoint: `${mcpBase}/oauth/token`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        scopes_supported: [],
      });
    });

    // Token proxy — forwards client-provided credentials to the correct tenant's token endpoint
    app.post('/oauth/token', async (c) => {
      const start = Date.now();
      try {
        const authServerBase = getAuthServerBase(c);
        const body = await c.req.text();

        const upstream = await fetch(`${authServerBase}/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });

        const responseBody = await upstream.text();

        const params = new URLSearchParams(body);
        logger.info({
          event: 'token_proxy',
          grant_type: params.get('grant_type'),
          upstream_status: upstream.status,
          duration_ms: Date.now() - start,
        });

        return new Response(responseBody, {
          status: upstream.status,
          headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
        });
      } catch (err) {
        logger.error({
          event: 'token_proxy',
          duration_ms: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        });
        return c.json({ error: 'server_error', error_description: 'Token proxy failed' }, 500);
      }
    });

    // Bearer auth middleware for /mcp routes
    app.use('/mcp', async (c, next) => {
      const authHeader = c.req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.text('Unauthorized', 401, {
          'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"`,
        });
      }

      const token = authHeader.slice('Bearer '.length);
      if (!token) {
        return c.text('Unauthorized', 401, {
          'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"`,
        });
      }

      // Store the token so the MCP handler can pass it to tool execution
      c.set('bearerToken', token);
      await next();
    });
  }

  // Main MCP endpoint supporting both GET and POST
  app.get("/mcp", (c) => mcpHandler.handleGetRequest(c));
  app.post("/mcp", (c) => mcpHandler.handlePostRequest(c));

  // Static files for the web client (if any)
  app.get('/*', async (c) => {
    const filePath = c.req.path === '/' ? '/index.html' : c.req.path;
    try {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const publicPath = path.join(__dirname, '..', 'public');
      const fullPath = path.join(publicPath, filePath);
      // Simple security check to prevent directory traversal
      if (!fullPath.startsWith(publicPath)) {
        return c.text('Forbidden', 403);
      }

      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          const content = fs.readFileSync(fullPath);

          // Set content type based on file extension
          const ext = path.extname(fullPath).toLowerCase();
          let contentType = 'text/plain';

          switch (ext) {
            case '.html': contentType = 'text/html'; break;
            case '.css': contentType = 'text/css'; break;
            case '.js': contentType = 'text/javascript'; break;
            case '.json': contentType = 'application/json'; break;
            case '.png': contentType = 'image/png'; break;
            case '.jpg': contentType = 'image/jpeg'; break;
            case '.svg': contentType = 'image/svg+xml'; break;
          }

          return new Response(content, {
            headers: { 'Content-Type': contentType }
          });
        }
      } catch (err) {
        // File not found
        return c.text('Not Found', 404);
      }
    } catch (err) {
      logger.error({ event: 'static_file_error', path: filePath, error: String(err) });
      return c.text('Internal Server Error', 500);
    }

    return c.text('Not Found', 404);
  });

  // Start the server
  serve({
    fetch: app.fetch,
    port
  }, (info) => {
    logger.info({
      event: 'server_started',
      port: info.port,
      mcp_endpoint: `http://localhost:${info.port}/mcp`,
      health_endpoint: `http://localhost:${info.port}/health`,
    });
  });

  return app;
}
