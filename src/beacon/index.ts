import { scrapeMetadata } from './metadata.js';
import type { createPostsApi } from '../api/posts.js';
import type { ResolvedConfig } from '../types/index.js';

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
      })
      .catch(err => {
        if (config.debug) console.warn('[ContentCredits] beacon failed', err);
      });
  } catch (err) {
    if (config.debug) console.warn('[ContentCredits] beacon metadata scrape failed', err);
  }
}
