import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios
const mockAxios = vi.fn();
vi.mock('axios', () => ({
  default: Object.assign(
    (...args: any[]) => mockAxios(...args),
    { isAxiosError: (e: any) => e?.isAxiosError === true }
  ),
}));

const { DoceboApiClient } = await import('../../src/server/tools/doceboApi.js');

describe('DoceboApiClient', () => {
  let client: InstanceType<typeof DoceboApiClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DoceboApiClient('test-token', 'https://acme.docebosaas.com');
  });

  describe('get', () => {
    it('should make GET request with correct URL and auth header', async () => {
      mockAxios.mockResolvedValue({
        status: 200,
        data: { data: { items: [] } },
      });

      await client.get('learn/v1/courses');

      const config = mockAxios.mock.calls[0][0];
      expect(config.method).toBe('GET');
      expect(config.url).toBe('https://acme.docebosaas.com/learn/v1/courses');
      expect(config.headers.Authorization).toBe('Bearer test-token');
      expect(config.timeout).toBe(30000);
    });

    it('should pass query params', async () => {
      mockAxios.mockResolvedValue({ status: 200, data: { data: {} } });

      await client.get('manage/v1/user', { search_text: 'jane', page: 0 });

      const config = mockAxios.mock.calls[0][0];
      expect(config.params.search_text).toBe('jane');
      expect(config.params.page).toBe(0);
    });

    it('should return response data', async () => {
      mockAxios.mockResolvedValue({
        status: 200,
        data: { data: { items: [{ id: 1 }] } },
      });

      const result = await client.get('learn/v1/courses');
      expect(result).toEqual({ data: { items: [{ id: 1 }] } });
    });

    it('should throw descriptive error on failure', async () => {
      const error = new Error('Request failed') as any;
      error.isAxiosError = true;
      error.response = { status: 404, statusText: 'Not Found', data: { message: 'Not found' } };
      mockAxios.mockRejectedValue(error);

      await expect(client.get('learn/v1/courses/999')).rejects.toThrow('404');
    });
  });

  describe('post', () => {
    it('should make POST request with JSON body', async () => {
      mockAxios.mockResolvedValue({ status: 200, data: { success: true } });

      await client.post('learn/v1/enrollments/1/2', { level: 3 });

      const config = mockAxios.mock.calls[0][0];
      expect(config.method).toBe('POST');
      expect(config.url).toBe('https://acme.docebosaas.com/learn/v1/enrollments/1/2');
      expect(config.data).toEqual({ level: 3 });
      expect(config.headers['Content-Type']).toBe('application/json');
    });
  });
});
