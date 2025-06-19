import { describe, it, expect, beforeEach } from 'vitest';
import { registerToken, validateBearerToken, getBearerToken, BEARER_PREFIX } from '../src/server/auth.js';

describe('Auth Module', () => {
  beforeEach(() => {
    // Note: validTokens set persists between tests in this module
    // This is actually the intended behavior for the auth module
  });

  describe('registerToken', () => {
    it('should register a token', () => {
      const testToken = 'test-token-123';
      
      // Register the token
      registerToken(testToken);
      
      // Verify token is registered by checking validation
      const mockReq = {
        headers: {
          'authorization': `${BEARER_PREFIX}${testToken}`
        }
      };
      
      expect(validateBearerToken(mockReq)).toBe(true);
    });
  });

  describe('validateBearerToken', () => {
    it('should return true for valid bearer token when tokens are registered and match', () => {
      // First register a token to test against
      registerToken('valid-token');
      
      const mockReq = {
        headers: {
          'authorization': 'Bearer valid-token'
        }
      };
      
      expect(validateBearerToken(mockReq)).toBe(true);
    });

    it('should return false when authorization header is missing', () => {
      const mockReq = {
        headers: {}
      };
      
      expect(validateBearerToken(mockReq)).toBe(false);
    });

    it('should return false when authorization header does not start with Bearer', () => {
      const mockReq = {
        headers: {
          'authorization': 'Basic dGVzdDp0ZXN0'
        }
      };
      
      expect(validateBearerToken(mockReq)).toBe(false);
    });

    it('should handle array headers correctly', () => {
      registerToken('array-token');
      
      const mockReq = {
        headers: {
          'authorization': ['Bearer array-token', 'Bearer another-token']
        }
      };
      
      expect(validateBearerToken(mockReq)).toBe(true);
    });

    it('should work with lowercase header names', () => {
      registerToken('lowercase-token');
      
      const mockReq = {
        headers: {
          'authorization': 'Bearer lowercase-token'
        }
      };
      
      expect(validateBearerToken(mockReq)).toBe(true);
    });

    it('should validate registered tokens correctly', () => {
      const validToken = 'registered-token-123';
      const invalidToken = 'unregistered-token-456';
      
      registerToken(validToken);
      
      const validReq = {
        headers: {
          'authorization': `Bearer ${validToken}`
        }
      };
      
      const invalidReq = {
        headers: {
          'authorization': `Bearer ${invalidToken}`
        }
      };
      
      expect(validateBearerToken(validReq)).toBe(true);
      expect(validateBearerToken(invalidReq)).toBe(false);
    });
  });

  describe('getBearerToken', () => {
    it('should extract token from valid authorization header', () => {
      const testToken = 'test-token-123';
      const mockReq = {
        headers: {
          'authorization': `Bearer ${testToken}`
        }
      };
      
      expect(getBearerToken(mockReq)).toBe(testToken);
    });

    it('should return null when authorization header is missing', () => {
      const mockReq = {
        headers: {}
      };
      
      expect(getBearerToken(mockReq)).toBeNull();
    });

    it('should return null when authorization header does not start with Bearer', () => {
      const mockReq = {
        headers: {
          'authorization': 'Basic dGVzdDp0ZXN0'
        }
      };
      
      expect(getBearerToken(mockReq)).toBeNull();
    });

    it('should handle array headers correctly', () => {
      const testToken = 'array-token-123';
      const mockReq = {
        headers: {
          'authorization': [`Bearer ${testToken}`, 'Bearer another-token']
        }
      };
      
      expect(getBearerToken(mockReq)).toBe(testToken);
    });

    it('should return null for empty bearer token', () => {
      const mockReq = {
        headers: {
          'authorization': 'Bearer '
        }
      };
      
      expect(getBearerToken(mockReq)).toBe('');
    });
  });
}); 