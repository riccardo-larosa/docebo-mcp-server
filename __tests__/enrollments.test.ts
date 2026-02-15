import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { enrollmentsToolsMap } from '../src/server/tools/enrollments.js';

describe('Enrollment Tools', () => {
  it('should have 5 tool definitions', () => {
    expect(enrollmentsToolsMap.size).toBe(5);
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

  describe('list_enrollments', () => {
    const tool = enrollmentsToolsMap.get('list_enrollments')!;

    it('should have correct metadata', () => {
      expect(tool.name).toBe('list_enrollments');
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
      expect(() => tool.zodSchema!.parse({ id_user: '123', page: 0, page_size: 10 })).not.toThrow();
      expect(() => tool.zodSchema!.parse({ id_course: '456', status: 'completed' })).not.toThrow();
    });

    it('should reject invalid input', () => {
      expect(() => tool.zodSchema!.parse({ id_user: 123 })).toThrow(ZodError);
      expect(() => tool.zodSchema!.parse({ status: true })).toThrow(ZodError);
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

  describe('get_enrollment_details', () => {
    const tool = enrollmentsToolsMap.get('get_enrollment_details')!;

    it('should have correct metadata', () => {
      expect(tool.name).toBe('get_enrollment_details');
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

  describe('get_user_progress', () => {
    const tool = enrollmentsToolsMap.get('get_user_progress')!;

    it('should have correct metadata', () => {
      expect(tool.name).toBe('get_user_progress');
      expect(tool.method).toBe('get');
      expect(tool.pathTemplate).toBe('learn/v1/enrollments');
      expect(tool.executionParameters).toHaveLength(4);
    });

    it('should have zodSchema and inputSchema', () => {
      expect(tool.zodSchema).toBeDefined();
      expect(tool.inputSchema).toHaveProperty('type', 'object');
      expect(tool.inputSchema.properties).toHaveProperty('id_user');
      expect(tool.inputSchema.required).toContain('id_user');
    });

    it('should require id_user', () => {
      expect(() => tool.zodSchema!.parse({})).toThrow(ZodError);
      expect(() => tool.zodSchema!.parse({ id_user: '123' })).not.toThrow();
    });

    it('should accept optional filters', () => {
      expect(() => tool.zodSchema!.parse({
        id_user: '123',
        status: 'completed',
        page: 0,
        page_size: 20,
      })).not.toThrow();
    });

    it('should apply default pagination values', () => {
      const parsed = tool.zodSchema!.parse({ id_user: '123' });
      expect(parsed).toHaveProperty('page', 0);
      expect(parsed).toHaveProperty('page_size', 20);
    });

    it('should have query parameters only', () => {
      for (const param of tool.executionParameters) {
        expect(param.in).toBe('query');
      }
    });

    it('should have readOnly annotation', () => {
      expect(tool.annotations!.readOnlyHint).toBe(true);
      expect(tool.annotations!.destructiveHint).toBe(false);
    });
  });

  describe('enroll_user', () => {
    const tool = enrollmentsToolsMap.get('enroll_user')!;

    it('should have correct metadata', () => {
      expect(tool.name).toBe('enroll_user');
      expect(tool.method).toBe('post');
      expect(tool.pathTemplate).toBe('learn/v1/enrollments/{course_id}/{user_id}');
      expect(tool.executionParameters).toHaveLength(2);
      expect(tool.executionParameters[0]).toEqual({ name: 'course_id', in: 'path' });
      expect(tool.executionParameters[1]).toEqual({ name: 'user_id', in: 'path' });
    });

    it('should require course_id and user_id', () => {
      expect(() => tool.zodSchema!.parse({})).toThrow(ZodError);
      expect(() => tool.zodSchema!.parse({ course_id: '1' })).toThrow(ZodError);
      expect(() => tool.zodSchema!.parse({ course_id: '1', user_id: '2' })).not.toThrow();
    });

    it('should accept optional requestBody', () => {
      expect(() => tool.zodSchema!.parse({
        course_id: '1',
        user_id: '2',
        requestBody: { level: 3, date_begin_validity: '2025-01-01' },
      })).not.toThrow();
    });

    it('should have application/json content type', () => {
      expect(tool.requestBodyContentType).toBe('application/json');
    });

    it('should not be readOnly or destructive', () => {
      expect(tool.annotations!.readOnlyHint).toBe(false);
      expect(tool.annotations!.destructiveHint).toBe(false);
    });
  });

  describe('unenroll_user', () => {
    const tool = enrollmentsToolsMap.get('unenroll_user')!;

    it('should have correct metadata', () => {
      expect(tool.name).toBe('unenroll_user');
      expect(tool.method).toBe('delete');
      expect(tool.pathTemplate).toBe('learn/v1/enrollments/{id_course}/{id_user}');
      expect(tool.executionParameters).toHaveLength(2);
      expect(tool.executionParameters[0]).toEqual({ name: 'id_course', in: 'path' });
      expect(tool.executionParameters[1]).toEqual({ name: 'id_user', in: 'path' });
    });

    it('should require id_course and id_user', () => {
      expect(() => tool.zodSchema!.parse({})).toThrow(ZodError);
      expect(() => tool.zodSchema!.parse({ id_course: '1', id_user: '2' })).not.toThrow();
    });

    it('should be marked as destructive', () => {
      expect(tool.annotations!.readOnlyHint).toBe(false);
      expect(tool.annotations!.destructiveHint).toBe(true);
      expect(tool.annotations!.idempotentHint).toBe(true);
    });

    it('should not have a request body content type', () => {
      expect(tool.requestBodyContentType).toBeUndefined();
    });
  });

  describe('Annotations', () => {
    it('should have annotations on all enrollment tools', () => {
      for (const tool of enrollmentsToolsMap.values()) {
        expect(tool.annotations).toBeDefined();
        expect(tool.annotations).toHaveProperty('title');
      }
    });

    it('read-only tools should have readOnlyHint=true', () => {
      expect(enrollmentsToolsMap.get('list_enrollments')!.annotations!.readOnlyHint).toBe(true);
      expect(enrollmentsToolsMap.get('get_enrollment_details')!.annotations!.readOnlyHint).toBe(true);
      expect(enrollmentsToolsMap.get('get_user_progress')!.annotations!.readOnlyHint).toBe(true);
    });

    it('write tools should have readOnlyHint=false', () => {
      expect(enrollmentsToolsMap.get('enroll_user')!.annotations!.readOnlyHint).toBe(false);
      expect(enrollmentsToolsMap.get('unenroll_user')!.annotations!.readOnlyHint).toBe(false);
    });

    it('should have openWorldHint=true on list-style, false on targeted tools', () => {
      expect(enrollmentsToolsMap.get('list_enrollments')!.annotations!.openWorldHint).toBe(true);
      expect(enrollmentsToolsMap.get('get_enrollment_details')!.annotations!.openWorldHint).toBe(false);
      expect(enrollmentsToolsMap.get('get_user_progress')!.annotations!.openWorldHint).toBe(true);
      expect(enrollmentsToolsMap.get('enroll_user')!.annotations!.openWorldHint).toBe(false);
      expect(enrollmentsToolsMap.get('unenroll_user')!.annotations!.openWorldHint).toBe(false);
    });
  });
});
