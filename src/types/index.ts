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

  /** Custom HTML template string for the paywall overlay */
  paywallTemplate?: string;

  /** Called when the user is granted access to the article */
  onAccessGranted?: () => void;

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
}

export interface ResolvedConfig extends Required<Omit<SDKConfig, 'paywallTemplate' | 'onAccessGranted' | 'theme'>> {
  articleUrl: string;
  hostName: string;
  pageTitle: string;
  apiBaseUrl: string;
  accountsUrl: string;
  paywallTemplate?: string;
  onAccessGranted?: () => void;
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
