import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { enrollmentsToolsMap } from '../src/server/tools/enrollments.js';

describe('Enrollment Tools', () => {
  it('should have 2 tool definitions', () => {
    expect(enrollmentsToolsMap.size).toBe(2);
  });

  it('should have valid tool definitions', () => {
    for (const [toolName, toolDef] of enrollmentsToolsMap) {
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

  describe('list-enrollments', () => {
    const tool = enrollmentsToolsMap.get('list-enrollments')!;

    it('should have correct metadata', () => {
      expect(tool.name).toBe('list-enrollments');
      expect(tool.method).toBe('get');
      expect(tool.pathTemplate).toBe('learn/v1/enrollments');
      expect(tool.executionParameters).toHaveLength(5);
    });

    it('should have zodSchema and inputSchema', () => {
      expect(tool.zodSchema).toBeDefined();
      expect(typeof tool.zodSchema!.parse).toBe('function');
      expect(tool.inputSchema).toHaveProperty('type', 'object');
      expect(tool.inputSchema).toHaveProperty('properties');
    });

    it('should validate correct input (all optional)', () => {
      expect(() => tool.zodSchema!.parse({})).not.toThrow();
      expect(() => tool.zodSchema!.parse({ id_user: '123', page: '0', page_size: '10' })).not.toThrow();
      expect(() => tool.zodSchema!.parse({ id_course: '456', status: 'completed' })).not.toThrow();
    });

    it('should reject invalid input', () => {
      expect(() => tool.zodSchema!.parse({ id_user: 123 })).toThrow(ZodError);
      expect(() => tool.zodSchema!.parse({ status: true })).toThrow(ZodError);
    });

    it('should have correct query parameters', () => {
      const paramNames = tool.executionParameters.map(p => p.name);
      expect(paramNames).toContain('id_user');
      expect(paramNames).toContain('id_course');
      expect(paramNames).toContain('status');
      expect(paramNames).toContain('page');
      expect(paramNames).toContain('page_size');
      for (const param of tool.executionParameters) {
        expect(param.in).toBe('query');
      }
    });
  });

  describe('get-enrollment-details', () => {
    const tool = enrollmentsToolsMap.get('get-enrollment-details')!;

    it('should have correct metadata', () => {
      expect(tool.name).toBe('get-enrollment-details');
      expect(tool.method).toBe('get');
      expect(tool.pathTemplate).toBe('learn/v1/enrollments/{id_course}/{id_user}');
      expect(tool.executionParameters).toHaveLength(2);
      expect(tool.executionParameters[0]).toEqual({ name: 'id_course', in: 'path' });
      expect(tool.executionParameters[1]).toEqual({ name: 'id_user', in: 'path' });
    });

    it('should have zodSchema and inputSchema', () => {
      expect(tool.zodSchema).toBeDefined();
      expect(typeof tool.zodSchema!.parse).toBe('function');
      expect(tool.inputSchema).toHaveProperty('type', 'object');
      expect(tool.inputSchema.properties).toHaveProperty('id_course');
      expect(tool.inputSchema.properties).toHaveProperty('id_user');
      expect(tool.inputSchema.required).toContain('id_course');
      expect(tool.inputSchema.required).toContain('id_user');
    });

    it('should validate correct input', () => {
      expect(() => tool.zodSchema!.parse({ id_course: '2', id_user: '13242' })).not.toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() => tool.zodSchema!.parse({})).toThrow(ZodError);
      expect(() => tool.zodSchema!.parse({ id_course: '2' })).toThrow(ZodError);
      expect(() => tool.zodSchema!.parse({ id_user: '13242' })).toThrow(ZodError);
    });

    it('should reject wrong type', () => {
      expect(() => tool.zodSchema!.parse({ id_course: 2, id_user: 13242 })).toThrow(ZodError);
    });
  });

  describe('Annotations', () => {
    it('should have annotations on all enrollment tools', () => {
      for (const tool of enrollmentsToolsMap.values()) {
        expect(tool.annotations).toBeDefined();
        expect(tool.annotations).toHaveProperty('title');
        expect(tool.annotations!.readOnlyHint).toBe(true);
        expect(tool.annotations!.destructiveHint).toBe(false);
        expect(tool.annotations!.idempotentHint).toBe(true);
      }
    });

    it('should have openWorldHint=true on list, false on get', () => {
      expect(enrollmentsToolsMap.get('list-enrollments')!.annotations!.openWorldHint).toBe(true);
      expect(enrollmentsToolsMap.get('get-enrollment-details')!.annotations!.openWorldHint).toBe(false);
    });
  });
});
