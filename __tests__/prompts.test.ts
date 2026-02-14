import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  registerPrompt,
  getPrompts,
  getPromptMessages,
  clearPrompts,
  type PromptDefinition,
} from '../src/server/prompts/index.js';

describe('Prompt Registry', () => {
  beforeEach(() => {
    clearPrompts();
  });

  it('should register and retrieve a prompt', () => {
    const prompt: PromptDefinition = {
      name: 'test-prompt',
      description: 'A test prompt',
      getMessages: () => [{ role: 'user', content: { type: 'text', text: 'Hello' } }],
    };

    registerPrompt(prompt);
    const prompts = getPrompts();

    expect(prompts).toHaveLength(1);
    expect(prompts[0].name).toBe('test-prompt');
    expect(prompts[0].description).toBe('A test prompt');
  });

  it('should list all registered prompts', () => {
    registerPrompt({
      name: 'prompt-a',
      description: 'First',
      getMessages: () => [{ role: 'user', content: { type: 'text', text: 'A' } }],
    });
    registerPrompt({
      name: 'prompt-b',
      description: 'Second',
      getMessages: () => [{ role: 'user', content: { type: 'text', text: 'B' } }],
    });

    const prompts = getPrompts();
    expect(prompts).toHaveLength(2);

    const names = prompts.map(p => p.name);
    expect(names).toContain('prompt-a');
    expect(names).toContain('prompt-b');
  });

  it('should generate messages without arguments', () => {
    registerPrompt({
      name: 'no-args',
      description: 'No arguments needed',
      getMessages: () => [{ role: 'user', content: { type: 'text', text: 'Fixed message' } }],
    });

    const messages = getPromptMessages('no-args', {});
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content.text).toBe('Fixed message');
  });

  it('should generate messages with arguments', () => {
    registerPrompt({
      name: 'with-args',
      description: 'With arguments',
      arguments: [{ name: 'name', description: 'A name', required: false }],
      getMessages: (args) => [
        { role: 'user', content: { type: 'text', text: `Hello ${args.name || 'world'}` } },
      ],
    });

    const messages = getPromptMessages('with-args', { name: 'Claude' });
    expect(messages[0].content.text).toBe('Hello Claude');
  });

  it('should throw on missing required argument', () => {
    registerPrompt({
      name: 'required-arg',
      description: 'Requires an argument',
      arguments: [{ name: 'id', description: 'Required ID', required: true }],
      getMessages: (args) => [
        { role: 'user', content: { type: 'text', text: `ID: ${args.id}` } },
      ],
    });

    expect(() => getPromptMessages('required-arg', {})).toThrow('Missing required argument: id');
  });

  it('should throw on non-existent prompt', () => {
    expect(() => getPromptMessages('does-not-exist', {})).toThrow('Prompt not found: does-not-exist');
  });

  it('should clear all prompts', () => {
    registerPrompt({
      name: 'temp',
      description: 'Temporary',
      getMessages: () => [{ role: 'user', content: { type: 'text', text: 'temp' } }],
    });

    expect(getPrompts()).toHaveLength(1);
    clearPrompts();
    expect(getPrompts()).toHaveLength(0);
  });
});

describe('Course Enrollment Report Prompt', () => {
  // Import once to trigger side-effect registration (cached by module system)
  beforeAll(async () => {
    clearPrompts();
    await import('../src/server/prompts/courseEnrollmentReport.js');
  });

  it('should require user_ids argument', () => {
    expect(() => getPromptMessages('course-enrollment-report', {})).toThrow('Missing required argument: user_ids');
  });

  it('should generate correct messages with user_ids', () => {
    const messages = getPromptMessages('course-enrollment-report', { user_ids: '123, 456' });
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content.text).toContain('get-user-progress');
    expect(messages[0].content.text).toContain('get-enrollment-details');
    expect(messages[0].content.text).toContain('123');
    expect(messages[0].content.text).toContain('456');
    expect(messages[0].content.text).toContain('Only report on the specified users');
  });

  it('should generate messages filtered by course_name', () => {
    const messages = getPromptMessages('course-enrollment-report', { user_ids: '123', course_name: 'Onboarding' });
    expect(messages[0].content.text).toContain('Onboarding');
  });
});

describe('Learner Progress Prompt', () => {
  beforeAll(async () => {
    clearPrompts();
    await import('../src/server/prompts/learnerProgress.js');
  });

  it('should generate correct messages with user_id', () => {
    const messages = getPromptMessages('learner-progress', { user_id: '123' });
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content.text).toContain('get-user-progress');
    expect(messages[0].content.text).toContain('get-enrollment-details');
    expect(messages[0].content.text).toContain('123');
  });

  it('should require user_id argument', () => {
    expect(() => getPromptMessages('learner-progress', {})).toThrow('Missing required argument: user_id');
  });
});
