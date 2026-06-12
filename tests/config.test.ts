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
});
