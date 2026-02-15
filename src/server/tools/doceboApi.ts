import axios, { type AxiosRequestConfig } from 'axios';
import { logger } from '../logger.js';

/**
 * Lightweight HTTP client for Docebo API calls from workflow tools.
 * Handles URL construction, auth headers, timeouts, and error formatting.
 * Emits a structured wide event for every outbound API call.
 */
export class DoceboApiClient {
  private baseUrl: string;
  private token: string;
  /** Number of API calls made by this client instance. */
  callCount = 0;

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
    const cleanPath = opts.path.replace(/^\/+/, '');
    const url = `${this.baseUrl}/${cleanPath}`;
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

    const start = Date.now();
    this.callCount++;

    // Build common log fields (include params for GET, body keys for POST)
    const logFields: Record<string, unknown> = {
      event: 'docebo_api_call',
      method: opts.method,
      path: cleanPath,
    };
    if (opts.params) logFields.params = opts.params;
    if (opts.data !== undefined) logFields.body = opts.data;

    try {
      const response = await axios(config);

      logger.info({
        ...logFields,
        status: response.status,
        duration_ms: Date.now() - start,
      });

      return response.data as T;
    } catch (error: unknown) {
      const duration_ms = Date.now() - start;

      if (axios.isAxiosError(error) && error.response) {
        const { status, statusText, data } = error.response;
        const detail = typeof data === 'string' ? data : JSON.stringify(data);

        logger.error({
          ...logFields,
          status,
          duration_ms,
          error: `${status} ${statusText}`,
        });

        throw new Error(`Docebo API error: ${status} ${statusText} — ${detail}`);
      }

      logger.error({
        ...logFields,
        status: null,
        duration_ms,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}
