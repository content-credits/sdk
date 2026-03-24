import { createShadowHost, injectStyles, removeShadowHost } from '../ui/shadow.js';
import { getPaywallStyles } from '../ui/styles.js';
import { el, setTextContent } from '../ui/sanitize.js';
import type { ResolvedConfig } from '../types/index.js';

const HOST_ID = 'cc-paywall-host';

export type PaywallUIState =
  | 'checking'      // initial access check in progress
  | 'login'         // user not logged in
  | 'purchase'      // logged in but no access
  | 'insufficient'  // logged in but not enough credits
  | 'loading'       // purchase in progress
  | 'granted'       // access granted, overlay removed

export interface PaywallRendererCallbacks {
  onLogin(): void;
  onPurchase(): void;
  onBuyMoreCredits(): void;
}

export function createPaywallRenderer(config: ResolvedConfig) {
  let root: ShadowRoot | null = null;
  let overlay: HTMLElement | null = null;

  function init(): void {
    const { root: shadowRoot } = createShadowHost(HOST_ID);
    root = shadowRoot;
    injectStyles(root, getPaywallStyles(config.theme.primaryColor, config.theme.fontFamily));

    overlay = el('div');
    overlay.className = 'cc-paywall-overlay';
    root.appendChild(overlay);
  }

  function render(
    state: PaywallUIState,
    callbacks: PaywallRendererCallbacks,
    meta?: { requiredCredits?: number | null; creditBalance?: number | null }
  ): void {
    if (!overlay) init();
    if (!overlay) return;

    // Clear previous content
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

    switch (state) {
      case 'checking':
        renderChecking(overlay);
        break;
      case 'login':
        renderLogin(overlay, callbacks);
        break;
      case 'purchase':
        renderPurchase(overlay, callbacks, meta?.requiredCredits ?? null);
        break;
      case 'insufficient':
        renderInsufficient(overlay, callbacks, meta?.requiredCredits ?? null, meta?.creditBalance ?? null);
        break;
      case 'loading':
        renderLoading(overlay);
        break;
      case 'granted':
        destroy();
        break;
    }
  }

  function renderChecking(parent: HTMLElement): void {
    const spinner = el('div');
    spinner.className = 'cc-spinner';
    spinner.style.margin = '0 auto 12px';
    spinner.style.width = '24px';
    spinner.style.height = '24px';
    spinner.style.borderWidth = '2px';
    spinner.style.borderColor = '#e5e7eb';
    spinner.style.borderTopColor = config.theme.primaryColor;

    const text = el('p', 'Checking access...');
    text.style.cssText = 'font-size:14px;color:#6b7280;text-align:center;font-family:' + config.theme.fontFamily;

    parent.appendChild(spinner);
    parent.appendChild(text);
  }

  function renderLogin(parent: HTMLElement, cb: PaywallRendererCallbacks): void {
    parent.appendChild(el('h2', 'This article requires a subscription'));
    parent.appendChild(el('p', 'Log in with your Content Credits account to unlock this article.'));

    const btn = el('button', 'Login & Buy with Content Credits');
    btn.className = 'cc-btn cc-btn-primary';
    btn.addEventListener('click', cb.onLogin);
    parent.appendChild(btn);

    parent.appendChild(poweredBy());
  }

  function renderPurchase(parent: HTMLElement, cb: PaywallRendererCallbacks, credits: number | null): void {
    parent.appendChild(el('h2', 'Unlock this article'));

    if (credits !== null) {
      const badge = el('span', `${credits} credit${credits !== 1 ? 's' : ''}`);
      badge.className = 'cc-credit-badge';
      parent.appendChild(badge);
    }

    parent.appendChild(el('p', 'Use your Content Credits balance to instantly access this premium article.'));

    const btn = el('button', credits !== null ? `Buy for ${credits} Credit${credits !== 1 ? 's' : ''}` : 'Buy with Content Credits');
    btn.className = 'cc-btn cc-btn-primary';
    btn.addEventListener('click', cb.onPurchase);
    parent.appendChild(btn);

    parent.appendChild(poweredBy());
  }

  function renderInsufficient(
    parent: HTMLElement,
    cb: PaywallRendererCallbacks,
    required: number | null,
    available: number | null
  ): void {
    parent.appendChild(el('h2', 'Not enough credits'));

    const detail = required !== null && available !== null
      ? `You need ${required} credit${required !== 1 ? 's' : ''} but have ${available}. Top up to unlock this article.`
      : 'You don\'t have enough credits to unlock this article. Purchase more to continue.';

    parent.appendChild(el('p', detail));

    const btn = el('button', 'Buy More Credits');
    btn.className = 'cc-btn cc-btn-primary';
    btn.addEventListener('click', cb.onBuyMoreCredits);
    parent.appendChild(btn);

    parent.appendChild(poweredBy());
  }

  function renderLoading(parent: HTMLElement): void {
    const btn = el('button');
    btn.className = 'cc-btn cc-btn-primary';
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
    if (!overlay) return;
    const btn = overlay.querySelector<HTMLButtonElement>('.cc-btn');
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
    removeShadowHost(HOST_ID);
    root = null;
    overlay = null;
  }

  return { init, render, setButtonLoading, destroy };
}
