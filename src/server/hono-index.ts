import { setupStreamableHttpServer, type OAuthResourceConfig } from "./hono-server.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./core.js";

import dotenv from 'dotenv';

dotenv.config();

// Re-export for hono-server.ts (which imports SERVER_NAME / SERVER_VERSION)
export { SERVER_NAME, SERVER_VERSION };

/**
 * MCP Server instance using shared core logic
 */
const server = createServer();

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
  try {
    // Build OAuth resource server config when both env vars are set
    let oauthConfig: OAuthResourceConfig | undefined;
    const mcpServerUrl = process.env.MCP_SERVER_URL;
    const authServerUrl = process.env.DOCEBO_AUTH_SERVER_URL || process.env.API_BASE_URL;

    if (mcpServerUrl && authServerUrl) {
      oauthConfig = { mcpServerUrl, authorizationServerUrl: authServerUrl };
      console.error(`OAuth resource server enabled — AS: ${authServerUrl}`);
    }

    const port = parseInt(process.env.PORT || '3000', 10);
    await setupStreamableHttpServer(server, port, oauthConfig);
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
