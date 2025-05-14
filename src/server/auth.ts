
export const BEARER_TOKEN_HEADER = 'Authorization';
export const BEARER_PREFIX = 'Bearer ';
export const AUTH_SCHEME_NAME = 'bearerAuth';

const validTokens = new Set<string>();

/**
 * Registers a valid token
 * @param token The token to register as valid
 */
export function registerToken(token: string): void {
  validTokens.add(token);
}

/**
 * Validates a bearer token from the request headers
 * @param req The request object containing headers
 * @param tokenScheme The name of the token scheme
 * @returns True if the token is valid, false otherwise
 */
export function validateBearerToken(req: { headers: Record<string, string | string[] | undefined> }, tokenScheme: string = AUTH_SCHEME_NAME): boolean {
  const authHeader = req.headers[BEARER_TOKEN_HEADER.toLowerCase()] || req.headers[BEARER_TOKEN_HEADER];
  
  if (!authHeader) {
    return false;
  }
  
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  
  if (!headerValue || !headerValue.startsWith(BEARER_PREFIX)) {
    return false;
  }
  
  const token = headerValue.substring(BEARER_PREFIX.length);
  
  return validTokens.size === 0 || validTokens.has(token);
}

/**
 * Gets a bearer token from the request headers
 * @param req The request object containing headers
 * @returns The token or null if not found
 */
export function getBearerToken(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const authHeader = req.headers[BEARER_TOKEN_HEADER.toLowerCase()] || req.headers[BEARER_TOKEN_HEADER];
  
  if (!authHeader) {
    return null;
  }
  
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  
  if (!headerValue || !headerValue.startsWith(BEARER_PREFIX)) {
    return null;
  }
  
  return headerValue.substring(BEARER_PREFIX.length);
}
