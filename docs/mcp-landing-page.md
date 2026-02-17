# Enable AI to interact with your Docebo learning platform.

The Docebo MCP Server connects AI assistants to your learning platform through the [Model Context Protocol](https://modelcontextprotocol.io/) — the open standard for giving AI tools secure, structured access to your data.

Ask questions about learners, pull training reports, search your course catalog, and manage enrollments — all through natural conversation with Claude, Cursor, or any MCP-compatible client.

---

## What can it do?

**Ask about your learners**
"Show me Jane Smith's full training dashboard — what's she completed, what's in progress?"

**Get team training reports**
"Which team members haven't finished their required compliance courses?"

**Search your platform with AI**
"Find everything we have on leadership development" — powered by Docebo's Harmony Search (RAG).

**Manage enrollments by name**
"Enroll John Smith in the Compliance 101 course" — no IDs needed.

**Send notifications**
"Send a training reminder to John Smith"

---

## Available tools

### Workflow tools
High-level operations that combine multiple API calls into a single step.

| Tool | What it does |
|------|-------------|
| **Learner Dashboard** | User profile + all enrollments with progress in one call |
| **Team Training Report** | Team-wide training status with filters and completion stats |
| **Enroll by Name** | Search user and course by name, enroll automatically |
| **Harmony Search** | RAG-powered semantic search across your entire platform |

### Platform tools

| Area | Tools |
|------|-------|
| **Courses** | List and search courses, get course details |
| **Enrollments** | List, create, and remove enrollments; get progress and details |
| **Users** | List and search users, get user profiles |
| **Notifications** | Send training reminders and learning plan notifications |

---

## Connect in seconds

Works with any MCP-compatible client that supports OAuth 2.0 with pre-registeration . No SDK, no custom code.

### Claude Desktop, other clients
TODO: add instructions

Claude handles OAuth authorization automatically.


---

## Secure by design

- **OAuth 2.0** — Industry-standard authentication. Users authorize with their own Docebo credentials. No API keys stored on the server.
- **Per-user permissions** — The AI can only access what the authenticated user can access in Docebo. Your existing role-based access controls apply.

---

## How it works

```
MCP Client (Claude, Cursor, ...)
        ↕  HTTP + OAuth 2.0
   Docebo MCP Server
        ↕  Docebo REST API
   Your Docebo Instance
```

The MCP server translates natural-language tool calls from your AI client into Docebo API requests — handling authentication, parameter validation, pagination, and error formatting so the AI gets clean, structured data back.


---

*Built on the [Model Context Protocol](https://modelcontextprotocol.io/) open standard.*
