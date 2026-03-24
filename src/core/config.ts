import type { SDKConfig, ResolvedConfig } from '../types/index.js';

declare const __API_BASE_URL__: string;
declare const __ACCOUNTS_URL__: string;
declare const __EXTENSION_ID__: string;

export function resolveConfig(raw: SDKConfig): ResolvedConfig {
  if (!raw.apiKey || typeof raw.apiKey !== 'string' || raw.apiKey.trim() === '') {
    throw new Error('[ContentCredits] apiKey is required. Get yours from the Content Credits admin panel.');
  }

  const articleUrl = raw.articleUrl ?? window.location.href;
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
    apiBaseUrl: __API_BASE_URL__,
    accountsUrl: __ACCOUNTS_URL__,
    paywallTemplate: raw.paywallTemplate,
    onAccessGranted: raw.onAccessGranted,
    theme: {
      primaryColor: raw.theme?.primaryColor ?? '#44C678',
      fontFamily: raw.theme?.fontFamily ?? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
  };
}
