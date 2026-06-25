import { isTokenExpired } from './token.js';

const SESSION_KEY = 'cc_sdk_token';
const REFRESH_KEY  = 'cc_rt';

/**
 * Token Storage Strategy
 *
 * SECURITY NOTE: Tokens stored in sessionStorage/localStorage are accessible
 * to any JavaScript on the page. This is an intentional tradeoff:
 * - HttpOnly cookies aren't accessible for API calls from JS
 * - The publisher site must implement CSP to mitigate XSS
 * - Refresh tokens are rotated on each use (reuse = revocation)
 *
 * Defense layers:
 * 1. Memory-first storage (cleared on page unload)
 * 2. Short-lived access tokens (15 min)
 * 3. Refresh token rotation with reuse detection
 * 4. Publisher-domain scoping (localStorage is origin-bound)
 *
 * ---
 *
 * Three-layer auth storage:
 *
 *  ACCESS TOKEN (short-lived JWT, ~15 min)
 *  ┌─ Layer 1: in-memory  — invisible to other scripts; cleared on page close
 *  └─ Layer 2: sessionStorage — survives soft reloads; cleared when tab closes
 *
 *  REFRESH TOKEN (long-lived opaque token, ~30 days)
 *  └─ Layer 3: localStorage — survives browser close; used to silently
 *     re-authenticate on the next visit without showing a popup
 *
 * We intentionally never write to document.cookie — both localStorage and
 * non-HttpOnly cookies are equally XSS-accessible.  The truly safe option
 * (HttpOnly server-set cookie) requires cross-site cookie support which
 * browsers are phasing out for third-party embeds.  localStorage is
 * first-party (publisher-domain scoped), never blocked, and the risk is
 * mitigated by short-lived access tokens and server-side refresh token rotation.
 */
let memoryToken: string | null = null;

export const tokenStorage = {
  set(token: string): void {
    memoryToken = token;
    try {
      sessionStorage.setItem(SESSION_KEY, token);
    } catch {
      // sessionStorage unavailable (e.g. private mode with strict settings) — ok
    }
  },

  get(): string | null {
    // Memory hit
    if (memoryToken) {
      if (isTokenExpired(memoryToken)) {
        this.clear();
        return null;
      }
      return memoryToken;
    }

    // sessionStorage fallback (page reloaded but tab still open)
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        if (isTokenExpired(stored)) {
          this.clear();
          return null;
        }
        memoryToken = stored; // warm up memory layer
        return stored;
      }
    } catch {
      // ignore
    }

    return null;
  },

  clear(): void {
    memoryToken = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  },

  has(): boolean {
    return this.get() !== null;
  },
};

/**
 * Refresh token storage — localStorage only.
 *
 * Stored on the publisher's domain (first-party storage) so it is never
 * subject to third-party cookie / storage blocking in any browser.
 * Refresh tokens are opaque strings issued by the backend and rotated
 * on every use.
 */
export const refreshTokenStorage = {
  set(token: string): void {
    try {
      localStorage.setItem(REFRESH_KEY, token);
    } catch {
      // localStorage unavailable (private mode with strict settings) — degrade
      // to session-only auth gracefully
    }
  },

  get(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      // ignore
    }
  },

  has(): boolean {
    return this.get() !== null;
  },
};
