import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentCredits } from '../src/index';
import type { SDKState } from '../src/types';

vi.stubGlobal('__API_BASE_URL__', 'https://api.contentcredits.com');
vi.stubGlobal('__ACCOUNTS_URL__', 'https://accounts.contentcredits.com');
vi.stubGlobal('__EXTENSION_ID__', 'test-ext-id');

vi.mock('../src/paywall/index.js', () => ({
  createPaywall: vi.fn(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    checkAccess: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    login: vi.fn().mockResolvedValue(undefined),
    purchase: vi.fn().mockResolvedValue(undefined),
    buyMoreCredits: vi.fn(),
  })),
}));

vi.mock('../src/comments/index.js', () => ({
  createComments: vi.fn(() => ({
    init: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock('../src/auth/session.js', () => ({
  tryRefreshSession: vi.fn().mockResolvedValue(false),
}));

vi.mock('../src/auth/oauth.js', () => ({
  consumeAuthCodeFromUrl: vi.fn().mockResolvedValue(false),
  login: vi.fn().mockResolvedValue(false),
}));

vi.mock('../src/extension/detector.js', () => ({
  detectExtension: vi.fn().mockResolvedValue(false),
}));

describe('ContentCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<article class="cc-premium-content"><p>Paragraph 1</p><p>Paragraph 2</p></article>';
  });

  it('wires callbacks, initializes modules, and exposes public API methods', async () => {
    const onStateChange = vi.fn();
    const onReady = vi.fn();
    const onPurchased = vi.fn();
    const onUserLogout = vi.fn();

    const cc = ContentCredits.init({
      apiKey: 'pub_123',
      enableComments: true,
      onStateChange,
      onReady,
      onPurchased,
      onUserLogout,
    });

    await vi.waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1);
    });

    const state = cc.getState() as SDKState;
    expect(state).toEqual(expect.objectContaining({
      isLoading: false,
      hasAccess: false,
    }));

    cc['emitter'].emit('article:purchased', { creditsSpent: 3, remainingBalance: 8 });
    cc['emitter'].emit('auth:logout', {});

    expect(onPurchased).toHaveBeenCalledWith({ creditsSpent: 3, remainingBalance: 8 });
    expect(onUserLogout).toHaveBeenCalledTimes(1);

    await expect(cc.login()).resolves.toBeUndefined();
    await expect(cc.purchase()).resolves.toBeUndefined();
    await expect(cc.checkAccess()).resolves.toBeUndefined();

    cc.buyMoreCredits();
    cc.openComments();
    cc.closeComments();

    cc.destroy();
    expect(onStateChange).toHaveBeenCalled();
  });

  it('clears state on logout even when server revoke fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const cc = ContentCredits.init({ apiKey: 'pub_123' });

    await vi.waitFor(() => {
      expect(cc.getState()).toBeTruthy();
    });

    await expect(cc.logout()).resolves.toBeUndefined();
    expect(cc.getState()).toEqual(expect.objectContaining({
      isLoggedIn: false,
      hasAccess: false,
    }));
  });
});
