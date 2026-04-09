import { describe, it, expect, beforeEach } from 'vitest';
import { decodeJwt, isTokenExpired, getUserIdFromToken } from '../src/auth/token';
import { tokenStorage } from '../src/auth/storage';
import { isMobileDevice } from '../src/auth/popup';

// A real JWT with exp far in the future: { id: 'user123', exp: 9999999999 }
const VALID_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  btoa(JSON.stringify({ id: 'user123', email: 'test@example.com', exp: 9999999999, iat: 1000000000 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') +
  '.fake-signature';

const EXPIRED_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  btoa(JSON.stringify({ id: 'user123', exp: 1, iat: 0 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') +
  '.fake-signature';

describe('token.ts', () => {
  it('decodes a valid JWT payload', () => {
    const payload = decodeJwt(VALID_JWT);
    expect(payload).not.toBeNull();
    expect(payload?.id).toBe('user123');
  });

  it('returns null for a malformed token', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull();
    expect(decodeJwt('')).toBeNull();
  });

  it('identifies a valid (non-expired) token', () => {
    expect(isTokenExpired(VALID_JWT)).toBe(false);
  });

  it('identifies an expired token', () => {
    expect(isTokenExpired(EXPIRED_JWT)).toBe(true);
  });

  it('returns true for a malformed token', () => {
    expect(isTokenExpired('garbage')).toBe(true);
  });

  it('extracts user ID from token', () => {
    expect(getUserIdFromToken(VALID_JWT)).toBe('user123');
  });

  it('returns null for invalid token when extracting ID', () => {
    expect(getUserIdFromToken('bad')).toBeNull();
  });
});

describe('tokenStorage', () => {
  beforeEach(() => {
    tokenStorage.clear();
  });

  it('stores and retrieves a valid token', () => {
    tokenStorage.set(VALID_JWT);
    expect(tokenStorage.get()).toBe(VALID_JWT);
    expect(tokenStorage.has()).toBe(true);
  });

  it('clears the token', () => {
    tokenStorage.set(VALID_JWT);
    tokenStorage.clear();
    expect(tokenStorage.get()).toBeNull();
    expect(tokenStorage.has()).toBe(false);
  });

  it('returns null and clears when storing an expired token then retrieving', () => {
    // Bypass the set (which doesn't check expiry) to simulate a token that
    // was valid when stored but is now expired
    sessionStorage.setItem('cc_sdk_token', EXPIRED_JWT);
    // Force clear memory layer by clearing first
    tokenStorage.clear();
    // Now put the expired token directly in sessionStorage
    sessionStorage.setItem('cc_sdk_token', EXPIRED_JWT);
    expect(tokenStorage.get()).toBeNull();
  });
});

describe('isMobileDevice', () => {
  it('returns false for touch-enabled desktop environments', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    });
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    expect(isMobileDevice()).toBe(false);
  });

  it('returns true for small-screen coarse-pointer devices', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    });
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)' || query === '(max-width: 768px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    expect(isMobileDevice()).toBe(true);
  });
});
