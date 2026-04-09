import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tokenStorage, refreshTokenStorage } from '../src/auth/storage';
import { tryRefreshSession } from '../src/auth/session';

const VALID_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  btoa(JSON.stringify({ id: 'user123', email: 'test@example.com', exp: 9999999999, iat: 1000000000 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') +
  '.fake-signature';

describe('refreshTokenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores, retrieves, and clears refresh tokens', () => {
    refreshTokenStorage.set('rt_123');
    expect(refreshTokenStorage.get()).toBe('rt_123');
    expect(refreshTokenStorage.has()).toBe(true);

    refreshTokenStorage.clear();
    expect(refreshTokenStorage.get()).toBeNull();
    expect(refreshTokenStorage.has()).toBe(false);
  });
});

describe('tryRefreshSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    tokenStorage.clear();
    refreshTokenStorage.clear();
    refreshTokenStorage.set('rt_123');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    tokenStorage.clear();
    refreshTokenStorage.clear();
  });

  it('returns false when no refresh token exists', async () => {
    refreshTokenStorage.clear();
    expect(await tryRefreshSession('https://api.contentcredits.com')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stores rotated tokens on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      accessToken: VALID_JWT,
      refreshToken: 'rt_rotated',
    }), { status: 200 }));

    await expect(tryRefreshSession('https://api.contentcredits.com')).resolves.toBe(true);
    expect(tokenStorage.get()).toBe(VALID_JWT);
    expect(refreshTokenStorage.get()).toBe('rt_rotated');
  });

  it('clears refresh token on rejected refresh response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      message: 'Unauthorized',
    }), { status: 401 }));

    await expect(tryRefreshSession('https://api.contentcredits.com')).resolves.toBe(false);
    expect(refreshTokenStorage.get()).toBeNull();
  });

  it('clears refresh token on malformed success payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      accessToken: VALID_JWT,
    }), { status: 200 }));

    await expect(tryRefreshSession('https://api.contentcredits.com')).resolves.toBe(false);
    expect(refreshTokenStorage.get()).toBeNull();
    expect(tokenStorage.get()).toBeNull();
  });

  it('keeps refresh token on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(tryRefreshSession('https://api.contentcredits.com')).resolves.toBe(false);
    expect(refreshTokenStorage.get()).toBe('rt_123');
  });
});
