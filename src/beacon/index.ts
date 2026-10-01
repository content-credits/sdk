import { scrapeMetadata } from './metadata.js';
import { getOrCreateAnonId } from './anonId.js';
import { getPageViewId } from './pageView.js';
import { tokenStorage } from '../auth/storage.js';
import type { createPostsApi } from '../api/posts.js';
import type { ResolvedConfig } from '../types/index.js';

const VIEW_DEDUP_WINDOW_MS = 30 * 60 * 1000;

/**
 * Client-side view dedup for consent-denied, signed-out readers, who have no
 * anonId for the server to dedup on. Stores only a timestamp (no identifier)
 * in sessionStorage. Returns true when a view was already sent recently.
 * Any storage failure degrades to "not seen" — just send.
 */
function recentlyViewed(canonicalUrl: string): boolean {
  try {
    const key = `cc_viewed:${canonicalUrl}`;
    const last = Number(sessionStorage.getItem(key));
    if (last && Date.now() - last < VIEW_DEDUP_WINDOW_MS) return true;
    sessionStorage.setItem(key, String(Date.now()));
    return false;
  } catch {
    return false;
  }
}

/**
 * Fires the post-discovery / view beacon (`POST /posts/observe`,
 * design doc §5.1). Runs once per page load, best-effort: scraping or
 * network failures are swallowed (debug-logged only) so the beacon can
 * never break the paywall or comments.
 */
export function sendBeacon(
  config: ResolvedConfig,
  postsApi: ReturnType<typeof createPostsApi>
): void {
  if (!config.enableBeacon) return;
  if (
    config.analyticsConsent === 'denied' &&
    !tokenStorage.has() &&
    recentlyViewed(config.canonicalArticleUrl)
  ) return;

  try {
    const meta = scrapeMetadata(config.contentSelector);

    void postsApi
      .observe({
        apiKey: config.apiKey,
        url: config.articleUrl,
        canonicalUrl: config.canonicalArticleUrl,
        title: meta.title || config.pageTitle,
        author: meta.author,
        publishedAt: meta.publishedAt,
        thumbnailUrl: meta.thumbnailUrl,
        // Consent denied: the anonId is never created, read or sent.
        anonId: config.analyticsConsent === 'denied' ? undefined : getOrCreateAnonId(),
        referrer: document.referrer || undefined,
        consent: config.analyticsConsent,
        surface: config.surface,
        pageViewId: getPageViewId(),
        ...(config.internalTraffic ? { internal: true } : {}),
      })
      .catch(err => {
        if (config.debug) console.warn('[ContentCredits] beacon failed', err);
      });
  } catch (err) {
    if (config.debug) console.warn('[ContentCredits] beacon metadata scrape failed', err);
  }
}
