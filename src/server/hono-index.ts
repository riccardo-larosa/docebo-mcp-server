import { setupStreamableHttpServer, type OAuthResourceConfig } from "./hono-server.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./core.js";

import dotenv from 'dotenv';

dotenv.config();

// Re-export for hono-server.ts (which imports SERVER_NAME / SERVER_VERSION)
export { SERVER_NAME, SERVER_VERSION };

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
    // Build OAuth resource server config
    let oauthConfig: OAuthResourceConfig | undefined;
    const mcpServerUrl = process.env.MCP_SERVER_URL;
    const apiBaseUrl = process.env.API_BASE_URL;

    if (mcpServerUrl) {
      oauthConfig = {
        mcpServerUrl,
        // In single-tenant mode, use API_BASE_URL as auth server.
        // In multi-tenant mode, authorizationServerUrl is undefined — derived per-request from tenant.
        authorizationServerUrl: apiBaseUrl,
        clientId: process.env.DOCEBO_CLIENT_ID,
        clientSecret: process.env.DOCEBO_CLIENT_SECRET,
      };
      console.error(`OAuth resource server enabled${apiBaseUrl ? ` — AS: ${apiBaseUrl}` : ' — multi-tenant mode'}`);
      if (oauthConfig.clientId && oauthConfig.clientSecret) {
        console.error(`Token proxy enabled for client: ${oauthConfig.clientId}`);
      }
    }

    const port = parseInt(process.env.PORT || '3000', 10);
    await setupStreamableHttpServer(() => createServer(), port, oauthConfig);
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
