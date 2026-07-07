import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPaywall } from '../src/paywall/index';
import { createState } from '../src/core/state';
import { createEventEmitter } from '../src/core/events';

vi.stubGlobal('__ACCOUNTS_URL__', 'https://accounts.contentcredits.com');

const gateApi = {
  hide: vi.fn(() => true),
  reveal: vi.fn(),
  isGated: vi.fn(() => true),
};

const rendererApi = {
  init: vi.fn(),
  render: vi.fn(),
  setButtonLoading: vi.fn(),
  destroy: vi.fn(),
};

const bridgeApi = {
  attach: vi.fn(),
  detach: vi.fn(),
  requestAuthorization: vi.fn(),
  requestPurchase: vi.fn(),
  requestLogin: vi.fn(),
  onAuthorizationResponse: vi.fn(),
  onPurchaseResponse: vi.fn(),
};

let extensionDetected = false;
let tokenPresent = false;
let popupToken: string | null = null;

vi.mock('../src/paywall/gate.js', () => ({
  createGate: vi.fn(() => gateApi),
}));

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
  login: vi.fn(async () => {
    if (popupToken) tokenPresent = true;
    return !!popupToken;
  }),
  consumeAuthCodeFromUrl: vi.fn().mockResolvedValue(false),
}));

vi.mock('../src/auth/storage.js', () => ({
  tokenStorage: {
    has: vi.fn(() => tokenPresent),
    get: vi.fn(() => (tokenPresent ? 'token_123' : null)),
    set: vi.fn(() => {
      tokenPresent = true;
    }),
    clear: vi.fn(() => {
      tokenPresent = false;
    }),
  },
}));

describe('paywall flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extensionDetected = false;
    tokenPresent = false;
    popupToken = null;
  });

  it('shows login-required state when no token is present', async () => {
    const state = createState();
    const emitter = createEventEmitter();
    const onLoginRequired = vi.fn();
    const paywallShown = vi.fn();
    emitter.on('paywall:shown', paywallShown);

    const module = createPaywall({
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
      apiBaseUrl: 'https://api.contentcredits.com',
      accountsUrl: 'https://accounts.contentcredits.com',
      paywallTemplate: undefined,
      onAccessGranted: undefined,
      onStateChange: undefined,
      onReady: undefined,
      onLoginRequired,
      onPurchaseRequired: undefined,
      onInsufficientCredits: undefined,
      onPurchased: undefined,
      onUserLogin: undefined,
      onUserLogout: undefined,
      onError: undefined,
      theme: { primaryColor: '#44C678', fontFamily: 'sans-serif' },
    } as any, {
      checkAccess: vi.fn(),
      purchaseArticle: vi.fn(),
    } as any, state, emitter, gateApi as any);

    await module.init();

    expect(gateApi.hide).toHaveBeenCalled();
    expect(rendererApi.render).toHaveBeenCalledWith('login', expect.any(Object));
    expect(onLoginRequired).toHaveBeenCalledTimes(1);
    expect(paywallShown).toHaveBeenCalledTimes(1);
    expect(state.get()).toEqual(expect.objectContaining({
      isLoaded: true,
      isLoggedIn: false,
      hasAccess: false,
    }));
  });

  it('re-checks access after popup login and grants access when already purchased', async () => {
    const state = createState();
    const emitter = createEventEmitter();
    const accessGranted = vi.fn();
    const hidden = vi.fn();
    emitter.on('paywall:hidden', hidden);

    const creditsApi = {
      checkAccess: vi.fn().mockResolvedValue({ success: true }),
      purchaseArticle: vi.fn(),
    };

    const module = createPaywall({
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
      apiBaseUrl: 'https://api.contentcredits.com',
      accountsUrl: 'https://accounts.contentcredits.com',
      paywallTemplate: undefined,
      onAccessGranted: accessGranted,
      onStateChange: undefined,
      onReady: undefined,
      onLoginRequired: undefined,
      onPurchaseRequired: undefined,
      onInsufficientCredits: undefined,
      onPurchased: undefined,
      onUserLogin: undefined,
      onUserLogout: undefined,
      onError: undefined,
      theme: { primaryColor: '#44C678', fontFamily: 'sans-serif' },
    } as any, creditsApi as any, state, emitter, gateApi as any);

    await module.init();
    popupToken = 'token_123';

    await module.login();

    expect(creditsApi.checkAccess).toHaveBeenCalledWith({
      apiKey: 'pub_123',
      postUrl: 'https://example.com/post',
      postName: 'Hello',
      hostName: 'example.com',
    });
    expect(gateApi.reveal).toHaveBeenCalled();
    expect(hidden).toHaveBeenCalledTimes(1);
    expect(accessGranted).toHaveBeenCalledTimes(1);
    expect(state.get()).toEqual(expect.objectContaining({
      isLoggedIn: true,
      hasAccess: true,
      isLoaded: true,
    }));
  });

  it('passes per-article credit price to the purchase render on the direct-API path', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();

    const creditsApi = {
      checkAccess: vi.fn().mockResolvedValue({
        success: false,
        requiredCredits: 3,
        creditBalance: 10,
      }),
      purchaseArticle: vi.fn(),
    };

    const onPurchaseRequired = vi.fn();

    const module = createPaywall({
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
      apiBaseUrl: 'https://api.contentcredits.com',
      accountsUrl: 'https://accounts.contentcredits.com',
      paywallTemplate: undefined,
      onAccessGranted: undefined,
      onStateChange: undefined,
      onReady: undefined,
      onLoginRequired: undefined,
      onPurchaseRequired,
      onInsufficientCredits: undefined,
      onPurchased: undefined,
      onUserLogin: undefined,
      onUserLogout: undefined,
      onError: undefined,
      theme: { primaryColor: '#44C678', fontFamily: 'sans-serif' },
    } as any, creditsApi as any, state, emitter, gateApi as any);

    await module.init();

    expect(rendererApi.render).toHaveBeenCalledWith(
      'purchase',
      expect.any(Object),
      { requiredCredits: 3, creditBalance: 10 },
    );
    expect(onPurchaseRequired).toHaveBeenCalledWith({ requiredCredits: 3, creditBalance: 10 });
    expect(state.get()).toEqual(expect.objectContaining({
      requiredCredits: 3,
      creditBalance: 10,
      hasAccess: false,
    }));
  });

  it('processes successful purchases for logged-in users', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();
    const purchased = vi.fn();
    emitter.on('article:purchased', purchased);

    const creditsApi = {
      checkAccess: vi.fn().mockResolvedValue({ success: false }),
      purchaseArticle: vi.fn().mockResolvedValue({ success: true }),
    };

    const module = createPaywall({
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
      apiBaseUrl: 'https://api.contentcredits.com',
      accountsUrl: 'https://accounts.contentcredits.com',
      paywallTemplate: undefined,
      onAccessGranted: undefined,
      onStateChange: undefined,
      onReady: undefined,
      onLoginRequired: undefined,
      onPurchaseRequired: vi.fn(),
      onInsufficientCredits: undefined,
      onPurchased: undefined,
      onUserLogin: undefined,
      onUserLogout: undefined,
      onError: undefined,
      theme: { primaryColor: '#44C678', fontFamily: 'sans-serif' },
    } as any, creditsApi as any, state, emitter, gateApi as any);

    await module.purchase();

    expect(creditsApi.purchaseArticle).toHaveBeenCalledWith({
      apiKey: 'pub_123',
      postUrl: 'https://example.com/post',
      postName: 'Hello',
      hostName: 'example.com',
    });
    expect(purchased).toHaveBeenCalledWith({ creditsSpent: 0, remainingBalance: 0 });
    expect(state.get()).toEqual(expect.objectContaining({
      isLoading: false,
      hasAccess: true,
    }));
  });
});
