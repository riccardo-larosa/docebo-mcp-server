import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z, ZodError } from 'zod';

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
  }))
}));

// Mock axios
vi.mock('axios');

// Mock environment variables
const mockEnv = {
  BEARER_TOKEN_BEARERAUTH: 'test-bearer-token'
};

describe('Server Core Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock process.env
    Object.assign(process.env, mockEnv);
  });

  afterEach(() => {
    // Clean up environment
    Object.keys(mockEnv).forEach(key => {
      delete process.env[key];
    });
  });

  describe('Argument Validation', () => {
    it('should validate simple string parameters', () => {
      const schema = z.object({
        course_id: z.string()
      });
      
      const validArgs = { course_id: '123' };
      const invalidArgs = { course_id: 123 };
      
      expect(() => schema.parse(validArgs)).not.toThrow();
      expect(() => schema.parse(invalidArgs)).toThrow(ZodError);
    });

    it('should validate optional query parameters', () => {
      const schema = z.object({
        page: z.string().optional(),
        page_size: z.string().optional()
      });
      
      const validArgs1 = { page: '0', page_size: '10' };
      const validArgs2 = { page: '0' };
      const validArgs3 = {};
      
      expect(() => schema.parse(validArgs1)).not.toThrow();
      expect(() => schema.parse(validArgs2)).not.toThrow();
      expect(() => schema.parse(validArgs3)).not.toThrow();
    });

    it('should validate required parameters', () => {
      const schema = z.object({
        course_id: z.string()
      });
      
      const validArgs = { course_id: 'abc123' };
      const invalidArgs = {};
      
      expect(() => schema.parse(validArgs)).not.toThrow();
      expect(() => schema.parse(invalidArgs)).toThrow(ZodError);
    });

    it('should handle complex nested schemas', () => {
      const schema = z.object({
        requestBody: z.object({
          name: z.string(),
          description: z.string().optional(),
          settings: z.object({
            enabled: z.boolean()
          }).optional()
        })
      });
      
      const validArgs = {
        requestBody: {
          name: 'Test Course',
          description: 'A test course',
          settings: { enabled: true }
        }
      };
      
      const minimalValidArgs = {
        requestBody: {
          name: 'Test Course'
        }
      };
      
      expect(() => schema.parse(validArgs)).not.toThrow();
      expect(() => schema.parse(minimalValidArgs)).not.toThrow();
    });
  });

  describe('Path Parameter Resolution', () => {
    it('should replace single path parameters', () => {
      const pathTemplate = 'learn/v1/courses/{course_id}';
      const args = { course_id: '123' };
      
      let resolvedPath = pathTemplate;
      resolvedPath = resolvedPath.replace('{course_id}', encodeURIComponent(String(args.course_id)));
      
      expect(resolvedPath).toBe('learn/v1/courses/123');
    });

    it('should replace multiple path parameters', () => {
      const pathTemplate = 'learn/v1/courses/{course_id}/sessions/{session_id}';
      const args = { course_id: '123', session_id: '456' };
      
      let resolvedPath = pathTemplate;
      resolvedPath = resolvedPath.replace('{course_id}', encodeURIComponent(String(args.course_id)));
      resolvedPath = resolvedPath.replace('{session_id}', encodeURIComponent(String(args.session_id)));
      
      expect(resolvedPath).toBe('learn/v1/courses/123/sessions/456');
    });

    it('should encode special characters in path parameters', () => {
      const pathTemplate = 'learn/v1/courses/{course_id}';
      const args = { course_id: 'course with spaces & symbols' };
      
      let resolvedPath = pathTemplate;
      resolvedPath = resolvedPath.replace('{course_id}', encodeURIComponent(String(args.course_id)));
      
      expect(resolvedPath).toBe('learn/v1/courses/course%20with%20spaces%20%26%20symbols');
    });

    it('should detect unresolved path parameters', () => {
      const pathTemplate = 'learn/v1/courses/{course_id}/sessions/{session_id}';
      const args = { course_id: '123' }; // missing session_id
      
      let resolvedPath = pathTemplate;
      resolvedPath = resolvedPath.replace('{course_id}', encodeURIComponent(String(args.course_id)));
      
      expect(resolvedPath.includes('{')).toBe(true);
    });
  });

  describe('Query Parameter Handling', () => {
    it('should build query parameters correctly', () => {
      const args = {
        page: '0',
        page_size: '10',
        sort: 'name'
      };
      
      const queryParams: Record<string, any> = {};
      
      // Simulate parameter processing
      const executionParameters = [
        { name: 'page', in: 'query' },
        { name: 'page_size', in: 'query' },
        { name: 'sort', in: 'query' }
      ];
      
      executionParameters.forEach(param => {
        if (param.in === 'query' && args[param.name] !== undefined) {
          queryParams[param.name] = args[param.name];
        }
      });
      
      expect(queryParams).toEqual({
        page: '0',
        page_size: '10',
        sort: 'name'
      });
    });

    it('should skip undefined query parameters', () => {
      const args = {
        page: '0',
        page_size: undefined,
        sort: null
      };
      
      const queryParams: Record<string, any> = {};
      
      const executionParameters = [
        { name: 'page', in: 'query' },
        { name: 'page_size', in: 'query' },
        { name: 'sort', in: 'query' }
      ];
      
      executionParameters.forEach(param => {
        if (param.in === 'query' && args[param.name] !== undefined && args[param.name] !== null) {
          queryParams[param.name] = args[param.name];
        }
      });
      
      expect(queryParams).toEqual({
        page: '0'
      });
    });
  });

  describe('Header Processing', () => {
    it('should set headers correctly', () => {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      const args = {
        'x-custom-header': 'custom-value',
        'authorization': 'Bearer token123'
      };
      
      const executionParameters = [
        { name: 'x-custom-header', in: 'header' },
        { name: 'authorization', in: 'header' }
      ];
      
      executionParameters.forEach(param => {
        if (param.in === 'header' && args[param.name] !== undefined) {
          headers[param.name.toLowerCase()] = String(args[param.name]);
        }
      });
      
      expect(headers).toEqual({
        'Accept': 'application/json',
        'x-custom-header': 'custom-value',
        'authorization': 'Bearer token123'
      });
    });
  });

  describe('Security Requirements', () => {
    it('should detect valid bearer token environment variable', () => {
      const securityRequirements = [{ 'bearerAuth': [] }];
      const allSecuritySchemes = {
        'bearerAuth': {
          'type': 'http',
          'scheme': 'bearer'
        }
      };
      
      // Simulate security validation
      const appliedSecurity = securityRequirements.find(req => {
        return Object.entries(req).every(([schemeName, scopesArray]) => {
          const scheme = allSecuritySchemes[schemeName];
          if (!scheme) return false;
          
          if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer') {
            return !!process.env[`BEARER_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
          }
          
          return false;
        });
      });
      
      expect(appliedSecurity).toBeDefined();
    });

    it('should reject invalid security schemes', () => {
      delete process.env.BEARER_TOKEN_BEARERAUTH;
      
      const securityRequirements = [{ 'bearerAuth': [] }];
      const allSecuritySchemes = {
        'bearerAuth': {
          'type': 'http',
          'scheme': 'bearer'
        }
      };
      
      const appliedSecurity = securityRequirements.find(req => {
        return Object.entries(req).every(([schemeName, scopesArray]) => {
          const scheme = allSecuritySchemes[schemeName];
          if (!scheme) return false;
          
          if (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer') {
            return !!process.env[`BEARER_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
          }
          
          return false;
        });
      });
      
      expect(appliedSecurity).toBeUndefined();
    });
  });
}); 