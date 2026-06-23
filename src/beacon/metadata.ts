/**
 * Scrapes page metadata for the post-discovery beacon (`POST /posts/observe`,
 * see POST_IDENTITY_AND_REVAMP_PLAN.md §5.1 / §6).
 *
 * Source priority mirrors the design doc:
 *  - title:        <title>
 *  - thumbnailUrl:  og:image -> twitter:image -> JSON-LD Article.image -> first in-content <img>
 *  - author:        JSON-LD Article.author -> meta[name="author"] / article:author
 *  - publishedAt:   JSON-LD Article.datePublished -> meta[property="article:published_time"]
 */

export interface ScrapedMetadata {
  title: string;
  author?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
}

function metaContent(selector: string): string | undefined {
  const el = document.querySelector<HTMLMetaElement>(selector);
  const content = el?.getAttribute('content')?.trim();
  return content || undefined;
}

/** Parses every JSON-LD <script> block, returning the first object with @type Article/NewsArticle/BlogPosting. */
function findJsonLdArticle(): Record<string, unknown> | undefined {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');

  for (const script of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? '');
    } catch {
      continue;
    }

    const candidates = Array.isArray(parsed)
      ? parsed
      : (parsed as { '@graph'?: unknown[] })?.['@graph'] ?? [parsed];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      const obj = candidate as Record<string, unknown>;
      const type = obj['@type'];
      const types = Array.isArray(type) ? type : [type];
      if (types.some(t => typeof t === 'string' && /^(Article|NewsArticle|BlogPosting)$/i.test(t))) {
        return obj;
      }
    }
  }

  return undefined;
}

function jsonLdImage(article: Record<string, unknown> | undefined): string | undefined {
  if (!article) return undefined;
  const image = article.image;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    const first: unknown = (image as unknown[])[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && typeof (first as { url?: unknown }).url === 'string') {
      return (first as { url: string }).url;
    }
  }
  if (image && typeof image === 'object' && typeof (image as { url?: unknown }).url === 'string') {
    return (image as { url: string }).url;
  }
  return undefined;
}

function jsonLdAuthor(article: Record<string, unknown> | undefined): string | undefined {
  if (!article) return undefined;
  const author = article.author;
  if (typeof author === 'string') return author;
  if (Array.isArray(author)) {
    const first: unknown = (author as unknown[])[0];
    if (first && typeof first === 'object' && typeof (first as { name?: unknown }).name === 'string') {
      return (first as { name: string }).name;
    }
  }
  if (author && typeof author === 'object' && typeof (author as { name?: unknown }).name === 'string') {
    return (author as { name: string }).name;
  }
  return undefined;
}

function jsonLdDate(article: Record<string, unknown> | undefined): string | undefined {
  if (!article) return undefined;
  const date = article.datePublished ?? article.dateCreated;
  return typeof date === 'string' ? date : undefined;
}

/** First reasonably-sized <img> inside common content containers — last-resort thumbnail fallback. */
function firstInContentImage(contentSelector?: string): string | undefined {
  const scopes: (Document | Element)[] = [];
  if (contentSelector) {
    const el = document.querySelector(contentSelector);
    if (el) scopes.push(el);
  }
  scopes.push(document);

  for (const scope of scopes) {
    const img = scope.querySelector<HTMLImageElement>('article img, main img, img');
    if (img?.src) return img.src;
  }
  return undefined;
}

export function scrapeMetadata(contentSelector?: string): ScrapedMetadata {
  const jsonLd = findJsonLdArticle();

  const title =
    metaContent('meta[property="og:title"]') ??
    document.title ??
    '';

  const thumbnailUrl =
    metaContent('meta[property="og:image"]') ??
    metaContent('meta[name="twitter:image"]') ??
    jsonLdImage(jsonLd) ??
    firstInContentImage(contentSelector);

  const author =
    jsonLdAuthor(jsonLd) ??
    metaContent('meta[property="article:author"]') ??
    metaContent('meta[name="author"]');

  const publishedAt =
    jsonLdDate(jsonLd) ??
    metaContent('meta[property="article:published_time"]');

  return {
    title,
    author,
    publishedAt,
    thumbnailUrl,
  };
}
