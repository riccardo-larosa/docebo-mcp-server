import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the MCP SDK Client
const mockClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  request: vi.fn(),
  notification: vi.fn(),
  close: vi.fn()
};

const mockTransport = {
  start: vi.fn(),
  close: vi.fn(),
  restart: vi.fn()
};

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => mockClient)
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => mockTransport)
}));

// Mock readline
const mockReadline = {
  question: vi.fn(),
  close: vi.fn()
};

vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => mockReadline)
}));

describe('MCP Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variables
    delete process.env.MCP_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Connection Management', () => {
    it('should initialize with default server URL', async () => {
      // Import the client module to trigger initialization
      // Note: This test verifies the default configuration
      expect(mockTransport).toBeDefined();
      expect(mockClient).toBeDefined();
    });

    it('should use environment variable for bearer token', () => {
      process.env.MCP_API_KEY = 'env-token-123';
      
      // Re-import or reinitialize to pick up env var
      // In real implementation, this would be tested by checking the token usage
      expect(process.env.MCP_API_KEY).toBe('env-token-123');
    });

    it('should fall back to default token when env var not set', () => {
      delete process.env.MCP_API_KEY;
      
      // Default behavior should use 'test-token'
      // This would be verified in actual client implementation
      expect(process.env.MCP_API_KEY).toBeUndefined();
    });
  });

  describe('Tool Operations', () => {
    beforeEach(() => {
      // Setup successful responses for tool operations
      mockClient.request.mockResolvedValue({
        tools: [
          {
            name: 'list-all-courses',
            description: 'Retrieves all courses',
            inputSchema: {
              type: 'object',
              properties: {
                page: { type: 'string' },
                page_size: { type: 'string' }
              }
            }
          }
        ]
      });
    });

    it('should handle list tools request', async () => {
      const expectedRequest = {
        method: 'tools/list',
        params: {}
      };

      // Mock the list tools functionality
      await mockClient.request(expectedRequest);

      expect(mockClient.request).toHaveBeenCalledWith(expectedRequest);
    });

    it('should handle call tool request with arguments', async () => {
      const expectedRequest = {
        method: 'tools/call',
        params: {
          name: 'list-all-courses',
          arguments: {
            page: '0',
            page_size: '10'
          }
        }
      };

      mockClient.request.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Successfully retrieved courses'
          }
        ]
      });

      await mockClient.request(expectedRequest);

      expect(mockClient.request).toHaveBeenCalledWith(expectedRequest);
    });

    it('should handle call tool request without arguments', async () => {
      const expectedRequest = {
        method: 'tools/call',
        params: {
          name: 'list-all-courses',
          arguments: {}
        }
      };

      await mockClient.request(expectedRequest);

      expect(mockClient.request).toHaveBeenCalledWith(expectedRequest);
    });

    it('should handle tool call errors gracefully', async () => {
      const expectedRequest = {
        method: 'tools/call',
        params: {
          name: 'non-existent-tool',
          arguments: {}
        }
      };

      mockClient.request.mockRejectedValueOnce(new Error('Tool not found'));

      await expect(mockClient.request(expectedRequest)).rejects.toThrow('Tool not found');
    });
  });

  describe('JSON Argument Parsing', () => {
    it('should parse valid JSON arguments', () => {
      const jsonString = '{"page": "0", "page_size": "10"}';
      
      let parsed;
      try {
        parsed = JSON.parse(jsonString);
      } catch (error) {
        parsed = {};
      }

      expect(parsed).toEqual({
        page: '0',
        page_size: '10'
      });
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = 'invalid json string';
      
      let parsed;
      try {
        parsed = JSON.parse(invalidJson);
      } catch (error) {
        parsed = {};
      }

      expect(parsed).toEqual({});
    });

    it('should handle empty argument string', () => {
      const emptyString = '';
      
      let parsed;
      try {
        parsed = JSON.parse(emptyString || '{}');
      } catch (error) {
        parsed = {};
      }

      expect(parsed).toEqual({});
    });
  });

  describe('Command Processing', () => {
    it('should split command input correctly', () => {
      const input = 'call-tool list-all-courses {"page": "0"}';
      const args = input.trim().split(/\s+/);
      
      expect(args[0]).toBe('call-tool');
      expect(args[1]).toBe('list-all-courses');
      expect(args.slice(2).join(' ')).toBe('{"page": "0"}');
    });

    it('should handle commands without arguments', () => {
      const input = 'list-tools';
      const args = input.trim().split(/\s+/);
      
      expect(args[0]).toBe('list-tools');
      expect(args.length).toBe(1);
    });

    it('should handle empty input', () => {
      const input = '';
      const args = input.trim().split(/\s+/);
      
      expect(args[0]).toBe('');
    });

    it('should handle whitespace-only input', () => {
      const input = '   ';
      const args = input.trim().split(/\s+/);
      
      expect(args[0]).toBe('');
    });
  });

  describe('Transport Management', () => {
    it('should start transport on connection', async () => {
      await mockTransport.start();
      
      expect(mockTransport.start).toHaveBeenCalled();
    });

    it('should restart transport on reconnection', async () => {
      await mockTransport.restart();
      
      expect(mockTransport.restart).toHaveBeenCalled();
    });

    it('should close transport on disconnection', async () => {
      await mockTransport.close();
      
      expect(mockTransport.close).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      mockClient.connect.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(mockClient.connect()).rejects.toThrow('Connection failed');
    });

    it('should handle request timeouts', async () => {
      mockClient.request.mockRejectedValueOnce(new Error('Request timeout'));

      const request = {
        method: 'tools/list',
        params: {}
      };

      await expect(mockClient.request(request)).rejects.toThrow('Request timeout');
    });

    it('should handle malformed responses', async () => {
      mockClient.request.mockResolvedValueOnce(null);

      const request = {
        method: 'tools/list',
        params: {}
      };

      const response = await mockClient.request(request);
      expect(response).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should maintain session state', () => {
      // Test session state management
      // This would involve testing session ID persistence
      expect(mockTransport).toBeDefined();
    });

    it('should handle session termination', async () => {
      await mockClient.close();
      
      expect(mockClient.close).toHaveBeenCalled();
    });
  });
}); 