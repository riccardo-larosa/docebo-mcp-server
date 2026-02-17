import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import express from 'express';
import { Server } from 'http';
import { z } from 'zod';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import type { OAuthResourceConfig } from '../src/server/hono-server.js';

const TEST_PORT = 3099;
const MCP_SERVER_URL = `http://localhost:${TEST_PORT}`;
const AUTH_SERVER_URL = 'https://test-instance.docebosaas.com';

describe('OAuth Resource Server', () => {
  let honoServer: ReturnType<typeof serve>;

  beforeAll(async () => {
    const app = new Hono();
    app.use('*', cors());

    const oauthConfig: OAuthResourceConfig = {
      mcpServerUrl: MCP_SERVER_URL,
      authorizationServerUrl: AUTH_SERVER_URL,
    };

    const resourceMetadataUrl = `${MCP_SERVER_URL}/.well-known/oauth-protected-resource`;

    // Health endpoint (no auth)
    app.get('/health', (c) => c.json({ status: 'OK' }));

    // Protected Resource Metadata endpoint
    app.get('/.well-known/oauth-protected-resource', (c) => {
      return c.json({
        resource: oauthConfig.mcpServerUrl,
        authorization_servers: [oauthConfig.authorizationServerUrl],
        scopes_supported: [],
        bearer_methods_supported: ['header'],
      });
    });

    // Bearer auth middleware for /mcp
    app.use('/mcp', async (c, next) => {
      const authHeader = c.req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.text('Unauthorized', 401, {
          'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"`,
        });
      }
      const token = authHeader.slice('Bearer '.length);
      if (!token) {
        return c.text('Unauthorized', 401, {
          'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"`,
        });
      }
      c.set('bearerToken', token);
      await next();
    });

    // Simple MCP echo endpoint for testing authenticated access
    app.post('/mcp', (c) => {
      const token = c.get('bearerToken');
      return c.json({ jsonrpc: '2.0', result: { token_received: !!token }, id: 1 });
    });

    honoServer = serve({ fetch: app.fetch, port: TEST_PORT });
  });

  afterAll(async () => {
    if (honoServer) {
      honoServer.close();
    }
  });

  describe('Protected Resource Metadata (/.well-known/oauth-protected-resource)', () => {
    it('should return metadata with correct authorization server', async () => {
      const res = await fetch(`${MCP_SERVER_URL}/.well-known/oauth-protected-resource`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.resource).toBe(MCP_SERVER_URL);
      expect(body.authorization_servers).toEqual([AUTH_SERVER_URL]);
      expect(body.scopes_supported).toEqual([]);
      expect(body.bearer_methods_supported).toEqual(['header']);
    });

    it('should return JSON content type', async () => {
      const res = await fetch(`${MCP_SERVER_URL}/.well-known/oauth-protected-resource`);
      expect(res.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('Bearer Auth Middleware', () => {
    it('should return 401 when no Authorization header is present', async () => {
      const res = await fetch(`${MCP_SERVER_URL}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
      });

      expect(res.status).toBe(401);
      const wwwAuth = res.headers.get('WWW-Authenticate');
      expect(wwwAuth).toContain('Bearer');
      expect(wwwAuth).toContain('resource_metadata=');
      expect(wwwAuth).toContain('.well-known/oauth-protected-resource');
    });

    it('should return 401 when Authorization header is not Bearer', async () => {
      const res = await fetch(`${MCP_SERVER_URL}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic dGVzdDp0ZXN0',
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
      });

      expect(res.status).toBe(401);
    });

    it('should allow access with valid Bearer token', async () => {
      const res = await fetch(`${MCP_SERVER_URL}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-test-token',
        },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.result.token_received).toBe(true);
    });

    it('should not require auth for health endpoint', async () => {
      const res = await fetch(`${MCP_SERVER_URL}/health`);
      expect(res.status).toBe(200);
    });
  });

  describe('OAuth disabled (no config)', () => {
    let noAuthServer: ReturnType<typeof serve>;
    const NO_AUTH_PORT = 3098;

    beforeAll(async () => {
      const app = new Hono();
      app.use('*', cors());

      // No OAuth middleware — open access
      app.post('/mcp', (c) => {
        return c.json({ jsonrpc: '2.0', result: { open: true }, id: 1 });
      });

      app.get('/.well-known/oauth-protected-resource', (c) => {
        return c.text('Not Found', 404);
      });

      noAuthServer = serve({ fetch: app.fetch, port: NO_AUTH_PORT });
    });

    afterAll(() => {
      if (noAuthServer) noAuthServer.close();
    });

    it('should allow unauthenticated access when OAuth is not configured', async () => {
      const res = await fetch(`http://localhost:${NO_AUTH_PORT}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 }),
      });

      expect(res.status).toBe(200);
    });

    it('should not serve metadata endpoint when OAuth is not configured', async () => {
      const res = await fetch(`http://localhost:${NO_AUTH_PORT}/.well-known/oauth-protected-resource`);
      expect(res.status).toBe(404);
    });
  });
});
