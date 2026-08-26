import { canonicalUrl } from '../utils/canonical.js';
import type { SDKConfig, ResolvedConfig } from '../types/index.js';

declare const __API_BASE_URL__: string;
declare const __ACCOUNTS_URL__: string;

function normalizeArticleUrl(articleUrl: string): string {
  try {
    const url = new URL(articleUrl);
    ['token', 'cc_token', 'refresh_token', 'cc_refresh_token', 'cc_auth_code', 'cc_state'].forEach(param => {
      url.searchParams.delete(param);
    });
    return url.toString();
  } catch {
    return articleUrl;
  }
}

/**
 * Validate the opt-in server-side-content endpoint.
 *
 * Returns `null` for "not configured", which is the compatibility path — the
 * SDK then behaves exactly as it did before hydration existed. An endpoint
 * that is present but unusable (relative, `javascript:`, malformed) also
 * resolves to `null` rather than throwing: a bad value in a publisher's
 * template must degrade to today's hide/reveal behaviour, not take the whole
 * paywall down.
 *
 * The value is used verbatim as a complete URL — the SDK never appends a path.
 */
function resolveContentEndpoint(raw: SDKConfig, articleUrl: string): string | null {
  const candidate = raw.contentEndpoint;
  if (typeof candidate !== 'string' || candidate.trim() === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate.trim());
  } catch {
    console.warn(
      `[ContentCredits] contentEndpoint must be an absolute URL — ignoring "${candidate}". ` +
      'Falling back to hiding the content already on the page.'
    );
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    console.warn(`[ContentCredits] contentEndpoint must be http(s) — ignoring "${candidate}".`);
    return null;
  }

  // The reader's access token is sent to this origin. It is normally the
  // publisher's own site (which already controls this page, so this is not a
  // new capability) — but a cross-origin value is worth surfacing, since it is
  // usually a copy-paste mistake in a template rather than a deliberate choice.
  try {
    if (parsed.origin !== new URL(articleUrl).origin) {
      console.warn(
        `[ContentCredits] contentEndpoint origin (${parsed.origin}) differs from the article's ` +
        'origin. The reader\'s access token will be sent there — check this is intentional.'
      );
    }
  } catch {
    // articleUrl was already validated by the caller; nothing to do here.
  }

  return parsed.toString();
}

export function resolveConfig(raw: SDKConfig): ResolvedConfig {
  if (!raw.apiKey || typeof raw.apiKey !== 'string' || raw.apiKey.trim() === '') {
    throw new Error('[ContentCredits] apiKey is required. Get yours from the Content Credits admin panel.');
  }

  const articleUrl = normalizeArticleUrl(raw.articleUrl ?? window.location.href);
  let hostName: string;

  try {
    hostName = new URL(articleUrl).hostname;
  } catch {
    throw new Error(`[ContentCredits] Invalid articleUrl: "${articleUrl}"`);
  }

  return {
    apiKey: raw.apiKey.trim(),
    articleUrl,
    hostName,
    pageTitle: document.title,
    canonicalArticleUrl: canonicalUrl(articleUrl),
    contentSelector: raw.contentSelector ?? '.cc-premium-content',
    contentEndpoint: resolveContentEndpoint(raw, articleUrl),
    teaserParagraphs: raw.teaserParagraphs ?? 2,
    enableComments: raw.enableComments ?? true,
    enableBeacon: raw.enableBeacon ?? true,
    extensionId: 'ljehdpabbhgccmanhjdfacjnaigpgcml',
    debug: raw.debug ?? false,
    headless: raw.headless ?? false,
    paywallMode: raw.paywallMode ?? 'overlay',
    showHeadings: raw.showHeadings ?? true,
    unlockButtonLabel: raw.unlockButtonLabel,
    paywallCopy: raw.paywallCopy,
    renderPaywall: raw.renderPaywall,
    reactDOM: raw.reactDOM,
    apiBaseUrl: __API_BASE_URL__,
    accountsUrl: __ACCOUNTS_URL__,
    onAccessGranted: raw.onAccessGranted,
    onStateChange: raw.onStateChange,
    onReady: raw.onReady,
    onLoginRequired: raw.onLoginRequired,
    onPurchaseRequired: raw.onPurchaseRequired,
    onInsufficientCredits: raw.onInsufficientCredits,
    onCreditsPurchased: raw.onCreditsPurchased,
    onPurchased: raw.onPurchased,
    onUserLogin: raw.onUserLogin,
    onUserLogout: raw.onUserLogout,
    onError: raw.onError,
    theme: {
      primaryColor: raw.theme?.primaryColor ?? '#44C678',
      fontFamily: raw.theme?.fontFamily ?? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      backdropColor: raw.theme?.backdropColor ?? 'rgba(0, 0, 0, 0.45)',
      sdkButtonColor: raw.theme?.sdkButtonColor ?? '#44C678',
    },
  };
}
