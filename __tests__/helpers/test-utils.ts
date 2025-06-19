import { vi } from 'vitest';
import type { McpToolDefinition } from '../../src/server/tools/index.js';

/**
 * Test utility functions for MCP server testing
 */

/**
 * Creates a mock request object with headers
 */
export function createMockRequest(headers: Record<string, string | string[]> = {}) {
  return {
    headers: {
      'content-type': 'application/json',
      ...headers
    }
  };
}

/**
 * Creates a mock HTTP response object
 */
export function createMockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    on: vi.fn()
  };
  
  return res;
}

/**
 * Creates a test tool definition
 */
export function createTestToolDefinition(overrides: Partial<McpToolDefinition> = {}): McpToolDefinition {
  return {
    name: 'test-tool',
    description: 'A test tool for testing purposes',
    inputSchema: {
      type: 'object',
      properties: {
        param1: { type: 'string' },
        param2: { type: 'string', optional: true }
      },
      required: ['param1']
    },
    method: 'get',
    pathTemplate: 'test/v1/endpoint/{param1}',
    executionParameters: [
      { name: 'param1', in: 'path' },
      { name: 'param2', in: 'query' }
    ],
    requestBodyContentType: undefined,
    securityRequirements: [{ 'bearerAuth': [] }],
    ...overrides
  };
}

/**
 * Creates a test MCP request
 */
export function createMcpRequest(method: string, params: any = {}) {
  return {
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 10000),
    method,
    params
  };
}

/**
 * Creates a test bearer token header
 */
export function createBearerTokenHeader(token: string) {
  return `Bearer ${token}`;
}

/**
 * Environment variable utilities for testing
 */
export class TestEnv {
  private originalEnv: Record<string, string | undefined> = {};
  
  /**
   * Sets environment variables for testing and stores originals
   */
  set(vars: Record<string, string>) {
    Object.keys(vars).forEach(key => {
      this.originalEnv[key] = process.env[key];
      process.env[key] = vars[key];
    });
  }
  
  /**
   * Restores original environment variables
   */
  restore() {
    Object.keys(this.originalEnv).forEach(key => {
      if (this.originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = this.originalEnv[key];
      }
    });
    this.originalEnv = {};
  }
}

/**
 * Axios mock helpers
 */
export function createAxiosMock() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    defaults: {
      headers: {
        common: {}
      }
    }
  };
}

/**
 * Creates a successful axios response
 */
export function createAxiosResponse(data: any, status = 200) {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {
      'content-type': 'application/json'
    },
    config: {}
  };
}

/**
 * Creates an axios error
 */
export function createAxiosError(message: string, status = 500, data?: any) {
  const error = new Error(message) as any;
  error.response = {
    status,
    statusText: status === 404 ? 'Not Found' : 'Internal Server Error',
    data: data || { error: message },
    headers: {}
  };
  error.isAxiosError = true;
  return error;
}

/**
 * Validates JSON-RPC response format
 */
export function isValidJsonRpcResponse(response: any): boolean {
  return (
    typeof response === 'object' &&
    response !== null &&
    response.jsonrpc === '2.0' &&
    ('result' in response || 'error' in response) &&
    'id' in response
  );
}

/**
 * Validates JSON-RPC error format
 */
export function isValidJsonRpcError(response: any): boolean {
  return (
    isValidJsonRpcResponse(response) &&
    'error' in response &&
    typeof response.error === 'object' &&
    typeof response.error.code === 'number' &&
    typeof response.error.message === 'string'
  );
} 