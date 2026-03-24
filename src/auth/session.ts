import { tokenStorage, refreshTokenStorage } from './storage.js';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * Attempt a silent token refresh using the stored refresh token.
 *
 * Uses a raw fetch (not the SDK API client) to avoid:
 *   1. Circular dependency: client → session → client
 *   2. Triggering the client's own 401 → tryRefreshSession loop
 *
 * Returns true if a new access token was obtained and stored.
 *
 * On network error the refresh token is NOT cleared — it may still be
 * valid once connectivity returns.  On 401/403 the token is cleared
 * because the server has explicitly rejected it (expired / revoked).
 */
export async function tryRefreshSession(apiBaseUrl: string): Promise<boolean> {
  const rt = refreshTokenStorage.get();
  if (!rt) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  try {
    const resp = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
      credentials: 'omit',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      // Server rejected the token — it has expired or been revoked.
      // Clear it so we don't retry on every page load.
      refreshTokenStorage.clear();
      return false;
    }

    const data = (await resp.json()) as RefreshResponse;

    if (!data?.accessToken || !data?.refreshToken) {
      refreshTokenStorage.clear();
      return false;
    }

    // Store new access token and rotate the refresh token
    tokenStorage.set(data.accessToken);
    refreshTokenStorage.set(data.refreshToken);
    return true;
  } catch {
    // Network error or timeout — don't clear the refresh token
    clearTimeout(timeoutId);
    return false;
  }
}
