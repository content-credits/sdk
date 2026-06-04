/**
 * Content Credits JS SDK v2
 *
 * Drop-in paywall and comments for any website.
 *
 * CDN (script tag):
 *   <script src="https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js"></script>
 *   <script>
 *     ContentCreditsSDK.init({ apiKey: 'YOUR_API_KEY', contentSelector: '#article-body' });
 *   </script>
 *
 * npm:
 *   import { ContentCredits } from '@contentcredits/sdk';
 *   ContentCredits.init({ apiKey: 'YOUR_API_KEY', contentSelector: '#article-body' });
 */

import { resolveConfig } from './core/config.js';
import { createState } from './core/state.js';
import { createEventEmitter } from './core/events.js';
import { createApiClient } from './api/client.js';
import { createCreditsApi } from './api/credits.js';
import { createCommentsApi } from './api/comments.js';
import { createPaywall } from './paywall/index.js';
import { createGate } from './paywall/gate.js';
import { createComments } from './comments/index.js';
import { tokenStorage, refreshTokenStorage } from './auth/storage.js';
import { consumeTokenFromUrl } from './auth/popup.js';
import { tryRefreshSession } from './auth/session.js';

import type {
  SDKConfig,
  SDKState,
  SDKEventName,
  SDKEventHandler,
} from './types/index.js';

export type { SDKConfig, SDKState, SDKEventName, SDKEventHandler };
export type { User, Comment, CommentSortBy } from './types/index.js';

declare const __VERSION__: string;

export class ContentCredits {
  private readonly state = createState();
  private readonly emitter = createEventEmitter();
  private readonly client;
  private readonly creditsApi;
  private readonly commentsApi;
  private paywallModule: ReturnType<typeof createPaywall> | null = null;
  private commentsModule: ReturnType<typeof createComments> | null = null;

  private constructor(private readonly config: ReturnType<typeof resolveConfig>) {
    this.client = createApiClient(config.apiBaseUrl, this.emitter);
    this.creditsApi = createCreditsApi(this.client);
    this.commentsApi = createCommentsApi(this.client);
  }

  // ── Factory ───────────────────────────────────────────────────────────────

  /**
   * Initialise the SDK and immediately start the access check.
   *
   * @example
   * const cc = ContentCredits.init({
   *   apiKey: 'pub_abc123',
   *   contentSelector: '#premium-content',
   * });
   */
  static init(rawConfig: SDKConfig): ContentCredits {
    const config = resolveConfig(rawConfig);
    const instance = new ContentCredits(config);
    void instance._start();
    return instance;
  }

  // ── Internal start ────────────────────────────────────────────────────────

  private async _start(): Promise<void> {
    // 1. Consume any token that arrived in the URL (mobile redirect flow)
    consumeTokenFromUrl();

    // 2. Wire config-level callbacks so developers don't need separate on() calls.
    if (this.config.onStateChange) {
      this.state.subscribe(this.config.onStateChange);
    }
    if (this.config.onReady) {
      this.emitter.on('ready', ({ state }) => this.config.onReady!(state));
    }
    if (this.config.onPurchased) {
      this.emitter.on('article:purchased', (payload) => this.config.onPurchased!(payload));
    }
    if (this.config.onUserLogin) {
      this.emitter.on('auth:login', ({ user }) => this.config.onUserLogin!(user));
    }
    if (this.config.onUserLogout) {
      this.emitter.on('auth:logout', () => this.config.onUserLogout!());
    }
    if (this.config.onError) {
      this.emitter.on('error', (payload) => this.config.onError!(payload));
    }

    // 3. Hide premium content immediately (synchronous) before any async work.
    //    This prevents the flash of full article content that would otherwise
    //    appear during the token-refresh and access-check network round-trips.
    //    Skipped in headless mode — the host app owns all DOM manipulation.
    const earlyGate = createGate({
      selector: this.config.contentSelector,
      teaserParagraphs: this.config.teaserParagraphs,
      paywallMode: this.config.paywallMode,
    });
    if (!this.config.headless) earlyGate.hide();

    // 4. If no access token in memory/session, attempt a silent refresh.
    //    This runs on every new browser session (after the browser was closed)
    //    and silently re-authenticates the user using their stored refresh token.
    if (!tokenStorage.has()) {
      await tryRefreshSession(this.config.apiBaseUrl);
    }

    // 5. Pass the pre-created gate so createPaywall reuses the same instance
    // (and its hiddenNodes list) rather than creating a second one.
    this.paywallModule = createPaywall(
      this.config,
      this.creditsApi,
      this.state,
      this.emitter,
      earlyGate
    );

    if (this.config.enableComments) {
      this.commentsModule = createComments(
        this.config,
        this.commentsApi,
        this.emitter
      );
      this.commentsModule.init();
    }

    await this.paywallModule.init();

    this.emitter.emit('ready', { state: this.state.get() });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Subscribe to state changes. The callback receives the full state snapshot
   * every time any field changes. Returns an unsubscribe function.
   *
   * Primarily useful in **headless mode** — lets you drive your own UI from
   * reactive state without polling `getState()`.
   *
   * @example
   * const unsubscribe = cc.subscribe((state) => {
   *   if (state.hasAccess) showFullContent();
   *   else showPaywall(state);
   * });
   */
  subscribe(fn: (state: SDKState) => void): () => void {
    return this.state.subscribe(fn);
  }

  /**
   * Trigger the login flow programmatically.
   *
   * - Desktop: opens a popup window to the Content Credits auth page.
   * - Mobile: performs a full-page redirect.
   * - Extension: delegates to the browser extension.
   *
   * Primarily useful in **headless mode** where you render your own "Login"
   * button and call this from its `onClick` handler.
   */
  async login(): Promise<void> {
    await this.paywallModule?.login();
  }

  /**
   * Trigger the article purchase flow programmatically.
   *
   * Deducts the required credits from the user's balance and, on success,
   * updates `state.hasAccess` to `true` and emits `article:purchased`.
   *
   * If the user is not logged in, this automatically opens the login flow
   * first, then proceeds with the purchase.
   *
   * Primarily useful in **headless mode** where you render your own "Unlock"
   * button and call this from its `onClick` handler.
   */
  async purchase(): Promise<void> {
    await this.paywallModule?.purchase();
  }

  /**
   * Open the Content Credits dashboard in a new tab so the user can top up
   * their credit balance.
   *
   * Primarily useful in **headless mode** when `state.creditBalance` is lower
   * than `state.requiredCredits`.
   */
  buyMoreCredits(): void {
    this.paywallModule?.buyMoreCredits();
  }

  /** Subscribe to an SDK event. Returns an unsubscribe function. */
  on<K extends SDKEventName>(event: K, handler: SDKEventHandler<K>): () => void {
    return this.emitter.on(event, handler);
  }

  /** Unsubscribe from an SDK event. */
  off<K extends SDKEventName>(event: K, handler: SDKEventHandler<K>): void {
    this.emitter.off(event, handler);
  }

  /** Get a snapshot of the current SDK state. */
  getState(): SDKState {
    return this.state.get();
  }

  /** Programmatically trigger an article access check. */
  async checkAccess(): Promise<void> {
    await this.paywallModule?.checkAccess();
  }

  /** Open the comment panel programmatically. */
  openComments(): void {
    this.commentsModule?.open();
  }

  /** Close the comment panel programmatically. */
  closeComments(): void {
    this.commentsModule?.close();
  }

  /** Check if the user is currently authenticated. */
  isLoggedIn(): boolean {
    return tokenStorage.has();
  }

  /**
   * Return the current access token, or null if not authenticated.
   *
   * Use this to call your own server-side API routes that need to verify
   * the user's identity with the Content Credits API before returning
   * protected content — avoids ever sending premium content to the browser
   * before access is confirmed.
   */
  getToken(): string | null {
    return tokenStorage.get();
  }

  /**
   * Log the current user out.
   *
   * Revokes the refresh token on the server (best-effort), clears all local
   * auth state, resets SDK state, and emits `auth:logout`.
   */
  async logout(): Promise<void> {
    const rt = refreshTokenStorage.get();
    if (rt) {
      try {
        await fetch(`${this.config.apiBaseUrl}/auth/log-out`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
          credentials: 'omit',
        });
      } catch {
        // Network error — proceed with local cleanup regardless
      }
    }
    tokenStorage.clear();
    refreshTokenStorage.clear();
    this.state.reset();
    this.emitter.emit('auth:logout', {});
  }

  /** Tear down the SDK — removes all UI, event listeners, and stored state. */
  destroy(): void {
    this.paywallModule?.destroy();
    this.commentsModule?.destroy();
    this.emitter.removeAll();
    this.state.reset();
  }

  /** SDK version string. */
  static get version(): string {
    return __VERSION__;
  }
}

// ── Auto-init from script data attributes (CDN usage) ────────────────────────
// Partners can include the script like:
//   <script src="..." data-api-key="pub_abc" data-content-selector="#body"></script>
// and the SDK will auto-initialise without any additional JS.

function autoInit(): void {
  const script =
    document.currentScript as HTMLScriptElement | null ??
    document.querySelector<HTMLScriptElement>('script[data-cc-api-key], script[data-api-key]');

  if (!script) return;

  const ds = script.dataset;
  const apiKey = ds.ccApiKey ?? ds.apiKey;
  if (!apiKey) return;

  const rawConfig: SDKConfig = {
    apiKey,
    contentSelector: ds.ccContentSelector ?? ds.contentSelector,
    teaserParagraphs: ds.ccTeaserParagraphs ? parseInt(ds.ccTeaserParagraphs, 10) : undefined,
    enableComments: ds.ccEnableComments !== 'false',
    debug: ds.ccDebug === 'true',
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ContentCredits.init(rawConfig));
  } else {
    ContentCredits.init(rawConfig);
  }
}

autoInit();
