import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { notificationsToolsMap } from '../src/server/tools/notifications.js';

describe('Notification Tools', () => {
  it('should have 2 tool definitions', () => {
    expect(notificationsToolsMap.size).toBe(2);
  });

  it('should have valid tool definitions', () => {
    for (const [toolName, toolDef] of notificationsToolsMap) {
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
      expect(toolDef.method).toBe('post');
      expect(toolDef.requestBodyContentType).toBe('application/json');
      expect(toolDef.securityRequirements).toContainEqual({ 'bearerAuth': [] });
    }
  });

  describe('send-training-reminder', () => {
    const tool = notificationsToolsMap.get('send-training-reminder')!;

    it('should have correct metadata', () => {
      expect(tool.name).toBe('send-training-reminder');
      expect(tool.method).toBe('post');
      expect(tool.pathTemplate).toBe('manage/v1/user/send_mail');
      expect(tool.executionParameters).toHaveLength(0);
    });

    it('should have zodSchema and inputSchema', () => {
      expect(tool.zodSchema).toBeDefined();
      expect(typeof tool.zodSchema!.parse).toBe('function');
      expect(tool.inputSchema).toHaveProperty('type', 'object');
    });

    it('should validate correct input', () => {
      expect(() => tool.zodSchema!.parse({
        requestBody: {
          id_user: 123,
          subject: 'Training Reminder',
          message: '<p>Please complete your training.</p>',
        },
      })).not.toThrow();
    });

    it('should reject missing required body fields', () => {
      expect(() => tool.zodSchema!.parse({})).toThrow(ZodError);
      expect(() => tool.zodSchema!.parse({
        requestBody: { id_user: 123 },
      })).toThrow(ZodError);
      expect(() => tool.zodSchema!.parse({
        requestBody: { id_user: 123, subject: 'Test' },
      })).toThrow(ZodError);
    });

    it('should reject wrong types in body', () => {
      expect(() => tool.zodSchema!.parse({
        requestBody: {
          id_user: '123',
          subject: 'Test',
          message: 'Hello',
        },
      })).toThrow(ZodError);
    });

    it('should not be readOnly but not destructive', () => {
      expect(tool.annotations!.readOnlyHint).toBe(false);
      expect(tool.annotations!.destructiveHint).toBe(false);
      expect(tool.annotations!.idempotentHint).toBe(false);
    });
  });

  describe('send-learning-plan-notification', () => {
    const tool = notificationsToolsMap.get('send-learning-plan-notification')!;

    it('should have correct metadata', () => {
      expect(tool.name).toBe('send-learning-plan-notification');
      expect(tool.method).toBe('post');
      expect(tool.pathTemplate).toBe('manage/v1/notifications/external_notification');
      expect(tool.executionParameters).toHaveLength(0);
    });

    it('should have zodSchema and inputSchema', () => {
      expect(tool.zodSchema).toBeDefined();
      expect(typeof tool.zodSchema!.parse).toBe('function');
      expect(tool.inputSchema).toHaveProperty('type', 'object');
    });

    it('should validate correct input', () => {
      expect(() => tool.zodSchema!.parse({
        requestBody: {
          user_id: 456,
          learning_plan_id: 789,
        },
      })).not.toThrow();
    });

    it('should reject missing required body fields', () => {
      expect(() => tool.zodSchema!.parse({})).toThrow(ZodError);
      expect(() => tool.zodSchema!.parse({
        requestBody: { user_id: 456 },
      })).toThrow(ZodError);
    });

    it('should reject wrong types in body', () => {
      expect(() => tool.zodSchema!.parse({
        requestBody: {
          user_id: '456',
          learning_plan_id: 789,
        },
      })).toThrow(ZodError);
    });

    it('should not be readOnly but not destructive', () => {
      expect(tool.annotations!.readOnlyHint).toBe(false);
      expect(tool.annotations!.destructiveHint).toBe(false);
      expect(tool.annotations!.idempotentHint).toBe(false);
    });
  });

  describe('Annotations', () => {
    it('should have annotations on all notification tools', () => {
      for (const tool of notificationsToolsMap.values()) {
        expect(tool.annotations).toBeDefined();
        expect(tool.annotations).toHaveProperty('title');
        expect(tool.annotations!.readOnlyHint).toBe(false);
        expect(tool.annotations!.destructiveHint).toBe(false);
        expect(tool.annotations!.idempotentHint).toBe(false);
        expect(tool.annotations!.openWorldHint).toBe(true);
      }
    });
  });
});
