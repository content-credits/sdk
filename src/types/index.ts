// ─── Backend model types ────────────────────────────────────────────────────

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  credits: number;
  roles: UserRole[];
  isVerified: boolean;
  isActive: boolean;
  linkedPublisherId?: string;
}

export type UserRole = 'consumer' | 'publisher' | 'admin';

export interface PurchasedContentItem {
  _id: string;
  postId: string;
  title: string;
  url: string;
  publisherName: string;
  publisherId?: string;
  publisherWebsite?: string;
  thumbnailUrl?: string;
  purchasedAt: string;
  creditsSpent: number;
}

export interface Article {
  _id: string;
  publisherId: string;
  url: string;
  title: string;
  creditsToPurchase: number;
  publisherEarningRate: number;
  totalPurchases: number;
  isActive: boolean;
}

export interface Comment {
  _id: string;
  threadId: string;
  postId?: string | null;
  parentCommentId: string | null;
  authorId: string;
  content: string;
  isActive: boolean;
  mentions: string[];
  likeCount: number;
  hasLiked: boolean;
  createdAt: string;
  updatedAt: string;
  author?: CommentAuthor;
  replies?: Comment[];

  // ── Moderation (design doc §4.1) ────────────────────────────────────────
  // `isActive: false` is the single visibility flag; these fields explain
  // *why*/*who* when present. All optional — older comments / non-moderated
  // comments simply omit them.
  hiddenBy?: string | null;
  hiddenReason?: string | null;
  moderatedAt?: string | null;
}

export interface CommentAuthor {
  _id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

export interface CommentThread {
  _id: string;
  pageUrl: string;
  hostname: string;
  isOpen: boolean;
  /** Links the thread to its canonical Post (design doc §3.1 / §4). Optional until backend ships it. */
  postId?: string | null;
}

export type CommentSortBy = 'TOP' | 'NEWEST' | 'TIPPED_MOST';

// ─── API response types ──────────────────────────────────────────────────────

export interface ApiResponse<T = Record<string, unknown>> {
  success: boolean;
  message?: string;
  data?: T;
}

// Backend returns { success, message, requiredCredits, creditBalance } — success IS
// the access indicator; requiredCredits is the article's price and creditBalance is
// the authenticated user's whole-credit balance (per-article pricing).
export interface CheckAccessResponse {
  success: boolean;
  message?: string;
  /** Machine-readable reason, e.g. `'SIGN_IN_REQUIRED'` for a signed-out caller. */
  code?: string;
  requiredCredits?: number;
  creditBalance?: number | null;
  /** Who the answer is for. `'agent'` is reserved for the future; not produced today. */
  principal?: { type: 'anonymous' | 'reader' };
}

// Backend returns { success: boolean, message: string } — no balance/creditsSpent in response
export interface PurchaseResponse {
  success: boolean;
  message?: string;
}

/**
 * Response from the publisher's own server-side content route (v1 contract).
 *
 * This is NOT a Content Credits API shape — it is served by the publisher
 * (e.g. the WordPress plugin), from the absolute URL in
 * `SDKConfig.contentEndpoint`. Contract:
 *   200 → `{ success: true, content: "<full post HTML>" }`
 *   401 → `{ success: false, code: "UNAUTHENTICATED" }`
 *   403 → `{ success: false, code: "NO_ACCESS" }`
 *   503 → `{ success: false, code: "UPSTREAM_UNAVAILABLE" }`
 */
export interface PublisherContentResponse {
  success: boolean;
  /** Full post HTML. Present only on the 200 success shape. */
  content?: string;
  /** Machine-readable failure code on the non-200 shapes. */
  code?: string;
  message?: string;
}

// Backend returns { thread, comments } — no success wrapper
export interface CommentsResponse {
  thread: CommentThread;
  comments: Comment[];
}

// Backend returns the thread object directly (no success wrapper)
export type EnsureThreadResponse = CommentThread;

// ─── Post discovery beacon (design doc §5.1) ─────────────────────────────────

/** POST /posts/observe request body — fired once per page load. */
export interface ObservePostPayload {
  apiKey: string;
  url: string;
  canonicalUrl: string;
  title: string;
  author?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  /** Rotating, non-PII id used for anonymous-reader view dedup (design doc §7.4). */
  anonId?: string;
  /** `document.referrer` at beacon time, when available. */
  referrer?: string;
  /** Publisher-declared analytics consent; omitted anonId when `'denied'`. */
  consent?: AnalyticsConsent;
}

/** Publisher-declared analytics consent state for this page load. */
export type AnalyticsConsent = 'granted' | 'denied' | 'unknown';

/** Gated paywall states an offer can be shown in. */
export type OfferState = 'login' | 'purchase' | 'insufficient';

/** POST /posts/offer-shown request body. Never carries a price — the server owns it. */
export interface OfferShownPayload {
  apiKey: string;
  url: string;
  hostName: string;
  state: OfferState;
  surface: 'sdk';
  anonId?: string;
  consent?: AnalyticsConsent;
  referrer?: string;
}

/** `decisionId` is null when the server could not resolve the post. */
export interface OfferShownResponse {
  success?: boolean;
  decisionId?: string | null;
  price?: number;
  [key: string]: unknown;
}

/** Backend acks with the upserted Post id (shape TBD — kept loose intentionally). */
export interface ObservePostResponse {
  success?: boolean;
  postId?: string;
  [key: string]: unknown;
}

/**
 * Loosely-typed ReactDOM adapter — matches both React 18 (`createRoot`) and
 * React 16/17 (`render`) without pulling React into the SDK's own bundle.
 */
export interface ReactDOMAdapter {
  /** React 18+ */
  createRoot?(container: Element): { render(node: unknown): void; unmount(): void };
  /** React 16/17 */
  render?(node: unknown, container: Element, callback?: () => void): void;
}

// ─── SDK configuration ───────────────────────────────────────────────────────

export interface SDKConfig {
  /** Publisher API key from the Content Credits admin panel */
  apiKey: string;

  /** Full URL of the article page. Defaults to window.location.href */
  articleUrl?: string;

  /** CSS selector for the element containing the premium content to gate */
  contentSelector?: string;

  /** Number of visible paragraphs before the paywall kicks in. Default: 2 */
  teaserParagraphs?: number;

  /**
   * **Opt-in.** Absolute URL of the publisher's own endpoint that serves the
   * full article HTML to entitled readers.
   *
   * Leave this unset (the default) and the SDK behaves exactly as it always
   * has: the page ships the whole article and the SDK hides everything past
   * the teaser, revealing it in place once access is granted.
   *
   * Set it — normally via the `data-cc-content-endpoint` attribute the
   * WordPress plugin puts on its script tag — and the page only ever ships a
   * teaser. When access is granted the SDK GETs this URL with the reader's
   * Content Credits token as `Authorization: Bearer <token>`, expects
   * `{ success: true, content: "<html>" }`, sanitizes the HTML, and replaces
   * the contents of `contentSelector` with it before revealing.
   *
   * Must be an absolute `http(s)` URL — the SDK never builds a path of its
   * own, so the publisher controls the whole route. Note that the reader's
   * access token is sent to this origin.
   */
  contentEndpoint?: string;

  /** Whether to enable the comment widget. Default: true */
  enableComments?: boolean;

  /**
   * Whether to fire the post-discovery beacon (`POST /posts/observe`) on page
   * load. Scrapes `og:*` / JSON-LD / `<title>` metadata and reports it
   * alongside the canonical URL — this is also the view event for analytics
   * (design doc §5.1, §7.1). Disable if you're handling discovery yourself
   * (e.g. via the WordPress plugin's server-side push) or to opt out of
   * anonymous view tracking entirely.
   *
   * Default: `true`
   */
  enableBeacon?: boolean;

  /**
   * Your reader-consent state for analytics identifiers. Sent with the view
   * beacon and the offer-exposure event.
   * - `'granted'` / `'unknown'` — the SDK may use its anonymous, non-PII
   *   `anonId` for view dedup.
   * - `'denied'` — the SDK never creates, reads or sends the `anonId`.
   *
   * Wire this to your consent banner. Data attribute: `data-cc-analytics-consent`.
   *
   * Default: `'unknown'`
   */
  analyticsConsent?: AnalyticsConsent;

  /** Visual theme options */
  theme?: SDKTheme;

  /**
   * Paywall display mode.
   * - `'inline'` — panel sits below the teaser content in the page flow (original behaviour)
   * - `'overlay'` — full-width panel that renders below the gated content (default)
   *
   * Default: `'overlay'`
   */
  paywallMode?: 'inline' | 'overlay';

  /**
   * Your ReactDOM instance. Required when using `renderPaywall`.
   * Supports React 18 (`createRoot`) and React 16/17 (`render`).
   *
   * @example
   * import ReactDOM from 'react-dom/client'; // React 18
   * ContentCredits.init({ reactDOM, renderPaywall: ({ mountSdkButton }) => <MyPaywall ref={mountSdkButton} /> });
   */
  reactDOM?: ReactDOMAdapter;

  /**
   * Custom label for the SDK's unlock/purchase button.
   * Defaults to `'Unlock for N credits'` (when price is known) or `'Unlock article'`.
   *
   * A `{credits}` token in the label is replaced with the article's price when
   * known ('Unlock with {credits} Content Credits' → 'Unlock with 2 Content
   * Credits') and stripped when unknown. Keep the price visible to readers:
   * if you override both this label (without `{credits}`) and
   * `paywallCopy.purchaseDetail`, the reader never sees the cost before a
   * one-click spend.
   *
   * @example
   * unlockButtonLabel: 'Unlock with {credits} Content Credits'
   */
  unlockButtonLabel?: string;

  /**
   * Override the default copy shown in the SDK's built-in paywall states.
   * All fields are optional — only supply the strings you want to change.
   *
   * @example
   * paywallCopy: {
   *   loginHeading: 'Read the full story',
   *   loginDetail: 'Sign in to access this article with your credits.',
   * }
   */
  paywallCopy?: {
    /** Heading shown in the login state. Default: 'Unlock this article with Content Credits' */
    loginHeading?: string;
    /** Detail shown in the login state. Default: 'Pay only for the articles you choose to read — no subscription. Sign in or create a free account to continue.' */
    loginDetail?: string;
    /** Heading shown in the purchase state. Default: 'Unlock this article' */
    purchaseHeading?: string;
    /**
     * Detail shown in the purchase state. Default when both the article price
     * and the reader's balance are known: 'This article costs X credits — you
     * have Y.' Otherwise: 'Use your Content Credits balance to instantly
     * access this article.'
     */
    purchaseDetail?: string;
    /** Heading shown when credits are insufficient. Default: 'Not enough credits' */
    insufficientHeading?: string;
    /**
     * Detail shown when credits are insufficient. Default when both the
     * article price and the reader's balance are known: 'This article costs
     * X credits — you have Y.' Otherwise: 'You don't have enough credits to
     * unlock this article.'
     */
    insufficientDetail?: string;
    /** Label for the sign-in button in the login state. Default: 'Sign in to read' */
    signInButtonLabel?: string;
    /** Label for the buy-credits button in the insufficient state. Default: 'Buy credits' */
    buyCreditsButtonLabel?: string;
    /**
     * Overrides the generic purchase-failure line shown after a failed
     * unlock attempt (network error, 5xx, or any non-402/429 failure).
     * Default: "Something went wrong and your article wasn't unlocked.
     * Please try again."
     */
    errorText?: string;
  };

  /**
   * Full-control paywall render function. The publisher renders the entire
   * modal content and decides where the SDK's action button appears by passing
   * `mountSdkButton` as a React ref callback to any container element.
   *
   * The SDK mounts its state-aware button (sign in / unlock / top up) and the
   * "Powered by Content Credits" line inside whichever element receives the ref.
   * Requires `reactDOM` to also be set.
   *
   * @example
   * renderPaywall: ({ mountSdkButton }) => (
   *   <div>
   *     <h2>Donate to access this story.</h2>
   *     <button onClick={openDonation}>See Donation Options</button>
   *     <div ref={mountSdkButton} />
   *   </div>
   * )
   */
  renderPaywall?: (props: {
    mountSdkButton: (el: HTMLElement | null) => void;
  }) => { type: unknown; props: unknown; key?: unknown };

  /**
   * Whether to show the heading and detail text in the SDK's built-in paywall
   * states (login, purchase, insufficient). Set to `false` when your layout
   * already provides article context (e.g. via `renderPaywall`).
   *
   * Default: `true`
   */
  showHeadings?: boolean;

  /** Called when the user is granted access to the article */
  onAccessGranted?: () => void;

  // ── Headless / custom-UI callbacks ──────────────────────────────────────────
  // All callbacks below fire regardless of headless mode. In headless mode the
  // SDK calls these instead of rendering its own UI; in default mode they fire
  // alongside the built-in UI so you can run side-effects without switching modes.

  /**
   * Called on every state change. Receives the full state snapshot.
   * Use this as the single reactive hook to drive a custom UI instead of
   * calling `cc.subscribe()` separately.
   */
  onStateChange?: (state: SDKState) => void;

  /**
   * Called once the SDK has finished its first access check.
   * Equivalent to listening for the `ready` event.
   */
  onReady?: (state: SDKState) => void;

  /**
   * Called when the paywall is reached and the user is **not logged in**.
   * Render your login UI here and call `cc.login()` from your button.
   */
  onLoginRequired?: () => void;

  /**
   * Called when the user is logged in but has **not yet purchased** this article.
   * Render your unlock/purchase UI here and call `cc.purchase()` from your button.
   */
  onPurchaseRequired?: (info: { requiredCredits: number | null; creditBalance: number | null }) => void;

  /**
   * Called when the user is logged in but their credit balance is **below** the
   * article price. Render a top-up UI here and call `cc.buyMoreCredits()`.
   */
  onInsufficientCredits?: (info: { required: number; available: number }) => void;

  /**
   * Called after a successful credit purchase via the checkout popup.
   * Equivalent to listening for the `credits:purchased` event.
   */
  onCreditsPurchased?: (info: { creditsAdded: number; creditBalance: number | null }) => void;

  /**
   * Called after a successful article purchase.
   * Equivalent to listening for the `article:purchased` event.
   */
  onPurchased?: (info: { creditsSpent: number; remainingBalance: number }) => void;

  /**
   * Called when a user logs in.
   * Equivalent to listening for the `auth:login` event.
   */
  onUserLogin?: (user: User) => void;

  /**
   * Called when the user logs out.
   * Equivalent to listening for the `auth:logout` event.
   */
  onUserLogout?: () => void;

  /**
   * Called when any SDK error occurs.
   * Equivalent to listening for the `error` event.
   */
  onError?: (info: { message: string; error?: unknown }) => void;

  /** Enable verbose debug logging */
  debug?: boolean;

  /**
   * Headless mode — disables all built-in DOM manipulation and UI rendering.
   *
   * When `true` the SDK will NOT:
   * - hide / reveal the premium content element
   * - inject the paywall overlay or gradient fade
   *
   * Instead it exposes reactive state (via `subscribe()`) and action methods
   * (`login()`, `purchase()`, `buyMoreCredits()`) so you can build a fully
   * custom paywall UI in React, Vue, Svelte, or plain JS.
   *
   * Default: `false`
   */
  headless?: boolean;
}

export interface SDKTheme {
  /** Primary brand colour used for buttons and accents. Default: '#44C678' */
  primaryColor?: string;
  /** Font family for all SDK UI elements */
  fontFamily?: string;
  /**
   * Background colour of the modal backdrop/scrim.
   * Accepts any valid CSS colour value.
   * Default: 'rgba(0, 0, 0, 0.45)'
   */
  backdropColor?: string;
  /**
   * Fill colour for the SDK's own action buttons (Sign in, Unlock, Top up).
   * Intentionally separate from `primaryColor` so publishers can brand their
   * own slot buttons differently from the Content Credits controls.
   * Default: '#44C678' (Content Credits green)
   */
  sdkButtonColor?: string;
}

export interface ResolvedConfig extends Required<Omit<SDKConfig,
  | 'contentEndpoint'
  | 'renderPaywall'
  | 'unlockButtonLabel'
  | 'paywallCopy'
  | 'reactDOM'
  | 'onAccessGranted'
  | 'onStateChange'
  | 'onReady'
  | 'onLoginRequired'
  | 'onPurchaseRequired'
  | 'onInsufficientCredits'
  | 'onCreditsPurchased'
  | 'onPurchased'
  | 'onUserLogin'
  | 'onUserLogout'
  | 'onError'
  | 'theme'
>> {
  extensionId: string;
  articleUrl: string;
  hostName: string;
  pageTitle: string;
  /** Client-computed canonical form of articleUrl (mirrors backend §2.2 rules). */
  canonicalArticleUrl: string;
  apiBaseUrl: string;
  accountsUrl: string;
  /**
   * Validated absolute `http(s)` server-side-content endpoint, or `null` when
   * the publisher hasn't opted in. `null` is the compatibility path: every
   * hide/reveal behaviour stays exactly as it was before hydration existed.
   */
  contentEndpoint: string | null;
  paywallMode: 'inline' | 'overlay';
  showHeadings: boolean;
  unlockButtonLabel?: string;
  paywallCopy?: SDKConfig['paywallCopy'];
  renderPaywall?: SDKConfig['renderPaywall'];
  reactDOM?: ReactDOMAdapter;
  onAccessGranted?: () => void;
  onStateChange?: (state: SDKState) => void;
  onReady?: (state: SDKState) => void;
  onLoginRequired?: () => void;
  onPurchaseRequired?: (info: { requiredCredits: number | null; creditBalance: number | null }) => void;
  onInsufficientCredits?: (info: { required: number; available: number }) => void;
  onCreditsPurchased?: (info: { creditsAdded: number; creditBalance: number | null }) => void;
  onPurchased?: (info: { creditsSpent: number; remainingBalance: number }) => void;
  onUserLogin?: (user: User) => void;
  onUserLogout?: () => void;
  onError?: (info: { message: string; error?: unknown }) => void;
  theme: Required<SDKTheme>;
}

// ─── SDK state ───────────────────────────────────────────────────────────────
//
// Note: `PaywallUIState` (`src/paywall/renderer.ts` — 'checking' | 'login' |
// 'purchase' | 'insufficient' | 'loading' | 'granted' | 'error') is a private
// implementation detail of the built-in renderer's DOM rebuilds. It is never
// serialized here or on any public event payload — `onStateChange`/`subscribe`
// only ever receive the boolean-flag `SDKState` snapshot below. That's why
// adding the 'error' state (Phase 0 trust-bug fix — see
// CONSUMER_MESSAGING_AUDIT_2026-07.md Part 1.3) for non-401 access-check
// failures was safe to do without a version bump or a publisher-facing
// migration: it can't collide with anything in a publisher's `onStateChange`
// switch statement.

export interface SDKState {
  isLoading: boolean;
  isExtensionAvailable: boolean;
  isLoggedIn: boolean;
  hasAccess: boolean;
  isLoaded: boolean;
  user: User | null;
  creditBalance: number | null;
  requiredCredits: number | null;
}

// ─── SDK events ──────────────────────────────────────────────────────────────

export interface SDKEventMap {
  ready: { state: SDKState };
  'auth:login': { user: User };
  'auth:logout': Record<string, never>;
  'paywall:shown': Record<string, never>;
  'paywall:hidden': Record<string, never>;
  'article:purchased': { creditsSpent: number; remainingBalance: number };
  'credits:insufficient': { required: number; available: number };
  'credits:purchased': { creditsAdded: number; creditBalance: number | null };
  'comment:posted': { comment: Comment };
  'comment:liked': { commentId: string; hasLiked: boolean };
  'comment:deleted': { commentId: string };
  error: { message: string; error?: unknown };
}

export type SDKEventName = keyof SDKEventMap;
export type SDKEventHandler<K extends SDKEventName> = (payload: SDKEventMap[K]) => void;

// ─── Extension message types ─────────────────────────────────────────────────

export interface ExtensionMessage {
  type: string;
  data?: Record<string, unknown>;
}

export interface AuthorizationResponseData {
  isAuthenticated: boolean;
  doesHaveAccess: boolean;
  creditBalance?: number;
  requiredCredits?: number;
}

export interface PurchaseResponseData {
  doesHaveAccess: boolean;
  creditBalance?: number;
  creditsSpent?: number;
  /** HTTP status of the backend purchase call, relayed by the extension. */
  status?: number;
  /** Backend error code (e.g. 'INSUFFICIENT_CREDITS'), relayed by the extension. */
  code?: string;
  message?: string;
  requiredCredits?: number;
}
