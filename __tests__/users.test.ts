import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { usersToolsMap } from '../src/server/tools/users.js';

describe('User Tools', () => {
  it('should have 2 tool definitions', () => {
    expect(usersToolsMap.size).toBe(2);
  });

  it('should have valid tool definitions', () => {
    for (const [toolName, toolDef] of usersToolsMap) {
      expect(toolDef).toMatchObject({
        name: expect.any(String),
        description: expect.any(String),
        inputSchema: expect.any(Object),
        method: expect.any(String),
        pathTemplate: expect.any(String),
        executionParameters: expect.any(Array),
        securityRequirements: expect.any(Array),
      });

      expect(toolDef.name).toBe(toolName);
      expect(['get', 'post', 'put', 'patch', 'delete']).toContain(toolDef.method.toLowerCase());

      for (const param of toolDef.executionParameters) {
        expect(param).toHaveProperty('name');
        expect(param).toHaveProperty('in');
        expect(['path', 'query', 'header', 'body']).toContain(param.in);
      }

      expect(toolDef.securityRequirements).toContainEqual({ 'bearerAuth': [] });
    }
  });

  describe('list_users', () => {
    const tool = usersToolsMap.get('list_users')!;

    it('should have correct metadata', () => {
      expect(tool.name).toBe('list_users');
      expect(tool.method).toBe('get');
      expect(tool.pathTemplate).toBe('manage/v1/user');
      expect(tool.executionParameters).toHaveLength(3);
    });

    it('should have zodSchema and inputSchema', () => {
      expect(tool.zodSchema).toBeDefined();
      expect(typeof tool.zodSchema!.parse).toBe('function');
      expect(tool.inputSchema).toHaveProperty('type', 'object');
      expect(tool.inputSchema).toHaveProperty('properties');
    });

    it('should validate correct input (all optional)', () => {
      expect(() => tool.zodSchema!.parse({})).not.toThrow();
      expect(() => tool.zodSchema!.parse({ search_text: 'john', page: 0, page_size: 10 })).not.toThrow();
    });

    it('should reject invalid input', () => {
      expect(() => tool.zodSchema!.parse({ search_text: 123 })).toThrow(ZodError);
      expect(() => tool.zodSchema!.parse({ page: 'abc' })).toThrow(ZodError);
    });

    it('should apply default pagination values', () => {
      const parsed = tool.zodSchema!.parse({});
      expect(parsed).toHaveProperty('page', 0);
      expect(parsed).toHaveProperty('page_size', 20);
    });

    it('should enforce max page_size of 200', () => {
      expect(() => tool.zodSchema!.parse({ page_size: 201 })).toThrow(ZodError);
    });

    it('should have correct query parameters', () => {
      const paramNames = tool.executionParameters.map(p => p.name);
      expect(paramNames).toContain('search_text');
      expect(paramNames).toContain('page');
      expect(paramNames).toContain('page_size');
      for (const param of tool.executionParameters) {
        expect(param.in).toBe('query');
      }
    });
  });

  describe('get_user', () => {
    const tool = usersToolsMap.get('get_user')!;

    it('should have correct metadata', () => {
      expect(tool.name).toBe('get_user');
      expect(tool.method).toBe('get');
      expect(tool.pathTemplate).toBe('manage/v1/user/{user_id}');
      expect(tool.executionParameters).toHaveLength(1);
      expect(tool.executionParameters[0]).toEqual({ name: 'user_id', in: 'path' });
    });

    it('should have zodSchema and inputSchema', () => {
      expect(tool.zodSchema).toBeDefined();
      expect(typeof tool.zodSchema!.parse).toBe('function');
      expect(tool.inputSchema).toHaveProperty('type', 'object');
      expect(tool.inputSchema.properties).toHaveProperty('user_id');
      expect(tool.inputSchema.required).toContain('user_id');
    });

    it('should validate correct input', () => {
      expect(() => tool.zodSchema!.parse({ user_id: '42' })).not.toThrow();
    });

    it('should reject missing required field', () => {
      expect(() => tool.zodSchema!.parse({})).toThrow(ZodError);
    });

    it('should reject wrong type', () => {
      expect(() => tool.zodSchema!.parse({ user_id: 42 })).toThrow(ZodError);
    });
  });

  describe('Annotations', () => {
    it('should have annotations on all user tools', () => {
      for (const tool of usersToolsMap.values()) {
        expect(tool.annotations).toBeDefined();
        expect(tool.annotations).toHaveProperty('title');
        expect(tool.annotations!.readOnlyHint).toBe(true);
        expect(tool.annotations!.destructiveHint).toBe(false);
        expect(tool.annotations!.idempotentHint).toBe(true);
      }
    });

    it('should have openWorldHint=true on list, false on get', () => {
      expect(usersToolsMap.get('list_users')!.annotations!.openWorldHint).toBe(true);
      expect(usersToolsMap.get('get_user')!.annotations!.openWorldHint).toBe(false);
    });
  });
});
