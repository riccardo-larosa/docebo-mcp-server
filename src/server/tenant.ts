/**
 * Validates that a string is a valid tenant slug.
 * Rules: lowercase alphanumeric + hyphens, 1-63 chars, cannot start/end with hyphen.
 */
export function isValidTenantSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug);
}

/**
 * Extracts tenant slug from a Host header value.
 * Expects format: {tenant}.{rest} where rest has at least 3 parts (e.g. mcp.domain.com).
 * Returns null if no valid tenant can be extracted.
 */
export function extractTenant(host: string | undefined): string | null {
  if (!host) return null;

  // Strip port
  const hostname = host.split(':')[0];

  // Skip localhost and IP addresses
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null;
  }

  const parts = hostname.split('.');
  // Need at least 4 parts: tenant.mcp.domain.tld
  if (parts.length < 4) return null;

  const tenant = parts[0];
  return isValidTenantSlug(tenant) ? tenant : null;
}

/**
 * Resolves the API base URL for a request.
 *
 * - If apiBaseUrlEnv is set → single-tenant mode, return it directly
 * - Otherwise → extract tenant from Host header, construct https://{tenant}.docebosaas.com
 * - Returns null if no tenant can be resolved
 */
export function resolveTenantApiBaseUrl(host: string | undefined, apiBaseUrlEnv: string | undefined): string | null {
  // Single-tenant mode: API_BASE_URL is explicitly set
  if (apiBaseUrlEnv) {
    return apiBaseUrlEnv;
  }

  // Multi-tenant mode: extract from subdomain
  const tenant = extractTenant(host);
  if (!tenant) return null;

  return `https://${tenant}.docebosaas.com`;
}
