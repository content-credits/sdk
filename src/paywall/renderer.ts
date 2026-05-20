import { createShadowHost, createInlineShadowHost, injectStyles, removeShadowHost } from '../ui/shadow.js';
import { getPaywallStyles } from '../ui/styles.js';
import { el, setTextContent } from '../ui/sanitize.js';
import type { ResolvedConfig, PaywallSlotItem, ReactDOMAdapter } from '../types/index.js';

const HOST_ID = 'cc-paywall-host';

export type PaywallUIState =
  | 'checking'      // initial access check in progress
  | 'login'         // user not logged in
  | 'purchase'      // logged in but no access
  | 'insufficient'  // logged in but not enough credits
  | 'loading'       // purchase/login in progress
  | 'granted'       // access granted, overlay removed

export interface PaywallRendererCallbacks {
  onLogin(): void | Promise<void>;
  onPurchase(): void | Promise<void>;
  onBuyMoreCredits(): void;
}

export interface PaywallRenderer {
  init(): void;
  render(
    state: PaywallUIState,
    callbacks: PaywallRendererCallbacks,
    meta?: { requiredCredits?: number | null; creditBalance?: number | null }
  ): void;
  setButtonLoading(loading: boolean): void;
  destroy(): void;
}

export function createPaywallRenderer(config: ResolvedConfig): PaywallRenderer {
  let root: ShadowRoot | null = null;
  // In inline mode: the single panel div. In overlay mode: the body section only.
  let body: HTMLElement | null = null;
  // Tracks a mounted React 18 root so we can unmount it on destroy.
  let reactRoot: { unmount(): void } | null = null;

  function init(): void {
    const contentEl = document.querySelector<HTMLElement>(config.contentSelector);
    if (!contentEl) return;

    // Overlay mode: fixed to the bottom of the viewport — attach to body so it
    // is never constrained by the article's max-width container.
    // Inline mode: inserted after the content element in document flow.
    const { root: shadowRoot } = config.paywallMode === 'overlay'
      ? createShadowHost(HOST_ID)
      : createInlineShadowHost(HOST_ID, contentEl);

    root = shadowRoot;
    injectStyles(root, getPaywallStyles(config.theme.primaryColor, config.theme.fontFamily));

    if (config.paywallMode === 'overlay') {
      initOverlay(root, contentEl);
    } else {
      initInline(root);
    }
  }

  function initInline(shadowRoot: ShadowRoot): void {
    body = el('div');
    body.className = 'cc-paywall-inline';
    shadowRoot.appendChild(body);
  }

  function initOverlay(shadowRoot: ShadowRoot, contentEl: HTMLElement): void {
    const panel = el('div');
    panel.className = 'cc-paywall-overlay';

    // Gradient that visually fades the article into the panel.
    // Reads the page background so the gradient colour matches non-white sites.
    const gradient = el('div');
    gradient.className = 'cc-paywall-overlay-gradient';
    const pageBg = getComputedStyle(document.body).backgroundColor;
    if (pageBg && pageBg !== 'rgba(0, 0, 0, 0)' && pageBg !== 'transparent') {
      // Multi-stop gradient so the fade reads as natural depth rather than a
      // sharp white overlay — same curve as the CSS default, but using the
      // actual page background colour.
      gradient.style.background = [
        'linear-gradient(to bottom,',
        `transparent 0%,`,
        `transparent 18%,`,
        // Mid-stops approximate a cubic ease-in curve
        `color-mix(in srgb, ${pageBg} 30%, transparent) 45%,`,
        `color-mix(in srgb, ${pageBg} 75%, transparent) 68%,`,
        `${pageBg} 100%`,
        ')',
      ].join(' ');

      // Fallback for browsers without color-mix (pre-2023) — simple 2-stop
      if (!CSS.supports('color', 'color-mix(in srgb, red 50%, blue)')) {
        gradient.style.background = `linear-gradient(to bottom, transparent 0%, ${pageBg} 100%)`;
      }
    }
    panel.appendChild(gradient);

    // Add bottom padding to the content element so the fixed panel
    // doesn't overlap the last readable line of the teaser.
    contentEl.style.paddingBottom = '240px';

    // Top slot — client content
    const slot = el('div');
    slot.className = 'cc-paywall-overlay-slot';
    reactRoot = mountTopSlot(slot, config.paywallTopSlot, config.reactDOM) ?? null;
    panel.appendChild(slot);

    // Our SDK's unlock body
    body = el('div');
    body.className = 'cc-paywall-overlay-body';
    panel.appendChild(body);

    shadowRoot.appendChild(panel);
  }

  function render(
    state: PaywallUIState,
    callbacks: PaywallRendererCallbacks,
    meta?: { requiredCredits?: number | null; creditBalance?: number | null }
  ): void {
    if (state === 'checking') return;
    if (!body) init();
    if (!body) return;

    // Loading: don't rebuild the DOM — freeze the active button in place.
    // This prevents the panel from shrinking/shifting when a purchase or
    // login is in progress, which would be jarring given the panel's fixed position.
    if (state === 'loading') {
      setButtonLoading(true);
      return;
    }

    if (state === 'granted') {
      destroy();
      return;
    }

    // Full state transition — clear and rebuild the body.
    while (body.firstChild) body.removeChild(body.firstChild);

    switch (state) {
      case 'login':
        renderLogin(body, callbacks);
        break;
      case 'purchase':
        renderPurchase(body, callbacks, meta?.requiredCredits ?? null);
        break;
      case 'insufficient':
        renderInsufficient(body, callbacks, meta?.requiredCredits ?? null, meta?.creditBalance ?? null);
        break;
    }
  }

  // ── State renderers ────────────────────────────────────────────────────────

  function renderLogin(parent: HTMLElement, cb: PaywallRendererCallbacks): void {
    // In overlay mode the slot already provides article context, so the body
    // just needs the CTA. In inline mode we add heading + description.
    if (config.paywallMode === 'inline') {
      parent.appendChild(el('h2', 'This article requires a subscription'));
      const detail = el('p', 'Sign in to your Content Credits account to unlock this article.');
      detail.className = 'cc-state-detail';
      parent.appendChild(detail);
    }

    const btn = el('button', 'Sign in to read');
    btn.className = 'cc-btn cc-btn-primary';
    btn.addEventListener('click', () => { void cb.onLogin(); });
    parent.appendChild(btn);

    parent.appendChild(poweredBy());
  }

  function renderPurchase(parent: HTMLElement, cb: PaywallRendererCallbacks, credits: number | null): void {
    if (config.paywallMode === 'inline') {
      parent.appendChild(el('h2', 'Unlock this article'));
      const detail = el('p', 'Use your Content Credits balance to instantly access this article.');
      detail.className = 'cc-state-detail';
      parent.appendChild(detail);
    }

    // Credits shown inline in the button label — clear and scannable.
    const label = credits !== null
      ? `Unlock · ${credits} credit${credits !== 1 ? 's' : ''}`
      : 'Unlock article';
    const btn = el('button', label);
    btn.className = 'cc-btn cc-btn-primary';
    btn.addEventListener('click', () => { void cb.onPurchase(); });
    parent.appendChild(btn);

    parent.appendChild(poweredBy());
  }

  function renderInsufficient(
    parent: HTMLElement,
    cb: PaywallRendererCallbacks,
    required: number | null,
    available: number | null
  ): void {
    if (config.paywallMode === 'inline') {
      parent.appendChild(el('h2', 'Not enough credits'));
    }

    const detail = el('p');
    detail.className = 'cc-state-detail';
    if (required !== null && available !== null) {
      detail.textContent = `This article costs ${required} credit${required !== 1 ? 's' : ''} — you have ${available}.`;
    } else {
      detail.textContent = "You don't have enough credits to unlock this article.";
    }
    parent.appendChild(detail);

    const btn = el('button', 'Top up credits');
    btn.className = 'cc-btn cc-btn-primary';
    btn.addEventListener('click', () => cb.onBuyMoreCredits());
    parent.appendChild(btn);

    parent.appendChild(poweredBy());
  }

  function poweredBy(): HTMLElement {
    const div = el('div');
    div.className = 'cc-powered-by';
    div.textContent = 'Powered by ';
    const link = el('a', 'Content Credits');
    link.setAttribute('href', 'https://contentcredits.com');
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    div.appendChild(link);
    return div;
  }

  // ── Button loading state ───────────────────────────────────────────────────

  function setButtonLoading(loading: boolean): void {
    if (!body) return;
    const btn = body.querySelector<HTMLButtonElement>('.cc-btn');
    if (!btn) return;

    btn.disabled = loading;

    if (loading) {
      // Replace button content with spinner + label, preserving button size.
      // The spinner is white on the primary colour background — matches all states.
      const spinner = el('span');
      spinner.className = 'cc-spinner';
      setTextContent(btn, '');
      btn.appendChild(spinner);
      btn.appendChild(document.createTextNode(' Processing…'));
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  function destroy(): void {
    reactRoot?.unmount();
    reactRoot = null;
    removeShadowHost(HOST_ID);
    // Remove the padding we added to the content element
    if (config.paywallMode === 'overlay') {
      const contentEl = document.querySelector<HTMLElement>(config.contentSelector);
      if (contentEl) contentEl.style.paddingBottom = '';
    }
    root = null;
    body = null;
  }

  return { init, render, setButtonLoading, destroy };
}

// ─── Top slot mounting ───────────────────────────────────────────────────────

function mountTopSlot(
  container: HTMLElement,
  slot: ResolvedConfig['paywallTopSlot'],
  reactDOM: ReactDOMAdapter | undefined
): { unmount(): void } | undefined {
  if (!slot) return undefined;

  // React element — detected by the $$typeof symbol all React elements carry.
  if (isReactElement(slot)) {
    if (!reactDOM) {
      console.warn('[ContentCredits] paywallTopSlot is a React element but `reactDOM` was not provided. ' +
        'Pass your ReactDOM instance: ContentCredits.init({ reactDOM, paywallTopSlot: <Widget /> })');
      return undefined;
    }
    return mountReactElement(container, slot, reactDOM);
  }

  if (typeof slot === 'function') {
    (slot as (c: HTMLElement) => void)(container);
    return undefined;
  }

  if (slot instanceof HTMLElement) {
    container.appendChild(slot);
    return undefined;
  }

  // Structured PaywallSlotItem[]
  for (const item of slot as PaywallSlotItem[]) {
    container.appendChild(renderSlotItem(item));
  }
  return undefined;
}

function isReactElement(value: unknown): boolean {
  // All React elements (JSX) have a $$typeof symbol set to Symbol.for('react.element')
  // or, in older builds, the integer 0xeac7.
  return (
    typeof value === 'object' &&
    value !== null &&
    '$$typeof' in value &&
    !Array.isArray(value) &&
    !(value instanceof HTMLElement)
  );
}

function mountReactElement(
  container: HTMLElement,
  element: unknown,
  reactDOM: ReactDOMAdapter
): { unmount(): void } | undefined {
  // React 18+: createRoot
  if (typeof reactDOM.createRoot === 'function') {
    const root = reactDOM.createRoot(container);
    root.render(element);
    return root;
  }
  // React 16/17: legacy render (no unmount handle needed — it cleans up on container removal)
  if (typeof reactDOM.render === 'function') {
    reactDOM.render(element, container);
    return {
      unmount() {
        // ReactDOM.unmountComponentAtNode is the React 16/17 equivalent
        const rdom = reactDOM as unknown as { unmountComponentAtNode?(el: Element): void };
        rdom.unmountComponentAtNode?.(container);
      },
    };
  }
  console.warn('[ContentCredits] The provided `reactDOM` has neither `createRoot` nor `render`. ' +
    'Pass a valid ReactDOM instance.');
  return undefined;
}

function renderSlotItem(item: PaywallSlotItem): HTMLElement {
  switch (item.type) {
    case 'heading': {
      const h = el('span', item.content ?? '');
      h.className = 'cc-slot-heading';
      return h;
    }
    case 'subheading': {
      const h = el('span', item.content ?? '');
      h.className = 'cc-slot-subheading';
      return h;
    }
    case 'text': {
      const p = el('span', item.content ?? '');
      p.className = 'cc-slot-text';
      return p;
    }
    case 'button': {
      const btn = el('button', item.content ?? '');
      const variantClass = item.variant === 'outline'
        ? 'cc-btn-outline'
        : item.variant === 'secondary'
          ? 'cc-btn-secondary'
          : 'cc-btn-primary';
      btn.className = `cc-btn ${variantClass}`;
      if (item.onClick) btn.addEventListener('click', item.onClick);
      return btn;
    }
    case 'divider': {
      const d = el('div', item.content ?? '');
      d.className = 'cc-slot-divider';
      return d;
    }
  }
}
