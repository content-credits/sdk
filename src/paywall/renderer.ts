import { createInlineShadowHost, injectStyles, removeShadowHost } from '../ui/shadow.js';
import { getPaywallStyles } from '../ui/styles.js';
import { el, setTextContent } from '../ui/sanitize.js';
import type { ResolvedConfig, PaywallSlotItem, ReactDOMAdapter } from '../types/index.js';

const HOST_ID = 'cc-paywall-host';

export type PaywallUIState =
  | 'checking'      // initial access check in progress
  | 'login'         // user not logged in
  | 'purchase'      // logged in but no access
  | 'insufficient'  // logged in but not enough credits
  | 'loading'       // purchase in progress
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

    const { root: shadowRoot } = createInlineShadowHost(HOST_ID, contentEl);
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

    // Gradient that visually fades the article into the white panel.
    // We read the computed background of the content element's parent so the
    // gradient blends correctly on sites with non-white backgrounds.
    const gradient = el('div');
    gradient.className = 'cc-paywall-overlay-gradient';
    const parentBg = getComputedStyle(contentEl.parentElement ?? contentEl).backgroundColor;
    if (parentBg && parentBg !== 'rgba(0, 0, 0, 0)' && parentBg !== 'transparent') {
      gradient.style.background = `linear-gradient(to bottom, transparent 0%, ${parentBg} 100%)`;
    }
    panel.appendChild(gradient);

    // Top slot — client content
    const slot = el('div');
    slot.className = 'cc-paywall-overlay-slot';
    reactRoot = mountTopSlot(slot, config.paywallTopSlot, config.reactDOM) ?? null;
    panel.appendChild(slot);

    // Only render the "or" divider between slot and body when the slot has content
    if (config.paywallTopSlot) {
      const divider = el('div');
      divider.className = 'cc-slot-divider';
      divider.style.cssText = 'margin: 4px auto 0; padding: 0 24px;';
      divider.textContent = 'or';
      panel.appendChild(divider);
    }

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
      case 'loading':
        renderLoading(body);
        break;
      case 'granted':
        destroy();
        break;
    }
  }

  function renderLogin(parent: HTMLElement, cb: PaywallRendererCallbacks): void {
    // Only show the heading/description in inline mode; in overlay mode the
    // client's top slot already provides the article context.
    if (config.paywallMode === 'inline') {
      parent.appendChild(el('h2', 'This article requires a subscription'));
      parent.appendChild(el('p', 'Log in with your Content Credits account to unlock this article.'));
    }

    const btn = el('button', 'Login & Unlock with Content Credits');
    btn.className = 'cc-btn cc-btn-primary';
    btn.addEventListener('click', () => { void cb.onLogin(); });
    parent.appendChild(btn);

    parent.appendChild(poweredBy());
  }

  function renderPurchase(parent: HTMLElement, cb: PaywallRendererCallbacks, credits: number | null): void {
    if (config.paywallMode === 'inline') {
      parent.appendChild(el('h2', 'Unlock this article'));

      if (credits !== null) {
        const badge = el('span', `${credits} credit${credits !== 1 ? 's' : ''}`);
        badge.className = 'cc-credit-badge';
        parent.appendChild(badge);
      }

      parent.appendChild(el('p', 'Use your Content Credits balance to instantly access this premium article.'));
    }

    const label = credits !== null
      ? `Unlock Just This Story · ${credits} Credit${credits !== 1 ? 's' : ''}`
      : 'Unlock Just This Story';
    const btn = el('button', label);
    btn.className = 'cc-btn cc-btn-outline';
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

    const detail = required !== null && available !== null
      ? `You need ${required} credit${required !== 1 ? 's' : ''} but only have ${available}.`
      : 'You don\'t have enough credits to unlock this article.';

    parent.appendChild(el('p', detail));

    const btn = el('button', 'Buy More Credits');
    btn.className = 'cc-btn cc-btn-primary';
    btn.addEventListener('click', () => cb.onBuyMoreCredits());
    parent.appendChild(btn);

    parent.appendChild(poweredBy());
  }

  function renderLoading(parent: HTMLElement): void {
    const btn = el('button');
    btn.className = 'cc-btn cc-btn-outline';
    btn.disabled = true;

    const spinner = el('span');
    spinner.className = 'cc-spinner';
    btn.appendChild(spinner);
    btn.appendChild(document.createTextNode(' Processing…'));

    parent.appendChild(btn);
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

  function setButtonLoading(loading: boolean): void {
    if (!body) return;
    const btn = body.querySelector<HTMLButtonElement>('.cc-btn');
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      const spinner = el('span');
      spinner.className = 'cc-spinner';
      setTextContent(btn, '');
      btn.appendChild(spinner);
      btn.appendChild(document.createTextNode(' Processing…'));
    }
  }

  function destroy(): void {
    reactRoot?.unmount();
    reactRoot = null;
    removeShadowHost(HOST_ID);
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
