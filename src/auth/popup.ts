import { tokenStorage, refreshTokenStorage } from './storage.js';

const POPUP_NAME = 'ccAuthPopup';
const POPUP_SPECS = 'scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no,width=600,height=650';

function centeredSpecs(): string {
  const width = 600;
  const height = 650;
  const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
  return `${POPUP_SPECS},left=${left},top=${top}`;
}

export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || window.innerWidth < 768;
}

/**
 * Scrub `token` and `cc_token` query parameters from the current URL
 * so the token doesn't appear in browser history or server logs.
 */
export function scrubTokenFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    let changed = false;
    ['token', 'cc_token', 'refresh_token', 'cc_refresh_token'].forEach(param => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    });
    if (changed) {
      history.replaceState(null, '', url.toString());
    }
  } catch {
    // ignore in environments without history API
  }
}

/**
 * Read and store a token that may have been placed in the current URL
 * (e.g. after a mobile redirect back from the accounts site).
 * Always scrubs the token from the URL after reading it.
 */
export function consumeTokenFromUrl(): string | null {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token') ?? url.searchParams.get('cc_token');
    const refreshToken = url.searchParams.get('refresh_token') ?? url.searchParams.get('cc_refresh_token');

    // Scrub ALL auth params before doing anything else
    scrubTokenFromUrl();

    if (refreshToken) {
      refreshTokenStorage.set(refreshToken);
    }
    if (token) {
      tokenStorage.set(token);
      return token;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Open a centered auth popup and poll for the token callback.
 * Returns a promise that resolves with the token when login completes,
 * or null if the popup is closed without completing login.
 */
export function openAuthPopup(authUrl: string): Promise<string | null> {
  return new Promise(resolve => {
    let popup: Window | null = null;

    try {
      popup = window.open(authUrl, POPUP_NAME, centeredSpecs());
    } catch {
      // popup blocked — fall through to null
    }

    // Popup blocked
    if (!popup || popup.closed) {
      resolve(null);
      return;
    }

    const POLL_MS = 200;
    const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += POLL_MS;

      if (!popup || popup.closed) {
        clearInterval(timer);
        resolve(tokenStorage.get()); // may have been set just before close
        return;
      }

      if (elapsed > MAX_WAIT_MS) {
        clearInterval(timer);
        try { popup.close(); } catch { /* ignore */ }
        resolve(null);
        return;
      }

      try {
        // Only readable once popup navigates back to our origin
        const popupUrl = popup.location.href;
        if (popupUrl.includes('/auth/callback') || popupUrl.includes('cc_token=') || popupUrl.includes('token=')) {
          const params = new URLSearchParams(popup.location.search);
          const token = params.get('token') ?? params.get('cc_token');
          const refreshToken = params.get('refresh_token') ?? params.get('cc_refresh_token');
          if (token) {
            tokenStorage.set(token);
            if (refreshToken) {
              refreshTokenStorage.set(refreshToken);
            }
            clearInterval(timer);
            try { popup.close(); } catch { /* ignore */ }
            resolve(token);
          }
        }
      } catch {
        // cross-origin error — popup is on accounts domain, not ours yet; keep polling
      }
    }, POLL_MS);
  });
}
