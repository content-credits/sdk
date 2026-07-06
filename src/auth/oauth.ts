import { tokenStorage, refreshTokenStorage } from './storage.js';
import { isMobileDevice, openCenteredPopup } from './popup.js';
import type { ResolvedConfig } from '../types/index.js';

const PENDING_KEY = 'cc_pkce_pending';
// Poll cadence for the `/auth/token/poll` fallback. Kept tight (well under the
// popup's own ~300–500ms self-close) so a poll always runs before — and one
// last time after — the popup goes away. A slower cadence let the popup close
// before the first tick, so the fallback never fired and login hung.
const POLL_INTERVAL_MS = 500;
const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes

interface PendingAuthorization {
  state: string;
  verifier: string;
}

interface AuthCodeMessage {
  type: string;
  code?: string;
  state?: string;
}

function isAuthCodeMessage(data: unknown): data is AuthCodeMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'cc_auth_code'
  );
}

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function base64url(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(new Uint8Array(digest));
}

// ── Pending-authorization persistence ───────────────────────────────────────
//
// Memory-first approach: PKCE state is kept in-memory where possible to reduce
// XSS exposure window. Falls back to sessionStorage only for redirect flows
// (mobile, popup-blocked) where memory is cleared by the page navigation.
//
// Security rationale:
// - Memory storage is invisible to other scripts on the page
// - sessionStorage is XSS-accessible but required for redirect-back flows
// - The PKCE verifier is only useful during the brief auth flow window

// In-memory store for PKCE state (survives only during auth flow)
let pendingAuth: PendingAuthorization | null = null;

function storePending(pending: PendingAuthorization): void {
  pendingAuth = pending;
  // Fallback to sessionStorage only if memory is cleared (page refresh during auth)
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // sessionStorage unavailable (e.g. private mode) — memory-only
  }
}

function takePending(): PendingAuthorization | null {
  // Prefer memory (not XSS-accessible)
  if (pendingAuth) {
    const result = pendingAuth;
    pendingAuth = null;
    // Also clear sessionStorage to avoid stale state
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      // ignore
    }
    return result;
  }

  // Fallback to sessionStorage (page was refreshed during auth flow)
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as PendingAuthorization;
  } catch {
    return null;
  }
}

// ── Token exchange ───────────────────────────────────────────────────────────

async function exchangeCode(apiBaseUrl: string, code: string, verifier: string): Promise<boolean> {
  try {
    const resp = await fetch(`${apiBaseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier }),
      credentials: 'omit',
    });

    if (!resp.ok) return false;

    const data = (await resp.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken || !data.refreshToken) return false;

    tokenStorage.set(data.accessToken);
    refreshTokenStorage.set(data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function pollForCode(apiBaseUrl: string, state: string): Promise<string | null> {
  try {
    const resp = await fetch(`${apiBaseUrl}/auth/token/poll?state=${encodeURIComponent(state)}`, {
      method: 'GET',
      credentials: 'omit',
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { code?: string | null };
    return data.code ?? null;
  } catch {
    return null;
  }
}

// ── URL helpers ──────────────────────────────────────────────────────────────

function buildAuthorizeUrl(config: ResolvedConfig, state: string, codeChallenge: string): string {
  const url = new URL('/authorize', config.accountsUrl);
  url.searchParams.set('client_id', config.apiKey);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('origin', window.location.origin);
  url.searchParams.set('redirect', config.articleUrl);
  return url.toString();
}

function accountsOrigin(config: ResolvedConfig): string {
  try {
    return new URL(config.accountsUrl).origin;
  } catch {
    return config.accountsUrl;
  }
}

// ── Wait for the popup to deliver the auth code ─────────────────────────────
//
// Primary path: postMessage from the /authorize popup, strictly checked
// against the accounts origin and our `state`.
//
// Fallback path: poll `/auth/token/poll?state=` — covers Cross-Origin-Opener-
// Policy setups where the popup's `window.opener` is severed and postMessage
// never arrives.

function waitForCode(popup: Window, config: ResolvedConfig, state: string): Promise<string | null> {
  return new Promise(resolve => {
    let settled = false;
    let polling = false;
    const expectedOrigin = accountsOrigin(config);
    const startedAt = Date.now();

    // When the code arrives via postMessage the popup is alive and owns its own
    // close — it self-closes after delivering, or lingers to show a post-signup
    // screen (e.g. a signup-bonus celebration) before closing itself. Only the
    // poll/timeout fallback closes the popup here: that path means the opener
    // was severed (COOP) so the popup can't self-close, or it's stuck.
    function finish(code: string | null, closePopup: boolean): void {
      if (settled) return;
      settled = true;
      clearInterval(pollTimer);
      window.removeEventListener('message', onMessage);
      if (closePopup) {
        try { if (!popup.closed) popup.close(); } catch { /* ignore */ }
      }
      resolve(code);
    }

    function onMessage(event: MessageEvent): void {
      if (event.origin !== expectedOrigin) return;
      if (!isAuthCodeMessage(event.data)) return;
      if (event.data.state !== state || !event.data.code) return;
      finish(event.data.code, false);
    }

    window.addEventListener('message', onMessage);

    // The popup hands its code to the server (`rawCodeForPoll`) whether or not
    // its postMessage reaches us and whether or not it has self-closed, so this
    // poll — not the message above — is the reliable path. Crucially we never
    // give up on `popup.closed` alone: a closed popup may have left a code in
    // the poll store, so we always run one more poll and only abandon the flow
    // once that comes back empty.
    const pollTimer = setInterval(() => {
      if (settled || polling) return;

      if (Date.now() - startedAt > MAX_WAIT_MS) {
        finish(null, true);
        return;
      }

      // Snapshot before the await: if the popup is already gone, this poll is
      // our last chance to recover the code it left behind.
      const popupGone = popup.closed;
      polling = true;

      void pollForCode(config.apiBaseUrl, state)
        .then(code => {
          if (settled) return;
          if (code) {
            finish(code, true);
          } else if (popupGone) {
            finish(null, false);
          }
        })
        .finally(() => { polling = false; });
    }, POLL_INTERVAL_MS);
  });
}

// ── Login (single-flight) ────────────────────────────────────────────────────

let pendingLogin: Promise<boolean> | null = null;

/**
 * Run the PKCE login flow:
 *  - desktop: opens an `/authorize` popup, waits for the auth code via
 *    postMessage (or `/auth/token/poll` fallback), then exchanges it.
 *  - mobile / blocked popup: full-page redirect to `/authorize`. The result
 *    is picked up by `consumeAuthCodeFromUrl` on the next page load.
 *
 * Concurrent calls (e.g. paywall + comments both triggering login) share a
 * single in-flight attempt.
 */
export function login(config: ResolvedConfig): Promise<boolean> {
  if (pendingLogin) return pendingLogin;
  pendingLogin = doLogin(config).finally(() => { pendingLogin = null; });
  return pendingLogin;
}

async function doLogin(config: ResolvedConfig): Promise<boolean> {
  const verifier = randomString(32);
  const state = randomString(16);
  const codeChallenge = await generateCodeChallenge(verifier);

  storePending({ state, verifier });

  const authUrl = buildAuthorizeUrl(config, state, codeChallenge);

  if (isMobileDevice()) {
    window.location.href = authUrl;
    // Navigating away — the result is picked up by consumeAuthCodeFromUrl
    // when the page reloads.
    return false;
  }

  const popup = openCenteredPopup(authUrl);
  if (!popup) {
    // Popup blocked — fall back to full-page redirect. Leave the pending PKCE
    // in sessionStorage: consumeAuthCodeFromUrl needs it on the next load.
    window.location.href = authUrl;
    return false;
  }

  try {
    const code = await waitForCode(popup, config, state);
    if (!code) return false;
    return await exchangeCode(config.apiBaseUrl, code, verifier);
  } finally {
    // The popup path resolves the code in-memory and never routes back through
    // consumeAuthCodeFromUrl, so nothing else clears the pending PKCE we stored
    // above. Drop it here so it can't linger in sessionStorage after the
    // attempt settles (whether it succeeded or failed).
    takePending();
  }
}

// ── Redirect-back consumption ────────────────────────────────────────────────

/**
 * Check the current URL for `cc_auth_code`/`cc_state` (set by `/authorize`'s
 * redirect-back fallback for the mobile flow and COOP-severed popups), scrub
 * them, and exchange the code for tokens if it matches our pending PKCE
 * verifier.
 *
 * If we're running inside a popup whose opener is reachable, notify it and
 * close — this covers the case where a COOP-severed popup navigated itself
 * back to the article URL with the code while the opener is still polling.
 */
export async function consumeAuthCodeFromUrl(config: ResolvedConfig): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return false;
  }

  const code = url.searchParams.get('cc_auth_code');
  const state = url.searchParams.get('cc_state');
  if (!code || !state) return false;

  url.searchParams.delete('cc_auth_code');
  url.searchParams.delete('cc_state');
  try { history.replaceState(null, '', url.toString()); } catch { /* ignore */ }

  const pending = takePending();
  if (!pending || pending.state !== state) return false;

  const ok = await exchangeCode(config.apiBaseUrl, code, pending.verifier);

  if (ok) {
    const opener = window.opener as Window | null;
    if (opener && !opener.closed) {
      try {
        opener.postMessage({ type: 'cc_auth_complete', state }, window.location.origin);
      } catch { /* cross-origin opener — ignore */ }
      setTimeout(() => { try { window.close(); } catch { /* ignore */ } }, 300);
    }
  }

  return ok;
}
