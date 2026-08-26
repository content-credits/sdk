/**
 * Safe DOM text node — never use innerHTML with user-generated content.
 * Returns a text node that can be appended to any element.
 */
export function safeText(str: string): Text {
  return document.createTextNode(str);
}

/**
 * Set an element's text content safely (no HTML injection).
 */
export function setTextContent(el: Element, str: string): void {
  el.textContent = str;
}

/**
 * Create an element with safe text content.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  attrs?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => element.setAttribute(k, v));
  }
  return element;
}

/**
 * Render comment content as safe DOM nodes.
 * Supports newlines → <br> but no raw HTML from user input.
 * Returns a DocumentFragment.
 */
export function renderCommentContent(raw: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  // Replace \n with a delimiter we can split on
  const lines = raw.split('\n');
  lines.forEach((line, i) => {
    fragment.appendChild(document.createTextNode(line));
    if (i < lines.length - 1) {
      fragment.appendChild(document.createElement('br'));
    }
  });
  return fragment;
}

/**
 * Validate that a URL is safe (http/https only).
 * Returns null if unsafe.
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

// ─── Publisher HTML sanitizer (server-side teaser hydration) ─────────────────
//
// Used by the opt-in server-side-teaser path: when a publisher serves only a
// teaser and the SDK fetches the full article from the publisher's own
// `data-cc-content-endpoint`, that HTML is real markup (headings, images,
// tables) and cannot go through the text-only helpers above.
//
// The source is the publisher's own origin — the same origin that already
// controls this page and could inject anything it wanted — so this is
// defence-in-depth, not a trust boundary. It exists so that a compromised or
// misconfigured content route cannot escalate into script execution inside the
// publisher's page. Everything is rebuilt from an allowlist: unknown elements
// are unwrapped, unknown attributes dropped, and every URL re-parsed.

/**
 * Elements dropped along with their children. Their text content is markup,
 * script, or chrome — unwrapping them would dump CSS/JS source into the article.
 */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'applet', 'form', 'input',
  'textarea', 'select', 'option', 'optgroup', 'button', 'fieldset', 'legend',
  'link', 'meta', 'base', 'noscript', 'svg', 'math', 'template', 'frame',
  'frameset', 'portal', 'slot', 'canvas',
]);

/** Elements rendered as themselves. Anything else is unwrapped (children kept). */
const ALLOWED_TAGS = new Set([
  // structure
  'div', 'section', 'article', 'aside', 'main', 'header', 'footer', 'nav',
  'figure', 'figcaption', 'address', 'hr', 'br', 'wbr',
  // text blocks
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // inline
  'span', 'a', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins',
  'sub', 'sup', 'small', 'mark', 'code', 'kbd', 'samp', 'var', 'abbr', 'cite',
  'q', 'time', 'bdi', 'bdo', 'ruby', 'rt', 'rp',
  // media
  'img', 'picture', 'source', 'video', 'audio',
  // tables
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
]);

/** Attributes permitted on every allowed element (plus any `aria-*`). */
const GLOBAL_ATTRS = new Set(['class', 'id', 'lang', 'dir', 'title', 'role', 'style']);

/** Additional attributes permitted per element. */
const TAG_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel', 'hreflang', 'type'],
  img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
  video: ['src', 'poster', 'controls', 'width', 'height', 'preload', 'loop', 'muted', 'playsinline'],
  audio: ['src', 'controls', 'preload', 'loop', 'muted'],
  source: ['src', 'type', 'media'],
  td: ['colspan', 'rowspan', 'headers'],
  th: ['colspan', 'rowspan', 'headers', 'scope', 'abbr'],
  col: ['span'],
  colgroup: ['span'],
  ol: ['start', 'reversed', 'type'],
  li: ['value'],
  time: ['datetime'],
  blockquote: ['cite'],
  q: ['cite'],
  del: ['cite', 'datetime'],
  ins: ['cite', 'datetime'],
};

/** Attributes whose value is a URL and must be re-parsed before it is kept. */
const URL_ATTRS = new Set(['href', 'src', 'poster', 'cite']);

/**
 * Inline-style values that can execute code or pull a remote resource.
 * `url(` is rejected outright rather than parsed — article layout styles
 * (`width`, `margin`, `text-align`) never need it.
 */
const UNSAFE_STYLE =
  /(?:expression\s*\(|javascript\s*:|vbscript\s*:|behavi(?:ou)?r\s*:|-moz-binding|@import|url\s*\(|image-set\s*\()/i;

/** Inline raster images are common in exported WordPress content; SVG is not allowed. */
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;

/**
 * Depth cap so a pathologically nested document can't blow the call stack.
 * Real article markup nests well under 20 levels.
 */
const MAX_DEPTH = 64;

/**
 * Resolve a URL attribute to an absolute `http(s)` URL, or null.
 *
 * Unlike {@link sanitizeUrl} this resolves relative values against the
 * document base — publisher markup routinely uses root-relative image paths
 * (`/wp-content/uploads/…`), and rejecting those would strip every image.
 * Dangerous schemes still fail: `javascript:` resolves to itself and is
 * rejected on protocol.
 */
function safeResourceUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const base = typeof document !== 'undefined' ? document.baseURI : undefined;
    const parsed = base ? new URL(raw, base) : new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function safeAttrValue(tag: string, name: string, value: string): string | null {
  if (name === 'style') return UNSAFE_STYLE.test(value) ? null : value;
  if (URL_ATTRS.has(name)) {
    if (name === 'src' && tag === 'img' && SAFE_DATA_IMAGE.test(value.trim())) {
      return value.trim();
    }
    return safeResourceUrl(value);
  }
  return value;
}

function copyAttributes(source: Element, target: Element, tag: string): void {
  const perTag = TAG_ATTRS[tag];
  for (const attr of Array.from(source.attributes)) {
    const name = attr.name.toLowerCase();
    // Event handlers are never on an allowlist, but reject them explicitly —
    // this is the one attribute class that turns markup into code.
    if (name.startsWith('on')) continue;
    const permitted =
      GLOBAL_ATTRS.has(name) || name.startsWith('aria-') || (perTag?.includes(name) ?? false);
    if (!permitted) continue;
    const value = safeAttrValue(tag, name, attr.value);
    if (value === null) continue;
    target.setAttribute(name, value);
  }
  // `target="_blank"` without `rel=noopener` hands the opened page a live
  // `window.opener` handle back into the publisher's page.
  if (tag === 'a' && target.getAttribute('target')) {
    target.setAttribute('rel', 'noopener noreferrer');
  }
}

function sanitizeChildren(source: Element, depth: number): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const child of Array.from(source.childNodes)) {
    const clean = sanitizeNode(child, depth + 1);
    if (clean) fragment.appendChild(clean);
  }
  return fragment;
}

function sanitizeNode(node: Node, depth: number): Node | null {
  if (depth > MAX_DEPTH) return null;

  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.nodeValue ?? '');
  }
  // Comments, processing instructions, doctypes and anything else are dropped.
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const source = node as Element;
  const tag = source.localName.toLowerCase();

  if (DROP_WITH_CONTENT.has(tag)) return null;

  const children = sanitizeChildren(source, depth);
  // Unknown / not-allowed element: keep the prose, discard the wrapper.
  if (!ALLOWED_TAGS.has(tag)) return children;

  const clean = document.createElement(tag);
  copyAttributes(source, clean, tag);
  clean.appendChild(children);
  return clean;
}

/**
 * Sanitize a publisher-supplied HTML string into a `DocumentFragment` that is
 * safe to insert into the page.
 *
 * Parsing happens in an inert `DOMParser` document: `<script>` never executes,
 * `<img onerror>` never fires, and no subresource is requested while the tree
 * is walked. The returned fragment is rebuilt from scratch, so nothing outside
 * the allowlists above survives.
 */
export function sanitizeHtml(html: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  if (!html || typeof html !== 'string') return fragment;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const child of Array.from(doc.body.childNodes)) {
    const clean = sanitizeNode(child, 0);
    if (clean) fragment.appendChild(clean);
  }
  return fragment;
}
