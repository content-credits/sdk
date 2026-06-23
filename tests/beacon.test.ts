import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendBeacon } from '../src/beacon/index';

function baseConfig(overrides: Record<string, unknown> = {}): any {
  return {
    apiKey: 'pub_123',
    articleUrl: 'https://example.com/post',
    canonicalArticleUrl: 'https://example.com/post',
    pageTitle: 'Fallback Title',
    contentSelector: '.cc-premium-content',
    enableBeacon: true,
    debug: false,
    ...overrides,
  };
}

describe('sendBeacon', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.title = '';
  });

  it('does nothing when enableBeacon is false', () => {
    const observe = vi.fn();
    sendBeacon(baseConfig({ enableBeacon: false }), { observe } as any);
    expect(observe).not.toHaveBeenCalled();
  });

  it('calls observe with scraped metadata and canonical url', () => {
    document.head.innerHTML = '<meta property="og:title" content="Scraped Title"><meta property="og:image" content="https://example.com/img.jpg">';
    const observe = vi.fn().mockResolvedValue({ success: true });

    sendBeacon(baseConfig(), { observe } as any);

    expect(observe).toHaveBeenCalledWith({
      apiKey: 'pub_123',
      url: 'https://example.com/post',
      canonicalUrl: 'https://example.com/post',
      title: 'Scraped Title',
      author: undefined,
      publishedAt: undefined,
      thumbnailUrl: 'https://example.com/img.jpg',
    });
  });

  it('falls back to config.pageTitle when scraping finds no title', () => {
    const observe = vi.fn().mockResolvedValue({ success: true });
    sendBeacon(baseConfig(), { observe } as any);
    expect(observe).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fallback Title' }));
  });

  it('swallows a rejected observe() call without throwing', async () => {
    const observe = vi.fn().mockRejectedValue(new Error('network down'));
    expect(() => sendBeacon(baseConfig(), { observe } as any)).not.toThrow();
    await Promise.resolve(); // flush the microtask queue
  });

  it('swallows scrape errors without throwing', () => {
    const observe = vi.fn();
    // Force scrapeMetadata's querySelectorAll to throw by poisoning document.title getter is hard;
    // instead pass a config whose contentSelector causes querySelector to throw on an invalid selector.
    expect(() =>
      sendBeacon(baseConfig({ contentSelector: ':::not-a-valid-selector:::' }), { observe } as any)
    ).not.toThrow();
  });
});
