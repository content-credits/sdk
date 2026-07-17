import { createShadowHost, createInlineShadowHost, injectStyles, removeShadowHost } from '../ui/shadow.js';
import { getPaywallStyles, getSdkButtonStyles } from '../ui/styles.js';
import { el, setTextContent } from '../ui/sanitize.js';
import type { ResolvedConfig, ReactDOMAdapter } from '../types/index.js';

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
  // In inline mode: the single panel div. In overlay/renderPaywall mode: wrapper
  // inside the nested shadow root where the SDK button is mounted.
  let body: HTMLElement | null = null;
  // Tracks a mounted React 18 root so we can unmount it on destroy.
  let reactRoot: { unmount(): void } | null = null;
  // renderPaywall: body is set asynchronously via ref callback. Buffer any
  // render() call that arrives before the ref fires.
  let pendingRender: (() => void) | null = null;
  // Guards against in-flight async callbacks (e.g. mountSdkButton ref) firing
  // after destroy() — e.g. React StrictMode double-invoke in development.
  let isDestroyed = false;

  function init(): void {
    if (config.paywallMode === 'overlay') {
      // Modal mode: full-viewport takeover, no content element needed for positioning.
      const { root: shadowRoot, host: shadowHost } = createShadowHost(HOST_ID);
      root = shadowRoot;
      injectStyles(root, getPaywallStyles(config.theme.primaryColor, config.theme.fontFamily, config.theme.backdropColor, config.theme.sdkButtonColor));
      initModal(root, shadowHost);
    } else {
      // Inline mode: inserted after the content element in document flow.
      const contentEl = document.querySelector<HTMLElement>(config.contentSelector);
      if (!contentEl) return;
      const { root: shadowRoot } = createInlineShadowHost(HOST_ID, contentEl);
      root = shadowRoot;
      injectStyles(root, getPaywallStyles(config.theme.primaryColor, config.theme.fontFamily, config.theme.backdropColor, config.theme.sdkButtonColor));
      initInline(root);
    }
  }

  function initInline(shadowRoot: ShadowRoot): void {
    body = el('div');
    body.className = 'cc-paywall-inline';
    shadowRoot.appendChild(body);
  }

  function initModal(shadowRoot: ShadowRoot, shadowHost: HTMLElement): void {
    // Defensive cleanup: if a previous renderer instance already appended a
    // backdrop to this shadow root (React StrictMode double-invoke), remove it
    // so we don't end up with two backdrops inside the same shadow root.
    const existingBackdrop = shadowRoot.querySelector('.cc-paywall-modal-backdrop');
    if (existingBackdrop) existingBackdrop.remove();
    // Also remove any stale slotted light DOM containers from a prior instance.
    for (const child of Array.from(shadowHost.children)) {
      if (child.getAttribute('slot') === 'paywall-content') child.remove();
    }

    // Lock page scroll while the modal is visible.
    document.body.style.overflow = 'hidden';

    const backdrop = el('div');
    backdrop.className = 'cc-paywall-modal-backdrop';

    const card = el('div');
    card.className = 'cc-paywall-modal-card';

    if (config.renderPaywall && config.reactDOM) {
      // Publisher controls the full card layout via renderPaywall JSX.
      //
      // CSS isolation problem: content mounted inside a shadow root loses access
      // to the host page's stylesheets. To solve this, we render the publisher's
      // JSX into the light DOM (as a slotted child of the shadow host) so their
      // CSS applies normally. The SDK's own button gets its own nested shadow root
      // for style isolation, but the publisher can still position it anywhere in
      // their layout via the mountSdkButton ref callback.
      //
      // DOM structure:
      //   cc-paywall-host (shadow host)
      //   ├── [outer shadow root] — backdrop, card, named slot
      //   └── <div slot="paywall-content"> (light DOM) — publisher's React tree
      //           └── <div ref={mountSdkButton}>
      //                   └── [nested shadow root] — SDK button, isolated styles

      // Named slot in the card — projects the light DOM container visually.
      const slotEl = document.createElement('slot');
      slotEl.name = 'paywall-content';
      card.appendChild(slotEl);

      // Light DOM container — publisher's React mounts here, host CSS applies.
      const lightContainer = el('div');
      lightContainer.setAttribute('slot', 'paywall-content');
      shadowHost.appendChild(lightContainer);

      const mountSdkButton = (container: HTMLElement | null): void => {
        if (!container) return;
        // If destroy() was called before this ref fired (React StrictMode
        // cleanup racing the async import), bail out immediately.
        if (isDestroyed) return;

        // Attach a nested shadow root to isolate SDK button styles from the
        // publisher's stylesheet while keeping publisher content in light DOM.
        const nestedRoot = container.attachShadow({ mode: 'open' });
        injectStyles(nestedRoot, getSdkButtonStyles(config.theme.sdkButtonColor, config.theme.fontFamily));

        // body is the wrapper inside the nested shadow root.
        const wrapper = el('div');
        wrapper.className = 'cc-paywall-modal-body';
        nestedRoot.appendChild(wrapper);
        body = wrapper;

        // Flush any render() call that arrived before the ref fired.
        if (pendingRender) {
          pendingRender();
          pendingRender = null;
        }
      };

      const jsxElement = config.renderPaywall({ mountSdkButton });
      reactRoot = mountReactElement(lightContainer, jsxElement, config.reactDOM) ?? null;
    } else {
      body = el('div');
      body.className = 'cc-paywall-modal-body';
      card.appendChild(body);
    }

    backdrop.appendChild(card);
    shadowRoot.appendChild(backdrop);
  }

  function render(
    state: PaywallUIState,
    callbacks: PaywallRendererCallbacks,
    meta?: { requiredCredits?: number | null; creditBalance?: number | null }
  ): void {
    if (isDestroyed) return;
    if (state === 'checking') return;
    // Guard: only call init() if neither root nor body is set. In the
    // renderPaywall case, root is set synchronously but body stays null until
    // the mountSdkButton ref fires asynchronously. Without this guard a second
    // render() call before the ref fires would call init() again and create a
    // duplicate shadow host + light DOM container.
    if (!root && !body) init();

    // renderPaywall: body is set asynchronously via the mountSdkButton ref
    // callback. Buffer this call and flush it once the ref fires.
    if (!body && config.renderPaywall) {
      pendingRender = () => render(state, callbacks, meta);
      return;
    }

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
    if (config.showHeadings) {
      parent.appendChild(el('h2', config.paywallCopy?.loginHeading ?? 'Unlock this article with Content Credits'));
      const detail = el('p', config.paywallCopy?.loginDetail ?? 'Sign in to your Content Credits account to unlock this article.');
      detail.className = 'cc-state-detail';
      parent.appendChild(detail);
    }

    const btn = el('button', 'Sign in to read');
    btn.className = 'cc-btn cc-btn-sdk';
    btn.dataset.ccAction = 'login';
    btn.addEventListener('click', () => { void cb.onLogin(); });
    parent.appendChild(btn);

    parent.appendChild(poweredBy());
  }

  function renderPurchase(parent: HTMLElement, cb: PaywallRendererCallbacks, credits: number | null): void {
    if (config.showHeadings) {
      parent.appendChild(el('h2', config.paywallCopy?.purchaseHeading ?? 'Unlock this article'));
      const detail = el('p', config.paywallCopy?.purchaseDetail ?? 'Use your Content Credits balance to instantly access this article.');
      detail.className = 'cc-state-detail';
      parent.appendChild(detail);
    }

    // Credits shown inline in the button label — clear and scannable.
    // Publishers can override via `unlockButtonLabel`.
    const defaultLabel = credits !== null
      ? `Unlock · ${credits} credit${credits !== 1 ? 's' : ''}`
      : 'Unlock article';
    const label = config.unlockButtonLabel ?? defaultLabel;
    const btn = el('button', label);
    btn.className = 'cc-btn cc-btn-sdk';
    btn.dataset.ccAction = 'purchase';
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
    if (config.showHeadings) {
      parent.appendChild(el('h2', config.paywallCopy?.insufficientHeading ?? 'Not enough credits'));
    }

    const detail = el('p');
    detail.className = 'cc-state-detail';
    if (required !== null && available !== null) {
      detail.textContent = `This article costs ${required} credit${required !== 1 ? 's' : ''} — you have ${available}.`;
    } else {
      detail.textContent = "You don't have enough credits to unlock this article.";
    }
    parent.appendChild(detail);

    const btn = el('button', 'Buy credits');
    btn.className = 'cc-btn cc-btn-sdk';
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
      // The button retains a data-cc-action tag set when it was rendered (login
      // or purchase), so we can say what's actually happening instead of a bare
      // "Processing…". Falls back to "Processing…" for any other action.
      const loadingLabel = btn.dataset.ccAction === 'login'
        ? 'Signing in…'
        : btn.dataset.ccAction === 'purchase'
          ? 'Unlocking…'
          : 'Processing…';
      const spinner = el('span');
      spinner.className = 'cc-spinner';
      setTextContent(btn, '');
      btn.appendChild(spinner);
      btn.appendChild(document.createTextNode(` ${loadingLabel}`));
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  function destroy(): void {
    isDestroyed = true;
    pendingRender = null;
    reactRoot?.unmount();
    reactRoot = null;
    // removeShadowHost removes the entire host element, which also removes any
    // light DOM children (the slotted container for renderPaywall).
    removeShadowHost(HOST_ID);
    // Restore scroll lock applied in initModal.
    if (config.paywallMode === 'overlay') {
      document.body.style.overflow = '';
    }
    root = null;
    body = null;
  }

  return { init, render, setButtonLoading, destroy };
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
