/**
 * Creates an isolated Shadow DOM host attached to document.body.
 * All SDK UI lives inside this shadow root so partner CSS cannot
 * bleed in and SDK CSS cannot bleed out.
 */
export function createShadowHost(id: string): { host: HTMLElement; root: ShadowRoot } {
  // Reuse if already in the DOM (e.g. hot-reload)
  let host = document.getElementById(id);
  if (!host) {
    host = document.createElement('div');
    host.id = id;
    // The host element itself is invisible; only its shadow children show
    host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;';
    document.body.appendChild(host);
  }

  const existing = (host as unknown as { _ccShadow?: ShadowRoot })._ccShadow;
  if (existing) return { host, root: existing };

  const root = host.attachShadow({ mode: 'open' });
  (host as unknown as { _ccShadow: ShadowRoot })._ccShadow = root;
  return { host, root };
}

/**
 * Creates a shadow host inserted immediately after `anchorEl` in the DOM.
 * Used for the inline paywall panel so it flows naturally below the content.
 */
export function createInlineShadowHost(id: string, anchorEl: HTMLElement): { host: HTMLElement; root: ShadowRoot } {
  let host = document.getElementById(id);
  if (!host) {
    host = document.createElement('div');
    host.id = id;
    anchorEl.parentNode!.insertBefore(host, anchorEl.nextSibling);
  }

  const existing = (host as unknown as { _ccShadow?: ShadowRoot })._ccShadow;
  if (existing) return { host, root: existing };

  const root = host.attachShadow({ mode: 'open' });
  (host as unknown as { _ccShadow: ShadowRoot })._ccShadow = root;
  return { host, root };
}

export function removeShadowHost(id: string): void {
  const host = document.getElementById(id);
  if (host) host.remove();
}

/** Inject a <style> tag into a shadow root */
export function injectStyles(root: ShadowRoot, css: string): void {
  const existing = root.querySelector('style[data-cc-styles]');
  if (existing) {
    existing.textContent = css;
    return;
  }
  const style = document.createElement('style');
  style.dataset.ccStyles = 'true';
  style.textContent = css;
  root.appendChild(style);
}
