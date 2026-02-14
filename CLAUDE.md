# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) server that bridges Claude/MCP clients to the Docebo Learning Platform API. Uses StreamableHTTP transport over Hono, with tool definitions that translate to Docebo REST API calls. Includes an interactive CLI client for testing.

## Commands

```bash
# Build
npm run build                           # Compile TypeScript to ./build

# Dev (auto-rebuild on changes)
npm run dev:hono                        # Start server with tsc-watch

# Test
npm test                                # Run all tests
npm test -- __tests__/auth.test.ts      # Run a single test file
npm run coverage                        # Run tests with coverage report
./scripts/test.sh all                   # Full suite: build + typecheck + tests + coverage
./scripts/test.sh mcp                   # MCP protocol compliance tests only
./scripts/test.sh unit                  # Unit tests only

# Client
npm run start:simpleClient              # Start interactive CLI client
```

## Architecture

### Server (`src/server/`)

**hono-index.ts** — Core MCP server logic. Creates the MCP Server instance and registers two protocol handlers:
- `ListToolsRequestSchema` — Returns available tools from all tool maps
- `CallToolRequestSchema` — Executes a tool by: validating args against auto-generated Zod schemas (from JSON Schema via `json-schema-to-zod`), binding path/query/header parameters to the URL template, applying security credentials from environment variables, and making the HTTP request via axios.

**hono-server.ts** — HTTP transport layer. `MCPStreamableHttpServer` class wraps Hono to manage MCP sessions tracked via `mcp-session-id` header. Endpoints: `POST /mcp` (all MCP requests), `GET /health` (health check).

**auth.ts** — In-memory token registry with `registerToken()`/`validateBearerToken()`. Used for authenticating MCP client connections to this server.

### Tool System (`src/server/tools/`)

**index.ts** — Defines `McpToolDefinition` interface: each tool is a data structure describing an API endpoint (name, method, pathTemplate, inputSchema as JSON Schema, executionParameters for parameter binding, securityRequirements).

**courses.ts / classrooms.ts** — Tool definition maps (`Map<string, McpToolDefinition>`) for Docebo API endpoints. Adding new tools means creating a new map file and registering it in hono-index.ts.

### Client (`src/client/`)

**simpleStreamableHttpClient.ts** — Interactive REPL client with commands: connect, disconnect, list-tools, call-tool, set-token. Manages sessions with resumption tokens.

### Key Patterns

- **Tool definitions are data, not code** — Each tool is a declarative object with JSON Schema, HTTP method, path template, and parameter bindings. The execution engine in hono-index.ts is generic.
- **Bearer token flow** — Tokens flow through the call chain, never via global env vars. HTTP transport: token comes from `extra.authInfo` (set by the auth middleware). Stdio transport: token comes from the `getAccessToken` callback (OAuth password grant). Both paths pass the token directly to `executeApiTool`.
- **JSON Schema → Zod validation** — Tool input schemas are JSON Schema objects; at runtime they're converted to Zod schemas via `json-schema-to-zod` for argument validation before API calls.
- **Session management** — Each MCP client connection gets its own `Server` instance (via factory function) and `StreamableHTTPServerTransport`, tracked by UUID in the `mcp-session-id` HTTP header.

## Environment Variables

Required: `API_BASE_URL` — Docebo instance URL (e.g. `https://mycompany.docebosaas.com`).
Stdio transport: `DOCEBO_CLIENT_ID`, `DOCEBO_CLIENT_SECRET`, `DOCEBO_USERNAME`, `DOCEBO_PASSWORD`.
HTTP transport (OAuth): `MCP_SERVER_URL` (public URL), optionally `DOCEBO_CLIENT_ID`/`DOCEBO_CLIENT_SECRET` for token proxy.
Optional: `PORT` (default 3000).

## Tech Stack

- **Runtime:** Node.js with ES modules (`"type": "module"`)
- **Language:** TypeScript (strict mode, ES2022 target, Node16 module resolution)
- **Server framework:** Hono with `@hono/node-server`
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Validation:** Zod + json-schema-to-zod
- **HTTP client:** axios (for outbound Docebo API calls)
- **Testing:** Vitest with v8 coverage, tests in `__tests__/`
- **Commit style:** Conventional commits (feat:, fix:, chore:, test:, refactor:)
