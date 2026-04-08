import { createGate } from './gate.js';
import type { Gate } from './gate.js';
import { createPaywallRenderer, type PaywallRenderer } from './renderer.js';
import { detectExtension } from '../extension/detector.js';
import { createExtensionBridge } from '../extension/bridge.js';
import { openAuthPopup, isMobileDevice, consumeTokenFromUrl } from '../auth/popup.js';
import { tokenStorage } from '../auth/storage.js';
import { ApiError } from '../api/client.js';
import type { createCreditsApi } from '../api/credits.js';
import type { StateStore } from '../core/state.js';
import type { EventEmitter } from '../core/events.js';
import type { ResolvedConfig } from '../types/index.js';

declare const __ACCOUNTS_URL__: string;

export interface PaywallModule {
  init(): Promise<void>;
  checkAccess(): Promise<void>;
  destroy(): void;
  login(): Promise<void>;
  purchase(): Promise<void>;
  buyMoreCredits(): void;
}

export function createPaywall(
  config: ResolvedConfig,
  creditsApi: ReturnType<typeof createCreditsApi>,
  state: StateStore,
  emitter: EventEmitter,
  existingGate?: Gate
): PaywallModule {
  // Accept a pre-created gate so the caller can call gate.hide() synchronously
  // before any async work, preventing a flash of the full article content.
  const gate = existingGate ?? createGate({
    selector: config.contentSelector,
    teaserParagraphs: config.teaserParagraphs,
  });

  const renderer: PaywallRenderer = createPaywallRenderer(config);
  const bridge = createExtensionBridge();
  let extensionAvailable = false;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function buildAuthUrl(): string {
    const redirect = encodeURIComponent(config.articleUrl);
    return `${__ACCOUNTS_URL__}/authenticate/extension?redirect=${redirect}`;
  }

  function handleAccessGranted(creditsSpent = 0, balance = 0): void {
    state.set({ hasAccess: true, isLoaded: true, isLoading: false });
    if (!config.headless) {
      gate.reveal();
      renderer.render('granted', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
    }
    emitter.emit('paywall:hidden', {});
    emitter.emit('article:purchased', { creditsSpent, remainingBalance: balance });
    config.onAccessGranted?.();
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async function doLogin(): Promise<void> {
    const authUrl = buildAuthUrl();

    if (extensionAvailable) {
      bridge.requestLogin(config.hostName);
      return;
    }

    if (isMobileDevice()) {
      // Full-page redirect — popup is blocked on mobile
      window.location.href = authUrl;
      return;
    }

    if (!config.headless) renderer.render('loading', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
    const token = await openAuthPopup(authUrl);

    if (token) {
      state.set({ isLoggedIn: true });
      await checkAccess();
    } else {
      // Popup closed without login
      if (!config.headless) renderer.render('login', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
    }
  }

  // ── Purchase ──────────────────────────────────────────────────────────────

  async function doPurchase(): Promise<void> {
    if (!tokenStorage.has()) {
      await doLogin();
      return;
    }

    if (extensionAvailable) {
      bridge.requestPurchase({
        articleId: config.apiKey,
        hostName: config.hostName,
        location: config.articleUrl,
        title: config.pageTitle,
      });
      return;
    }

    if (!config.headless) renderer.render('loading', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
    state.set({ isLoading: true });

    try {
      const result = await creditsApi.purchaseArticle({
        apiKey: config.apiKey,
        postUrl: config.articleUrl,
        postName: config.pageTitle,
        hostName: config.hostName,
      });

      if (result.success) {
        handleAccessGranted(0, 0);
      } else {
        state.set({ isLoading: false });
        if (!config.headless) renderer.render('purchase', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
        emitter.emit('error', { message: result.message ?? 'Purchase failed' });
      }
    } catch (err) {
      state.set({ isLoading: false });
      if (err instanceof ApiError && err.status === 402) {
        // Insufficient credits
        if (!config.headless) {
          renderer.render('insufficient', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits }, {
            requiredCredits: state.get().requiredCredits,
            creditBalance: state.get().creditBalance,
          });
        }
        const required = state.get().requiredCredits ?? 0;
        const available = state.get().creditBalance ?? 0;
        config.onInsufficientCredits?.({ required, available });
        emitter.emit('credits:insufficient', { required, available });
      } else {
        if (!config.headless) renderer.render('purchase', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
        config.onPurchaseRequired?.({
          requiredCredits: state.get().requiredCredits,
          creditBalance: state.get().creditBalance,
        });
        emitter.emit('error', { message: 'Purchase failed', error: err });
      }
    }
  }

  function doBuyMoreCredits(): void {
    window.open(`${__ACCOUNTS_URL__}/consumer/dashboard`, '_blank', 'noopener,noreferrer');
  }

  // ── Access Check ──────────────────────────────────────────────────────────

  async function checkAccess(): Promise<void> {
    state.set({ isLoading: true });
    if (!config.headless) renderer.render('checking', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });

    if (extensionAvailable) {
      bridge.requestAuthorization(config.apiKey, config.hostName);
      return; // response handled in onAuthorizationResponse
    }

    if (!tokenStorage.has()) {
      state.set({ isLoading: false, isLoaded: true });
      if (!config.headless) {
        gate.hide();
        renderer.render('login', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
      }
      config.onLoginRequired?.();
      emitter.emit('paywall:shown', {});
      return;
    }

    try {
      const result = await creditsApi.checkAccess({
        apiKey: config.apiKey,
        postUrl: config.articleUrl,
        postName: config.pageTitle,
        hostName: config.hostName,
      });

      // The API accepted the token → user is definitely authenticated,
      // regardless of whether they have access to this specific article.
      state.set({
        isLoading: false,
        isLoaded: true,
        hasAccess: result.success,
        isLoggedIn: true,
      });

      if (result.success) {
        handleAccessGranted(0, 0);
      } else {
        if (!config.headless) {
          gate.hide();
          renderer.render('purchase', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
        }
        config.onPurchaseRequired?.({
          requiredCredits: state.get().requiredCredits,
          creditBalance: state.get().creditBalance,
        });
        emitter.emit('paywall:shown', {});
      }
    } catch (err) {
      state.set({ isLoading: false, isLoaded: true });
      if (!config.headless) {
        gate.hide();
        renderer.render('login', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
      }
      config.onLoginRequired?.();
      if (!(err instanceof ApiError && err.status === 401)) {
        emitter.emit('error', { message: 'Access check failed', error: err });
      }
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init(): Promise<void> {
    // Check if user just returned from a mobile login redirect
    const redirectToken = consumeTokenFromUrl();
    if (redirectToken) {
      state.set({ isLoggedIn: true });
    }

    // Detect extension
    extensionAvailable = await detectExtension(config.extensionId);
    state.set({ isExtensionAvailable: extensionAvailable });

    if (extensionAvailable) {
      bridge.attach();
      bridge.onAuthorizationResponse(data => {
        state.set({
          isLoggedIn: data.isAuthenticated,
          hasAccess: data.doesHaveAccess,
          isLoaded: true,
          isLoading: false,
          creditBalance: data.creditBalance ?? null,
          requiredCredits: data.requiredCredits ?? null,
        });

        if (!data.isAuthenticated) {
          if (!config.headless) {
            gate.hide();
            renderer.render('login', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
          }
          config.onLoginRequired?.();
          emitter.emit('paywall:shown', {});
        } else if (data.doesHaveAccess) {
          handleAccessGranted(0, data.creditBalance ?? 0);
        } else {
          if (!config.headless) {
            gate.hide();
            renderer.render('purchase', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits }, {
              requiredCredits: data.requiredCredits,
              creditBalance: data.creditBalance,
            });
          }
          config.onPurchaseRequired?.({
            requiredCredits: data.requiredCredits ?? null,
            creditBalance: data.creditBalance ?? null,
          });
          emitter.emit('paywall:shown', {});
        }
      });

      bridge.onPurchaseResponse(data => {
        state.set({ isLoading: false, isLoaded: true, hasAccess: data.doesHaveAccess });
        if (data.doesHaveAccess) {
          handleAccessGranted(data.creditsSpent ?? 0, data.creditBalance ?? 0);
        } else {
          renderer.render('purchase', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
          emitter.emit('error', { message: 'Purchase failed via extension' });
        }
      });
    }

    await checkAccess();
  }

  function destroy(): void {
    bridge.detach();
    if (!config.headless) {
      renderer.destroy();
      gate.reveal();
    }
  }

  return {
    init,
    checkAccess,
    destroy,
    login: doLogin,
    purchase: doPurchase,
    buyMoreCredits: doBuyMoreCredits,
  };
}
