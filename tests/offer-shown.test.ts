import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPaywall } from '../src/paywall/index';
import { createState } from '../src/core/state';
import { createEventEmitter } from '../src/core/events';
import { ApiError } from '../src/api/client';
import { createPostsApi } from '../src/api/posts';
import { sendBeacon } from '../src/beacon/index';
import { resolveConfig, normalizeConsent } from '../src/core/config';

vi.stubGlobal('__ACCOUNTS_URL__', 'https://accounts.contentcredits.com');
vi.stubGlobal('__API_BASE_URL__', 'https://api.contentcredits.com');

const gateApi = { hide: vi.fn(() => true), reveal: vi.fn(), isGated: vi.fn(() => true) };
const rendererApi = { init: vi.fn(), render: vi.fn(), setButtonLoading: vi.fn(), destroy: vi.fn() };
const bridgeApi = {
  attach: vi.fn(), detach: vi.fn(), requestAuthorization: vi.fn(), requestPurchase: vi.fn(),
  requestLogin: vi.fn(), onAuthorizationResponse: vi.fn(), clearAuthorizationResponse: vi.fn(),
  onPurchaseResponse: vi.fn(),
};
let tokenPresent = false;

vi.mock('../src/paywall/gate.js', () => ({ createGate: vi.fn(() => gateApi) }));
vi.mock('../src/paywall/renderer.js', () => ({ createPaywallRenderer: vi.fn(() => rendererApi) }));
vi.mock('../src/extension/detector.js', () => ({ detectExtension: vi.fn(async () => false) }));
vi.mock('../src/extension/bridge.js', () => ({ createExtensionBridge: vi.fn(() => bridgeApi) }));
vi.mock('../src/auth/popup.js', () => ({ isMobileDevice: vi.fn(() => false), openCenteredPopup: vi.fn(() => null) }));
vi.mock('../src/auth/oauth.js', () => ({
  login: vi.fn(async () => false),
  consumeAuthCodeFromUrl: vi.fn().mockResolvedValue(false),
  accountsOrigin: vi.fn(() => 'https://accounts.contentcredits.com'),
}));
vi.mock('../src/auth/storage.js', () => ({
  tokenStorage: {
    has: vi.fn(() => tokenPresent),
    get: vi.fn(() => (tokenPresent ? 'token_123' : null)),
    set: vi.fn(),
    clear: vi.fn(),
  },
}));

function cfg(overrides: Record<string, unknown> = {}): any {
  return {
    apiKey: 'pub_123',
    articleUrl: 'https://example.com/post',
    hostName: 'example.com',
    pageTitle: 'Hello',
    contentSelector: '#article',
    teaserParagraphs: 2,
    enableComments: false,
    extensionId: 'ext_123',
    debug: false,
    headless: false,
    analyticsConsent: 'unknown',
    apiBaseUrl: 'https://api.contentcredits.com',
    accountsUrl: 'https://accounts.contentcredits.com',
    theme: { primaryColor: '#44C678', fontFamily: 'sans-serif' },
    ...overrides,
  };
}

function setup(opts: {
  config?: Record<string, unknown>;
  checkAccess?: ReturnType<typeof vi.fn>;
  purchaseArticle?: ReturnType<typeof vi.fn>;
  offerShown?: ReturnType<typeof vi.fn>;
} = {}) {
  const creditsApi = {
    checkAccess: opts.checkAccess ?? vi.fn().mockResolvedValue({ success: false, requiredCredits: 2, creditBalance: 10 }),
    purchaseArticle: opts.purchaseArticle ?? vi.fn().mockResolvedValue({ success: true }),
  };
  const postsApi = {
    observe: vi.fn(),
    offerShown: opts.offerShown ?? vi.fn().mockResolvedValue({ success: true, decisionId: 'dec_abc', price: 2 }),
  };
  const module = createPaywall(
    cfg(opts.config), creditsApi as any, createState(), createEventEmitter(), gateApi as any, postsApi as any
  );
  return { module, creditsApi, postsApi };
}

const flush = () => new Promise(r => setTimeout(r, 0));

describe('offer-shown exposure event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenPresent = false;
    localStorage.clear();
  });

  it('fires login once for a signed-out reader, without a price', async () => {
    const { module, postsApi } = setup();
    await module.init();
    await module.checkAccess(); // re-render of the same state
    expect(postsApi.offerShown).toHaveBeenCalledTimes(1);
    const payload = postsApi.offerShown.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({
      apiKey: 'pub_123', url: 'https://example.com/post', hostName: 'example.com',
      state: 'login', surface: 'sdk', consent: 'unknown',
    }));
    expect(payload.anonId).toEqual(expect.any(String));
    expect(JSON.stringify(payload)).not.toMatch(/price|credits/i);
  });

  it('fires once per state transition and again when the state changes', async () => {
    tokenPresent = true;
    const checkAccess = vi.fn()
      .mockResolvedValueOnce({ success: false, requiredCredits: 2, creditBalance: 10 })
      .mockResolvedValueOnce({ success: false, requiredCredits: 2, creditBalance: 10 })
      .mockResolvedValueOnce({ success: false, requiredCredits: 5, creditBalance: 1 });
    const { module, postsApi } = setup({ checkAccess });
    await module.init();
    await module.checkAccess();
    expect(postsApi.offerShown).toHaveBeenCalledTimes(1);
    expect(postsApi.offerShown.mock.calls[0][0].state).toBe('purchase');
    await module.checkAccess();
    expect(postsApi.offerShown).toHaveBeenCalledTimes(2);
    expect(postsApi.offerShown.mock.calls[1][0].state).toBe('insufficient');
  });

  it('does not fire for a reader who already has access', async () => {
    tokenPresent = true;
    const { module, postsApi } = setup({ checkAccess: vi.fn().mockResolvedValue({ success: true }) });
    await module.init();
    expect(postsApi.offerShown).not.toHaveBeenCalled();
  });

  it('fires in headless mode when onPurchaseRequired is invoked', async () => {
    tokenPresent = true;
    const onPurchaseRequired = vi.fn();
    const { module, postsApi } = setup({ config: { headless: true, onPurchaseRequired } });
    await module.init();
    expect(onPurchaseRequired).toHaveBeenCalledTimes(1);
    expect(rendererApi.render).not.toHaveBeenCalled();
    expect(postsApi.offerShown).toHaveBeenCalledTimes(1);
    expect(postsApi.offerShown.mock.calls[0][0].state).toBe('purchase');
  });

  it('sends the returned decisionId on purchaseArticle', async () => {
    tokenPresent = true;
    const { module, creditsApi } = setup();
    await module.init();
    await flush();
    await module.purchase();
    expect(creditsApi.purchaseArticle).toHaveBeenCalledWith(expect.objectContaining({ decisionId: 'dec_abc' }));
  });

  it('omits decisionId on purchaseArticle when none was returned', async () => {
    tokenPresent = true;
    const { module, creditsApi } = setup({ offerShown: vi.fn().mockResolvedValue({ success: true, decisionId: null }) });
    await module.init();
    await flush();
    await module.purchase();
    expect(creditsApi.purchaseArticle.mock.calls[0][0]).not.toHaveProperty('decisionId');
  });

  it('a rejecting offer-shown never breaks or delays the paywall', async () => {
    tokenPresent = true;
    const offerShown = vi.fn().mockRejectedValue(new ApiError(500, 'boom'));
    const onPurchaseRequired = vi.fn();
    const { module, creditsApi } = setup({ offerShown, config: { onPurchaseRequired } });
    await module.init();
    await flush();
    expect(rendererApi.render).toHaveBeenCalledWith('purchase', expect.any(Object), expect.any(Object));
    expect(onPurchaseRequired).toHaveBeenCalledTimes(1);
    await module.purchase();
    expect(creditsApi.purchaseArticle.mock.calls[0][0]).not.toHaveProperty('decisionId');
  });

  it('a synchronously throwing offer-shown never breaks the paywall', async () => {
    const offerShown = vi.fn(() => { throw new Error('sync boom'); });
    const onLoginRequired = vi.fn();
    const { module } = setup({ offerShown, config: { onLoginRequired } });
    await module.init();
    expect(onLoginRequired).toHaveBeenCalledTimes(1);
  });

  it('does not block the render path on a pending offer-shown', async () => {
    const onLoginRequired = vi.fn();
    const { module } = setup({ offerShown: vi.fn(() => new Promise(() => {})), config: { onLoginRequired } });
    await module.init();
    expect(onLoginRequired).toHaveBeenCalledTimes(1);
  });

  it('consent denied: no anonId is created or sent on offer-shown', async () => {
    const { module, postsApi } = setup({ config: { analyticsConsent: 'denied' } });
    await module.init();
    const payload = postsApi.offerShown.mock.calls[0][0];
    expect(payload.anonId).toBeUndefined();
    expect(payload.consent).toBe('denied');
    expect(localStorage.getItem('cc_anon_id')).toBeNull();
  });

  it('is a no-op when no postsApi is supplied', async () => {
    const module = createPaywall(cfg(), { checkAccess: vi.fn(), purchaseArticle: vi.fn() } as any,
      createState(), createEventEmitter(), gateApi as any);
    await expect(module.init()).resolves.toBeUndefined();
  });
});

describe('consent on the view beacon', () => {
  beforeEach(() => { localStorage.clear(); document.head.innerHTML = ''; });
  const bc = (o: Record<string, unknown> = {}): any => ({
    apiKey: 'pub_123', articleUrl: 'https://example.com/post', canonicalArticleUrl: 'https://example.com/post',
    pageTitle: 'T', contentSelector: '.x', enableBeacon: true, debug: false, analyticsConsent: 'unknown', ...o,
  });

  it('denied: no anonId created or sent, consent forwarded', () => {
    const observe = vi.fn().mockResolvedValue({});
    sendBeacon(bc({ analyticsConsent: 'denied' }), { observe } as any);
    const [payload] = observe.mock.calls[0];
    expect(payload.anonId).toBeUndefined();
    expect(payload.consent).toBe('denied');
    expect(localStorage.getItem('cc_anon_id')).toBeNull();
  });

  it('granted: anonId sent with consent', () => {
    const observe = vi.fn().mockResolvedValue({});
    sendBeacon(bc({ analyticsConsent: 'granted' }), { observe } as any);
    const [payload] = observe.mock.calls[0];
    expect(payload.anonId).toEqual(expect.any(String));
    expect(payload.consent).toBe('granted');
  });
});

describe('posts api offerShown', () => {
  it('posts to /posts/offer-shown and omits empty optional fields', async () => {
    const client = { post: vi.fn().mockResolvedValue({ success: true, decisionId: 'dec_1' }) } as any;
    await createPostsApi(client).offerShown({
      apiKey: 'k', url: 'https://e.com/p', hostName: 'e.com', state: 'login', surface: 'sdk', consent: 'denied',
    });
    expect(client.post).toHaveBeenCalledWith('/posts/offer-shown', {
      apiKey: 'k', url: 'https://e.com/p', hostName: 'e.com', state: 'login', surface: 'sdk', consent: 'denied',
    });
  });
});

describe('analyticsConsent config', () => {
  it('defaults to unknown and accepts granted/denied', () => {
    expect(resolveConfig({ apiKey: 'k' }).analyticsConsent).toBe('unknown');
    expect(resolveConfig({ apiKey: 'k', analyticsConsent: 'denied' }).analyticsConsent).toBe('denied');
    expect(resolveConfig({ apiKey: 'k', analyticsConsent: 'granted' }).analyticsConsent).toBe('granted');
  });

  it('normalizes data-attribute values (data-cc-analytics-consent)', () => {
    expect(normalizeConsent('granted')).toBe('granted');
    expect(normalizeConsent('denied')).toBe('denied');
    expect(normalizeConsent(undefined)).toBe('unknown');
    expect(normalizeConsent('yes')).toBe('unknown');
  });
});

describe('credits api purchaseArticle decisionId', () => {
  it('forwards decisionId only when present', async () => {
    const { createCreditsApi } = await import('../src/api/credits');
    const client = { post: vi.fn().mockResolvedValue({ success: true }) } as any;
    const api = createCreditsApi(client);
    const base = { apiKey: 'k', postUrl: 'u', postName: 'n', hostName: 'h' };
    await api.purchaseArticle({ ...base, decisionId: 'dec_1' });
    await api.purchaseArticle(base);
    expect(client.post.mock.calls[0][1]).toEqual({ ...base, decisionId: 'dec_1' });
    expect(client.post.mock.calls[1][1]).toEqual(base);
  });
});
