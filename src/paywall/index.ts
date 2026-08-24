import { createGate } from './gate.js';
import type { Gate } from './gate.js';
import { createPaywallRenderer, type PaywallRenderer } from './renderer.js';
import { detectExtension } from '../extension/detector.js';
import { createExtensionBridge } from '../extension/bridge.js';
import { isMobileDevice, openCenteredPopup } from '../auth/popup.js';
import { login as oauthLogin, accountsOrigin } from '../auth/oauth.js';
import { tokenStorage } from '../auth/storage.js';
import { ApiError } from '../api/client.js';
import type { createCreditsApi } from '../api/credits.js';
import type { StateStore } from '../core/state.js';
import type { EventEmitter } from '../core/events.js';
import type { ResolvedConfig, AuthorizationResponseData } from '../types/index.js';

// How long to wait for the extension to respond to an authorization request
// before falling back to the direct API check. MV3 service workers can take
// a moment to wake up, but if they don't respond within this window we
// assume the extension isn't functional and proceed without it.
const EXTENSION_RESPONSE_TIMEOUT_MS = 3_000;

// ─── Error classification ────────────────────────────────────────────────────
// The backend is rolling out a machine-readable `code` field on error bodies
// (CONSUMER_MESSAGING_AUDIT_2026-07.md Part 4/5). Prefer `code` when the
// backend has deployed it; fall back to the `status` checks that shipped in
// Phase 0 for backends that haven't deployed the `code` field yet — both
// paths must keep working since the backend change may land after this one.

function isInsufficientCreditsError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.code) return err.code === 'INSUFFICIENT_CREDITS';
  return err.status === 402;
}

function isRateLimitedError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.code) return err.code === 'RATE_LIMITED';
  return err.status === 429;
}

interface CreditsPurchasedMessage {
  type: string;
  orderId?: string;
  creditsAdded?: number;
  creditBalance?: number | null;
}

function isCreditsPurchasedMessage(data: unknown): data is CreditsPurchasedMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'cc:credits_purchased'
  );
}

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
    paywallMode: config.paywallMode,
  });

  const renderer: PaywallRenderer = createPaywallRenderer(config);
  const bridge = createExtensionBridge();
  let extensionAvailable = false;

  // ── Helpers ──────────────────────────────────────────────────────────────

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
    if (extensionAvailable) {
      bridge.requestLogin(config.hostName);
      return;
    }

    if (isMobileDevice()) {
      // Full-page redirect — popup is unusable on mobile. The result is
      // picked up by consumeAuthCodeFromUrl on the next page load.
      void oauthLogin(config);
      return;
    }

    if (!config.headless) renderer.render('loading', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
    const ok = await oauthLogin(config);

    if (ok) {
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
        // Reader-facing failure feedback: reverting the button silently with no
        // explanation leaves a paying user with zero feedback on why nothing
        // happened. The button stays enabled (via the `purchase` state) so they
        // can retry immediately. Publisher event below is unchanged.
        if (!config.headless) {
          renderer.render('purchase', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits }, {
            error: config.paywallCopy?.errorText ?? "Something went wrong and your article wasn't unlocked. Please try again.",
          });
        }
        emitter.emit('error', { message: result.message ?? 'Purchase failed' });
      }
    } catch (err) {
      state.set({ isLoading: false });
      if (isInsufficientCreditsError(err)) {
        // Insufficient credits — this must take precedence over the generic
        // inline purchase-error line; don't double-render.
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
        // Rate-limited retries get the specific copy from the OTP-incident
        // playbook; everything else (network blip, 5xx) gets the generic
        // purchase-failed line. Button stays enabled for retry either way.
        const message = isRateLimitedError(err)
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : config.paywallCopy?.errorText ?? "Something went wrong and your article wasn't unlocked. Please try again.";
        if (!config.headless) {
          renderer.render('purchase', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits }, { error: message });
        }
        config.onPurchaseRequired?.({
          requiredCredits: state.get().requiredCredits,
          creditBalance: state.get().creditBalance,
        });
        emitter.emit('error', { message: 'Purchase failed', error: err });
      }
    }
  }

  let creditsPurchasedListener: ((event: MessageEvent) => void) | null = null;

  // Wall-clock timestamp (Date.now()) of when the current checkout session
  // was armed. Used only for the absolute cap in recheckAfterCheckout below —
  // never to detect completion (a popup handle's liveness is not trustworthy;
  // see the comment on recheckAfterCheckout for why).
  let checkoutStartedAt: number | null = null;
  let lastFallbackRecheckAt = 0;
  // A single deferred recheck for a focus/visibility event that arrived
  // inside the debounce window (see scheduleTrailingRecheck). This is not a
  // poll: it fires at most once per suppressed event, never re-arms itself,
  // and is cleared on teardown.
  let trailingRecheckTimer: ReturnType<typeof setTimeout> | null = null;
  let focusListener: (() => void) | null = null;
  let visibilityChangeListener: (() => void) | null = null;

  function removeMessageListener(): void {
    if (creditsPurchasedListener) {
      window.removeEventListener('message', creditsPurchasedListener);
      creditsPurchasedListener = null;
    }
  }

  function clearTrailingRecheck(): void {
    if (trailingRecheckTimer !== null) {
      clearTimeout(trailingRecheckTimer);
      trailingRecheckTimer = null;
    }
  }

  // Tears down everything armed by doBuyMoreCredits(): the completion
  // message listener, the focus/visibility fallback, and any pending
  // trailing-edge recheck. Called on real completion (handleCreditsPurchased),
  // on the terminal recheck (recheckAfterCheckout), and on destroy().
  function removeCreditsPurchasedListeners(): void {
    checkoutStartedAt = null;
    clearTrailingRecheck();
    removeMessageListener();
    if (focusListener) {
      window.removeEventListener('focus', focusListener);
      focusListener = null;
    }
    if (visibilityChangeListener) {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityChangeListener);
      }
      visibilityChangeListener = null;
    }
  }

  function handleCreditsPurchased(event: MessageEvent): void {
    if (event.origin !== accountsOrigin(config)) return;
    if (!isCreditsPurchasedMessage(event.data)) return;

    removeCreditsPurchasedListeners();

    const creditsAdded = typeof event.data.creditsAdded === 'number' ? event.data.creditsAdded : 0;
    const creditBalance = typeof event.data.creditBalance === 'number' ? event.data.creditBalance : null;

    // onCreditsPurchased is emitter-wired in ContentCredits._start() (same
    // convention as onPurchased) — emitting here reaches it exactly once.
    emitter.emit('credits:purchased', { creditsAdded, creditBalance });

    void checkAccess();
  }

  /**
   * Fallback recovery for when the completion message never arrives. COOP can
   * sever window.opener, and on some browsers a severed popup's `.closed`
   * getter reads `true` immediately — even though the popup is still open and
   * the reader is still mid-payment. That is the *same* severed-opener
   * condition that stops the `cc:credits_purchased` postMessage from ever
   * arriving, so the two are not independent signals: reading
   * the popup handle's `.closed` as "checkout is done" stands the fallback down
   * exactly when it is the only remaining recovery path. This codebase
   * already knows popup-handle liveness is untrustworthy — see
   * `src/auth/popup.ts` (treats `popup.closed` right after `window.open` as
   * "blocked") and `src/auth/oauth.ts` (needed a server-side poll because the
   * opener is severed and postMessage never arrives).
   *
   * The only real completion signal is checkAccess() itself reporting access
   * granted (see performRecheck). Both bounds below are evaluated only in
   * response to a real `focus`/`visibilitychange` event (plus at most one
   * deferred trailing call per suppressed event — never a self-perpetuating
   * timer), so this cannot repeat the 2026-07 incident where a poll loop
   * starved the OTP rate limiter. That also means the bounds only take effect
   * the next time the reader returns to the tab: if they never come back,
   * these listeners stay attached — until destroy() tears them down — for the
   * rest of the page's lifetime. That's harmless (idle event listeners, no
   * timer running in the background), just not the same claim as "cannot
   * live forever":
   *   1. debounced (trailing-edge — see scheduleTrailingRecheck), so rapid
   *      focus/visibility churn collapses to one call without dropping the
   *      terminal recheck (the tab regaining focus for good is the normal end
   *      state, and if that call is silently dropped nothing else ever fires);
   *   2. an absolute wall-clock cap since the checkout window was armed
   *      (FALLBACK_RECHECK_MAX_WINDOW_MS) — long enough to cover a slow or
   *      interrupted PayPal/Apple Pay/card flow, short enough that an
   *      abandoned checkout doesn't keep rechecking the API indefinitely once
   *      the reader does come back.
   */
  const FALLBACK_RECHECK_MIN_INTERVAL_MS = 2000;
  // 15 minutes: generous for a distracted checkout (stepping away for a
  // card, a slow OTP, etc.) without leaving fallback listeners attached for
  // the rest of the browsing session if the reader abandons checkout outright.
  const FALLBACK_RECHECK_MAX_WINDOW_MS = 15 * 60 * 1000;

  function performRecheck(): void {
    clearTrailingRecheck();
    lastFallbackRecheckAt = Date.now();

    void checkAccess().then(() => {
      const timedOut = checkoutStartedAt !== null
        && Date.now() - checkoutStartedAt > FALLBACK_RECHECK_MAX_WINDOW_MS;
      // Stand down once checkAccess confirms access is granted — that is the
      // only trustworthy terminal condition — or once the absolute cap above
      // is hit. The popup handle's `.closed` is deliberately not consulted here.
      if (state.get().hasAccess || timedOut) {
        removeCreditsPurchasedListeners();
      }
    });
  }

  function scheduleTrailingRecheck(): void {
    if (trailingRecheckTimer !== null) return; // one pending trailing call at a time
    const dueIn = Math.max(0, FALLBACK_RECHECK_MIN_INTERVAL_MS - (Date.now() - lastFallbackRecheckAt));
    trailingRecheckTimer = setTimeout(() => {
      trailingRecheckTimer = null;
      performRecheck();
    }, dueIn);
  }

  function recheckAfterCheckout(): void {
    if (Date.now() - lastFallbackRecheckAt < FALLBACK_RECHECK_MIN_INTERVAL_MS) {
      // Suppressed by the debounce — defer it to the boundary instead of
      // dropping it (see FALLBACK_RECHECK_MIN_INTERVAL_MS point 1 above).
      scheduleTrailingRecheck();
      return;
    }
    performRecheck();
  }

  function handleFocus(): void {
    recheckAfterCheckout();
  }

  function handleVisibilityChange(): void {
    if (typeof document === 'undefined' || document.visibilityState === 'visible' || !document.visibilityState) {
      recheckAfterCheckout();
    }
  }

  function doBuyMoreCredits(): void {
    removeCreditsPurchasedListeners();
    lastFallbackRecheckAt = 0;
    checkoutStartedAt = Date.now();

    creditsPurchasedListener = handleCreditsPurchased;
    focusListener = handleFocus;
    visibilityChangeListener = handleVisibilityChange;

    window.addEventListener('message', creditsPurchasedListener);
    window.addEventListener('focus', focusListener);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', visibilityChangeListener);
    }

    const url = new URL('/checkout', config.accountsUrl);
    url.searchParams.set('origin', window.location.origin);
    url.searchParams.set('reason', 'insufficient');
    const requiredCredits = state.get().requiredCredits;
    if (requiredCredits !== null && requiredCredits !== undefined) {
      url.searchParams.set('required', String(requiredCredits));
    }

    const popup = openCenteredPopup(url.toString(), { name: 'ccCheckout', width: 480, height: 640 });
    if (!popup) {
      // Blocked popup: fall back to opening /consumer/buy-credits in a plain
      // tab with `noopener`, which severs window.opener entirely — no
      // `cc:credits_purchased` postMessage can ever reach the `message`
      // listener, so remove only that one. Focus/visibilitychange recovery is
      // still possible here, and with no popup handle at all it's the *only*
      // possible completion signal in this configuration — so leave it armed,
      // bounded the same way as the popup path (see recheckAfterCheckout).
      removeMessageListener();
      const fallbackUrl = new URL('/consumer/buy-credits', config.accountsUrl);
      window.open(fallbackUrl.toString(), '_blank', 'noopener,noreferrer');
    }
  }

  // ── Extension auth response handler ──────────────────────────────────────

  function handleExtensionAuthResponse(data: AuthorizationResponseData): void {
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
  }

  // ── Access Check ──────────────────────────────────────────────────────────

  async function checkAccess(): Promise<void> {
    state.set({ isLoading: true });
    if (!config.headless) renderer.render('checking', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });

    if (extensionAvailable) {
      // Race the extension response against a timeout. MV3 service workers can
      // be asleep and take time to wake — if they don't respond in time we mark
      // the extension as non-functional and fall through to the API check so the
      // logged-in user isn't left stuck on a blank/hidden article.
      const responded = await new Promise<boolean>(resolve => {
        const timer = setTimeout(() => {
          extensionAvailable = false;
          state.set({ isExtensionAvailable: false });
          bridge.clearAuthorizationResponse(); // discard any late response after fallback
          resolve(false);
        }, EXTENSION_RESPONSE_TIMEOUT_MS);

        bridge.onAuthorizationResponse(data => {
          clearTimeout(timer);
          handleExtensionAuthResponse(data);
          resolve(true);
        });

        bridge.requestAuthorization(config.apiKey, config.hostName);
      });

      if (responded) return;
      // Extension timed out — fall through to direct API check below.
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
        requiredCredits: result.requiredCredits ?? null,
        creditBalance: result.creditBalance ?? null,
      });

      if (result.success) {
        handleAccessGranted(0, 0);
      } else {
        const required = state.get().requiredCredits;
        const available = state.get().creditBalance;

        // Same precedence rule as the purchase-attempt (doPurchase's catch)
        // and extension paths: once the balance is known to be below the
        // price, this is the insufficient-credits state, not the generic
        // purchase state. Otherwise a recheck after an incomplete top-up
        // (e.g. the wallet-checkout fallback recheck) silently drops the
        // reader back onto an Unlock button that is guaranteed to 402.
        if (required !== null && available !== null && available < required) {
          if (!config.headless) {
            gate.hide();
            renderer.render('insufficient', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits }, {
              requiredCredits: required,
              creditBalance: available,
            });
          }
          config.onInsufficientCredits?.({ required, available });
          emitter.emit('credits:insufficient', { required, available });
        } else {
          if (!config.headless) {
            gate.hide();
            renderer.render('purchase', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits }, {
              requiredCredits: required,
              creditBalance: available,
            });
          }
          config.onPurchaseRequired?.({
            requiredCredits: required,
            creditBalance: available,
          });
        }
        emitter.emit('paywall:shown', {});
      }
    } catch (err) {
      state.set({ isLoading: false, isLoaded: true });

      if (err instanceof ApiError && err.status === 401) {
        // Genuinely unauthenticated (or the silent refresh gave up) — the
        // login state is correct here.
        if (!config.headless) {
          gate.hide();
          renderer.render('login', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits });
        }
        config.onLoginRequired?.();
      } else {
        // A non-401 failure (network blip, 5xx, rate limit) says nothing about
        // whether the reader is signed in — rendering `login` would wrongly
        // tell an already-signed-in reader to sign in again. Show a distinct
        // retry state instead and skip onLoginRequired.
        const message = isRateLimitedError(err)
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : "We couldn't check your access to this article. Please try again.";
        if (!config.headless) {
          gate.hide();
          renderer.render('error', {
            onLogin: doLogin,
            onPurchase: doPurchase,
            onBuyMoreCredits: doBuyMoreCredits,
            onRetry: checkAccess,
          }, { error: message });
        }
        emitter.emit('error', { message: 'Access check failed', error: err });
      }
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init(): Promise<void> {
    // Detect extension
    extensionAvailable = await detectExtension(config.extensionId);
    state.set({ isExtensionAvailable: extensionAvailable });

    if (extensionAvailable) {
      bridge.attach();
      bridge.onPurchaseResponse(data => {
        state.set({ isLoading: false, isLoaded: true, hasAccess: data.doesHaveAccess });
        if (data.doesHaveAccess) {
          handleAccessGranted(data.creditsSpent ?? 0, data.creditBalance ?? 0);
        } else if (data.code === 'INSUFFICIENT_CREDITS' || data.status === 402) {
          // Same precedence rule as the direct-API path: insufficient credits
          // must render its dedicated state, not the generic error line.
          state.set({
            requiredCredits: data.requiredCredits ?? state.get().requiredCredits,
            creditBalance: data.creditBalance ?? state.get().creditBalance,
          });
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
          renderer.render('purchase', { onLogin: doLogin, onPurchase: doPurchase, onBuyMoreCredits: doBuyMoreCredits }, {
            error: config.paywallCopy?.errorText ?? "Something went wrong and your article wasn't unlocked. Please try again.",
          });
          emitter.emit('error', { message: 'Purchase failed via extension' });
        }
      });
    }

    await checkAccess();
  }

  function destroy(): void {
    removeCreditsPurchasedListeners();
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
