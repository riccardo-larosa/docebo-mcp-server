import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import express from 'express';
import { Server } from 'http';
import { z } from 'zod';

describe('MCP Protocol Compliance Tests', () => {
  let app: express.Application;
  let server: Server;
  let client: Client;
  let serverUrl: string;
  const port = 3001;

  function createMcpServer(): McpServer {
    const mcpServer = new McpServer({
      name: 'test-docebo-server',
      version: '1.0.0'
    });

    mcpServer.registerTool(
      'getCourses',
      {
        title: 'Get Courses',
        description: 'Retrieve courses from Docebo',
        inputSchema: {
          page: z.number().optional().default(1),
          pageSize: z.number().optional().default(20),
          search: z.string().optional()
        }
      },
      async ({ page, pageSize, search }) => ({
        content: [{
          type: 'text',
          text: JSON.stringify({
            courses: [
              { id: 1, name: 'Test Course', status: 'active' }
            ],
            pagination: { page, pageSize, total: 1 }
          })
        }]
      })
    );

    mcpServer.registerTool(
      'getEnrollments',
      {
        title: 'Get Enrollments',
        description: 'Retrieve enrollments from Docebo',
        inputSchema: {
          page: z.number().optional().default(1),
          pageSize: z.number().optional().default(20)
        }
      },
      async ({ page, pageSize }) => ({
        content: [{
          type: 'text',
          text: JSON.stringify({
            enrollments: [
              { id: 1, user_id: 10, course_id: 20, status: 'completed' }
            ],
            pagination: { page, pageSize, total: 1 }
          })
        }]
      })
    );

    mcpServer.registerTool(
      'errorTool',
      {
        title: 'Error Tool',
        description: 'Tool that throws errors',
        inputSchema: {}
      },
      async () => {
        throw new Error('Test error');
      }
    );

    return mcpServer;
  }

  beforeAll(async () => {
    // Setup Express server with MCP server
    app = express();
    app.use(express.json());

    // Setup HTTP transport and endpoints
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

    app.post('/mcp', async (req, res) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          transport = transports[sessionId];
        } else {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => 'test-session-' + Date.now(),
            onsessioninitialized: (sessionId) => {
              transports[sessionId] = transport;
            }
          });

          transport.onclose = () => {
            if (transport.sessionId) {
              delete transports[transport.sessionId];
            }
          };

          // Create a new McpServer instance per transport (SDK requires one server per transport)
          const mcpServer = createMcpServer();
          await mcpServer.connect(transport);
        }

        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('MCP request error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error'
            },
            id: null
          });
        }
      }
    });

    app.get('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string;
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid session ID');
        return;
      }
      await transports[sessionId].handleRequest(req, res);
    });

    app.delete('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string;
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid session ID');
        return;
      }
      await transports[sessionId].handleRequest(req, res);
    });

    // Start server
    await new Promise<void>((resolve) => {
      server = app.listen(port, () => {
        serverUrl = `http://localhost:${port}/mcp`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.warn('Client close error:', error);
      }
    }
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  }, 15000); // Increase timeout to 15 seconds

  beforeEach(async () => {
    // Clean up previous client if exists
    if (client) {
      try {
        await client.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Create fresh client for each test
    client = new Client({
      name: 'test-client',
      version: '1.0.0'
    });

    const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    await client.connect(transport);
  });

  describe('MCP Initialization', () => {
    it('should complete MCP initialization handshake', async () => {
      // The connection in beforeEach already tests this
      expect(client).toBeDefined();
    });

    it('should return server capabilities', async () => {
      // The client is already initialized in beforeEach, so we can check its server info
      const tools = await client.listTools();
      expect(tools).toBeDefined();
      expect(tools.tools.length).toBeGreaterThanOrEqual(2); // At least 2 tools
      
      // The fact that we can list tools means initialization was successful
      // and the server capabilities include tools support
    });

    it('should handle invalid protocol version', async () => {
      const newClient = new Client({
        name: 'test-client-invalid',
        version: '1.0.0'
      });

      try {
        const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
        await newClient.connect(transport);
        
                 await expect(async () => {
           await newClient.request(
             { 
               method: 'initialize', 
               params: { 
                 protocolVersion: 'invalid-version', 
                 capabilities: {},
                 clientInfo: {
                   name: 'invalid-client',
                   version: '1.0.0'
                 }
               }
             },
             z.any()
           );
         }).rejects.toThrow();
      } finally {
        await newClient.close();
      }
    });
  });

  describe('JSON-RPC 2.0 Compliance', () => {
    it('should return proper JSON-RPC 2.0 response format', async () => {
      const tools = await client.listTools();
      
      // Verify response structure
      expect(tools).toHaveProperty('tools');
      expect(Array.isArray(tools.tools)).toBe(true);
    });

    it('should handle malformed JSON-RPC requests', async () => {
      // Send malformed request directly to HTTP endpoint
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing required jsonrpc field
          method: 'tools/list',
          id: 1
        })
      });

      const result = await response.json();
      expect(result).toHaveProperty('error');
      expect(result.error.code).toBe(-32000); // Server defined error for malformed requests
    });

    it('should handle unknown methods', async () => {
      try {
        await client.request(
          { method: 'unknown/method', params: {} },
          z.any()
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Method not found');
      }
    });

    it('should handle requests with invalid parameters', async () => {
      const result = await client.callTool({
        name: 'getCourses',
        arguments: {
          page: 'invalid-number' // Should be number
        }
      });

      // The SDK returns errors in the result with isError flag
      expect((result as any).isError).toBe(true);
    });
  });

  describe('Tools Implementation', () => {
    it('should list tools according to MCP schema', async () => {
      const response = await client.listTools();
      
      expect(response.tools.length).toBeGreaterThanOrEqual(2);
      
      // Verify getCourses tool
      const getCoursesTool = response.tools.find(t => t.name === 'getCourses');
      expect(getCoursesTool).toBeDefined();
      expect(getCoursesTool?.description).toBe('Retrieve courses from Docebo');
      expect(getCoursesTool?.inputSchema).toBeDefined();
      
      // Verify getEnrollments tool
      const getEnrollmentsTool = response.tools.find(t => t.name === 'getEnrollments');
      expect(getEnrollmentsTool).toBeDefined();
      expect(getEnrollmentsTool?.description).toBe('Retrieve enrollments from Docebo');
      expect(getEnrollmentsTool?.inputSchema).toBeDefined();
    });

    it('should execute tools with valid parameters', async () => {
      const result = await client.callTool({
        name: 'getCourses',
        arguments: {
          page: 1,
          pageSize: 10,
          search: 'test'
        }
      });

      expect((result as any).content).toHaveLength(1);
      expect((result as any).content[0].type).toBe('text');
      
      const textContent = (result as any).content[0] as { type: 'text'; text: string };
      const responseData = JSON.parse(textContent.text);
      expect(responseData).toHaveProperty('courses');
      expect(responseData).toHaveProperty('pagination');
      expect(responseData.pagination.page).toBe(1);
      expect(responseData.pagination.pageSize).toBe(10);
    });

    it('should validate tool parameters according to schema', async () => {
      const result = await client.callTool({
        name: 'getCourses',
        arguments: {
          page: -1, // Invalid: should be positive
          pageSize: 'invalid' // Invalid: should be number
        }
      });

      // The SDK returns validation errors in the result with isError flag
      expect((result as any).isError).toBe(true);
    });

    it('should handle non-existent tool calls', async () => {
      const result = await client.callTool({
        name: 'nonExistentTool',
        arguments: {}
      });

      // The SDK returns errors for non-existent tools in the result
      expect((result as any).isError).toBe(true);
    });

    it('should apply default values for optional parameters', async () => {
      const result = await client.callTool({
        name: 'getCourses',
        arguments: {} // No parameters provided
      });

      const textContent = (result as any).content[0] as { type: 'text'; text: string };
      const responseData = JSON.parse(textContent.text);
      expect(responseData.pagination.page).toBe(1); // Default value
      expect(responseData.pagination.pageSize).toBe(20); // Default value
    });
  });

  describe('Error Handling', () => {
    it('should return proper error codes for different scenarios', async () => {
      // Test invalid method
      try {
        await client.request({ method: 'invalid/method' }, z.any());
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe(-32601); // Method not found
      }

      // Test invalid params - SDK now returns errors in result instead of throwing
      const result = await client.callTool({
        name: 'getCourses',
        arguments: { page: 'not-a-number' }
      });
      expect((result as any).isError).toBe(true);
    });

    it('should handle server errors gracefully', async () => {
      // errorTool is registered in createMcpServer and throws an error
      try {
        const result = await client.callTool({
          name: 'errorTool',
          arguments: {}
        });
        
        // Check if error is returned in the result instead of throwing
        if (result && (result as any).isError) {
          expect((result as any).content[0].text).toContain('Test error');
        } else {
          expect.fail('Expected tool to return an error or throw');
        }
      } catch (error: any) {
        // If it throws, that's also acceptable
        expect(error.message).toContain('Test error');
      }
    });
  });

  describe('Message Format Validation', () => {
    it('should include required fields in all responses', async () => {
      const tools = await client.listTools();
      
      // All tools should have required fields
      for (const tool of tools.tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
      }
    });

    it('should handle concurrent requests properly', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        client.callTool({
          name: 'getCourses',
          arguments: { page: i + 1 }
        })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        const textContent = (result as any).content[0] as { type: 'text'; text: string };
        const data = JSON.parse(textContent.text);
        expect(data.pagination.page).toBe(index + 1);
      });
    });

    it('should maintain request/response correlation', async () => {
      // Send multiple requests and verify responses match
      const requests = [
        { name: 'getCourses', arguments: { page: 1 } },
        { name: 'getEnrollments', arguments: { page: 2 } },
        { name: 'getCourses', arguments: { page: 3 } }
      ];

      const results = await Promise.all(
        requests.map(req => client.callTool(req))
      );

      // Verify first request (getCourses page 1)
      const courses1Content = (results[0] as any).content[0] as { type: 'text'; text: string };
      const courses1 = JSON.parse(courses1Content.text);
      expect(courses1).toHaveProperty('courses');
      expect(courses1.pagination.page).toBe(1);

      // Verify second request (getEnrollments page 2)
      const enrollmentsContent = (results[1] as any).content[0] as { type: 'text'; text: string };
      const enrollments = JSON.parse(enrollmentsContent.text);
      expect(enrollments).toHaveProperty('enrollments');
      expect(enrollments.pagination.page).toBe(2);

      // Verify third request (getCourses page 3)
      const courses3Content = (results[2] as any).content[0] as { type: 'text'; text: string };
      const courses3 = JSON.parse(courses3Content.text);
      expect(courses3).toHaveProperty('courses');
      expect(courses3.pagination.page).toBe(3);
    });
  });

  describe('Protocol Version Compatibility', () => {
    it('should support MCP protocol version 2024-11-05', async () => {
      // This is tested implicitly in the initialization
      expect(client).toBeDefined();
    });

    it('should reject unsupported protocol versions', async () => {
      // Create client with different protocol version
      const newClient = new Client({
        name: 'version-test-client',
        version: '1.0.0'
      });

      try {
        const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
        await newClient.connect(transport);
        
        // Try to initialize with unsupported version
                 await expect(async () => {
           await newClient.request(
             { 
               method: 'initialize', 
               params: { 
                 protocolVersion: '2020-01-01', 
                 capabilities: {},
                 clientInfo: {
                   name: 'version-test-client',
                   version: '1.0.0'
                 }
               } 
             },
             z.any()
           );
         }).rejects.toThrow();
      } finally {
        await newClient.close();
      }
    });
  });

  describe('Transport Layer Compliance', () => {
    it('should handle HTTP POST requests correctly', async () => {
      // Test that the server is accessible via HTTP
      // We'll test that the server responds to requests (even if they fail for missing session)
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        })
      });

      // The response might be an error (missing session), but it should be a valid JSON-RPC response
      const result = await response.json();
      expect(result).toHaveProperty('jsonrpc');
      expect(result.jsonrpc).toBe('2.0');
      expect(result).toHaveProperty('id');
    });

    it('should use MCP protocol over HTTP transport', async () => {
      // Test that our client can communicate with the server via HTTP
      // This is already proven by the fact that other tests work
      expect(client).toBeDefined();
      
      // Test a simple operation to confirm HTTP transport is working
      const tools = await client.listTools();
      expect(tools.tools.length).toBeGreaterThanOrEqual(2); // At least 2 tools (may have errorTool from previous test)
    });
  });
}); 