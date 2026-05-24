import type { SDKConfig, ResolvedConfig } from '../types/index.js';

declare const __API_BASE_URL__: string;
declare const __ACCOUNTS_URL__: string;
declare const __EXTENSION_ID__: string;

function normalizeArticleUrl(articleUrl: string): string {
  try {
    const url = new URL(articleUrl);
    ['token', 'cc_token', 'refresh_token', 'cc_refresh_token'].forEach(param => {
      url.searchParams.delete(param);
    });
    return url.toString();
  } catch {
    return articleUrl;
  }
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
    contentSelector: raw.contentSelector ?? '.cc-premium-content',
    teaserParagraphs: raw.teaserParagraphs ?? 2,
    enableComments: raw.enableComments ?? true,
    extensionId: raw.extensionId ?? __EXTENSION_ID__,
    debug: raw.debug ?? false,
    headless: raw.headless ?? false,
    paywallMode: raw.paywallMode ?? 'overlay',
    unlockButtonLabel: raw.unlockButtonLabel,
    paywallCopy: raw.paywallCopy,
    renderPaywall: raw.renderPaywall,
    paywallTopSlot: raw.paywallTopSlot,
    reactDOM: raw.reactDOM,
    apiBaseUrl: __API_BASE_URL__,
    accountsUrl: __ACCOUNTS_URL__,
    onAccessGranted: raw.onAccessGranted,
    onStateChange: raw.onStateChange,
    onReady: raw.onReady,
    onLoginRequired: raw.onLoginRequired,
    onPurchaseRequired: raw.onPurchaseRequired,
    onInsufficientCredits: raw.onInsufficientCredits,
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
