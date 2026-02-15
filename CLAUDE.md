# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Remote MCP (Model Context Protocol) server that bridges Claude/MCP clients to the Docebo Learning Platform API. Uses StreamableHTTP transport over Hono with OAuth 2.0 authentication. Supports multi-tenant deployment via subdomain routing (`{tenant}.mcp.yourdomain.com` → `{tenant}.docebosaas.com`). Tool definitions translate to Docebo REST API calls.

## Commands

```bash
# Build
npm run build                           # Compile TypeScript to ./build

# Dev (auto-rebuild on changes)
npm run dev:hono                        # Start server with tsc-watch

# Start (production)
npm start                               # Start built server

# Test
npm test                                # Run all tests
npm test -- __tests__/auth.test.ts      # Run a single test file
npm run coverage                        # Run tests with coverage report
./scripts/test.sh all                   # Full suite: build + typecheck + tests + coverage
./scripts/test.sh mcp                   # MCP protocol compliance tests only
./scripts/test.sh unit                  # Unit tests only
```

## Architecture

### Server (`src/server/`)

**hono-index.ts** — Entry point. Configures OAuth resource server settings and starts the HTTP server.

**tenant.ts** — Tenant resolution logic. `extractTenant(host)` parses the tenant slug from a `Host` header subdomain. `resolveTenantApiBaseUrl(host, apiBaseUrlEnv)` returns `API_BASE_URL` if set (single-tenant), otherwise constructs `https://{tenant}.docebosaas.com` (multi-tenant).

**core.ts** — Creates the MCP Server instance and registers protocol handlers:
- `ListToolsRequestSchema` / `ListPromptsRequestSchema` — Returns available tools/prompts
- `CallToolRequestSchema` — Executes a tool by: validating args against Zod schemas, binding path/query/header parameters to the URL template, applying the bearer token and `apiBaseUrl` from the request context, and making the HTTP request via axios.
- `GetPromptRequestSchema` — Returns prompt messages with argument interpolation.

**hono-server.ts** — HTTP transport layer. `MCPStreamableHttpServer` class wraps Hono to manage MCP sessions tracked via `mcp-session-id` header. Includes tenant resolution middleware (sets `apiBaseUrl` per-request) and tenant-aware OAuth endpoints. Endpoints: `POST /mcp` (all MCP requests), `GET /health` (health check).

**auth.ts** — In-memory token registry with `registerToken()`/`validateBearerToken()`. Used for authenticating MCP client connections to this server.

### Tool System (`src/server/tools/`)

**index.ts** — Defines `McpToolDefinition` interface: each tool is a data structure describing an API endpoint (name, method, pathTemplate, inputSchema as JSON Schema, executionParameters for parameter binding, securityRequirements).

**courses.ts / enrollments.ts / users.ts / notifications.ts** — Tool definition maps (`Map<string, McpToolDefinition>`) for Docebo API endpoints. Adding new tools means creating a new map file and registering it in core.ts.

### Key Patterns

- **Tool definitions are data, not code** — Each tool is a declarative object with JSON Schema, HTTP method, path template, and parameter bindings. The execution engine in core.ts is generic.
- **Bearer token flow** — Token comes from `extra.authInfo` (set by the OAuth auth middleware) and is passed directly to `executeApiTool`. No env var token storage.
- **Multi-tenant routing** — `apiBaseUrl` is resolved per-request by the tenant middleware (from `Host` subdomain or `API_BASE_URL` fallback), threaded via `req.auth.apiBaseUrl` → `extra.authInfo.apiBaseUrl` → `executeApiTool()`. No global state.
- **Token proxy** — In single-tenant mode with `DOCEBO_CLIENT_ID`/`SECRET`, injects credentials (for public MCP clients). In multi-tenant mode, acts as pass-through forwarding client-provided credentials to the correct tenant's `/oauth2/token`.
- **Session management** — Each MCP client connection gets its own `Server` instance (via factory function) and `StreamableHTTPServerTransport`, tracked by UUID in the `mcp-session-id` HTTP header.

## Environment Variables

### Single-tenant mode (dev)

| Variable | Required | Description |
|---|---|---|
| `API_BASE_URL` | Yes | Docebo instance URL (e.g. `https://acme.docebosaas.com`) |
| `MCP_SERVER_URL` | Yes | Public URL of this server (e.g. ngrok URL) |
| `DOCEBO_CLIENT_ID` | Optional | Enables token proxy with credential injection |
| `DOCEBO_CLIENT_SECRET` | Optional | Enables token proxy with credential injection |
| `PORT` | Optional | Server port (default 3000) |

### Multi-tenant mode (prod)

| Variable | Required | Description |
|---|---|---|
| `API_BASE_URL` | **Unset** | Tenant derived from `Host` subdomain instead |
| `MCP_SERVER_URL` | Yes | Public URL (e.g. `https://mcp.yourdomain.com`) |
| `DOCEBO_CLIENT_ID` | **Unset** | Token proxy acts as pass-through |
| `DOCEBO_CLIENT_SECRET` | **Unset** | Token proxy acts as pass-through |
| `PORT` | Optional | Server port (default 3000) |

Multi-tenant activates when `API_BASE_URL` is not set. Requests to `acme.mcp.yourdomain.com` route API calls to `https://acme.docebosaas.com`.

## Tech Stack

- **Runtime:** Node.js with ES modules (`"type": "module"`)
- **Language:** TypeScript (strict mode, ES2022 target, Node16 module resolution)
- **Server framework:** Hono with `@hono/node-server`
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Validation:** Zod + json-schema-to-zod
- **HTTP client:** axios (for outbound Docebo API calls)
- **Testing:** Vitest with v8 coverage, tests in `__tests__/`
- **Commit style:** Conventional commits (feat:, fix:, chore:, test:, refactor:)
