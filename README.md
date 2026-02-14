# Docebo MCP Server

An [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) server that bridges Claude and other MCP clients to the [Docebo Learning Platform API](https://www.docebo.com/).

**What is MCP?**

[MCP](https://modelcontextprotocol.io/) is an open standard that lets AI models interact with external tools and data through a consistent interface. This server gives any MCP-compatible client (Claude Desktop, Claude Code, Cursor, and [others](https://modelcontextprotocol.io/clients)) the ability to read and manage your Docebo learning platform.

## Quick Start

```bash
# Run directly with npx (no install needed)
npx -y docebo-mcp-server

# Or install globally
npm install -g docebo-mcp-server
docebo-mcp-server
```

## Prerequisites

- Node.js >= 18
- A Docebo platform instance with API credentials (OAuth client ID/secret + user credentials)

## Setup

### Claude Desktop

Add the following to your Claude Desktop config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "docebo": {
      "command": "npx",
      "args": ["-y", "docebo-mcp-server"],
      "env": {
        "API_BASE_URL": "https://your-instance.docebosaas.com",
        "DOCEBO_CLIENT_ID": "your-client-id",
        "DOCEBO_CLIENT_SECRET": "your-client-secret",
        "DOCEBO_USERNAME": "your-username",
        "DOCEBO_PASSWORD": "your-password"
      }
    }
  }
}
```

Restart Claude Desktop after saving. The server will appear in the tools menu.

### Claude Code

```bash
claude mcp add docebo -- npx -y docebo-mcp-server
```

Then set the required environment variables in your shell before launching Claude Code, or use a `.env`-style approach supported by your shell.

## Example Usage

Once set up, try these example prompts:

### Track Learner Progress

- Show me the progress for user 12345 across all their courses.
- Which courses has Jane Smith not completed yet?
- Summarize the enrollment status for the "Onboarding" course.

### Manage Enrollments

- Enroll user 12345 in the "Compliance Training" course.
- List all enrollments for course 456.
- Remove user 67890 from the "Leadership Workshop" course.

### Search Courses

- Find all courses related to "leadership".
- Show me the details for course 456.
- List courses sorted by name.

### Send Notifications

- Send a training reminder email to user 12345.
- Trigger a learning plan notification for user 67890.

## Tools

### Courses

| Tool | Method | Description |
|------|--------|-------------|
| `list-all-courses` | GET | List and search courses with filters (name, category, status, sorting) |
| `get-a-course` | GET | Get full details for a single course by ID |

### Enrollments

| Tool | Method | Description |
|------|--------|-------------|
| `list-enrollments` | GET | List enrollments with optional user/course/status filters |
| `get-enrollment-details` | GET | Get detailed enrollment info for a specific course + user |
| `get-user-progress` | GET | Get all enrollments for a user (progress summary) |
| `enroll-user` | POST | Enroll a user into a course |
| `unenroll-user` | DELETE | Remove a user's enrollment from a course |

### Users

| Tool | Method | Description |
|------|--------|-------------|
| `list-users` | GET | List platform users with pagination |
| `get-user` | GET | Get details for a single user by ID |

### Notifications

| Tool | Method | Description |
|------|--------|-------------|
| `send-training-reminder` | POST | Send a custom email to a user |
| `send-learning-plan-notification` | POST | Trigger a learning plan notification for a user |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_BASE_URL` | Yes | Your Docebo instance URL (e.g., `https://your-instance.docebosaas.com`) |
| `DOCEBO_CLIENT_ID` | stdio | OAuth client ID |
| `DOCEBO_CLIENT_SECRET` | stdio | OAuth client secret |
| `DOCEBO_USERNAME` | stdio | Docebo username for OAuth password grant |
| `DOCEBO_PASSWORD` | stdio | Docebo password for OAuth password grant |
| `MCP_SERVER_URL` | HTTP | Public URL of this server (enables OAuth resource server) |
| `PORT` | No | Server port (default: 3000) |
| `LOG_LEVEL` | No | Log level (default: info) |

## Development

### HTTP Server

The server also supports Streamable HTTP transport for remote/web clients:

```bash
npm run dev:hono
```

The server listens on port 3000 by default and exposes the MCP endpoint at `/mcp`.

#### HTTP API

- **POST `/mcp`** — Client requests (including `initialize`)
- **GET `/mcp`** — SSE connection for server-to-client notifications
- **DELETE `/mcp`** — Terminate the MCP session
- **GET `/health`** — Health check

Sessions are tracked via the `mcp-session-id` HTTP header.

### Testing

```bash
npm test                                # All tests
npm run coverage                        # Tests with coverage
npm run test:contract                   # API contract tests (requires credentials)
```

### Debugging

Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector
```

Or the built-in CLI client:

```bash
npm run start:simpleClient
```

### Architecture

```mermaid
graph LR
    subgraph "Your Computer"
        C1[MCP Host w/ Client]
        S1[MCP Server]
    end

    subgraph "Remote Servers"
        API1[Docebo API]
    end

    C1 <--> S1
    S1 <--> API1

  style C1 fill:#2e7d32,color:#ffffff
  style S1 fill:#f57c00,color:#ffffff
  style API1 fill:#c2185b,color:#ffffff
```

Tool definitions are declarative data structures (not code). Each tool specifies an HTTP method, path template, parameter bindings, and JSON Schema. The execution engine in `core.ts` handles validation, URL construction, auth, and HTTP calls generically.
