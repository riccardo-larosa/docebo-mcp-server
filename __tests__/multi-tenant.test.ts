import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import http from 'node:http';
import { resolveTenantApiBaseUrl } from '../src/server/tenant.js';

// Unique ports to avoid conflicts with other test files
const MULTI_TENANT_PORT = 3097;
const SINGLE_TENANT_PORT = 3096;

function createApp(apiBaseUrlEnv: string | undefined) {
  const app = new Hono();
  app.use('*', cors());

  // Tenant resolution middleware
  app.use('*', async (c, next) => {
    const host = c.req.header('host');
    const apiBaseUrl = resolveTenantApiBaseUrl(host, apiBaseUrlEnv);
    if (!apiBaseUrl) {
      return c.json({ error: 'Could not resolve tenant' }, 400);
    }
    c.set('apiBaseUrl', apiBaseUrl);
    await next();
  });

  app.get('/health', (c) => {
    return c.json({ status: 'OK', apiBaseUrl: c.get('apiBaseUrl') });
  });

  return app;
}

/**
 * Helper that makes an HTTP request with a custom Host header.
 * Node's http module (unlike fetch) allows overriding the Host header.
 */
function requestWithHost(port: number, host: string | undefined): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (host) {
      headers['Host'] = host;
    }
    const req = http.get({ hostname: '127.0.0.1', port, path: '/health', headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });
    req.on('error', reject);
  });
}

describe('Multi-tenant routing (no API_BASE_URL)', () => {
  let server: Server;

  beforeAll(async () => {
    const app = createApp(undefined);
    server = serve({ fetch: app.fetch, port: MULTI_TENANT_PORT }) as unknown as Server;
    await new Promise<void>((resolve) => {
      server.once('listening', resolve);
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('should resolve tenant from Host header subdomain', async () => {
    const { status, body } = await requestWithHost(MULTI_TENANT_PORT, 'acme.mcp.yourdomain.com');
    expect(status).toBe(200);
    expect(body.apiBaseUrl).toBe('https://acme.docebosaas.com');
  });

  it('should resolve different tenants from different Host headers', async () => {
    const { status, body } = await requestWithHost(MULTI_TENANT_PORT, 'corp.mcp.yourdomain.com');
    expect(status).toBe(200);
    expect(body.apiBaseUrl).toBe('https://corp.docebosaas.com');
  });

  it('should return 400 when no tenant can be resolved', async () => {
    const { status, body } = await requestWithHost(MULTI_TENANT_PORT, undefined);
    expect(status).toBe(400);
    expect(body.error).toBe('Could not resolve tenant');
  });
});

describe('Single-tenant fallback (API_BASE_URL set)', () => {
  let server: Server;
  const API_BASE_URL = 'https://mycompany.docebosaas.com';

  beforeAll(async () => {
    const app = createApp(API_BASE_URL);
    server = serve({ fetch: app.fetch, port: SINGLE_TENANT_PORT }) as unknown as Server;
    await new Promise<void>((resolve) => {
      server.once('listening', resolve);
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('should use API_BASE_URL when set regardless of Host header', async () => {
    const { status, body } = await requestWithHost(SINGLE_TENANT_PORT, 'different.mcp.yourdomain.com');
    expect(status).toBe(200);
    expect(body.apiBaseUrl).toBe(API_BASE_URL);
  });

  it('should use API_BASE_URL even for localhost', async () => {
    const { status, body } = await requestWithHost(SINGLE_TENANT_PORT, undefined);
    expect(status).toBe(200);
    expect(body.apiBaseUrl).toBe(API_BASE_URL);
  });
});
