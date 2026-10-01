import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPaywall } from '../src/paywall/index';
import { createState } from '../src/core/state';
import { createEventEmitter } from '../src/core/events';
import { createPostsApi } from '../src/api/posts';
import { createCreditsApi } from '../src/api/credits';
import { sendBeacon } from '../src/beacon/index';
import { getPageViewId, markSdkPresent } from '../src/beacon/pageView';
import { resolveConfig } from '../src/core/config';
import { openCenteredPopup } from '../src/auth/popup';

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
let extensionPresent = false;

vi.mock('../src/paywall/gate.js', () => ({ createGate: vi.fn(() => gateApi) }));
vi.mock('../src/paywall/renderer.js', () => ({ createPaywallRenderer: vi.fn(() => rendererApi) }));
vi.mock('../src/extension/detector.js', () => ({ detectExtension: vi.fn(async () => extensionPresent) }));
vi.mock('../src/extension/bridge.js', () => ({ createExtensionBridge: vi.fn(() => bridgeApi) }));
vi.mock('../src/auth/popup.js', () => ({ isMobileDevice: vi.fn(() => false), openCenteredPopup: vi.fn(() => ({ closed: false })) }));
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
    apiKey: 'pub_123', articleUrl: 'https://example.com/post', hostName: 'example.com', pageTitle: 'Hello',
    contentSelector: '#article', teaserParagraphs: 2, enableComments: false, extensionId: 'ext_123', debug: false,
    headless: false, analyticsConsent: 'unknown', surface: 'sdk', apiBaseUrl: 'https://api.contentcredits.com',
    accountsUrl: 'https://accounts.contentcredits.com', theme: { primaryColor: '#44C678', fontFamily: 'sans-serif' },
    ...overrides,
  };
}

function setup(opts: { config?: Record<string, unknown>; offerShown?: any; checkAccess?: any } = {}) {
  const creditsApi = {
    checkAccess: opts.checkAccess ?? vi.fn().mockResolvedValue({ success: false, requiredCredits: 2, creditBalance: 10 }),
    purchaseArticle: vi.fn().mockResolvedValue({ success: true }),
  };
  const postsApi = {
    observe: vi.fn(),
    offerShown: opts.offerShown ?? vi.fn().mockResolvedValue({ success: true, decisionId: 'dec_abc', price: 2 }),
    offerAction: vi.fn().mockResolvedValue({ success: true }),
  };
  const module = createPaywall(cfg(opts.config), creditsApi as any, createState(), createEventEmitter(), gateApi as any, postsApi as any);
  return { module, creditsApi, postsApi };
}

const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  tokenPresent = false;
  extensionPresent = false;
  localStorage.clear();
  document.documentElement.removeAttribute('data-cc-sdk');
  document.documentElement.removeAttribute('data-cc-page-view-id');
});

describe('offer actions (signin_started / checkout_opened)', () => {
  it('login click reports signin_started keyed on the decisionId, with surface and consent', async () => {
    const { module, postsApi } = setup({ config: { analyticsConsent: 'granted' } });
    await module.init();
    await flush();
    await module.login();
    await flush();
    expect(postsApi.offerAction).toHaveBeenCalledTimes(1);
    expect(postsApi.offerAction.mock.calls[0][0]).toEqual(expect.objectContaining({
      apiKey: 'pub_123', url: 'https://example.com/post', hostName: 'example.com',
      decisionId: 'dec_abc', action: 'signin_started', surface: 'sdk', consent: 'granted',
      pageViewId: expect.any(String),
    }));
  });

  it('buyMoreCredits reports checkout_opened, opens the popup synchronously and puts decisionId in the URL', async () => {
    tokenPresent = true;
    const checkAccess = vi.fn().mockResolvedValue({ success: false, requiredCredits: 5, creditBalance: 1 });
    const { module, postsApi } = setup({ checkAccess });
    await module.init();
    await flush();
    module.buyMoreCredits();
    // the popup must open inside the click gesture: no await before it
    expect(openCenteredPopup).toHaveBeenCalledTimes(1);
    const url = new URL((openCenteredPopup as any).mock.calls[0][0]);
    expect(url.pathname).toBe('/checkout');
    expect(url.searchParams.get('decisionId')).toBe('dec_abc');
    expect(url.searchParams.get('reason')).toBe('insufficient');
    await flush();
    expect(postsApi.offerAction.mock.calls[0][0]).toEqual(expect.objectContaining({ action: 'checkout_opened', decisionId: 'dec_abc' }));
    module.destroy();
  });

  it('does not send an action when no decisionId was ever returned (null offer) and swallows failures', async () => {
    const { module, postsApi } = setup({ offerShown: vi.fn().mockResolvedValue({ success: true, decisionId: null }) });
    await module.init();
    await module.login();
    await flush();
    expect(postsApi.offerAction).not.toHaveBeenCalled();

    const b = setup();
    b.postsApi.offerAction.mockRejectedValue(new Error('network'));
    await b.module.init();
    await expect(b.module.login()).resolves.toBeUndefined();
    await flush();
  });

  it('no decisionId in the checkout URL when none is known', async () => {
    tokenPresent = true;
    const { module } = setup({
      checkAccess: vi.fn().mockResolvedValue({ success: false, requiredCredits: 5, creditBalance: 1 }),
      offerShown: vi.fn().mockResolvedValue({ success: true, decisionId: null }),
    });
    await module.init();
    module.buyMoreCredits();
    const url = new URL((openCenteredPopup as any).mock.calls[0][0]);
    expect(url.searchParams.has('decisionId')).toBe(false);
    module.destroy();
  });
});

describe('fast Unlock click awaits the in-flight offer-shown (bounded)', () => {
  it('purchase carries the decisionId even when the click beats the offer-shown response', async () => {
    tokenPresent = true;
    let resolveOffer: (v: any) => void = () => {};
    const offerShown = vi.fn(() => new Promise(r => { resolveOffer = r; }));
    const { module, creditsApi } = setup({ offerShown });
    const init = module.init();
    await flush();
    const purchase = module.purchase(); // click while offer-shown is still pending
    await flush();
    expect(creditsApi.purchaseArticle).not.toHaveBeenCalled();
    resolveOffer({ success: true, decisionId: 'dec_late' });
    await purchase;
    await init;
    expect(creditsApi.purchaseArticle).toHaveBeenCalledWith(expect.objectContaining({ decisionId: 'dec_late', surface: 'sdk' }));
  });

  it('gives up after 1s and purchases without a decisionId rather than hanging', async () => {
    vi.useFakeTimers();
    try {
      tokenPresent = true;
      const offerShown = vi.fn(() => new Promise(() => {})); // never settles
      const { module, creditsApi } = setup({ offerShown });
      void module.init();
      await vi.advanceTimersByTimeAsync(10);
      const purchase = module.purchase();
      await vi.advanceTimersByTimeAsync(500);
      expect(creditsApi.purchaseArticle).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(600);
      await purchase;
      expect(creditsApi.purchaseArticle).toHaveBeenCalledTimes(1);
      expect(creditsApi.purchaseArticle.mock.calls[0][0].decisionId).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('extension path carries the decisionId and surface', () => {
  it('request_purchase includes decisionId and the offer is reported with surface extension', async () => {
    tokenPresent = true;
    extensionPresent = true;
    const { module, postsApi } = setup();
    const init = module.init();
    await flush();
    // the extension answers the authorization request: signed in, no access
    const handler = bridgeApi.onAuthorizationResponse.mock.calls[0][0];
    handler({ isAuthenticated: true, doesHaveAccess: false, creditBalance: 10, requiredCredits: 2 });
    await init;
    await flush();
    expect(postsApi.offerShown.mock.calls[0][0].surface).toBe('extension');
    await module.purchase();
    expect(bridgeApi.requestPurchase).toHaveBeenCalledWith(expect.objectContaining({
      articleId: 'pub_123', hostName: 'example.com', decisionId: 'dec_abc',
    }));
  });
});

describe('internal traffic hint and wordpress surface', () => {
  it('config resolves internalTraffic (default false) and surface (default sdk)', () => {
    expect(resolveConfig({ apiKey: 'k' })).toMatchObject({ internalTraffic: false, surface: 'sdk' });
    expect(resolveConfig({ apiKey: 'k', internalTraffic: true, surface: 'wordpress' })).toMatchObject({ internalTraffic: true, surface: 'wordpress' });
    expect(resolveConfig({ apiKey: 'k', surface: 'bogus' as any }).surface).toBe('sdk');
  });

  it('beacon and offer-shown send internal:true only when configured, plus the surface', async () => {
    const observe = vi.fn().mockResolvedValue({});
    const bc = (o: Record<string, unknown> = {}): any => ({
      apiKey: 'pub_123', articleUrl: 'https://example.com/post', canonicalArticleUrl: 'https://example.com/post',
      pageTitle: 'T', contentSelector: '.x', enableBeacon: true, debug: false, analyticsConsent: 'unknown', surface: 'wordpress', ...o,
    });
    sendBeacon(bc({ internalTraffic: true }), { observe } as any);
    expect(observe.mock.calls[0][0]).toEqual(expect.objectContaining({ internal: true, surface: 'wordpress' }));
    sendBeacon(bc(), { observe } as any);
    expect(observe.mock.calls[1][0]).not.toHaveProperty('internal');

    const { module, postsApi } = setup({ config: { internalTraffic: true, surface: 'wordpress' } });
    await module.init();
    expect(postsApi.offerShown.mock.calls[0][0]).toEqual(expect.objectContaining({ internal: true, surface: 'wordpress' }));
  });
});

describe('page-load id shared with the extension', () => {
  it('markSdkPresent sets data-cc-sdk and publishes one stable page-view id on <html>', () => {
    markSdkPresent('3.11.0');
    const el = document.documentElement;
    expect(el.getAttribute('data-cc-sdk')).toBe('3.11.0');
    const id = el.getAttribute('data-cc-page-view-id')!;
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(getPageViewId()).toBe(id);
  });

  it('reuses an id the extension already wrote, and replaces an invalid one', () => {
    document.documentElement.setAttribute('data-cc-page-view-id', 'ext_written_id_1234');
    expect(getPageViewId()).toBe('ext_written_id_1234');
    document.documentElement.setAttribute('data-cc-page-view-id', 'bad id!');
    const fresh = getPageViewId();
    expect(fresh).not.toBe('bad id!');
    expect(fresh).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('the beacon carries that same id', () => {
    document.documentElement.setAttribute('data-cc-page-view-id', 'shared_page_view_1');
    const observe = vi.fn().mockResolvedValue({});
    sendBeacon({
      apiKey: 'k', articleUrl: 'https://e.com/p', canonicalArticleUrl: 'https://e.com/p', pageTitle: 'T',
      contentSelector: '.x', enableBeacon: true, debug: false, analyticsConsent: 'unknown', surface: 'sdk',
    } as any, { observe } as any);
    expect(observe.mock.calls[0][0].pageViewId).toBe('shared_page_view_1');
  });
});

describe('api wrappers', () => {
  it('offerAction posts the documented body and omits empty optionals', async () => {
    const client = { post: vi.fn().mockResolvedValue({ success: true }) } as any;
    await createPostsApi(client).offerAction({
      apiKey: 'k', url: 'https://e.com/p', hostName: 'e.com', decisionId: 'dec_1', action: 'signin_started',
    });
    expect(client.post).toHaveBeenCalledWith('/posts/offer-action', {
      apiKey: 'k', url: 'https://e.com/p', hostName: 'e.com', decisionId: 'dec_1', action: 'signin_started',
    });
  });

  it('purchaseArticle forwards surface only when set', async () => {
    const client = { post: vi.fn().mockResolvedValue({ success: true }) } as any;
    const api = createCreditsApi(client);
    const base = { apiKey: 'k', postUrl: 'u', postName: 'n', hostName: 'h' };
    await api.purchaseArticle({ ...base, surface: 'wordpress' });
    await api.purchaseArticle(base);
    expect(client.post.mock.calls[0][1]).toEqual({ ...base, surface: 'wordpress' });
    expect(client.post.mock.calls[1][1]).toEqual(base);
  });
});

describe('view beacon waits for the session restore, bounded (ContentCredits._start)', () => {
  afterEach(() => { vi.useRealTimers(); vi.resetModules(); vi.doUnmock('../src/auth/session.js'); vi.doUnmock('../src/beacon/index.js'); vi.doUnmock('../src/paywall/index.js'); });

  async function load(refresh: () => Promise<boolean>, order: string[]) {
    vi.resetModules();
    vi.doMock('../src/auth/session.js', () => ({ tryRefreshSession: vi.fn(async () => { order.push('refresh:start'); const r = await refresh(); order.push('refresh:end'); return r; }) }));
    vi.doMock('../src/beacon/index.js', () => ({ sendBeacon: vi.fn(() => { order.push('beacon'); }) }));
    vi.doMock('../src/paywall/index.js', () => ({
      createPaywall: vi.fn(() => ({
        init: vi.fn(async () => { order.push('paywall:init'); }),
        checkAccess: vi.fn(), destroy: vi.fn(), login: vi.fn(), purchase: vi.fn(), buyMoreCredits: vi.fn(),
      })),
    }));
    const mod = await import('../src/index');
    return mod.ContentCredits;
  }

  it('sends the beacon only after the silent refresh finishes, and does not delay the paywall', async () => {
    const order: string[] = [];
    let finish: (v: boolean) => void = () => {};
    // A reader with a stored refresh token but no access token: token storage is the real one (empty)
    const CC = await load(() => new Promise<boolean>(r => { finish = r; }), order);
    CC.init({ apiKey: 'pub_123', enableComments: false });
    await new Promise(r => setTimeout(r, 20));
    expect(order).toEqual(['refresh:start']); // beacon waits for the restore
    finish(true);
    await new Promise(r => setTimeout(r, 20));
    expect(order.indexOf('beacon')).toBeGreaterThan(order.indexOf('refresh:end'));
    expect(order).toContain('paywall:init');
  });

  it('sends anyway after 1.5s when the restore is slow (bounded wait)', async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const CC = await load(() => new Promise<boolean>(() => {}), order); // never settles
    CC.init({ apiKey: 'pub_123', enableComments: false });
    await vi.advanceTimersByTimeAsync(1400);
    expect(order).not.toContain('beacon');
    await vi.advanceTimersByTimeAsync(200);
    expect(order).toContain('beacon');
    expect(order).not.toContain('refresh:end');
  });
});
