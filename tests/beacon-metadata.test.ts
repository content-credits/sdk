import { describe, it, expect, beforeEach } from 'vitest';
import { scrapeMetadata } from '../src/beacon/metadata';

function setHead(html: string): void {
  document.head.innerHTML = html;
}

function setBody(html: string): void {
  document.body.innerHTML = html;
}

describe('scrapeMetadata', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.title = '';
  });

  it('falls back to <title> when no og:title is present', () => {
    document.title = 'Plain Title';
    const meta = scrapeMetadata();
    expect(meta.title).toBe('Plain Title');
  });

  it('prefers og:title over <title>', () => {
    document.title = 'Plain Title';
    setHead('<meta property="og:title" content="OG Title">');
    const meta = scrapeMetadata();
    expect(meta.title).toBe('OG Title');
  });

  it('uses og:image as the primary thumbnail source', () => {
    setHead('<meta property="og:image" content="https://example.com/og.jpg">');
    const meta = scrapeMetadata();
    expect(meta.thumbnailUrl).toBe('https://example.com/og.jpg');
  });

  it('falls back to twitter:image when og:image is absent', () => {
    setHead('<meta name="twitter:image" content="https://example.com/twitter.jpg">');
    const meta = scrapeMetadata();
    expect(meta.thumbnailUrl).toBe('https://example.com/twitter.jpg');
  });

  it('falls back to JSON-LD Article.image when no og/twitter image is present', () => {
    setHead(`
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","image":"https://example.com/ld.jpg"}
      </script>
    `);
    const meta = scrapeMetadata();
    expect(meta.thumbnailUrl).toBe('https://example.com/ld.jpg');
  });

  it('falls back to the first in-content <img> as a last resort', () => {
    setBody('<article><img src="https://example.com/inline.jpg"></article>');
    const meta = scrapeMetadata();
    expect(meta.thumbnailUrl).toBe('https://example.com/inline.jpg');
  });

  it('extracts author and publishedAt from JSON-LD', () => {
    setHead(`
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          "author": { "@type": "Person", "name": "Jane Whitmore" },
          "datePublished": "2026-03-01T08:00:00Z"
        }
      </script>
    `);
    const meta = scrapeMetadata();
    expect(meta.author).toBe('Jane Whitmore');
    expect(meta.publishedAt).toBe('2026-03-01T08:00:00Z');
  });

  it('falls back to meta tags for author and publishedAt when no JSON-LD is present', () => {
    setHead(`
      <meta property="article:author" content="Meta Author">
      <meta property="article:published_time" content="2026-01-01T00:00:00Z">
    `);
    const meta = scrapeMetadata();
    expect(meta.author).toBe('Meta Author');
    expect(meta.publishedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('ignores JSON-LD blocks that are not Article-typed', () => {
    setHead(`
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Organization","name":"Acme"}
      </script>
    `);
    const meta = scrapeMetadata();
    expect(meta.author).toBeUndefined();
  });

  it('does not throw on malformed JSON-LD', () => {
    setHead('<script type="application/ld+json">{not valid json</script>');
    expect(() => scrapeMetadata()).not.toThrow();
  });

  it('returns undefined fields gracefully when nothing is present', () => {
    const meta = scrapeMetadata();
    expect(meta.thumbnailUrl).toBeUndefined();
    expect(meta.author).toBeUndefined();
    expect(meta.publishedAt).toBeUndefined();
  });
});
