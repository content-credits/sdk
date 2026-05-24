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
  purchaseHistory: PurchaseItem[];
}

export type UserRole = 'consumer' | 'publisher' | 'admin';

export interface PurchaseItem {
  articleId: string;
  postUrl: string;
  postName: string;
  creditsSpent: number;
  purchasedAt: string;
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
}

export type CommentSortBy = 'TOP' | 'NEWEST' | 'TIPPED_MOST';

// ─── API response types ──────────────────────────────────────────────────────

export interface ApiResponse<T = Record<string, unknown>> {
  success: boolean;
  message?: string;
  data?: T;
}

// Backend returns { success: boolean, message: string } — success IS the access indicator
export interface CheckAccessResponse {
  success: boolean;
  message?: string;
}

// Backend returns { success: boolean, message: string } — no balance/creditsSpent in response
export interface PurchaseResponse {
  success: boolean;
  message?: string;
}

// Backend returns { thread, comments } — no success wrapper
export interface CommentsResponse {
  thread: CommentThread;
  comments: Comment[];
}

// Backend returns the thread object directly (no success wrapper)
export type EnsureThreadResponse = CommentThread;

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

  /** Whether to enable the comment widget. Default: true */
  enableComments?: boolean;

  /** Override the Chrome extension ID */
  extensionId?: string;

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
   * Defaults to `'Unlock · N credits'` (when price is known) or `'Unlock article'`.
   *
   * @example
   * unlockButtonLabel: 'Unlock Just This Story'
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
    /** Heading shown in the login state. Default: 'This article requires a subscription' */
    loginHeading?: string;
    /** Detail shown in the login state. Default: 'Sign in to your Content Credits account to unlock this article.' */
    loginDetail?: string;
    /** Heading shown in the purchase state. Default: 'Unlock this article' */
    purchaseHeading?: string;
    /** Detail shown in the purchase state. Default: 'Use your Content Credits balance to instantly access this article.' */
    purchaseDetail?: string;
    /** Heading shown when credits are insufficient. Default: 'Not enough credits' */
    insufficientHeading?: string;
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
  | 'onPurchased'
  | 'onUserLogin'
  | 'onUserLogout'
  | 'onError'
  | 'theme'
>> {
  articleUrl: string;
  hostName: string;
  pageTitle: string;
  apiBaseUrl: string;
  accountsUrl: string;
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
  onPurchased?: (info: { creditsSpent: number; remainingBalance: number }) => void;
  onUserLogin?: (user: User) => void;
  onUserLogout?: () => void;
  onError?: (info: { message: string; error?: unknown }) => void;
  theme: Required<SDKTheme>;
}

// ─── SDK state ───────────────────────────────────────────────────────────────

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
}
