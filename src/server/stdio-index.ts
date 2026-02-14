#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./core.js";
import { getAccessToken } from "./oauth.js";

// No dotenv here — env vars are provided by Claude Desktop config.
// dotenv writes to stdout which breaks the stdio JSON-RPC protocol.

async function main() {
  const apiBaseUrl = process.env.API_BASE_URL;
  const clientId = process.env.DOCEBO_CLIENT_ID;
  const clientSecret = process.env.DOCEBO_CLIENT_SECRET;
  const username = process.env.DOCEBO_USERNAME;
  const password = process.env.DOCEBO_PASSWORD;

  if (!apiBaseUrl || !clientId || !clientSecret || !username || !password) {
    console.error("Missing required environment variables: API_BASE_URL, DOCEBO_CLIENT_ID, DOCEBO_CLIENT_SECRET, DOCEBO_USERNAME, DOCEBO_PASSWORD");
    process.exit(1);
  }

  // Create the MCP server with a dynamic token provider for OAuth
  const server = createServer({
    getAccessToken: () => getAccessToken(apiBaseUrl, clientId, clientSecret, username, password),
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Docebo MCP server running on stdio transport.");
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
