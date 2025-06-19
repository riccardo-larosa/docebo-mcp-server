import { describe, it, expect } from 'vitest';
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
        expect(tool.executionParameters).toHaveLength(2);
        expect(tool.securityRequirements).toEqual([{ 'bearerAuth': [] }]);
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
}); 