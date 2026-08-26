/**
 * Scroll-lock lifecycle for the overlay paywall.
 *
 * The lock exists to focus the reader on a decision — sign in, spend credits.
 * Once access is granted there is no decision left, so no post-grant state may
 * hold the page in place.
 *
 * This shipped broken because nothing exercised it: `initModal` set
 * `body.style.overflow = 'hidden'` and the only restore lived in `destroy()`,
 * which `render()` reached only for 'granted'. The new 'hydrating' state
 * triggered init() where 'checking' never had, so a reader who had ALREADY
 * PAID was locked for the length of the fetch — and if the fetch failed, the
 * flow ended at 'error' and the page stayed unscrollable with no later
 * 'granted' transition to release it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPaywallRenderer } from '../src/paywall/renderer';

const config = {
  apiKey: 'pub_123',
  articleUrl: 'https://example.com/post',
  hostName: 'example.com',
  pageTitle: 'Test Post',
  contentSelector: '#article',
  teaserParagraphs: 2,
  enableComments: false,
  extensionId: 'ext_123',
  debug: false,
  headless: false,
  apiBaseUrl: 'https://api.contentcredits.com',
  accountsUrl: 'https://accounts.contentcredits.com',
  paywallMode: 'overlay' as const,
  contentEndpoint: 'https://example.com/wp-json/content-credits/v1/posts/1/content',
  theme: {
    primaryColor: '#44C678',
    fontFamily: 'sans-serif',
    backdropColor: 'rgba(0,0,0,0.45)',
    sdkButtonColor: '#44C678',
  },
} as never;

const callbacks = {
  onLogin: vi.fn(),
  onPurchase: vi.fn(),
  onBuyMoreCredits: vi.fn(),
  onRetry: vi.fn(),
};

function overflow(): string {
  return document.body.style.overflow;
}

describe('overlay paywall scroll lock', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="article"><p>Teaser</p></div>';
    document.body.style.overflow = '';
  });

  it('locks the page while the reader still has a decision to make', () => {
    const renderer = createPaywallRenderer(config);
    renderer.render('purchase', callbacks as never, { requiredCredits: 2, creditBalance: 10 });

    expect(overflow()).toBe('hidden');
    renderer.destroy();
  });

  it('does NOT lock the page while hydrating — the reader has already paid', () => {
    const renderer = createPaywallRenderer(config);
    renderer.render('hydrating', callbacks as never);

    expect(overflow()).not.toBe('hidden');
    renderer.destroy();
  });

  it('leaves the page scrollable when hydration fails permanently', () => {
    const renderer = createPaywallRenderer(config);

    // The exact sequence from a failed fetch: checking → hydrating → error,
    // with no 'granted' afterwards to trigger destroy().
    renderer.render('checking', callbacks as never);
    renderer.render('hydrating', callbacks as never);
    renderer.render('error', callbacks as never, { error: 'Could not load the article.' });

    expect(overflow()).not.toBe('hidden');
    renderer.destroy();
  });

  it('restores the page overflow the publisher had set, not an empty string', () => {
    document.body.style.overflow = 'auto';

    const renderer = createPaywallRenderer(config);
    renderer.render('purchase', callbacks as never, { requiredCredits: 2, creditBalance: 0 });
    expect(overflow()).toBe('hidden');

    renderer.destroy();
    expect(overflow()).toBe('auto');
  });

  it('releases the lock on destroy from any state', () => {
    const renderer = createPaywallRenderer(config);
    renderer.render('login', callbacks as never);
    expect(overflow()).toBe('hidden');

    renderer.destroy();
    expect(overflow()).not.toBe('hidden');
  });
});
