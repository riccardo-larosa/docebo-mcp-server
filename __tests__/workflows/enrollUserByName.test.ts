import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAxios = vi.fn();
vi.mock('axios', () => ({
  default: Object.assign(
    (...args: any[]) => mockAxios(...args),
    { isAxiosError: (e: any) => e?.isAxiosError === true }
  ),
}));

const { EnrollUserByNameTool } = await import('../../src/server/tools/workflows/enrollUserByName.js');

describe('EnrollUserByNameTool', () => {
  const tool = new EnrollUserByNameTool();
  const token = 'test-token';
  const apiBaseUrl = 'https://acme.docebosaas.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct name and annotations', () => {
    expect(tool.name).toBe('enroll_user_by_name');
    const def = tool.getToolDefinition();
    expect(def.annotations?.readOnlyHint).toBe(false);
  });

  it('should enroll when exactly one user and one course match', async () => {
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
    // Mock enrollment POST
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { success: true } },
    });

    const result = await tool.handleRequest({
      user_search: 'Jane Doe',
      course_search: 'Compliance 101',
    }, token, apiBaseUrl);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.enrolled).toBe(true);
    expect(data.user.user_id).toBe(42);
    expect(data.course.id_course).toBe(10);

    // Verify enrollment POST was called
    const postCall = mockAxios.mock.calls[2][0];
    expect(postCall.method).toBe('POST');
    expect(postCall.url).toContain('learn/v1/enrollments/10/42');
  });

  it('should return candidates when multiple users match', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 1, username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com' },
        { user_id: 2, username: 'jdoe2', first_name: 'John', last_name: 'Doe', email: 'john@acme.com' },
      ] } },
    });

    const result = await tool.handleRequest({
      user_search: 'Doe',
      course_search: 'Compliance',
    }, token, apiBaseUrl);

    expect(result.isError).toBe(true);
    const text = result.content[0].text;
    expect(text).toContain('Multiple users');
    expect(text).toContain('Jane');
    expect(text).toContain('John');
  });

  it('should return candidates when multiple courses match', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 42, username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, name: 'Compliance 101' },
        { id_course: 11, name: 'Compliance 201' },
      ] } },
    });

    const result = await tool.handleRequest({
      user_search: 'Jane',
      course_search: 'Compliance',
    }, token, apiBaseUrl);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Multiple courses');
  });

  it('should return error when no user found', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [] } },
    });

    const result = await tool.handleRequest({
      user_search: 'Nonexistent',
      course_search: 'Course',
    }, token, apiBaseUrl);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No users found');
  });

  it('should return error when no course found', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 42, username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [] } },
    });

    const result = await tool.handleRequest({
      user_search: 'Jane',
      course_search: 'Nonexistent',
    }, token, apiBaseUrl);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No courses found');
  });

  it('should handle missing token', async () => {
    const result = await tool.handleRequest({
      user_search: 'Jane',
      course_search: 'Compliance',
    }, undefined, apiBaseUrl);
    expect(result.isError).toBe(true);
  });

  it('should handle missing apiBaseUrl', async () => {
    const result = await tool.handleRequest({
      user_search: 'Jane',
      course_search: 'Compliance',
    }, token, undefined);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('API base URL');
  });

  it('should pass level parameter when provided', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 42, username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, name: 'Compliance 101', status: 'published' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { success: true } },
    });

    await tool.handleRequest({
      user_search: 'Jane',
      course_search: 'Compliance',
      level: 3,
    }, token, apiBaseUrl);

    const postCall = mockAxios.mock.calls[2][0];
    expect(postCall.data).toEqual({ level: 3 });
  });

  it('should not send body when level is not provided', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 42, username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@acme.com' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, name: 'Compliance 101', status: 'published' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { success: true } },
    });

    await tool.handleRequest({
      user_search: 'Jane',
      course_search: 'Compliance',
    }, token, apiBaseUrl);

    const postCall = mockAxios.mock.calls[2][0];
    expect(postCall.data).toBeUndefined();
  });

  it('should fall back to username when first/last name missing', async () => {
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { user_id: 42, username: 'sysadmin', email: 'admin@acme.com' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { items: [
        { id_course: 10, name: 'Compliance 101', status: 'published' },
      ] } },
    });
    mockAxios.mockResolvedValueOnce({
      status: 200,
      data: { data: { success: true } },
    });

    const result = await tool.handleRequest({
      user_search: 'sysadmin',
      course_search: 'Compliance',
    }, token, apiBaseUrl);

    const data = JSON.parse(result.content[0].text);
    expect(data.user.name).toBe('sysadmin');
  });

  it('should require both user_search and course_search', async () => {
    const result = await tool.handleRequest({ user_search: 'Jane' }, token, apiBaseUrl);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('course_search');
  });
});
