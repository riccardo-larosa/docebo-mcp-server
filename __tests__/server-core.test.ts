import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Capture registered handlers from the mock Server
const registeredHandlers = new Map<any, Function>();

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  return {
    Server: class MockServer {
      constructor() {}
      setRequestHandler(schema: any, handler: Function) {
        registeredHandlers.set(schema, handler);
      }
    },
  };
});

// Mock axios — default export is a callable function + has .isAxiosError
const mockAxios = vi.fn();
(mockAxios as any).isAxiosError = vi.fn(() => false);

vi.mock('axios', () => ({
  default: Object.assign(
    (...args: any[]) => mockAxios(...args),
    { isAxiosError: (e: any) => e?.isAxiosError === true }
  ),
}));

import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import after mocks are set up
const { createServer, toolDefinitionMap, securitySchemes, SERVER_NAME, SERVER_VERSION, CHARACTER_LIMIT, formatAsMarkdown, extractPaginationMetadata } = await import('../src/server/core.js');


describe('Server Core — createServer()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a server and register all four handlers', () => {
    createServer();
    expect(registeredHandlers.size).toBe(4);
  });

  it('should export SERVER_NAME and SERVER_VERSION', () => {
    expect(SERVER_NAME).toBe('docebo-mcp-server');
    expect(SERVER_VERSION).toBe('0.3.0');
  });

  it('should export CHARACTER_LIMIT', () => {
    expect(CHARACTER_LIMIT).toBe(25000);
  });

  it('should have tools in toolDefinitionMap', () => {
    expect(toolDefinitionMap.size).toBeGreaterThan(0);
  });

  it('should export securitySchemes with bearerAuth', () => {
    expect(securitySchemes).toHaveProperty('bearerAuth');
    expect(securitySchemes.bearerAuth.type).toBe('http');
    expect(securitySchemes.bearerAuth.scheme).toBe('bearer');
  });
});

describe('Server Core — ListTools handler', () => {
  let listToolsHandler: Function;

  beforeEach(() => {
    registeredHandlers.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createServer();
    listToolsHandler = registeredHandlers.get(ListToolsRequestSchema)!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return all tool definitions', async () => {
    const result = await listToolsHandler();
    expect(result.tools).toBeDefined();
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBe(toolDefinitionMap.size);
  });

  it('should include name, description, inputSchema for each tool', async () => {
    const result = await listToolsHandler();
    for (const tool of result.tools) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
    }
  });

  it('should include annotations when present', async () => {
    const result = await listToolsHandler();
    const toolWithAnnotations = result.tools.find((t: any) => t.annotations);
    expect(toolWithAnnotations).toBeDefined();
    expect(toolWithAnnotations.annotations).toHaveProperty('readOnlyHint');
  });

  it('should include workflow tools in listing', async () => {
    const result = await listToolsHandler();
    const toolNames = result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('get_learner_dashboard');
    expect(toolNames).toContain('get_team_training_report');
    expect(toolNames).toContain('enroll_user_by_name');
  });

  it('should return correct annotations for workflow tools', async () => {
    const result = await listToolsHandler();
    const dashboard = result.tools.find((t: any) => t.name === 'get_learner_dashboard');
    expect(dashboard.annotations.readOnlyHint).toBe(true);

    const enroll = result.tools.find((t: any) => t.name === 'enroll_user_by_name');
    expect(enroll.annotations.readOnlyHint).toBe(false);
  });
});

describe('Server Core — ListPrompts handler', () => {
  let listPromptsHandler: Function;

  beforeEach(() => {
    registeredHandlers.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createServer();
    listPromptsHandler = registeredHandlers.get(ListPromptsRequestSchema)!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return registered prompts', async () => {
    const result = await listPromptsHandler();
    expect(result.prompts).toBeDefined();
    expect(Array.isArray(result.prompts)).toBe(true);
    expect(result.prompts.length).toBeGreaterThan(0);
  });

  it('should include name and description for each prompt', async () => {
    const result = await listPromptsHandler();
    for (const prompt of result.prompts) {
      expect(prompt).toHaveProperty('name');
      expect(prompt).toHaveProperty('description');
    }
  });
});

describe('Server Core — GetPrompt handler', () => {
  let getPromptHandler: Function;

  beforeEach(() => {
    registeredHandlers.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createServer();
    getPromptHandler = registeredHandlers.get(GetPromptRequestSchema)!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return messages for a valid prompt', async () => {
    const result = await getPromptHandler({ params: { name: 'course-enrollment-report', arguments: { user_ids: '123' } } });
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0].role).toBe('user');
  });

  it('should pass arguments to the prompt', async () => {
    const result = await getPromptHandler({ params: { name: 'course-enrollment-report', arguments: { user_ids: '123', course_name: 'Onboarding' } } });
    expect(result.messages[0].content.text).toContain('Onboarding');
  });

  it('should throw for non-existent prompt', async () => {
    await expect(getPromptHandler({ params: { name: 'nonexistent', arguments: {} } }))
      .rejects.toThrow('Prompt not found');
  });
});

describe('Server Core — CallTool handler', () => {
  let callToolHandler: Function;

  const authExtra = { authInfo: { token: 'test-token-123' }, apiBaseUrl: 'https://example.docebosaas.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createServer();
    callToolHandler = registeredHandlers.get(CallToolRequestSchema)!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return error for unknown tool', async () => {
    const result = await callToolHandler({
      params: { name: 'nonexistent-tool', arguments: {} },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');
  });

  it('should execute list_courses and return API response', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { items: [{ id: 1, name: 'Course 1' }] } },
    });

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: { page: 0, page_size: 10 } },
    }, authExtra);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('API Response (Status: 200)');
    expect(result.content[0].text).toContain('Course 1');
  });

  it('should resolve path parameters for get_course', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { id: 42, name: 'Test Course' } },
    });

    const result = await callToolHandler({
      params: { name: 'get_course', arguments: { course_id: '42' } },
    }, authExtra);

    expect(result.isError).toBeUndefined();

    // Check that axios was called with the resolved URL
    const axiosCall = mockAxios.mock.calls[0][0];
    expect(axiosCall.url).toContain('learn/v1/courses/42');
    expect(axiosCall.url).not.toContain('{course_id}');
  });

  it('should include timeout in axios config', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: {},
    });

    await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    }, authExtra);

    const axiosCall = mockAxios.mock.calls[0][0];
    expect(axiosCall.timeout).toBe(30000);
  });

  it('should return validation error for missing required args', async () => {
    const result = await callToolHandler({
      params: { name: 'get_course', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('should return validation error for wrong arg types', async () => {
    const result = await callToolHandler({
      params: { name: 'get_course', arguments: { course_id: 123 } },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('should apply bearer token header from authInfo', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: {},
    });

    await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    }, authExtra);

    const axiosCall = mockAxios.mock.calls[0][0];
    expect(axiosCall.headers.authorization).toBe('Bearer test-token-123');
  });

  it('should handle string response data', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/plain' },
      data: 'plain text response',
    });

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    });

    expect(result.content[0].text).toContain('plain text response');
  });

  it('should handle empty response body', async () => {
    mockAxios.mockResolvedValue({
      status: 204,
      headers: {},
      data: undefined,
    });

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    });

    expect(result.content[0].text).toContain('Status: 204');
    expect(result.content[0].text).toContain('No body content');
  });

  it('should handle non-string, non-object response data', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/plain' },
      data: 12345,
    });

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    });

    expect(result.content[0].text).toContain('12345');
  });

  it('should truncate oversized responses', async () => {
    const largeData = { data: { items: Array(1000).fill({ id: 1, name: 'x'.repeat(100) }) } };
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: largeData,
    });

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    }, authExtra);

    expect(result.content[0].text).toContain('[Response truncated');
    expect(result.content[0].text).toContain('pagination');
  });

  it('should handle axios errors with response body', async () => {
    const axiosError = new Error('Request failed') as any;
    axiosError.isAxiosError = true;
    axiosError.response = {
      status: 404,
      statusText: 'Not Found',
      data: { message: 'Course not found' },
    };
    mockAxios.mockRejectedValue(axiosError);

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('404');
    expect(result.content[0].text).toContain('Not Found');
  });

  it('should handle axios errors with string response body', async () => {
    const axiosError = new Error('Request failed') as any;
    axiosError.isAxiosError = true;
    axiosError.response = {
      status: 500,
      statusText: 'Internal Server Error',
      data: 'Server exploded',
    };
    mockAxios.mockRejectedValue(axiosError);

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Server exploded');
  });

  it('should handle axios errors with no response body', async () => {
    const axiosError = new Error('Request failed') as any;
    axiosError.isAxiosError = true;
    axiosError.response = {
      status: 502,
      statusText: 'Bad Gateway',
      data: null,
    };
    mockAxios.mockRejectedValue(axiosError);

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No response body received');
  });

  it('should handle axios network errors (no response)', async () => {
    const axiosError = new Error('Network Error') as any;
    axiosError.isAxiosError = true;
    axiosError.request = {};
    axiosError.code = 'ECONNREFUSED';
    mockAxios.mockRejectedValue(axiosError);

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Network Error');
    expect(result.content[0].text).toContain('ECONNREFUSED');
  });

  it('should handle non-axios errors', async () => {
    mockAxios.mockRejectedValue(new Error('Random failure'));

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Random failure');
  });

  it('should handle unexpected non-Error throw', async () => {
    mockAxios.mockRejectedValue('string error');

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('string error');
  });

  it('should log error when no bearer token is available', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: {},
    });

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Call without authInfo — no token available
    await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    });

    const logLines = stderrSpy.mock.calls.map(c => String(c[0]));
    const missingTokenLog = logLines.find(l => l.includes('missing_bearer_token'));
    expect(missingTokenLog).toBeDefined();

    stderrSpy.mockRestore();
  });

  it('should handle null arguments gracefully', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { items: [] },
    });

    const result = await callToolHandler({
      params: { name: 'list_courses' },
    });

    expect(result.isError).toBeUndefined();
  });

  it('should execute list_enrollments and return API response', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { items: [{ id: 1, user_id: 10, course_id: 20, status: 'completed' }] } },
    });

    const result = await callToolHandler({
      params: { name: 'list_enrollments', arguments: { id_user: '10' } },
    }, authExtra);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('API Response (Status: 200)');
    expect(result.content[0].text).toContain('completed');

    const axiosCall = mockAxios.mock.calls[0][0];
    expect(axiosCall.url).toContain('learn/v1/enrollments');
    expect(axiosCall.params.id_user).toBe('10');
  });

  it('should execute list_users and return API response', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { items: [{ user_id: 1, username: 'jdoe', email: 'jdoe@example.com' }] } },
    });

    const result = await callToolHandler({
      params: { name: 'list_users', arguments: { search_text: 'jdoe' } },
    }, authExtra);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('API Response (Status: 200)');
    expect(result.content[0].text).toContain('jdoe');

    const axiosCall = mockAxios.mock.calls[0][0];
    expect(axiosCall.url).toContain('manage/v1/user');
    expect(axiosCall.params.search_text).toBe('jdoe');
  });

  it('should resolve path parameters for get_user', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { user_id: 42, username: 'test-user' } },
    });

    const result = await callToolHandler({
      params: { name: 'get_user', arguments: { user_id: '42' } },
    }, authExtra);

    expect(result.isError).toBeUndefined();

    const axiosCall = mockAxios.mock.calls[0][0];
    expect(axiosCall.url).toContain('manage/v1/user/42');
    expect(axiosCall.url).not.toContain('{user_id}');
  });

  it('should format response as markdown when response_format is markdown', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { items: [{ id_course: 1, name: 'Course A', status: 'published' }] } },
    });

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: { response_format: 'markdown' } },
    }, authExtra);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('## list_courses');
    expect(result.content[0].text).toContain('Course A');
  });

  it('should return JSON by default', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { items: [{ id: 1, name: 'Course A' }] } },
    });

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    }, authExtra);

    expect(result.content[0].text).toContain('"name": "Course A"');
  });

  it('should append pagination metadata for GET endpoints', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { items: [], total_count: 100, current_page: 0, page_size: 20, has_more_data: true } },
    });

    const result = await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    }, authExtra);

    expect(result.content[0].text).toContain('Pagination:');
    expect(result.content[0].text).toContain('total_count=100');
    expect(result.content[0].text).toContain('has_more=true');
  });

  it('should not send response_format to the API', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { items: [] } },
    });

    await callToolHandler({
      params: { name: 'list_courses', arguments: { response_format: 'markdown' } },
    }, authExtra);

    const axiosCall = mockAxios.mock.calls[0][0];
    expect(axiosCall.params).not.toHaveProperty('response_format');
  });
});

describe('Server Core — New tools in ListTools', () => {
  let listToolsHandler: Function;

  beforeEach(() => {
    registeredHandlers.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createServer();
    listToolsHandler = registeredHandlers.get(ListToolsRequestSchema)!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should include enrollment tools in ListTools response', async () => {
    const result = await listToolsHandler();
    const toolNames = result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('list_enrollments');
    expect(toolNames).toContain('get_enrollment_details');
  });

  it('should include user tools in ListTools response', async () => {
    const result = await listToolsHandler();
    const toolNames = result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('list_users');
    expect(toolNames).toContain('get_user');
  });
});

describe('Server Core — Workflow tools via CallTool', () => {
  let callToolHandler: Function;

  const authExtra = { authInfo: { token: 'test-token-123', apiBaseUrl: 'https://example.docebosaas.com' } };

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createServer();
    callToolHandler = registeredHandlers.get(CallToolRequestSchema)!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute get_learner_dashboard workflow tool', async () => {
    // Mock user profile
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { user_id: 42, username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com' } },
    });
    // Mock enrollments
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, course_name: 'Compliance', status: 'completed', completion_percentage: 100, score: 90 },
      ] } },
    });

    const result = await callToolHandler({
      params: { name: 'get_learner_dashboard', arguments: { user_id: '42' } },
    }, authExtra);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.user.username).toBe('jdoe');
    expect(data.enrollments).toHaveLength(1);
  });

  it('should execute enroll_user_by_name workflow tool', async () => {
    // Mock user search
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 42, username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com' },
      ] } },
    });
    // Mock course search
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, name: 'Compliance 101', status: 'published' },
      ] } },
    });
    // Mock enrollment
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { success: true } },
    });

    const result = await callToolHandler({
      params: { name: 'enroll_user_by_name', arguments: { user_search: 'Jane', course_search: 'Compliance' } },
    }, authExtra);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.enrolled).toBe(true);
  });

  it('should return validation error for workflow tool with missing required args', async () => {
    const result = await callToolHandler({
      params: { name: 'get_learner_dashboard', arguments: {} },
    }, authExtra);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('user_id');
  });
});

describe('Server Core — team-training-status prompt', () => {
  let listPromptsHandler: Function;
  let getPromptHandler: Function;

  beforeEach(() => {
    registeredHandlers.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createServer();
    listPromptsHandler = registeredHandlers.get(ListPromptsRequestSchema)!;
    getPromptHandler = registeredHandlers.get(GetPromptRequestSchema)!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should include team-training-status in ListPrompts', async () => {
    const result = await listPromptsHandler();
    const promptNames = result.prompts.map((p: any) => p.name);
    expect(promptNames).toContain('team-training-status');
  });

  it('should return messages for team-training-status without arguments', async () => {
    const result = await getPromptHandler({ params: { name: 'team-training-status', arguments: {} } });
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content.text).toContain('list_users');
    expect(result.messages[0].content.text).toContain('list_enrollments');
    expect(result.messages[0].content.text).toContain('Include all team members');
    expect(result.messages[0].content.text).toContain('Include all assigned trainings');
  });

  it('should filter by training_name when provided', async () => {
    const result = await getPromptHandler({ params: { name: 'team-training-status', arguments: { training_name: 'Compliance' } } });
    expect(result.messages[0].content.text).toContain('Compliance');
    expect(result.messages[0].content.text).toContain('list_courses');
  });

  it('should filter by team_member when provided', async () => {
    const result = await getPromptHandler({ params: { name: 'team-training-status', arguments: { team_member: 'Jane Doe' } } });
    expect(result.messages[0].content.text).toContain('Jane Doe');
  });
});

describe('Server Core — course-recommendations prompt', () => {
  let listPromptsHandler: Function;
  let getPromptHandler: Function;

  beforeEach(() => {
    registeredHandlers.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createServer();
    listPromptsHandler = registeredHandlers.get(ListPromptsRequestSchema)!;
    getPromptHandler = registeredHandlers.get(GetPromptRequestSchema)!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should include course-recommendations in ListPrompts', async () => {
    const result = await listPromptsHandler();
    const promptNames = result.prompts.map((p: any) => p.name);
    expect(promptNames).toContain('course-recommendations');
  });

  it('should return messages for course-recommendations without arguments', async () => {
    const result = await getPromptHandler({ params: { name: 'course-recommendations', arguments: {} } });
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content.text).toContain('list_users');
    expect(result.messages[0].content.text).toContain('list_enrollments');
    expect(result.messages[0].content.text).toContain('list_courses');
    expect(result.messages[0].content.text).toContain('Ask the user');
  });

  it('should include user_name in prompt when provided', async () => {
    const result = await getPromptHandler({ params: { name: 'course-recommendations', arguments: { user_name: 'John Smith' } } });
    expect(result.messages[0].content.text).toContain('John Smith');
    expect(result.messages[0].content.text).toContain('list_users');
    expect(result.messages[0].content.text).not.toContain('Ask the user');
  });

  it('should include interest_area in prompt when provided', async () => {
    const result = await getPromptHandler({ params: { name: 'course-recommendations', arguments: { interest_area: 'leadership' } } });
    expect(result.messages[0].content.text).toContain('leadership');
    expect(result.messages[0].content.text).toContain('search_text="leadership"');
  });

  it('should include both arguments when provided', async () => {
    const result = await getPromptHandler({ params: { name: 'course-recommendations', arguments: { user_name: 'Jane Doe', interest_area: 'data science' } } });
    expect(result.messages[0].content.text).toContain('Jane Doe');
    expect(result.messages[0].content.text).toContain('data science');
  });
});

describe('Server Core — list_courses search params', () => {
  let callToolHandler: Function;
  const authExtra = { authInfo: { token: 'test-token-123' }, apiBaseUrl: 'https://example.docebosaas.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createServer();
    callToolHandler = registeredHandlers.get(CallToolRequestSchema)!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass search_text as query param to axios', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { items: [] } },
    });

    await callToolHandler({
      params: { name: 'list_courses', arguments: { search_text: 'compliance' } },
    }, authExtra);

    const axiosCall = mockAxios.mock.calls[0][0];
    expect(axiosCall.params.search_text).toBe('compliance');
  });

  it('should pass category and status as query params to axios', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { items: [] } },
    });

    await callToolHandler({
      params: { name: 'list_courses', arguments: { category: 'Safety', status: 'published' } },
    }, authExtra);

    const axiosCall = mockAxios.mock.calls[0][0];
    expect(axiosCall.params.category).toBe('Safety');
    expect(axiosCall.params.status).toBe('published');
  });

  it('should pass sort_by and sort_order as query params to axios', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { items: [] } },
    });

    await callToolHandler({
      params: { name: 'list_courses', arguments: { sort_by: 'name', sort_order: 'asc' } },
    }, authExtra);

    const axiosCall = mockAxios.mock.calls[0][0];
    expect(axiosCall.params.sort_by).toBe('name');
    expect(axiosCall.params.sort_order).toBe('asc');
  });

  it('should apply default pagination when no page args provided', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { items: [] } },
    });

    await callToolHandler({
      params: { name: 'list_courses', arguments: {} },
    }, authExtra);

    const axiosCall = mockAxios.mock.calls[0][0];
    expect(axiosCall.params.page).toBe(0);
    expect(axiosCall.params.page_size).toBe(20);
  });
});

describe('Server Core — formatAsMarkdown', () => {
  it('should format list responses as markdown', () => {
    const data = {
      data: {
        items: [
          { id_course: 1, name: 'Course A', status: 'published', type: 'elearning' },
          { id_course: 2, name: 'Course B', status: 'draft' },
        ],
      },
    };
    const result = formatAsMarkdown(data, 'list_courses');
    expect(result).toContain('## list_courses Results');
    expect(result).toContain('**Course A**');
    expect(result).toContain('published');
    expect(result).toContain('**Course B**');
  });

  it('should format single record responses as markdown', () => {
    const data = {
      data: {
        id_course: 42,
        name: 'Test Course',
        type: 'elearning',
        status: 'published',
      },
    };
    const result = formatAsMarkdown(data, 'get_course');
    expect(result).toContain('## get_course Result');
    expect(result).toContain('**name**: Test Course');
    expect(result).toContain('**type**: elearning');
  });

  it('should cap items at 50', () => {
    const items = Array(60).fill(null).map((_, i) => ({ id: i, name: `Item ${i}` }));
    const data = { data: { items } };
    const result = formatAsMarkdown(data, 'list_courses');
    expect(result).toContain('...and 10 more items');
  });

  it('should fallback to JSON for unrecognized data', () => {
    const result = formatAsMarkdown(null, 'test');
    expect(result).toBe('null');
  });
});

describe('Server Core — extractPaginationMetadata', () => {
  it('should extract pagination fields from data.data', () => {
    const data = {
      data: {
        items: [],
        total_count: 100,
        current_page: 2,
        page_size: 20,
        has_more_data: true,
      },
    };
    const result = extractPaginationMetadata(data);
    expect(result).toContain('total_count=100');
    expect(result).toContain('current_page=2');
    expect(result).toContain('page_size=20');
    expect(result).toContain('has_more=true');
  });

  it('should return null when no pagination fields present', () => {
    const data = { data: { items: [] } };
    const result = extractPaginationMetadata(data);
    expect(result).toBeNull();
  });

  it('should handle partial pagination fields', () => {
    const data = { data: { total_count: 50 } };
    const result = extractPaginationMetadata(data);
    expect(result).toContain('total_count=50');
    expect(result).not.toContain('current_page');
  });
});

describe('Server Core — prompts use snake_case tool names', () => {
  let getPromptHandler: Function;

  beforeEach(() => {
    registeredHandlers.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createServer();
    getPromptHandler = registeredHandlers.get(GetPromptRequestSchema)!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('course-enrollment-report should reference snake_case tool names', async () => {
    const result = await getPromptHandler({ params: { name: 'course-enrollment-report', arguments: { user_ids: '123' } } });
    const text = result.messages[0].content.text;
    expect(text).toContain('get_user_progress');
    expect(text).toContain('list_courses');
    expect(text).toContain('get_enrollment_details');
    expect(text).not.toContain('get-user-progress');
    expect(text).not.toContain('list-all-courses');
  });

  it('learner-progress should reference snake_case tool names', async () => {
    const result = await getPromptHandler({ params: { name: 'learner-progress', arguments: { user_id: '123' } } });
    const text = result.messages[0].content.text;
    expect(text).toContain('get_user_progress');
    expect(text).toContain('get_enrollment_details');
    expect(text).not.toContain('get-user-progress');
    expect(text).not.toContain('get-enrollment-details');
  });
});
