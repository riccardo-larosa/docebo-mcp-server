import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios
const mockAxios = vi.fn();
vi.mock('axios', () => ({
  default: Object.assign(
    (...args: any[]) => mockAxios(...args),
    { isAxiosError: (e: any) => e?.isAxiosError === true }
  ),
}));

const { LearnerDashboardTool } = await import('../../src/server/tools/workflows/learnerDashboard.js');

describe('LearnerDashboardTool', () => {
  const tool = new LearnerDashboardTool();
  const token = 'test-token';
  const apiBaseUrl = 'https://acme.docebosaas.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name and annotations', () => {
    expect(tool.name).toBe('get_learner_dashboard');
    const def = tool.getToolDefinition();
    expect(def.annotations?.readOnlyHint).toBe(true);
  });

  it('should require user_id', async () => {
    const result = await tool.handleRequest({}, token, apiBaseUrl);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('user_id');
  });

  it('should return user profile and enrollments', async () => {
    // Mock GET /manage/v1/user/42
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { user_id: 42, username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com' } },
    });
    // Mock GET /learn/v1/enrollments?id_user=42
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, course_name: 'Compliance 101', status: 'completed', completion_percentage: 100, score: 95 },
        { id_course: 20, course_name: 'Leadership', status: 'in_progress', completion_percentage: 40, score: null },
      ] } },
    });

    const result = await tool.handleRequest({ user_id: '42' }, token, apiBaseUrl);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.user.username).toBe('jdoe');
    expect(data.enrollments).toHaveLength(2);
    expect(data.enrollments[0].course_name).toBe('Compliance 101');
    expect(data.enrollments[0].completion_percentage).toBe(100);
  });

  it('should handle user not found', async () => {
    const error = new Error('Not found') as any;
    error.isAxiosError = true;
    error.response = { status: 404, statusText: 'Not Found', data: 'User not found' };
    mockAxios.mockRejectedValueOnce(error);

    const result = await tool.handleRequest({ user_id: '999' }, token, apiBaseUrl);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('404');
  });

  it('should handle missing token', async () => {
    const result = await tool.handleRequest({ user_id: '42' }, undefined, apiBaseUrl);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('authentication');
  });

  it('should handle missing apiBaseUrl', async () => {
    const result = await tool.handleRequest({ user_id: '42' }, token, undefined);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('API base URL');
  });

  it('should handle user with no enrollments', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { user_id: 42, username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com' } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [] } },
    });

    const result = await tool.handleRequest({ user_id: '42' }, token, apiBaseUrl);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.enrollments).toHaveLength(0);
    expect(data.total_enrollments).toBe(0);
  });

  it('should use fallback fields for enrollment data', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { user_id: 42, username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com' } },
    });
    // Enrollment uses `name` instead of `course_name`, `completion` instead of `completion_percentage`
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, name: 'Safety Training', status: 'completed', completion: 100, score: 88 },
      ] } },
    });

    const result = await tool.handleRequest({ user_id: '42' }, token, apiBaseUrl);

    const data = JSON.parse(result.content[0].text);
    expect(data.enrollments[0].course_name).toBe('Safety Training');
    expect(data.enrollments[0].completion_percentage).toBe(100);
  });

  it('should handle API response without nested data wrapper', async () => {
    // Some endpoints return data directly without the nested .data wrapper
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { user_id: 42, username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com' },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [] } },
    });

    const result = await tool.handleRequest({ user_id: '42' }, token, apiBaseUrl);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.user.username).toBe('jdoe');
  });
});
