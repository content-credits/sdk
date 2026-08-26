/**
 * Server-side-teaser hydration (opt-in `contentEndpoint`).
 *
 * The three cases that matter:
 *   (a) no endpoint configured  → today's hide/reveal path, untouched, no fetch
 *   (b) endpoint + access granted → fetch, sanitize, inject, THEN reveal
 *   (c) fetch fails             → visible error + retry, never a silent teaser
 *
 * Uses the REAL gate against a real DOM so the inject-then-reveal ordering is
 * actually exercised; only the shadow-DOM renderer is mocked, so render()
 * calls can be asserted directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPaywall } from '../src/paywall/index';
import { createGate } from '../src/paywall/gate';
import { createState } from '../src/core/state';
import { createEventEmitter } from '../src/core/events';

const rendererApi = {
  init: vi.fn(),
  render: vi.fn(),
  setButtonLoading: vi.fn(),
  destroy: vi.fn(),
};

let authorizationResponder: ((data: unknown) => void) | null = null;

const bridgeApi = {
  attach: vi.fn(),
  detach: vi.fn(),
  requestAuthorization: vi.fn(() => {
    // Mirror the real bridge: the extension answers the request we just sent.
    if (authorizationResponder) authorizationResponder(extensionAuthData);
  }),
  requestPurchase: vi.fn(),
  requestLogin: vi.fn(),
  onAuthorizationResponse: vi.fn((cb: (data: unknown) => void) => {
    authorizationResponder = cb;
  }),
  clearAuthorizationResponse: vi.fn(),
  onPurchaseResponse: vi.fn(),
};

let extensionDetected = false;
let extensionAuthData: unknown = null;
let tokenPresent = true;

vi.mock('../src/paywall/renderer.js', () => ({
  createPaywallRenderer: vi.fn(() => rendererApi),
}));

vi.mock('../src/extension/detector.js', () => ({
  detectExtension: vi.fn(async () => extensionDetected),
}));

vi.mock('../src/extension/bridge.js', () => ({
  createExtensionBridge: vi.fn(() => bridgeApi),
}));

vi.mock('../src/auth/popup.js', () => ({
  isMobileDevice: vi.fn(() => false),
  openCenteredPopup: vi.fn(() => null),
}));

vi.mock('../src/auth/oauth.js', () => ({
  login: vi.fn(async () => false),
  consumeAuthCodeFromUrl: vi.fn().mockResolvedValue(false),
  accountsOrigin: vi.fn(() => 'https://accounts.contentcredits.com'),
}));

vi.mock('../src/auth/storage.js', () => ({
  tokenStorage: {
    has: () => tokenPresent,
    get: () => (tokenPresent ? 'token_123' : null),
    set: vi.fn(),
    clear: vi.fn(),
  },
  refreshTokenStorage: { get: vi.fn(() => null), set: vi.fn(), clear: vi.fn() },
}));

const ENDPOINT = 'https://example.com/wp-json/content-credits/v1/posts/42/content';

const FULL_ARTICLE = 'https://example.com/post';

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    apiKey: 'pub_123',
    articleUrl: FULL_ARTICLE,
    canonicalArticleUrl: FULL_ARTICLE,
    hostName: 'example.com',
    pageTitle: 'Hello',
    contentSelector: '#article',
    contentEndpoint: null,
    teaserParagraphs: 2,
    enableComments: false,
    enableBeacon: false,
    extensionId: 'ext_123',
    debug: false,
    headless: false,
    paywallMode: 'overlay',
    showHeadings: true,
    apiBaseUrl: 'https://api.contentcredits.com',
    accountsUrl: 'https://accounts.contentcredits.com',
    theme: {
      primaryColor: '#44C678',
      fontFamily: 'sans-serif',
      backdropColor: 'rgba(0,0,0,0.45)',
      sdkButtonColor: '#44C678',
    },
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

/** Let the fire-and-forget hydration promise settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

function renderedStates(): string[] {
  return rendererApi.render.mock.calls.map(call => call[0] as string);
}

function setPage(inner: string): HTMLElement {
  document.body.innerHTML = `<div id="article">${inner}</div>`;
  return document.querySelector<HTMLElement>('#article')!;
}

/** The full article, shipped to the browser — the legacy (no-endpoint) shape. */
const WHOLE_ARTICLE_MARKUP =
  '<p>Teaser one</p><p>Teaser two</p><p>Paid three</p><h2>Paid heading</h2><p>Paid four</p>';

/** Only the teaser, shipped to the browser — the server-side-gating shape. */
const TEASER_ONLY_MARKUP = '<p>Teaser one</p><p>Teaser two</p>';

function realGate(teaserParagraphs = 2) {
  return createGate({ selector: '#article', teaserParagraphs, paywallMode: 'overlay' });
}

function grantingCreditsApi() {
  return {
    checkAccess: vi.fn().mockResolvedValue({ success: true }),
    purchaseArticle: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('server-side-teaser hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    extensionDetected = false;
    extensionAuthData = null;
    authorizationResponder = null;
    tokenPresent = true;
    document.body.innerHTML = '';
  });

  // ── (a) No endpoint configured — the compatibility guarantee ──────────────

  describe('no contentEndpoint configured', () => {
    it('reveals the content already on the page and never fetches', async () => {
      const contentEl = setPage(WHOLE_ARTICLE_MARKUP);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const state = createState();
      const emitter = createEventEmitter();
      const hidden = vi.fn();
      emitter.on('paywall:hidden', hidden);
      const onAccessGranted = vi.fn();

      const gate = realGate();
      gate.hide();
      // Sanity: the gate really did hide the paid nodes before access was granted.
      expect(contentEl.querySelectorAll('[data-cc-hidden]').length).toBeGreaterThan(0);

      const module = createPaywall(
        baseConfig({ onAccessGranted }),
        grantingCreditsApi(),
        state,
        emitter,
        gate
      );

      await module.init();
      await flush();

      expect(fetchMock).not.toHaveBeenCalled();
      // Same five nodes, same order, nothing replaced.
      expect(contentEl.children.length).toBe(5);
      expect(contentEl.textContent).toContain('Paid four');
      // Fully revealed: no leftover hidden markers or display:none.
      expect(contentEl.querySelectorAll('[data-cc-hidden]').length).toBe(0);
      expect(
        Array.from(contentEl.children).filter(n => (n as HTMLElement).style.display === 'none').length
      ).toBe(0);
      expect(contentEl.hasAttribute('data-cc-gated')).toBe(false);

      // Granted-state signalling is unchanged and synchronous.
      expect(renderedStates()).toContain('granted');
      expect(renderedStates()).not.toContain('hydrating');
      expect(hidden).toHaveBeenCalledTimes(1);
      expect(onAccessGranted).toHaveBeenCalledTimes(1);
    });

    it('does not fetch on the extension access path either', async () => {
      setPage(WHOLE_ARTICLE_MARKUP);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      extensionDetected = true;
      extensionAuthData = { isAuthenticated: true, doesHaveAccess: true, creditBalance: 7 };

      const module = createPaywall(
        baseConfig(),
        grantingCreditsApi(),
        createState(),
        createEventEmitter(),
        realGate()
      );

      await module.init();
      await flush();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(renderedStates()).toContain('granted');
    });
  });

  // ── (b) Endpoint configured + access granted ──────────────────────────────

  describe('contentEndpoint configured and access granted', () => {
    it('fetches with the reader bearer token, injects, then reveals', async () => {
      const contentEl = setPage(TEASER_ONLY_MARKUP);
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(200, {
          success: true,
          content: '<p>Teaser one</p><p>Teaser two</p><h2>Paid heading</h2><p>Paid four</p>',
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const state = createState();
      const emitter = createEventEmitter();
      const hidden = vi.fn();
      emitter.on('paywall:hidden', hidden);
      const onAccessGranted = vi.fn();

      const gate = realGate();
      gate.hide();

      const module = createPaywall(
        baseConfig({ contentEndpoint: ENDPOINT, onAccessGranted }),
        grantingCreditsApi(),
        state,
        emitter,
        gate
      );

      await module.init();
      await flush();

      // The endpoint is used verbatim — the SDK builds no path of its own.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(ENDPOINT);
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer token_123');
      expect(init.credentials).toBe('omit');

      // Full content replaced the teaser.
      expect(contentEl.querySelector('h2')?.textContent).toBe('Paid heading');
      expect(contentEl.textContent).toContain('Paid four');

      // Hydrating shown while fetching, granted only afterwards.
      const states = renderedStates();
      expect(states).toContain('hydrating');
      expect(states).toContain('granted');
      expect(states.indexOf('hydrating')).toBeLessThan(states.indexOf('granted'));

      expect(hidden).toHaveBeenCalledTimes(1);
      expect(onAccessGranted).toHaveBeenCalledTimes(1);
      expect(state.get().hasAccess).toBe(true);
    });

    it('sanitizes the fetched HTML before injecting it', async () => {
      const contentEl = setPage(TEASER_ONLY_MARKUP);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse(200, {
            success: true,
            content:
              '<p onclick="steal()">Paid body</p>' +
              '<script>window.__pwned = true;</script>' +
              '<img src="javascript:alert(1)" alt="bad">' +
              '<iframe src="https://evil.example"></iframe>',
          })
        )
      );

      const module = createPaywall(
        baseConfig({ contentEndpoint: ENDPOINT }),
        grantingCreditsApi(),
        createState(),
        createEventEmitter(),
        realGate()
      );

      await module.init();
      await flush();

      expect(contentEl.textContent).toContain('Paid body');
      expect(contentEl.querySelector('script')).toBeNull();
      expect(contentEl.querySelector('iframe')).toBeNull();
      expect(contentEl.querySelector('p')?.hasAttribute('onclick')).toBe(false);
      expect(contentEl.querySelector('img')?.hasAttribute('src')).toBe(false);
    });

    it('hydrates on the extension access path through the same hook', async () => {
      const contentEl = setPage(TEASER_ONLY_MARKUP);
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(200, { success: true, content: '<h2>Paid heading</h2>' })
      );
      vi.stubGlobal('fetch', fetchMock);
      extensionDetected = true;
      extensionAuthData = { isAuthenticated: true, doesHaveAccess: true, creditBalance: 7 };

      const module = createPaywall(
        baseConfig({ contentEndpoint: ENDPOINT }),
        grantingCreditsApi(),
        createState(),
        createEventEmitter(),
        realGate()
      );

      await module.init();
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(contentEl.querySelector('h2')?.textContent).toBe('Paid heading');
      expect(renderedStates()).toContain('granted');
    });

    it('leaves the DOM alone in headless mode — the host app owns it', async () => {
      const contentEl = setPage(TEASER_ONLY_MARKUP);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const onAccessGranted = vi.fn();
      const module = createPaywall(
        baseConfig({ contentEndpoint: ENDPOINT, headless: true, onAccessGranted }),
        grantingCreditsApi(),
        createState(),
        createEventEmitter(),
        realGate()
      );

      await module.init();
      await flush();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(contentEl.innerHTML).toBe(TEASER_ONLY_MARKUP);
      expect(onAccessGranted).toHaveBeenCalledTimes(1);
    });
  });

  // ── (c) Fetch failure — a paid reader must never see a silent teaser ──────

  describe('contentEndpoint fetch failure', () => {
    it('renders a visible error with retry instead of a silent teaser', async () => {
      const contentEl = setPage(TEASER_ONLY_MARKUP);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse(503, { success: false, code: 'UPSTREAM_UNAVAILABLE' }))
      );

      const state = createState();
      const emitter = createEventEmitter();
      const hidden = vi.fn();
      const errored = vi.fn();
      emitter.on('paywall:hidden', hidden);
      emitter.on('error', errored);
      const onAccessGranted = vi.fn();

      const module = createPaywall(
        baseConfig({ contentEndpoint: ENDPOINT, onAccessGranted }),
        grantingCreditsApi(),
        state,
        emitter,
        realGate()
      );

      await module.init();
      await flush();

      const states = renderedStates();
      expect(states).toContain('error');
      // Never the purchase panel — that would read as "you still haven't paid".
      expect(states).not.toContain('purchase');
      expect(states).not.toContain('granted');

      const errorCall = rendererApi.render.mock.calls.find(call => call[0] === 'error')!;
      expect(errorCall[1].onRetry).toBeTypeOf('function');
      expect(errorCall[2].error).toContain("You've unlocked this article");

      // The reader is entitled, but nothing claims they're reading yet.
      expect(state.get().hasAccess).toBe(true);
      expect(hidden).not.toHaveBeenCalled();
      expect(onAccessGranted).not.toHaveBeenCalled();
      expect(errored).toHaveBeenCalledTimes(1);
      // Teaser left intact rather than blanked.
      expect(contentEl.innerHTML).toBe(TEASER_ONLY_MARKUP);
    });

    it('retry re-fetches and completes when the endpoint recovers', async () => {
      const contentEl = setPage(TEASER_ONLY_MARKUP);
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(503, { success: false, code: 'UPSTREAM_UNAVAILABLE' }))
        .mockResolvedValueOnce(jsonResponse(200, { success: true, content: '<h2>Paid heading</h2>' }));
      vi.stubGlobal('fetch', fetchMock);

      const emitter = createEventEmitter();
      const hidden = vi.fn();
      emitter.on('paywall:hidden', hidden);
      const onAccessGranted = vi.fn();

      const module = createPaywall(
        baseConfig({ contentEndpoint: ENDPOINT, onAccessGranted }),
        grantingCreditsApi(),
        createState(),
        emitter,
        realGate()
      );

      await module.init();
      await flush();

      const errorCall = rendererApi.render.mock.calls.find(call => call[0] === 'error')!;
      await errorCall[1].onRetry();
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(contentEl.querySelector('h2')?.textContent).toBe('Paid heading');
      expect(renderedStates()).toContain('granted');
      // Emitted exactly once, on the run that actually put the article on screen.
      expect(hidden).toHaveBeenCalledTimes(1);
      expect(onAccessGranted).toHaveBeenCalledTimes(1);
    });

    it('treats a network error the same way', async () => {
      setPage(TEASER_ONLY_MARKUP);
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      const module = createPaywall(
        baseConfig({ contentEndpoint: ENDPOINT }),
        grantingCreditsApi(),
        createState(),
        createEventEmitter(),
        realGate()
      );

      await module.init();
      await flush();

      expect(renderedStates()).toContain('error');
      expect(renderedStates()).not.toContain('granted');
    });

    it('treats a 200 with no content string as a failure, not an empty article', async () => {
      const contentEl = setPage(TEASER_ONLY_MARKUP);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { success: true })));

      const module = createPaywall(
        baseConfig({ contentEndpoint: ENDPOINT }),
        grantingCreditsApi(),
        createState(),
        createEventEmitter(),
        realGate()
      );

      await module.init();
      await flush();

      expect(renderedStates()).toContain('error');
      expect(contentEl.innerHTML).toBe(TEASER_ONLY_MARKUP);
    });

    it('uses site-specific copy when the publisher route denies access', async () => {
      setPage(TEASER_ONLY_MARKUP);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse(403, { success: false, code: 'NO_ACCESS' }))
      );

      const module = createPaywall(
        baseConfig({ contentEndpoint: ENDPOINT }),
        grantingCreditsApi(),
        createState(),
        createEventEmitter(),
        realGate()
      );

      await module.init();
      await flush();

      const errorCall = rendererApi.render.mock.calls.find(call => call[0] === 'error')!;
      expect(errorCall[2].error).toContain("this site wouldn't serve it");
    });

    it('does not sign the reader out when the publisher route returns 401', async () => {
      setPage(TEASER_ONLY_MARKUP);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse(401, { success: false, code: 'UNAUTHENTICATED' }))
      );

      const emitter = createEventEmitter();
      const loggedOut = vi.fn();
      emitter.on('auth:logout', loggedOut);

      const module = createPaywall(
        baseConfig({ contentEndpoint: ENDPOINT }),
        grantingCreditsApi(),
        createState(),
        emitter,
        realGate()
      );

      await module.init();
      await flush();

      expect(renderedStates()).toContain('error');
      // A 401 from the publisher's own route says nothing about the reader's
      // Content Credits session.
      expect(loggedOut).not.toHaveBeenCalled();
    });
  });

  // ── Idempotence ───────────────────────────────────────────────────────────

  describe('repeat access-granted runs', () => {
    it('does not re-fetch once the article has been hydrated', async () => {
      setPage(TEASER_ONLY_MARKUP);
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(200, { success: true, content: '<h2>Paid heading</h2>' })
      );
      vi.stubGlobal('fetch', fetchMock);

      const module = createPaywall(
        baseConfig({ contentEndpoint: ENDPOINT }),
        grantingCreditsApi(),
        createState(),
        createEventEmitter(),
        realGate()
      );

      await module.init();
      await flush();
      await module.checkAccess();
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
