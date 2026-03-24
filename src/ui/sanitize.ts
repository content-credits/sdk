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
