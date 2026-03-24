import { isTokenExpired } from './token.js';

const SESSION_KEY = 'cc_sdk_token';

/**
 * Two-layer token storage:
 *  1. In-memory (primary) — invisible to other scripts, survives page navigations
 *     within the same JS context but gone on hard reload.
 *  2. sessionStorage (secondary) — survives soft reloads, cleared when the tab
 *     closes, never shared across tabs.
 *
 * We intentionally never use document.cookie (no HttpOnly = XSS risk) or
 * localStorage (persists indefinitely across sessions).
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
