import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAxios = vi.fn();
vi.mock('axios', () => ({
  default: Object.assign(
    (...args: any[]) => mockAxios(...args),
    { isAxiosError: (e: any) => e?.isAxiosError === true }
  ),
}));

const { TeamTrainingReportTool } = await import('../../src/server/tools/workflows/teamTrainingReport.js');

describe('TeamTrainingReportTool', () => {
  const tool = new TeamTrainingReportTool();
  const token = 'test-token';
  const apiBaseUrl = 'https://acme.docebosaas.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name and annotations', () => {
    expect(tool.name).toBe('get_team_training_report');
    const def = tool.getToolDefinition();
    expect(def.annotations?.readOnlyHint).toBe(true);
  });

  it('should return aggregated report for multiple users', async () => {
    // Mock list users
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 1, username: 'alice', first_name: 'Alice', last_name: 'A', email: 'alice@acme.com' },
        { user_id: 2, username: 'bob', first_name: 'Bob', last_name: 'B', email: 'bob@acme.com' },
      ] } },
    });
    // Mock enrollments for user 1
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, course_name: 'Compliance', status: 'completed', completion_percentage: 100, score: 90 },
      ] } },
    });
    // Mock enrollments for user 2
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, course_name: 'Compliance', status: 'in_progress', completion_percentage: 50, score: null },
      ] } },
    });

    const result = await tool.handleRequest({}, token, apiBaseUrl);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.rows).toHaveLength(2);
    expect(data.rows[0].user_name).toContain('Alice');
    expect(data.summary.total_users).toBe(2);
  });

  it('should filter by course_name', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 1, username: 'alice', first_name: 'Alice', last_name: 'A', email: 'alice@acme.com' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, course_name: 'Compliance 101', status: 'completed', completion_percentage: 100, score: 95 },
        { id_course: 20, course_name: 'Leadership', status: 'in_progress', completion_percentage: 30, score: null },
      ] } },
    });

    const result = await tool.handleRequest({ course_name: 'Compliance' }, token, apiBaseUrl);

    const data = JSON.parse(result.content[0].text);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].course_name).toContain('Compliance');
  });

  it('should filter by status', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 1, username: 'alice', first_name: 'Alice', last_name: 'A', email: 'alice@acme.com' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, course_name: 'Compliance', status: 'completed', completion_percentage: 100, score: 95 },
        { id_course: 20, course_name: 'Leadership', status: 'in_progress', completion_percentage: 30, score: null },
      ] } },
    });

    const result = await tool.handleRequest({ status: 'completed' }, token, apiBaseUrl);

    const data = JSON.parse(result.content[0].text);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].status).toBe('completed');
  });

  it('should handle missing token', async () => {
    const result = await tool.handleRequest({}, undefined, apiBaseUrl);
    expect(result.isError).toBe(true);
  });

  it('should handle missing apiBaseUrl', async () => {
    const result = await tool.handleRequest({}, token, undefined);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('API base URL');
  });

  it('should pass search_text to user API', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [] } },
    });

    await tool.handleRequest({ search_text: 'engineering' }, token, apiBaseUrl);

    const config = mockAxios.mock.calls[0][0];
    expect(config.params.search_text).toBe('engineering');
  });

  it('should return N/A completion rate when no enrollments match', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 1, username: 'alice', first_name: 'Alice', last_name: 'A', email: 'alice@acme.com' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [] } },
    });

    const result = await tool.handleRequest({}, token, apiBaseUrl);

    const data = JSON.parse(result.content[0].text);
    expect(data.rows).toHaveLength(0);
    expect(data.summary.completion_rate).toBe('N/A');
  });

  it('should fall back to username when first/last name missing', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 1, username: 'sysadmin', email: 'admin@acme.com' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, course_name: 'Compliance', status: 'completed', completion_percentage: 100, score: 85 },
      ] } },
    });

    const result = await tool.handleRequest({}, token, apiBaseUrl);

    const data = JSON.parse(result.content[0].text);
    expect(data.rows[0].user_name).toBe('sysadmin');
  });

  it('should use fallback enrollment fields (name, completion)', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 1, username: 'alice', first_name: 'Alice', last_name: 'A', email: 'alice@acme.com' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, name: 'Safety 101', status: 'completed', completion: 100, score: 90 },
      ] } },
    });

    const result = await tool.handleRequest({}, token, apiBaseUrl);

    const data = JSON.parse(result.content[0].text);
    expect(data.rows[0].course_name).toBe('Safety 101');
    expect(data.rows[0].completion_percentage).toBe(100);
  });

  it('should apply both course_name and status filters together', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 1, username: 'alice', first_name: 'Alice', last_name: 'A', email: 'alice@acme.com' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, course_name: 'Compliance 101', status: 'completed', completion_percentage: 100, score: 95 },
        { id_course: 11, course_name: 'Compliance 201', status: 'in_progress', completion_percentage: 30, score: null },
        { id_course: 20, course_name: 'Leadership', status: 'completed', completion_percentage: 100, score: 88 },
      ] } },
    });

    const result = await tool.handleRequest({ course_name: 'Compliance', status: 'completed' }, token, apiBaseUrl);

    const data = JSON.parse(result.content[0].text);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].course_name).toBe('Compliance 101');
    expect(data.rows[0].status).toBe('completed');
  });
});
