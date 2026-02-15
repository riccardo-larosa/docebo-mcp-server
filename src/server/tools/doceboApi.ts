import axios, { type AxiosRequestConfig } from 'axios';

/**
 * Lightweight HTTP client for Docebo API calls from workflow tools.
 * Handles URL construction, auth headers, timeouts, and error formatting.
 */
export class DoceboApiClient {
  private baseUrl: string;
  private token: string;

  constructor(bearerToken: string, apiBaseUrl: string) {
    this.token = bearerToken;
    this.baseUrl = apiBaseUrl.replace(/\/+$/, '');
  }

  async get<T = any>(path: string, params?: Record<string, any>): Promise<T> {
    return this.request<T>({ method: 'GET', path, params });
  }

  async post<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>({ method: 'POST', path, data: body });
  }

  private async request<T>(opts: { method: string; path: string; params?: Record<string, any>; data?: any }): Promise<T> {
    const url = `${this.baseUrl}/${opts.path.replace(/^\/+/, '')}`;
    const config: AxiosRequestConfig = {
      method: opts.method,
      url,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/json',
        ...(opts.data !== undefined && { 'Content-Type': 'application/json' }),
      },
      timeout: 30000,
      ...(opts.params && { params: opts.params }),
      ...(opts.data !== undefined && { data: opts.data }),
    };

    try {
      const response = await axios(config);
      return response.data as T;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        const { status, statusText, data } = error.response;
        const detail = typeof data === 'string' ? data : JSON.stringify(data);
        throw new Error(`Docebo API error: ${status} ${statusText} — ${detail}`);
      }
      throw error;
    }
  }
}
