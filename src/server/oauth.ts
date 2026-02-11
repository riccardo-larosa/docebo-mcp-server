import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
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
 * Open a URL in the user's default browser (cross-platform).
 */
function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open'
    : platform === 'win32' ? 'start'
    : 'xdg-open';
  exec(`${cmd} "${url}"`);
}

/**
 * Run the OAuth2 authorization code flow:
 * 1. Start a temporary local HTTP server on a random port
 * 2. Open the browser to the Docebo authorize endpoint
 * 3. Wait for the redirect callback with the authorization code
 * 4. Exchange the code for an access token
 * 5. Cache the token to disk
 */
async function obtainToken(apiBaseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const callbackServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url!, `http://localhost`);
        if (url.pathname !== '/callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const code = url.searchParams.get('code');
        if (!code) {
          res.writeHead(400);
          res.end('Missing authorization code');
          reject(new Error('No authorization code received in callback'));
          callbackServer.close();
          return;
        }

        // Exchange code for token
        const redirectUri = `http://localhost:${(callbackServer.address() as any).port}/callback`;
        const tokenResponse = await axios.post(`${apiBaseUrl}/oauth2/token`, new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }).toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const { access_token, expires_in } = tokenResponse.data;
        saveCachedToken(access_token, expires_in ?? 3600);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Authorization successful!</h2><p>You can close this tab and return to your terminal.</p></body></html>');

        callbackServer.close();
        resolve(access_token);
      } catch (err: any) {
        res.writeHead(500);
        res.end('Token exchange failed');
        callbackServer.close();
        reject(err);
      }
    });

    // Listen on a random available port
    callbackServer.listen(0, () => {
      const port = (callbackServer.address() as any).port;
      const redirectUri = encodeURIComponent(`http://localhost:${port}/callback`);
      const authorizeUrl = `${apiBaseUrl}/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${redirectUri}`;

      console.error(`Opening browser for Docebo authorization...`);
      console.error(`If the browser doesn't open, visit: ${authorizeUrl}`);
      openBrowser(authorizeUrl);
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      callbackServer.close();
      reject(new Error('Authorization timed out after 2 minutes'));
    }, 120_000);
  });
}

/**
 * Get a valid access token, using the disk cache if available,
 * otherwise running the full OAuth authorization code flow.
 */
export async function getAccessToken(apiBaseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const cached = loadCachedToken();
  if (cached) {
    console.error('Using cached Docebo access token.');
    return cached;
  }

  console.error('No valid cached token found. Starting OAuth authorization flow...');
  return obtainToken(apiBaseUrl, clientId, clientSecret);
}
