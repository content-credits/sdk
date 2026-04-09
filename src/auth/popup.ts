import { tokenStorage, refreshTokenStorage } from './storage.js';

interface AuthCallbackMessage {
  type: string;
  token?: string;
  refreshToken?: string | null;
}

function isAuthCallback(data: unknown): data is AuthCallbackMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'cc_auth_callback'
  );
}

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
  // Use the user-agent to detect genuine mobile/tablet devices where popups
  // are either blocked by the OS or produce a terrible UX (full-screen tab).
  // We intentionally do NOT gate on window.innerWidth — a desktop user with
  // a narrow window or DevTools open still deserves a popup, not a redirect
  // that navigates them away from the article they were reading.
  const ua = navigator.userAgent;
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  // Touch-capable desktop Chrome devices can report a coarse pointer even when
  // the primary experience is still desktop. Treat coarse pointer as mobile
  // only when it also looks like a small-screen device.
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(max-width: 768px)').matches
  ) {
    return true;
  }
  return false;
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
 *
 * If we're running inside a popup window (window.opener exists), we notify
 * the opener via postMessage and close ourselves — this prevents the popup
 * from showing the full article page after a successful login redirect.
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

      // If we're inside a popup (opened by openAuthPopup), notify the opener
      // and close instead of rendering the page. This fixes the bug where the
      // popup shows the blog article after the accounts redirect.
      const opener = window.opener as Window | null;
      if (opener && !opener.closed) {
        try {
          opener.postMessage(
            { type: 'cc_auth_callback', token, refreshToken: refreshToken ?? null },
            window.location.origin
          );
        } catch {
          // opener is cross-origin or restricted — fall through, URL polling will handle it
        }
        // Brief delay so the opener can process the message before the popup closes
        setTimeout(() => { try { window.close(); } catch { /* ignore */ } }, 300);
      }

      return token;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Open a centered auth popup and wait for the token callback.
 *
 * Primary path: listens for a postMessage from the popup page (sent by
 * consumeTokenFromUrl when the accounts redirect lands on our origin).
 *
 * Fallback path: polls popup.location.href every 200 ms for cases where
 * postMessage isn't available (e.g. some mobile browsers, extensions).
 *
 * Returns a promise that resolves with the token when login completes,
 * or null if the popup is closed without completing login.
 */
export function openAuthPopup(authUrl: string): Promise<string | null> {
  return new Promise(resolve => {
    let popup: Window | null = null;
    let settled = false;

    function finish(token: string | null): void {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      window.removeEventListener('message', onMessage);
      resolve(token);
    }

    // ── Primary: postMessage from popup ───────────────────────────────────
    function onMessage(event: MessageEvent): void {
      // Only accept messages from our own origin
      if (event.origin !== window.location.origin) return;
      if (!isAuthCallback(event.data)) return;

      const token = event.data.token;
      const refreshToken = event.data.refreshToken;

      if (!token) return;

      tokenStorage.set(token);
      if (refreshToken) refreshTokenStorage.set(refreshToken);
      try { popup?.close(); } catch { /* ignore */ }
      finish(token);
    }

    window.addEventListener('message', onMessage);

    try {
      popup = window.open(authUrl, POPUP_NAME, centeredSpecs());
    } catch {
      window.removeEventListener('message', onMessage);
      resolve(null);
      return;
    }

    if (!popup || popup.closed) {
      window.removeEventListener('message', onMessage);
      resolve(null);
      return;
    }

    // ── Fallback: URL polling ─────────────────────────────────────────────
    const POLL_MS = 200;
    const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += POLL_MS;

      if (!popup || popup.closed) {
        finish(tokenStorage.get());
        return;
      }

      if (elapsed > MAX_WAIT_MS) {
        try { popup.close(); } catch { /* ignore */ }
        finish(null);
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
            if (refreshToken) refreshTokenStorage.set(refreshToken);
            try { popup.close(); } catch { /* ignore */ }
            finish(token);
          }
        }
      } catch {
        // cross-origin error — popup is on accounts domain, not ours yet; keep polling
      }
    }, POLL_MS);
  });
}
