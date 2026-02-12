import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs before importing the module
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}));

// Mock axios before importing the module
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

import fs from 'node:fs';
import axios from 'axios';

// Dynamic import so mocks are in place
const { getAccessToken } = await import('../src/server/oauth.js');

const BASE_URL = 'https://example.docebosaas.com';
const CLIENT_ID = 'test-client-id';
const CLIENT_SECRET = 'test-client-secret';
const USERNAME = 'testuser';
const PASSWORD = 'testpass';

describe('OAuth Token Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should obtain a new token when no cache exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'new-token-123', expires_in: 3600 },
    });

    const token = await getAccessToken(BASE_URL, CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD);

    expect(token).toBe('new-token-123');
    expect(axios.post).toHaveBeenCalledOnce();
    expect(fs.writeFileSync).toHaveBeenCalledOnce();
  });

  it('should cache token to disk after obtaining', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'cached-token', expires_in: 7200 },
    });

    await getAccessToken(BASE_URL, CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD);

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('.docebo-mcp'),
      { recursive: true }
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('tokens.json'),
      expect.stringContaining('cached-token'),
      'utf-8'
    );
  });

  it('should load valid cached token and skip HTTP call', async () => {
    const futureExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ access_token: 'cached-valid-token', expires_at: futureExpiry })
    );

    const token = await getAccessToken(BASE_URL, CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD);

    expect(token).toBe('cached-valid-token');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('should refresh expired token', async () => {
    const pastExpiry = Math.floor(Date.now() / 1000) - 100; // expired
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ access_token: 'expired-token', expires_at: pastExpiry })
    );
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'refreshed-token', expires_in: 3600 },
    });

    const token = await getAccessToken(BASE_URL, CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD);

    expect(token).toBe('refreshed-token');
    expect(axios.post).toHaveBeenCalledOnce();
  });

  it('should respect 5-minute expiry buffer', async () => {
    // Token expires in 4 minutes — within the 5-minute buffer, so should be treated as expired
    const nearExpiry = Math.floor(Date.now() / 1000) + 240;
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ access_token: 'near-expiry-token', expires_at: nearExpiry })
    );
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'new-token', expires_in: 3600 },
    });

    const token = await getAccessToken(BASE_URL, CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD);

    expect(token).toBe('new-token');
    expect(axios.post).toHaveBeenCalledOnce();
  });

  it('should handle corrupted cache and fall back to new token', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('not-valid-json{{{');
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'fallback-token', expires_in: 3600 },
    });

    const token = await getAccessToken(BASE_URL, CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD);

    expect(token).toBe('fallback-token');
    expect(axios.post).toHaveBeenCalledOnce();
  });

  it('should send correct OAuth request params', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: 'token', expires_in: 3600 },
    });

    await getAccessToken(BASE_URL, CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD);

    const [url, body, config] = vi.mocked(axios.post).mock.calls[0];
    expect(url).toBe(`${BASE_URL}/oauth2/token`);
    expect(body).toContain('grant_type=password');
    expect(body).toContain(`client_id=${CLIENT_ID}`);
    expect(body).toContain(`client_secret=${CLIENT_SECRET}`);
    expect(body).toContain(`username=${USERNAME}`);
    expect(body).toContain(`password=${PASSWORD}`);
    expect(body).toContain('scope=api');
    expect(config).toEqual({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  });

  it('should throw when access_token is missing from response', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(axios.post).mockResolvedValue({
      data: { expires_in: 3600 }, // no access_token
    });

    await expect(
      getAccessToken(BASE_URL, CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD)
    ).rejects.toThrow('access_token');
  });

  it('should propagate network errors', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(axios.post).mockRejectedValue(new Error('Network Error'));

    await expect(
      getAccessToken(BASE_URL, CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD)
    ).rejects.toThrow('Network Error');
  });
});
