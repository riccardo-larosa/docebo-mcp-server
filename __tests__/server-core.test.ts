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
const { createServer, toolDefinitionMap, securitySchemes, SERVER_NAME, SERVER_VERSION } = await import('../src/server/core.js');

describe('Server Core — createServer()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers.clear();
    process.env.BEARER_TOKEN_BEARERAUTH = 'test-token-123';
    process.env.API_BASE_URL = 'https://example.docebosaas.com';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.BEARER_TOKEN_BEARERAUTH;
    delete process.env.API_BASE_URL;
    vi.restoreAllMocks();
  });

  it('should create a server and register all four handlers', () => {
    createServer();
    expect(registeredHandlers.size).toBe(4);
  });

  it('should export SERVER_NAME and SERVER_VERSION', () => {
    expect(SERVER_NAME).toBe('docebo-mcp-server');
    expect(SERVER_VERSION).toBe('0.1.0');
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
    const result = await getPromptHandler({ params: { name: 'course-enrollment-report', arguments: {} } });
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0].role).toBe('user');
  });

  it('should pass arguments to the prompt', async () => {
    const result = await getPromptHandler({ params: { name: 'course-enrollment-report', arguments: { course_name: 'Onboarding' } } });
    expect(result.messages[0].content.text).toContain('Onboarding');
  });

  it('should throw for non-existent prompt', async () => {
    await expect(getPromptHandler({ params: { name: 'nonexistent', arguments: {} } }))
      .rejects.toThrow('Prompt not found');
  });
});

describe('Server Core — CallTool handler', () => {
  let callToolHandler: Function;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers.clear();
    process.env.BEARER_TOKEN_BEARERAUTH = 'test-token-123';
    process.env.API_BASE_URL = 'https://example.docebosaas.com';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createServer();
    callToolHandler = registeredHandlers.get(CallToolRequestSchema)!;
  });

  afterEach(() => {
    delete process.env.BEARER_TOKEN_BEARERAUTH;
    delete process.env.API_BASE_URL;
    vi.restoreAllMocks();
  });

  it('should return error for unknown tool', async () => {
    const result = await callToolHandler({
      params: { name: 'nonexistent-tool', arguments: {} },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');
  });

  it('should execute list-all-courses and return API response', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { items: [{ id: 1, name: 'Course 1' }] } },
    });

    const result = await callToolHandler({
      params: { name: 'list-all-courses', arguments: { page: '0', page_size: '10' } },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('API Response (Status: 200)');
    expect(result.content[0].text).toContain('Course 1');
  });

  it('should resolve path parameters for get-a-course', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { data: { id: 42, name: 'Test Course' } },
    });

    const result = await callToolHandler({
      params: { name: 'get-a-course', arguments: { course_id: '42' } },
    });

    expect(result.isError).toBeUndefined();

    // Check that axios was called with the resolved URL
    const axiosCall = mockAxios.mock.calls[0][0];
    expect(axiosCall.url).toContain('/learn/v1/courses/42');
    expect(axiosCall.url).not.toContain('{course_id}');
  });

  it('should return validation error for missing required args', async () => {
    const result = await callToolHandler({
      params: { name: 'get-a-course', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('should return validation error for wrong arg types', async () => {
    const result = await callToolHandler({
      params: { name: 'get-a-course', arguments: { course_id: 123 } },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('should apply bearer token header', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: {},
    });

    await callToolHandler({
      params: { name: 'list-all-courses', arguments: {} },
    });

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
      params: { name: 'list-all-courses', arguments: {} },
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
      params: { name: 'list-all-courses', arguments: {} },
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
      params: { name: 'list-all-courses', arguments: {} },
    });

    expect(result.content[0].text).toContain('12345');
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
      params: { name: 'list-all-courses', arguments: {} },
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
      params: { name: 'list-all-courses', arguments: {} },
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
      params: { name: 'list-all-courses', arguments: {} },
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
      params: { name: 'list-all-courses', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Network Error');
    expect(result.content[0].text).toContain('ECONNREFUSED');
  });

  it('should handle non-axios errors', async () => {
    mockAxios.mockRejectedValue(new Error('Random failure'));

    const result = await callToolHandler({
      params: { name: 'list-all-courses', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Random failure');
  });

  it('should handle unexpected non-Error throw', async () => {
    mockAxios.mockRejectedValue('string error');

    const result = await callToolHandler({
      params: { name: 'list-all-courses', arguments: {} },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('string error');
  });

  it('should use getAccessToken option when provided', async () => {
    registeredHandlers.clear();
    const mockGetToken = vi.fn().mockResolvedValue('dynamic-oauth-token');
    createServer({ getAccessToken: mockGetToken });
    const handler = registeredHandlers.get(CallToolRequestSchema)!;

    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: {},
    });

    await handler({ params: { name: 'list-all-courses', arguments: {} } });

    expect(mockGetToken).toHaveBeenCalledOnce();
    expect(process.env.BEARER_TOKEN_BEARERAUTH).toBe('dynamic-oauth-token');
  });

  it('should warn when no security credentials are found', async () => {
    delete process.env.BEARER_TOKEN_BEARERAUTH;

    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: {},
    });

    await callToolHandler({
      params: { name: 'list-all-courses', arguments: {} },
    });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('requires security'),
    );
  });

  it('should handle null arguments gracefully', async () => {
    mockAxios.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { items: [] },
    });

    const result = await callToolHandler({
      params: { name: 'list-all-courses' },
    });

    expect(result.isError).toBeUndefined();
  });
});
