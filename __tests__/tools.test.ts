import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { coursesToolsMap } from '../src/server/tools/courses.js';
import { classroomsToolsMap } from '../src/server/tools/classrooms.js';
import type { McpToolDefinition } from '../src/server/tools/index.js';

describe('Tool Definitions', () => {
  describe('Courses Tools', () => {
    it('should have valid tool definitions', () => {
      expect(coursesToolsMap.size).toBeGreaterThan(0);

      for (const [toolName, toolDef] of coursesToolsMap) {
        // Verify tool definition structure
        expect(toolDef).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.any(Object),
          method: expect.any(String),
          pathTemplate: expect.any(String),
          executionParameters: expect.any(Array),
          securityRequirements: expect.any(Array)
        });

        // Verify name consistency
        expect(toolDef.name).toBe(toolName);

        // Verify HTTP method is valid
        expect(['get', 'post', 'put', 'patch', 'delete']).toContain(toolDef.method.toLowerCase());

        // Verify input schema has required properties
        expect(toolDef.inputSchema).toHaveProperty('type', 'object');
        expect(toolDef.inputSchema).toHaveProperty('properties');

        // Verify execution parameters are properly structured
        for (const param of toolDef.executionParameters) {
          expect(param).toHaveProperty('name');
          expect(param).toHaveProperty('in');
          expect(['path', 'query', 'header', 'body']).toContain(param.in);
        }

        // Verify security requirements
        expect(Array.isArray(toolDef.securityRequirements)).toBe(true);
      }
    });

    it('should have list-all-courses tool with correct schema', () => {
      const tool = coursesToolsMap.get('list-all-courses');
      expect(tool).toBeDefined();

      if (tool) {
        expect(tool.name).toBe('list-all-courses');
        expect(tool.method).toBe('get');
        expect(tool.pathTemplate).toBe('learn/v1/courses');
        expect(tool.inputSchema.properties).toHaveProperty('page_size');
        expect(tool.inputSchema.properties).toHaveProperty('page');
        expect(tool.inputSchema.properties).toHaveProperty('search_text');
        expect(tool.inputSchema.properties).toHaveProperty('category');
        expect(tool.inputSchema.properties).toHaveProperty('status');
        expect(tool.inputSchema.properties).toHaveProperty('sort_by');
        expect(tool.inputSchema.properties).toHaveProperty('sort_order');
        expect(tool.executionParameters).toHaveLength(7);
        expect(tool.securityRequirements).toEqual([{ 'bearerAuth': [] }]);
      }
    });

    it('should accept search/filter params in list-all-courses zodSchema', () => {
      const tool = coursesToolsMap.get('list-all-courses')!;
      expect(() => tool.zodSchema!.parse({
        search_text: 'compliance',
        category: 'Safety',
        status: 'published',
        sort_by: 'name',
        sort_order: 'asc',
      })).not.toThrow();
    });

    it('should have search/filter executionParameters as query params', () => {
      const tool = coursesToolsMap.get('list-all-courses')!;
      const paramNames = tool.executionParameters.map(p => p.name);
      expect(paramNames).toContain('search_text');
      expect(paramNames).toContain('category');
      expect(paramNames).toContain('status');
      expect(paramNames).toContain('sort_by');
      expect(paramNames).toContain('sort_order');
      for (const param of tool.executionParameters) {
        expect(param.in).toBe('query');
      }
    });

    it('should have get-a-course tool with correct schema', () => {
      const tool = coursesToolsMap.get('get-a-course');
      expect(tool).toBeDefined();

      if (tool) {
        expect(tool.name).toBe('get-a-course');
        expect(tool.method).toBe('get');
        expect(tool.pathTemplate).toBe('learn/v1/courses/{course_id}');
        expect(tool.inputSchema.properties).toHaveProperty('course_id');
        expect(tool.inputSchema.required).toContain('course_id');
        expect(tool.executionParameters).toHaveLength(1);
        expect(tool.executionParameters[0]).toEqual({ name: 'course_id', in: 'path' });
      }
    });
  });

  describe('Classrooms Tools', () => {
    it('should have valid tool definitions', () => {
      expect(classroomsToolsMap.size).toBeGreaterThan(0);

      for (const [toolName, toolDef] of classroomsToolsMap) {
        // Verify tool definition structure
        expect(toolDef).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.any(Object),
          method: expect.any(String),
          pathTemplate: expect.any(String),
          executionParameters: expect.any(Array),
          securityRequirements: expect.any(Array)
        });

        // Verify name consistency
        expect(toolDef.name).toBe(toolName);

        // Verify path template format
        expect(toolDef.pathTemplate).toMatch(/^[a-z]+\/v\d+\/[a-z\/{}]+$/);
      }
    });
  });

  describe('Combined Tool Map', () => {
    it('should not have duplicate tool names between modules', () => {
      const courseToolNames = Array.from(coursesToolsMap.keys());
      const classroomToolNames = Array.from(classroomsToolsMap.keys());

      const duplicates = courseToolNames.filter(name => classroomToolNames.includes(name));
      expect(duplicates).toHaveLength(0);
    });

    it('should have consistent security requirements across tools', () => {
      const allTools = [...coursesToolsMap.values(), ...classroomsToolsMap.values()];

      for (const tool of allTools) {
        // All tools should require bearer authentication
        expect(tool.securityRequirements).toContainEqual({ 'bearerAuth': [] });
      }
    });
  });

  describe('Zod Schemas', () => {
    const allTools: McpToolDefinition[] = [
      ...coursesToolsMap.values(),
      ...classroomsToolsMap.values(),
    ];

    it('should have zodSchema defined on all tools', () => {
      for (const tool of allTools) {
        expect(tool.zodSchema).toBeDefined();
        expect(typeof tool.zodSchema!.parse).toBe('function');
      }
    });

    it('should validate correct input via zodSchema.parse()', () => {
      const listCourses = coursesToolsMap.get('list-all-courses')!;
      expect(() => listCourses.zodSchema!.parse({})).not.toThrow();
      expect(() => listCourses.zodSchema!.parse({ page: '0', page_size: '10' })).not.toThrow();

      const getCourse = coursesToolsMap.get('get-a-course')!;
      expect(() => getCourse.zodSchema!.parse({ course_id: '123' })).not.toThrow();

      const listClassrooms = classroomsToolsMap.get('list-all-classrooms')!;
      expect(() => listClassrooms.zodSchema!.parse({})).not.toThrow();

      const getClassroom = classroomsToolsMap.get('get-a-classroom')!;
      expect(() => getClassroom.zodSchema!.parse({ id: '456' })).not.toThrow();
    });

    it('should reject incorrect input via zodSchema.parse()', () => {
      const getCourse = coursesToolsMap.get('get-a-course')!;
      // Missing required field
      expect(() => getCourse.zodSchema!.parse({})).toThrow(ZodError);
      // Wrong type
      expect(() => getCourse.zodSchema!.parse({ course_id: 123 })).toThrow(ZodError);

      const getClassroom = classroomsToolsMap.get('get-a-classroom')!;
      expect(() => getClassroom.zodSchema!.parse({})).toThrow(ZodError);
    });

    it('should have inputSchema derived as valid JSON Schema', () => {
      for (const tool of allTools) {
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');
        expect(typeof tool.inputSchema.properties).toBe('object');
      }
    });
  });

  describe('Annotations', () => {
    const allTools: McpToolDefinition[] = [
      ...coursesToolsMap.values(),
      ...classroomsToolsMap.values(),
    ];

    it('should have annotations present on all tools', () => {
      for (const tool of allTools) {
        expect(tool.annotations).toBeDefined();
        expect(tool.annotations).toHaveProperty('title');
        expect(typeof tool.annotations!.readOnlyHint).toBe('boolean');
        expect(typeof tool.annotations!.destructiveHint).toBe('boolean');
        expect(typeof tool.annotations!.idempotentHint).toBe('boolean');
        expect(typeof tool.annotations!.openWorldHint).toBe('boolean');
      }
    });

    it('should have consistent annotations (all current tools are read-only)', () => {
      for (const tool of allTools) {
        expect(tool.annotations!.readOnlyHint).toBe(true);
        expect(tool.annotations!.destructiveHint).toBe(false);
        expect(tool.annotations!.idempotentHint).toBe(true);
      }
    });
  });
});
