import { describe, it, expect } from 'vitest';
import { canonicalHost, canonicalUrl } from '../src/utils/canonical';

describe('canonicalHost', () => {
  it('folds www. to apex', () => {
    expect(canonicalHost('www.example.com')).toBe('example.com');
    expect(canonicalHost('https://www.example.com/foo')).toBe('example.com');
  });

  it('does not fold other subdomains', () => {
    expect(canonicalHost('blog.example.com')).toBe('blog.example.com');
    expect(canonicalHost('shop.example.com')).toBe('shop.example.com');
  });

  it('lowercases', () => {
    expect(canonicalHost('WWW.Example.COM')).toBe('example.com');
  });

  it('strips trailing dot', () => {
    expect(canonicalHost('example.com.')).toBe('example.com');
  });

  it('accepts a bare hostname or a full URL identically', () => {
    expect(canonicalHost('example.com')).toBe(canonicalHost('https://example.com/some/path?x=1'));
  });

  it('strips port', () => {
    expect(canonicalHost('example.com:8080')).toBe('example.com');
  });

  it('returns empty string for empty input', () => {
    expect(canonicalHost('')).toBe('');
  });

  it('falls back gracefully on unparsable input', () => {
    expect(canonicalHost('www.example.com/weird::input')).toContain('example.com');
  });
});

describe('canonicalUrl', () => {
  it('forces https', () => {
    expect(canonicalUrl('http://example.com/post')).toBe('https://example.com/post');
  });

  it('folds www in the host', () => {
    expect(canonicalUrl('https://www.example.com/post')).toBe('https://example.com/post');
  });

  it('drops the fragment', () => {
    expect(canonicalUrl('https://example.com/post#section-2')).toBe('https://example.com/post');
  });

  it('drops tracking params', () => {
    expect(canonicalUrl('https://example.com/post?utm_source=x&utm_medium=y&fbclid=abc&gclid=def&ref=home&mc_cid=1&mc_eid=2&igshid=3'))
      .toBe('https://example.com/post');
  });

  it('keeps non-tracking query params and sorts them', () => {
    expect(canonicalUrl('https://example.com/post?b=2&a=1')).toBe('https://example.com/post?a=1&b=2');
  });

  it('keeps non-tracking params alongside dropped tracking params', () => {
    expect(canonicalUrl('https://example.com/post?utm_source=x&id=42')).toBe('https://example.com/post?id=42');
  });

  it('normalizes trailing slash (except root)', () => {
    expect(canonicalUrl('https://example.com/post/')).toBe('https://example.com/post');
    expect(canonicalUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('produces the same canonical key for equivalent URLs', () => {
    const a = canonicalUrl('http://www.example.com/post/?utm_source=newsletter');
    const b = canonicalUrl('https://example.com/post#comments');
    expect(a).toBe(b);
  });

  it('returns empty string for empty input', () => {
    expect(canonicalUrl('')).toBe('');
  });
});
