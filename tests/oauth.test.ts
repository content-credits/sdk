import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tokenStorage, refreshTokenStorage } from '../src/auth/storage';
import { login, consumeAuthCodeFromUrl } from '../src/auth/oauth';
import type { ResolvedConfig } from '../src/types/index';

let mobile = false;
let popup: { closed: boolean; close: ReturnType<typeof vi.fn> } | null = null;

vi.mock('../src/auth/popup.js', () => ({
  isMobileDevice: vi.fn(() => mobile),
  openCenteredPopup: vi.fn(() => popup),
}));

const config = {
  apiKey: 'pub_123',
  articleUrl: 'https://example.com/post',
  apiBaseUrl: 'https://api.contentcredits.com',
  accountsUrl: 'https://accounts.contentcredits.com',
} as unknown as ResolvedConfig;

function base64urlOf(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const STATE = base64urlOf(new Uint8Array(16));
const VERIFIER = base64urlOf(new Uint8Array(32));

const VALID_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  btoa(JSON.stringify({ id: 'user123', email: 'test@example.com', exp: 9999999999, iat: 1000000000 }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') +
  '.fake-signature';

function setLocation(href: string): void {
  Object.defineProperty(window, 'location', {
    value: new URL(href),
    writable: true,
    configurable: true,
  });
}

describe('oauth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());

    // localStorage isn't available in this test environment — provide a
    // simple in-memory shim so refreshTokenStorage works as expected.
    const localStore = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (localStore.has(k) ? localStore.get(k)! : null),
      setItem: (k: string, v: string) => { localStore.set(k, v); },
      removeItem: (k: string) => { localStore.delete(k); },
      clear: () => localStore.clear(),
    });

    vi.spyOn(crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(arr: T): T => {
      if (arr instanceof Uint8Array) arr.fill(0);
      return arr;
    });
    // The real SHA-256 digest is CPU-heavy under coverage instrumentation —
    // stub it so PKCE setup resolves quickly. Its output value is irrelevant
    // to these tests (only the resulting code/state exchange is checked).
    vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer);
    mobile = false;
    popup = null;
    tokenStorage.clear();
    refreshTokenStorage.clear();
    sessionStorage.clear();
    setLocation('http://localhost:3000/post');
    Object.defineProperty(window, 'opener', { value: null, writable: true, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('redirects to /authorize on mobile devices and returns false', async () => {
      mobile = true;

      const result = await login(config);

      expect(result).toBe(false);
      expect(window.location.href).toContain(`${config.accountsUrl}/authorize?`);
      expect(window.location.href).toContain(`client_id=${config.apiKey}`);
    });

    it('falls back to a full-page redirect when the popup is blocked', async () => {
      popup = null;

      const result = await login(config);

      expect(result).toBe(false);
      expect(window.location.href).toContain(`${config.accountsUrl}/authorize?`);
    });

    it('shares a single in-flight attempt across concurrent calls', () => {
      mobile = true;

      const first = login(config);
      const second = login(config);

      expect(first).toBe(second);
    });

    it('exchanges the code for tokens after receiving it via postMessage', async () => {
      popup = { closed: false, close: vi.fn() };
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        accessToken: VALID_JWT,
        refreshToken: 'refresh_123',
      }), { status: 200 }));

      const loginPromise = login(config);

      // Let the async PKCE setup (crypto.subtle.digest) settle so the
      // message listener is registered before we dispatch the event.
      await new Promise(resolve => setTimeout(resolve, 0));

      window.dispatchEvent(new MessageEvent('message', {
        origin: new URL(config.accountsUrl).origin,
        data: { type: 'cc_auth_code', code: 'auth_code_123', state: STATE },
      }));

      const result = await loginPromise;

      expect(result).toBe(true);
      expect(tokenStorage.get()).toBe(VALID_JWT);
      expect(refreshTokenStorage.get()).toBe('refresh_123');
      // The popup delivered the code via postMessage, so it's alive and owns
      // its own close (it self-closes, or lingers on a post-signup screen).
      // The SDK must NOT force-close it here.
      expect(popup.close).not.toHaveBeenCalled();

      const [, requestInit] = vi.mocked(fetch).mock.calls[0];
      expect(JSON.parse(requestInit!.body as string)).toEqual({
        code: 'auth_code_123',
        code_verifier: VERIFIER,
      });
    });

    it('closes the popup when the code arrives via the poll fallback', async () => {
      vi.useFakeTimers();
      popup = { closed: false, close: vi.fn() };
      // First call: token poll returns the code (opener severed by COOP, so no
      // postMessage). Second call: the token exchange.
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'auth_code_456' }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          accessToken: VALID_JWT,
          refreshToken: 'refresh_456',
        }), { status: 200 }));

      const loginPromise = login(config);

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(500); // one poll tick

      const result = await loginPromise;

      expect(result).toBe(true);
      // The poll path means the popup couldn't self-close (severed opener), so
      // the SDK closes the orphaned popup.
      expect(popup.close).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('recovers the code via a final poll when the popup self-closes before the first poll tick', async () => {
      vi.useFakeTimers();
      popup = { closed: false, close: vi.fn() };
      // The popup's postMessage never reached us and it self-closed almost
      // immediately (~300–500ms) — faster than a slow poll would ever tick.
      // The code is still waiting server-side, so the post-close poll recovers
      // it. First fetch: the poll. Second: the token exchange.
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'auth_code_789' }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          accessToken: VALID_JWT,
          refreshToken: 'refresh_789',
        }), { status: 200 }));

      const loginPromise = login(config);

      await vi.advanceTimersByTimeAsync(0);
      popup.closed = true;                     // self-closed before any poll ran
      await vi.advanceTimersByTimeAsync(500);  // first poll tick still fires

      const result = await loginPromise;

      expect(result).toBe(true);
      expect(tokenStorage.get()).toBe(VALID_JWT);
      expect(refreshTokenStorage.get()).toBe('refresh_789');

      vi.useRealTimers();
    });

    it('resolves false only after a final poll comes back empty on a closed popup', async () => {
      vi.useFakeTimers();
      popup = { closed: false, close: vi.fn() };
      // User closed the popup before authenticating — no code was ever minted,
      // so the final poll returns null and we give up.
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ code: null }), { status: 200 })
      );

      const loginPromise = login(config);

      await vi.advanceTimersByTimeAsync(0);
      popup.closed = true;
      await vi.advanceTimersByTimeAsync(500);

      const result = await loginPromise;
      expect(result).toBe(false);
      // We poll once more on close rather than abandoning the code blindly.
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/auth/token/poll');

      vi.useRealTimers();
    });

    it('clears the pending PKCE entry from sessionStorage after a popup login settles', async () => {
      popup = { closed: false, close: vi.fn() };
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        accessToken: VALID_JWT,
        refreshToken: 'refresh_123',
      }), { status: 200 }));

      const loginPromise = login(config);

      await new Promise(resolve => setTimeout(resolve, 0));
      // Mid-flight the pending entry exists (needed by the redirect fallback).
      expect(sessionStorage.getItem('cc_pkce_pending')).not.toBeNull();

      window.dispatchEvent(new MessageEvent('message', {
        origin: new URL(config.accountsUrl).origin,
        data: { type: 'cc_auth_code', code: 'auth_code_123', state: STATE },
      }));

      await loginPromise;

      // Once the attempt settles it must not linger — otherwise the next silent
      // login shows an orphaned `cc_pkce_pending` with no token beside it.
      expect(sessionStorage.getItem('cc_pkce_pending')).toBeNull();
    });
  });

  describe('consumeAuthCodeFromUrl', () => {
    it('returns false when the URL has no auth code params', async () => {
      setLocation('http://localhost:3000/post');

      const result = await consumeAuthCodeFromUrl(config);

      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns false when the state does not match the pending PKCE attempt', async () => {
      setLocation('http://localhost:3000/post?cc_auth_code=code123&cc_state=other_state');
      sessionStorage.setItem('cc_pkce_pending', JSON.stringify({ state: STATE, verifier: VERIFIER }));

      const result = await consumeAuthCodeFromUrl(config);

      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('exchanges the code and stores tokens when the state matches', async () => {
      setLocation(`http://localhost:3000/post?cc_auth_code=code123&cc_state=${STATE}`);
      sessionStorage.setItem('cc_pkce_pending', JSON.stringify({ state: STATE, verifier: VERIFIER }));
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        accessToken: VALID_JWT,
        refreshToken: 'refresh_456',
      }), { status: 200 }));

      const result = await consumeAuthCodeFromUrl(config);

      expect(result).toBe(true);
      expect(tokenStorage.get()).toBe(VALID_JWT);
      expect(refreshTokenStorage.get()).toBe('refresh_456');
      expect(sessionStorage.getItem('cc_pkce_pending')).toBeNull();

      const [, requestInit] = vi.mocked(fetch).mock.calls[0];
      expect(JSON.parse(requestInit!.body as string)).toEqual({
        code: 'code123',
        code_verifier: VERIFIER,
      });
    });

    it('notifies a reachable opener on success', async () => {
      setLocation(`http://localhost:3000/post?cc_auth_code=code123&cc_state=${STATE}`);
      sessionStorage.setItem('cc_pkce_pending', JSON.stringify({ state: STATE, verifier: VERIFIER }));
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        accessToken: 'access_789',
        refreshToken: 'refresh_789',
      }), { status: 200 }));

      const opener = { closed: false, postMessage: vi.fn() };
      Object.defineProperty(window, 'opener', { value: opener, writable: true, configurable: true });

      const result = await consumeAuthCodeFromUrl(config);

      expect(result).toBe(true);
      expect(opener.postMessage).toHaveBeenCalledWith(
        { type: 'cc_auth_complete', state: STATE },
        window.location.origin
      );
    });
  });
});
