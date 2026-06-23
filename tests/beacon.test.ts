import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendBeacon } from '../src/beacon/index';
import { getOrCreateAnonId } from '../src/beacon/anonId';

const ANON_ID_KEY = 'cc_anon_id';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    localStorage.clear();
  });

  it('does nothing when enableBeacon is false', () => {
    const observe = vi.fn();
    sendBeacon(baseConfig({ enableBeacon: false }), { observe } as any);
    expect(observe).not.toHaveBeenCalled();
  });

  it('calls observe with scraped metadata, canonical url, anonId, and referrer', () => {
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
      anonId: expect.any(String),
      referrer: document.referrer || undefined,
    });

    const [payload] = observe.mock.calls[0];
    expect(payload.anonId).toMatch(UUID_RE);
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

  it('reuses the same anonId across repeated beacon calls (persisted, not per-call)', () => {
    const observe = vi.fn().mockResolvedValue({ success: true });

    sendBeacon(baseConfig(), { observe } as any);
    const firstAnonId = observe.mock.calls[0][0].anonId;

    sendBeacon(baseConfig(), { observe } as any);
    const secondAnonId = observe.mock.calls[1][0].anonId;

    expect(secondAnonId).toBe(firstAnonId);
  });
});

describe('getOrCreateAnonId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates a new anonId and persists it under the cc_anon_id key', () => {
    expect(localStorage.getItem(ANON_ID_KEY)).toBeNull();

    const id = getOrCreateAnonId();

    expect(id).toMatch(UUID_RE);
    const stored = localStorage.getItem(ANON_ID_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed.value).toBe(id);
    expect(typeof parsed.expiresAt).toBe('number');
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());
  });

  it('returns the same anonId on subsequent calls', () => {
    const first = getOrCreateAnonId();
    const second = getOrCreateAnonId();
    expect(second).toBe(first);
  });

  it('uses a long (~1 year) TTL', () => {
    const before = Date.now();
    getOrCreateAnonId();
    const stored = JSON.parse(localStorage.getItem(ANON_ID_KEY) as string);
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    // Allow a small tolerance for test execution time.
    expect(stored.expiresAt).toBeGreaterThanOrEqual(before + oneYearMs - 5000);
    expect(stored.expiresAt).toBeLessThanOrEqual(before + oneYearMs + 5000);
  });

  it('generates a fresh anonId when the stored one has expired', () => {
    const firstId = getOrCreateAnonId();
    const stored = JSON.parse(localStorage.getItem(ANON_ID_KEY) as string);
    // Force expiry into the past.
    localStorage.setItem(ANON_ID_KEY, JSON.stringify({ ...stored, expiresAt: Date.now() - 1000 }));

    const secondId = getOrCreateAnonId();

    expect(secondId).not.toBe(firstId);
    expect(secondId).toMatch(UUID_RE);
  });

  it('falls back to a random string id when crypto.randomUUID is unavailable', () => {
    const originalCrypto = globalThis.crypto;
    // Simulate an environment without crypto.randomUUID.
    vi.stubGlobal('crypto', { ...originalCrypto, randomUUID: undefined });

    try {
      const id = getOrCreateAnonId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
      expect(id).not.toMatch(UUID_RE);
    } finally {
      vi.stubGlobal('crypto', originalCrypto);
    }
  });

  it('degrades gracefully (still returns a value) when localStorage throws', () => {
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };

    try {
      expect(() => getOrCreateAnonId()).not.toThrow();
      const id = getOrCreateAnonId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    } finally {
      Storage.prototype.getItem = originalGetItem;
      Storage.prototype.setItem = originalSetItem;
    }
  });
});
