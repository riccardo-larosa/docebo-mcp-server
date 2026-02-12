import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import axios from 'axios';

/**
 * Disk-based token cache stored at ~/.docebo-mcp/tokens.json
 */
interface CachedToken {
  access_token: string;
  expires_at: number; // epoch seconds
}

const CACHE_DIR = path.join(os.homedir(), '.docebo-mcp');
const CACHE_FILE = path.join(CACHE_DIR, 'tokens.json');
const EXPIRY_BUFFER_SECONDS = 300; // 5-minute safety buffer

/**
 * Load a cached token from disk. Returns the access_token if still valid, undefined otherwise.
 */
function loadCachedToken(): string | undefined {
  try {
    if (!fs.existsSync(CACHE_FILE)) return undefined;
    const data: CachedToken = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    if (data.access_token && data.expires_at > (Date.now() / 1000) + EXPIRY_BUFFER_SECONDS) {
      return data.access_token;
    }
  } catch {
    // Corrupted cache — ignore
  }
  return undefined;
}

/**
 * Save a token to the disk cache.
 */
function saveCachedToken(accessToken: string, expiresIn: number): void {
  const data: CachedToken = {
    access_token: accessToken,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Obtain an access token using the OAuth2 resource owner password grant.
 * POST {apiBaseUrl}/oauth2/token with grant_type=password.
 */
async function obtainToken(
  apiBaseUrl: string,
  clientId: string,
  clientSecret: string,
  username: string,
  password: string
): Promise<string> {
  const tokenResponse = await axios.post(
    `${apiBaseUrl}/oauth2/token`,
    new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password,
      scope: 'api',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, expires_in } = tokenResponse.data;
  if (!access_token) {
    throw new Error('Token response did not contain an access_token');
  }

  saveCachedToken(access_token, expires_in ?? 3600);
  console.error('Obtained new Docebo access token via password grant.');
  return access_token;
}

/**
 * Get a valid access token, using the disk cache if available,
 * otherwise requesting a new one via password grant.
 */
export async function getAccessToken(
  apiBaseUrl: string,
  clientId: string,
  clientSecret: string,
  username: string,
  password: string
): Promise<string> {
  const cached = loadCachedToken();
  if (cached) {
    console.error('Using cached Docebo access token.');
    return cached;
  }

  console.error('No valid cached token. Requesting new token via password grant...');
  return obtainToken(apiBaseUrl, clientId, clientSecret, username, password);
}
