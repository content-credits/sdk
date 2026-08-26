import { describe, it, expect, vi } from 'vitest';
import { resolveConfig } from '../src/core/config';

// Mock the build-time constants that Rollup normally injects
vi.stubGlobal('__API_BASE_URL__', 'https://api.contentcredits.com');
vi.stubGlobal('__ACCOUNTS_URL__', 'https://accounts.contentcredits.com');
vi.stubGlobal('__EXTENSION_ID__', 'test-ext-id');

describe('resolveConfig', () => {
  it('throws when apiKey is missing', () => {
    // @ts-expect-error intentional
    expect(() => resolveConfig({})).toThrow(/apiKey is required/);
  });

  it('throws when apiKey is empty string', () => {
    expect(() => resolveConfig({ apiKey: '  ' })).toThrow(/apiKey is required/);
  });

  it('resolves defaults correctly', () => {
    const config = resolveConfig({ apiKey: 'pub_test' });
    expect(config.apiKey).toBe('pub_test');
    expect(config.teaserParagraphs).toBe(2);
    expect(config.enableComments).toBe(true);
    expect(config.contentSelector).toBe('.cc-premium-content');
    expect(config.theme.primaryColor).toBe('#44C678');
    expect(config.debug).toBe(false);
  });

  it('accepts custom theme and teaserParagraphs', () => {
    const config = resolveConfig({
      apiKey: 'pub_test',
      teaserParagraphs: 4,
      theme: { primaryColor: '#ff0000' },
    });
    expect(config.teaserParagraphs).toBe(4);
    expect(config.theme.primaryColor).toBe('#ff0000');
  });

  it('derives hostName from articleUrl', () => {
    const config = resolveConfig({
      apiKey: 'pub_test',
      articleUrl: 'https://example.com/article/1',
    });
    expect(config.hostName).toBe('example.com');
  });

  it('scrubs auth params from articleUrl before resolving config', () => {
    const config = resolveConfig({
      apiKey: 'pub_test',
      articleUrl: 'https://example.com/article/1?token=abc&refresh_token=def&utm_source=test',
    });
    expect(config.articleUrl).toBe('https://example.com/article/1?utm_source=test');
  });

  it('scrubs PKCE redirect-back params from articleUrl before resolving config', () => {
    const config = resolveConfig({
      apiKey: 'pub_test',
      articleUrl: 'https://example.com/article/1?cc_auth_code=abc&cc_state=def&utm_source=test',
    });
    expect(config.articleUrl).toBe('https://example.com/article/1?utm_source=test');
  });

  it('passes onCreditsPurchased callback through to resolved config', () => {
    const onCreditsPurchased = vi.fn();
    const config = resolveConfig({
      apiKey: 'pub_test',
      onCreditsPurchased,
    });
    expect(config.onCreditsPurchased).toBe(onCreditsPurchased);
  });
  describe('contentEndpoint (opt-in server-side teaser)', () => {
    it('defaults to null so the legacy hide/reveal path is used', () => {
      expect(resolveConfig({ apiKey: 'pub_test' }).contentEndpoint).toBeNull();
    });

    it('accepts an absolute http(s) endpoint verbatim', () => {
      const url = 'https://example.com/wp-json/content-credits/v1/posts/42/content';
      const config = resolveConfig({
        apiKey: 'pub_test',
        articleUrl: 'https://example.com/post',
        contentEndpoint: url,
      });
      expect(config.contentEndpoint).toBe(url);
    });

    it('ignores a relative endpoint rather than throwing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const config = resolveConfig({
        apiKey: 'pub_test',
        contentEndpoint: '/wp-json/content-credits/v1/posts/42/content',
      });
      expect(config.contentEndpoint).toBeNull();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('ignores a non-http scheme', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      expect(
        resolveConfig({ apiKey: 'pub_test', contentEndpoint: 'javascript:alert(1)' }).contentEndpoint
      ).toBeNull();
      warn.mockRestore();
    });

    it('treats a blank endpoint as not configured', () => {
      expect(resolveConfig({ apiKey: 'pub_test', contentEndpoint: '   ' }).contentEndpoint).toBeNull();
    });

    it('warns but still accepts a cross-origin endpoint', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const config = resolveConfig({
        apiKey: 'pub_test',
        articleUrl: 'https://example.com/post',
        contentEndpoint: 'https://cdn.other.example/content/42',
      });
      expect(config.contentEndpoint).toBe('https://cdn.other.example/content/42');
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
