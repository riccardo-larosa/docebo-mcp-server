import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios
const mockAxios = vi.fn();
vi.mock('axios', () => ({
  default: Object.assign(
    (...args: any[]) => mockAxios(...args),
    { isAxiosError: (e: any) => e?.isAxiosError === true }
  ),
}));

const { MyProfileTool } = await import('../../src/server/tools/workflows/myProfile.js');

describe('MyProfileTool', () => {
  const tool = new MyProfileTool();
  const token = 'test-token';
  const apiBaseUrl = 'https://acme.docebosaas.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name and annotations', () => {
    expect(tool.name).toBe('get_my_profile');
    const def = tool.getToolDefinition();
    expect(def.annotations?.readOnlyHint).toBe(true);
  });

  it('should return current user profile from session endpoint', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: {
        data: {
          id: 13242,
          username: 'Riccardo',
          firstname: 'Riccardo',
          lastname: 'La Rosa',
          email: 'riccardo@example.com',
          user_level: 'super_admin',
          timezone: 'America/New_York',
          language: 'en',
        },
      },
    });

    const result = await tool.handleRequest({}, token, apiBaseUrl);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.user_id).toBe(13242);
    expect(data.username).toBe('Riccardo');
    expect(data.first_name).toBe('Riccardo');
    expect(data.last_name).toBe('La Rosa');
    expect(data.email).toBe('riccardo@example.com');
    expect(data.user_level).toBe('super_admin');
    expect(data.timezone).toBe('America/New_York');
    expect(data.language).toBe('en');
  });

  it('should work with no arguments', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: {
        data: {
          id: 100,
          username: 'learner1',
          firstname: 'Jane',
          lastname: 'Doe',
          email: 'jane@example.com',
          user_level: 'user',
          timezone: 'UTC',
          language: 'en',
        },
      },
    });

    const result = await tool.handleRequest({}, token, apiBaseUrl);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.user_id).toBe(100);
    expect(data.user_level).toBe('user');
  });

  it('should handle missing authentication token', async () => {
    const result = await tool.handleRequest({}, undefined, apiBaseUrl);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('authentication');
  });

  it('should handle missing API base URL', async () => {
    const result = await tool.handleRequest({}, token, undefined);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('API base URL');
  });

  it('should handle API error', async () => {
    const error = new Error('Unauthorized') as any;
    error.isAxiosError = true;
    error.response = { status: 401, statusText: 'Unauthorized', data: 'Invalid token' };
    mockAxios.mockRejectedValueOnce(error);

    const result = await tool.handleRequest({}, token, apiBaseUrl);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('401');
  });

  it('should call the correct endpoint', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { id: 1, username: 'test', firstname: 'T', lastname: 'U', email: 't@e.com', user_level: 'user', timezone: 'UTC', language: 'en' } },
    });

    await tool.handleRequest({}, token, apiBaseUrl);

    expect(mockAxios).toHaveBeenCalledOnce();
    const callConfig = mockAxios.mock.calls[0][0];
    expect(callConfig.url).toBe('https://acme.docebosaas.com/manage/v1/user/session');
    expect(callConfig.method).toBe('GET');
  });
});
