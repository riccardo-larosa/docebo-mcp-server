import { describe, it, expect } from 'vitest';
import { extractTenant, resolveTenantApiBaseUrl, isValidTenantSlug } from '../src/server/tenant.js';

describe('isValidTenantSlug', () => {
  it('should accept lowercase alphanumeric slugs', () => {
    expect(isValidTenantSlug('acme')).toBe(true);
    expect(isValidTenantSlug('corp-training')).toBe(true);
    expect(isValidTenantSlug('tenant123')).toBe(true);
  });

  it('should reject invalid slugs', () => {
    expect(isValidTenantSlug('')).toBe(false);
    expect(isValidTenantSlug('a'.repeat(64))).toBe(false);
    expect(isValidTenantSlug('has spaces')).toBe(false);
    expect(isValidTenantSlug('UPPERCASE')).toBe(false);
    expect(isValidTenantSlug('has.dots')).toBe(false);
    expect(isValidTenantSlug('-starts-with-dash')).toBe(false);
  });
});

describe('extractTenant', () => {
  it('should extract tenant from subdomain', () => {
    expect(extractTenant('acme.mcp.yourdomain.com')).toBe('acme');
  });

  it('should extract tenant from multi-level subdomain', () => {
    expect(extractTenant('corp.mcp.example.com')).toBe('corp');
  });

  it('should return null for bare domain', () => {
    expect(extractTenant('mcp.yourdomain.com')).toBeNull();
  });

  it('should return null for localhost', () => {
    expect(extractTenant('localhost')).toBeNull();
    expect(extractTenant('localhost:3000')).toBeNull();
  });

  it('should return null for IP addresses', () => {
    expect(extractTenant('127.0.0.1:3000')).toBeNull();
  });

  it('should return null for empty/missing host', () => {
    expect(extractTenant('')).toBeNull();
    expect(extractTenant(undefined)).toBeNull();
  });

  it('should strip port before extracting', () => {
    expect(extractTenant('acme.mcp.yourdomain.com:3000')).toBe('acme');
  });

  it('should return null for invalid tenant slugs in subdomain', () => {
    expect(extractTenant('INVALID.mcp.yourdomain.com')).toBeNull();
  });
});

describe('resolveTenantApiBaseUrl', () => {
  it('should return API_BASE_URL when set (single-tenant mode)', () => {
    const result = resolveTenantApiBaseUrl('acme.mcp.example.com', 'https://acme.docebosaas.com');
    expect(result).toBe('https://acme.docebosaas.com');
  });

  it('should derive URL from subdomain when API_BASE_URL is not set', () => {
    const result = resolveTenantApiBaseUrl('acme.mcp.example.com', undefined);
    expect(result).toBe('https://acme.docebosaas.com');
  });

  it('should return null when no tenant can be resolved', () => {
    const result = resolveTenantApiBaseUrl('localhost:3000', undefined);
    expect(result).toBeNull();
  });
});
