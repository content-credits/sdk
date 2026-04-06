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
import { tokenStorage } from './auth/storage.js';
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

    // 2. Hide premium content immediately (synchronous) before any async work.
    //    This prevents the flash of full article content that would otherwise
    //    appear during the token-refresh and access-check network round-trips.
    const earlyGate = createGate({
      selector: this.config.contentSelector,
      teaserParagraphs: this.config.teaserParagraphs,
    });
    earlyGate.hide();

    // 3. If no access token in memory/session, attempt a silent refresh.
    //    This runs on every new browser session (after the browser was closed)
    //    and silently re-authenticates the user using their stored refresh token.
    if (!tokenStorage.has()) {
      await tryRefreshSession(this.config.apiBaseUrl);
    }

    // Pass the pre-created gate so createPaywall reuses the same instance
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
    extensionId: ds.ccExtensionId,
    debug: ds.ccDebug === 'true',
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ContentCredits.init(rawConfig));
  } else {
    ContentCredits.init(rawConfig);
  }
}

autoInit();
