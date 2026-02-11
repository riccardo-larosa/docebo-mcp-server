import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./core.js";
import { getAccessToken } from "./oauth.js";

import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const apiBaseUrl = process.env.API_BASE_URL;
  const clientId = process.env.DOCEBO_CLIENT_ID;
  const clientSecret = process.env.DOCEBO_CLIENT_SECRET;

  if (!apiBaseUrl || !clientId || !clientSecret) {
    console.error("Missing required environment variables: API_BASE_URL, DOCEBO_CLIENT_ID, DOCEBO_CLIENT_SECRET");
    process.exit(1);
  }

  // Obtain (or load cached) access token via OAuth
  const accessToken = await getAccessToken(apiBaseUrl, clientId, clientSecret);
  process.env.BEARER_TOKEN_BEARERAUTH = accessToken;

  // Create the MCP server with a dynamic token provider for refresh
  const server = createServer({
    getAccessToken: () => getAccessToken(apiBaseUrl, clientId, clientSecret),
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
