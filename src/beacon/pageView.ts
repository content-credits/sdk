/**
 * Page-load identity shared with the browser extension (ADR-0021).
 *
 * The extension's content script lives in an isolated JS world and cannot read
 * SDK globals, so the two coordinate through attributes on <html>:
 *  - `data-cc-sdk`            set by the SDK at init: "the SDK is on this page,
 *                             do not send a second view beacon".
 *  - `data-cc-page-view-id`   one id per page load. Whoever runs first writes it,
 *                             the other reuses it, so if both beacon anyway the
 *                             backend dedups on (post, pageViewId).
 * The id is random and carries no identity.
 */

const SDK_ATTR = 'data-cc-sdk';
const PAGE_VIEW_ATTR = 'data-cc-page-view-id';
const VALID_ID = /^[A-Za-z0-9_-]{8,64}$/;

let fallbackId: string | null = null;

function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  const rand = (): string => Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${rand()}-${rand()}`.slice(0, 64);
}

/** The id of this page load, creating and publishing it on <html> if absent. */
export function getPageViewId(): string {
  try {
    const el = document.documentElement;
    const existing = el.getAttribute(PAGE_VIEW_ATTR);
    if (existing && VALID_ID.test(existing)) return existing;
    const id = generateId();
    el.setAttribute(PAGE_VIEW_ATTR, id);
    return id;
  } catch {
    return (fallbackId ??= generateId());
  }
}

/** Tell the extension (and anything else) that the SDK is running on this page. */
export function markSdkPresent(version: string): void {
  try {
    document.documentElement.setAttribute(SDK_ATTR, version || '1');
    getPageViewId(); // publish the id up front so the extension can reuse it
  } catch {
    // never break init
  }
}
