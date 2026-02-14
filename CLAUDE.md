# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Remote MCP (Model Context Protocol) server that bridges Claude/MCP clients to the Docebo Learning Platform API. Uses StreamableHTTP transport over Hono with OAuth 2.0 authentication. Tool definitions translate to Docebo REST API calls.

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

**core.ts** — Creates the MCP Server instance and registers protocol handlers:
- `ListToolsRequestSchema` / `ListPromptsRequestSchema` — Returns available tools/prompts
- `CallToolRequestSchema` — Executes a tool by: validating args against Zod schemas, binding path/query/header parameters to the URL template, applying the bearer token from OAuth, and making the HTTP request via axios.
- `GetPromptRequestSchema` — Returns prompt messages with argument interpolation.

**hono-server.ts** — HTTP transport layer. `MCPStreamableHttpServer` class wraps Hono to manage MCP sessions tracked via `mcp-session-id` header. Endpoints: `POST /mcp` (all MCP requests), `GET /health` (health check).

**auth.ts** — In-memory token registry with `registerToken()`/`validateBearerToken()`. Used for authenticating MCP client connections to this server.

### Tool System (`src/server/tools/`)

**index.ts** — Defines `McpToolDefinition` interface: each tool is a data structure describing an API endpoint (name, method, pathTemplate, inputSchema as JSON Schema, executionParameters for parameter binding, securityRequirements).

**courses.ts / enrollments.ts / users.ts / notifications.ts** — Tool definition maps (`Map<string, McpToolDefinition>`) for Docebo API endpoints. Adding new tools means creating a new map file and registering it in core.ts.

### Key Patterns

- **Tool definitions are data, not code** — Each tool is a declarative object with JSON Schema, HTTP method, path template, and parameter bindings. The execution engine in core.ts is generic.
- **Bearer token flow** — Token comes from `extra.authInfo` (set by the OAuth auth middleware) and is passed directly to `executeApiTool`. No env var token storage.
- **Session management** — Each MCP client connection gets its own `Server` instance (via factory function) and `StreamableHTTPServerTransport`, tracked by UUID in the `mcp-session-id` HTTP header.

## Environment Variables

Required: `API_BASE_URL` — Docebo instance URL, `MCP_SERVER_URL` — public URL of this server.
Optional: `DOCEBO_CLIENT_ID`/`DOCEBO_CLIENT_SECRET` (enables token proxy for public MCP clients), `PORT` (default 3000).

## Tech Stack

- **Runtime:** Node.js with ES modules (`"type": "module"`)
- **Language:** TypeScript (strict mode, ES2022 target, Node16 module resolution)
- **Server framework:** Hono with `@hono/node-server`
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Validation:** Zod + json-schema-to-zod
- **HTTP client:** axios (for outbound Docebo API calls)
- **Testing:** Vitest with v8 coverage, tests in `__tests__/`
- **Commit style:** Conventional commits (feat:, fix:, chore:, test:, refactor:)
