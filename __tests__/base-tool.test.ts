import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { BaseTool } from '../src/server/tools/baseTool.js';

/** Concrete test implementation of BaseTool */
class EchoTool extends BaseTool {
  name = 'echo';
  description = 'Echoes back the input message';
  zodSchema = z.object({
    message: z.string().describe('The message to echo'),
    count: z.number().optional().describe('Repeat count'),
  });
  annotations = {
    title: 'Echo Tool',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };

  async process(input: { message: string; count?: number }, bearerToken?: string): Promise<string> {
    const count = input.count ?? 1;
    const prefix = bearerToken ? `[auth] ` : '';
    return prefix + Array(count).fill(input.message).join(' ');
  }
}

/** Tool that returns an object */
class ObjectTool extends BaseTool {
  name = 'object-tool';
  description = 'Returns an object';
  zodSchema = z.object({ id: z.string() });

  async process(input: { id: string }): Promise<Record<string, unknown>> {
    return { id: input.id, status: 'ok' };
  }
}

/** Tool that throws during process */
class FailingTool extends BaseTool {
  name = 'failing-tool';
  description = 'Always fails';
  zodSchema = z.object({});

  async process(): Promise<never> {
    throw new Error('Something went wrong');
  }
}

describe('BaseTool', () => {
  const echoTool = new EchoTool();
  const objectTool = new ObjectTool();
  const failingTool = new FailingTool();

  describe('handleRequest - validation and processing', () => {
    it('should validate and process valid input', async () => {
      const result = await echoTool.handleRequest({ message: 'hello' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0]).toEqual({ type: 'text', text: 'hello' });
    });

    it('should reject invalid input with isError: true', async () => {
      const result = await echoTool.handleRequest({ message: 123 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid arguments for tool 'echo'");
    });

    it('should reject missing required fields', async () => {
      const result = await echoTool.handleRequest({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('message');
    });

    it('should call process with validated input', async () => {
      const spy = vi.spyOn(echoTool, 'process');
      await echoTool.handleRequest({ message: 'test', count: 3 });
      expect(spy).toHaveBeenCalledWith({ message: 'test', count: 3 }, undefined, undefined);
      spy.mockRestore();
    });

    it('should not call process on validation failure', async () => {
      const spy = vi.spyOn(echoTool, 'process');
      await echoTool.handleRequest({ message: 123 });
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should handle errors from process()', async () => {
      const result = await failingTool.handleRequest({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Something went wrong');
    });

    it('should pass bearerToken to process()', async () => {
      const result = await echoTool.handleRequest({ message: 'hello' }, 'my-token');
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('[auth] hello');
    });
  });

  describe('response formatting', () => {
    it('should format string responses directly', async () => {
      const result = await echoTool.handleRequest({ message: 'hi' });
      expect(result.content[0].text).toBe('hi');
    });

    it('should JSON-stringify object responses', async () => {
      const result = await objectTool.handleRequest({ id: 'abc' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual({ id: 'abc', status: 'ok' });
    });

    it('should format number responses as string', async () => {
      class NumberTool extends BaseTool {
        name = 'number-tool';
        description = 'Returns a number';
        zodSchema = z.object({});
        async process(): Promise<number> { return 42; }
      }
      const result = await new NumberTool().handleRequest({});
      expect(result.content[0].text).toBe('42');
    });
  });

  describe('getToolDefinition', () => {
    it('should return correct tool definition with name and description', () => {
      const def = echoTool.getToolDefinition();
      expect(def.name).toBe('echo');
      expect(def.description).toBe('Echoes back the input message');
    });

    it('should include annotations when present', () => {
      const def = echoTool.getToolDefinition();
      expect(def.annotations).toEqual({
        title: 'Echo Tool',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    });

    it('should omit annotations when not set', () => {
      const def = objectTool.getToolDefinition();
      expect(def.annotations).toBeUndefined();
    });

    it('should produce valid JSON Schema from zodSchema', () => {
      const def = echoTool.getToolDefinition();
      expect(def.inputSchema).toHaveProperty('type', 'object');
      expect(def.inputSchema).toHaveProperty('properties');
      expect(def.inputSchema.properties).toHaveProperty('message');
      expect(def.inputSchema.properties.message).toHaveProperty('type', 'string');
      expect(def.inputSchema.properties).toHaveProperty('count');
    });

    it('should mark required fields in JSON Schema', () => {
      const def = echoTool.getToolDefinition();
      expect(def.inputSchema.required).toContain('message');
      // count is optional, should not be in required
      expect(def.inputSchema.required).not.toContain('count');
    });
  });
});
