import { setupStreamableHttpServer, type OAuthResourceConfig } from "./hono-server.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./core.js";
import { logger } from "./logger.js";

import dotenv from 'dotenv';

dotenv.config();

// Re-export for hono-server.ts (which imports SERVER_NAME / SERVER_VERSION)
export { SERVER_NAME, SERVER_VERSION };

/**
 * Cleanup function for graceful shutdown
 */
async function cleanup() {
  logger.info({ event: 'server_shutdown' });
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
      logger.info({
        event: 'oauth_config',
        mode: apiBaseUrl ? 'single-tenant' : 'multi-tenant',
        ...(apiBaseUrl && { authorization_server: apiBaseUrl }),
        token_proxy: !!(oauthConfig.clientId && oauthConfig.clientSecret),
      });
    }

    const port = parseInt(process.env.PORT || '3000', 10);
    await setupStreamableHttpServer(() => createServer(), port, oauthConfig);
  } catch (error) {
    logger.error({ event: 'server_startup_error', error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start the server
main().catch((error) => {
  logger.error({ event: 'fatal_error', error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
