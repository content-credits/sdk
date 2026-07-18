import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPaywall } from '../src/paywall/index';
import { createState } from '../src/core/state';
import { createEventEmitter } from '../src/core/events';
import { ApiError } from '../src/api/client';

// Shared config literal for the Phase 0 trust-bug tests below — mirrors the
// per-test literals above but centralised so overrides stay short.
function baseConfig(overrides: Record<string, unknown> = {}) {
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
    apiBaseUrl: 'https://api.contentcredits.com',
    accountsUrl: 'https://accounts.contentcredits.com',
    paywallTemplate: undefined,
    onAccessGranted: undefined,
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
    ...overrides,
  };
}

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

  // ── Phase 0 trust-bug fixes (CONSUMER_MESSAGING_AUDIT_2026-07.md Part 1.3) ──

  it('re-renders the purchase state with an inline error on a generic purchase failure (not a thrown ApiError)', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();
    const errorHandler = vi.fn();
    emitter.on('error', errorHandler);

    const creditsApi = {
      checkAccess: vi.fn().mockResolvedValue({ success: false }),
      purchaseArticle: vi.fn().mockResolvedValue({ success: false, message: 'Card declined' }),
    };

    const module = createPaywall(
      baseConfig() as any,
      creditsApi as any,
      state,
      emitter,
      gateApi as any
    );

    await module.purchase();

    expect(rendererApi.render).toHaveBeenCalledWith(
      'purchase',
      expect.any(Object),
      { error: "Something went wrong and your article wasn't unlocked. Please try again." }
    );
    // Publisher event is unchanged by this fix.
    expect(errorHandler).toHaveBeenCalledWith({ message: 'Card declined' });
  });

  it('shows rate-limit copy on a 429 purchase failure', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();

    const creditsApi = {
      checkAccess: vi.fn().mockResolvedValue({ success: false }),
      purchaseArticle: vi.fn().mockRejectedValue(new ApiError(429, 'Too Many Requests')),
    };

    const module = createPaywall(
      baseConfig() as any,
      creditsApi as any,
      state,
      emitter,
      gateApi as any
    );

    await module.purchase();

    expect(rendererApi.render).toHaveBeenCalledWith(
      'purchase',
      expect.any(Object),
      { error: 'Too many attempts. Please wait a few minutes and try again.' }
    );
  });

  it('still renders the insufficient state (not the generic purchase error) on a 402 purchase failure', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();

    const creditsApi = {
      checkAccess: vi.fn().mockResolvedValue({ success: false }),
      purchaseArticle: vi.fn().mockRejectedValue(new ApiError(402, 'Insufficient credits')),
    };

    const module = createPaywall(
      baseConfig() as any,
      creditsApi as any,
      state,
      emitter,
      gateApi as any
    );

    await module.purchase();

    expect(rendererApi.render).toHaveBeenCalledWith('insufficient', expect.any(Object), expect.any(Object));
    // No double-render into the generic purchase-error state for a 402.
    expect(rendererApi.render).not.toHaveBeenCalledWith(
      'purchase',
      expect.any(Object),
      expect.objectContaining({ error: expect.any(String) })
    );
  });

  // ── Phase 3: error-code readiness (CONSUMER_MESSAGING_AUDIT_2026-07.md Part 4/5) ──

  it('prefers ApiError.code === "INSUFFICIENT_CREDITS" over status when both are present', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();

    const creditsApi = {
      checkAccess: vi.fn().mockResolvedValue({ success: false }),
      // Status is a generic 400 (not 402) but the code says insufficient credits —
      // code must win.
      purchaseArticle: vi.fn().mockRejectedValue(new ApiError(400, 'Bad request', undefined, 'INSUFFICIENT_CREDITS')),
    };

    const module = createPaywall(baseConfig() as any, creditsApi as any, state, emitter, gateApi as any);
    await module.purchase();

    expect(rendererApi.render).toHaveBeenCalledWith('insufficient', expect.any(Object), expect.any(Object));
  });

  it('prefers ApiError.code === "RATE_LIMITED" over status when both are present', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();

    const creditsApi = {
      checkAccess: vi.fn().mockResolvedValue({ success: false }),
      // Status is 500 (not 429) but the code says rate-limited — code must win.
      purchaseArticle: vi.fn().mockRejectedValue(new ApiError(500, 'Internal Server Error', undefined, 'RATE_LIMITED')),
    };

    const module = createPaywall(baseConfig() as any, creditsApi as any, state, emitter, gateApi as any);
    await module.purchase();

    expect(rendererApi.render).toHaveBeenCalledWith(
      'purchase',
      expect.any(Object),
      { error: 'Too many attempts. Please wait a few minutes and try again.' }
    );
  });

  it('falls back to status 402 for insufficient-credits when the backend has not deployed `code` yet', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();

    const creditsApi = {
      checkAccess: vi.fn().mockResolvedValue({ success: false }),
      purchaseArticle: vi.fn().mockRejectedValue(new ApiError(402, 'Insufficient credits')), // no `code`
    };

    const module = createPaywall(baseConfig() as any, creditsApi as any, state, emitter, gateApi as any);
    await module.purchase();

    expect(rendererApi.render).toHaveBeenCalledWith('insufficient', expect.any(Object), expect.any(Object));
  });

  it('falls back to status 429 for rate-limiting on access-check when the backend has not deployed `code` yet', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();

    const creditsApi = {
      checkAccess: vi.fn().mockRejectedValue(new ApiError(429, 'Too Many Requests')), // no `code`
      purchaseArticle: vi.fn(),
    };

    const module = createPaywall(baseConfig() as any, creditsApi as any, state, emitter, gateApi as any);
    await module.init();

    expect(rendererApi.render).toHaveBeenCalledWith(
      'error',
      expect.any(Object),
      { error: 'Too many attempts. Please wait a few minutes and try again.' }
    );
  });

  it('overrides the generic purchase-failure line via paywallCopy.errorText', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();

    const creditsApi = {
      checkAccess: vi.fn().mockResolvedValue({ success: false }),
      purchaseArticle: vi.fn().mockRejectedValue(new ApiError(500, 'Internal Server Error')),
    };

    const module = createPaywall(
      baseConfig({ paywallCopy: { errorText: 'That did not work — give it another shot.' } }) as any,
      creditsApi as any,
      state,
      emitter,
      gateApi as any
    );
    await module.purchase();

    expect(rendererApi.render).toHaveBeenCalledWith(
      'purchase',
      expect.any(Object),
      { error: 'That did not work — give it another shot.' }
    );
  });

  it('overrides the non-success (not thrown) purchase-failure line via paywallCopy.errorText', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();

    const creditsApi = {
      checkAccess: vi.fn().mockResolvedValue({ success: false }),
      purchaseArticle: vi.fn().mockResolvedValue({ success: false, message: 'Card declined' }),
    };

    const module = createPaywall(
      baseConfig({ paywallCopy: { errorText: 'That did not work — give it another shot.' } }) as any,
      creditsApi as any,
      state,
      emitter,
      gateApi as any
    );
    await module.purchase();

    expect(rendererApi.render).toHaveBeenCalledWith(
      'purchase',
      expect.any(Object),
      { error: 'That did not work — give it another shot.' }
    );
  });

  it('renders the error state (not login) on a non-401 access-check failure, and skips onLoginRequired', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();
    const onLoginRequired = vi.fn();
    const errorHandler = vi.fn();
    emitter.on('error', errorHandler);

    const creditsApi = {
      checkAccess: vi.fn().mockRejectedValue(new ApiError(500, 'Internal Server Error')),
      purchaseArticle: vi.fn(),
    };

    const module = createPaywall(
      baseConfig({ onLoginRequired }) as any,
      creditsApi as any,
      state,
      emitter,
      gateApi as any
    );

    await module.init();

    expect(rendererApi.render).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ onRetry: expect.any(Function) }),
      { error: "We couldn't check your access to this article. Please try again." }
    );
    expect(rendererApi.render).not.toHaveBeenCalledWith('login', expect.anything());
    expect(onLoginRequired).not.toHaveBeenCalled();
    expect(errorHandler).toHaveBeenCalledWith({ message: 'Access check failed', error: expect.any(ApiError) });
  });

  it('shows rate-limit copy in the error state on a 429 access-check failure', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();

    const creditsApi = {
      checkAccess: vi.fn().mockRejectedValue(new ApiError(429, 'Too Many Requests')),
      purchaseArticle: vi.fn(),
    };

    const module = createPaywall(
      baseConfig() as any,
      creditsApi as any,
      state,
      emitter,
      gateApi as any
    );

    await module.init();

    expect(rendererApi.render).toHaveBeenCalledWith(
      'error',
      expect.any(Object),
      { error: 'Too many attempts. Please wait a few minutes and try again.' }
    );
  });

  it('still renders login and calls onLoginRequired on a 401 access-check failure', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();
    const onLoginRequired = vi.fn();

    const creditsApi = {
      checkAccess: vi.fn().mockRejectedValue(new ApiError(401, 'Unauthorized — session expired')),
      purchaseArticle: vi.fn(),
    };

    const module = createPaywall(
      baseConfig({ onLoginRequired }) as any,
      creditsApi as any,
      state,
      emitter,
      gateApi as any
    );

    await module.init();

    expect(rendererApi.render).toHaveBeenCalledWith('login', expect.any(Object));
    expect(onLoginRequired).toHaveBeenCalledTimes(1);
    expect(rendererApi.render).not.toHaveBeenCalledWith('error', expect.anything(), expect.anything());
  });

  it('invoking onRetry from the error state re-runs the access check', async () => {
    tokenPresent = true;
    const state = createState();
    const emitter = createEventEmitter();

    const creditsApi = {
      checkAccess: vi.fn().mockRejectedValue(new ApiError(500, 'Internal Server Error')),
      purchaseArticle: vi.fn(),
    };

    const module = createPaywall(
      baseConfig() as any,
      creditsApi as any,
      state,
      emitter,
      gateApi as any
    );

    await module.init();
    expect(creditsApi.checkAccess).toHaveBeenCalledTimes(1);

    const errorCall = rendererApi.render.mock.calls.find((call: unknown[]) => call[0] === 'error');
    expect(errorCall).toBeDefined();
    const callbacks = errorCall![1] as { onRetry?: () => void | Promise<void> };
    await callbacks.onRetry?.();

    expect(creditsApi.checkAccess).toHaveBeenCalledTimes(2);
  });
});
