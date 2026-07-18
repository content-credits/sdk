import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGate } from '../src/paywall/gate';
import { createPaywallRenderer } from '../src/paywall/renderer';
import { createCommentWidget } from '../src/comments/widget';

const config = {
  apiKey: 'pub_123',
  articleUrl: 'https://example.com/post',
  hostName: 'example.com',
  pageTitle: 'Test Post',
  contentSelector: '#article',
  teaserParagraphs: 2,
  enableComments: false,
  extensionId: 'ext_123',
  debug: false,
  headless: false,
  apiBaseUrl: 'https://api.contentcredits.com',
  accountsUrl: 'https://accounts.contentcredits.com',
  paywallMode: 'inline' as const,
  onAccessGranted: undefined,
  onStateChange: undefined,
  onReady: undefined,
  onLoginRequired: undefined,
  onPurchaseRequired: undefined,
  onInsufficientCredits: undefined,
  onPurchased: undefined,
  onUserLogin: undefined,
  onUserLogout: undefined,
  onError: undefined,
  theme: {
    primaryColor: '#44C678',
    fontFamily: 'sans-serif',
  },
} as const;

describe('gate', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <article id="article">
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
        <h2>Heading</h2>
        <p>Paragraph 3</p>
      </article>
    `;
  });

  it('hides content after teaser paragraphs and restores it on reveal', () => {
    const gate = createGate({ selector: '#article', teaserParagraphs: 2, paywallMode: 'inline' });
    expect(gate.hide()).toBe(true);

    const article = document.getElementById('article')!;
    expect(article.getAttribute('data-cc-gated')).toBe('true');
    expect(article.querySelector('[data-cc-fade]')).not.toBeNull();
    expect(article.querySelectorAll('[data-cc-hidden="true"]').length).toBeGreaterThan(0);
    expect(gate.isGated()).toBe(true);

    gate.reveal();
    expect(article.querySelector('[data-cc-fade]')).toBeNull();
    expect(article.querySelector('[data-cc-hidden="true"]')).toBeNull();
    expect(gate.isGated()).toBe(false);
  });

  it('gracefully handles missing content elements', () => {
    const gate = createGate({ selector: '#missing', teaserParagraphs: 2 });
    expect(gate.hide()).toBe(false);
    expect(gate.isGated()).toBe(false);
  });
});

describe('paywall renderer', () => {
  beforeEach(() => {
    document.body.innerHTML = '<article id="article"><p>Teaser</p></article>';
  });

  it('renders login, purchase, insufficient, and loading states', () => {
    const renderer = createPaywallRenderer(config as any);
    const onLogin = vi.fn();
    const onPurchase = vi.fn();
    const onBuyMoreCredits = vi.fn();

    renderer.render('login', { onLogin, onPurchase, onBuyMoreCredits });
    let button = document.getElementById('cc-paywall-host')!.shadowRoot!.querySelector('button')!;
    button.click();
    expect(onLogin).toHaveBeenCalledTimes(1);

    renderer.render('purchase', { onLogin, onPurchase, onBuyMoreCredits }, { requiredCredits: 3 });
    const purchaseText = document.getElementById('cc-paywall-host')!.shadowRoot!.textContent!;
    expect(purchaseText).toContain('3 credits');
    button = document.getElementById('cc-paywall-host')!.shadowRoot!.querySelector('button')!;
    button.click();
    expect(onPurchase).toHaveBeenCalledTimes(1);

    renderer.render('insufficient', { onLogin, onPurchase, onBuyMoreCredits }, { requiredCredits: 4, creditBalance: 1 });
    expect(document.getElementById('cc-paywall-host')!.shadowRoot!.textContent).toContain('This article costs 4 credits');

    renderer.render('loading', { onLogin, onPurchase, onBuyMoreCredits });
    renderer.setButtonLoading(true);
    expect(document.getElementById('cc-paywall-host')!.shadowRoot!.textContent).toContain('Processing');

    renderer.render('granted', { onLogin, onPurchase, onBuyMoreCredits });
    expect(document.getElementById('cc-paywall-host')).toBeNull();
  });

  it('substitutes the {credits} token in unlockButtonLabel when the price is known', () => {
    const renderer = createPaywallRenderer({
      ...config,
      unlockButtonLabel: 'Unlock with {credits} Content Credits',
    } as any);
    renderer.render('purchase', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() }, { requiredCredits: 2 });
    const button = document.getElementById('cc-paywall-host')!.shadowRoot!.querySelector('button')!;
    expect(button.textContent).toBe('Unlock with 2 Content Credits');
  });

  it('strips the {credits} token cleanly when the price is unknown', () => {
    const renderer = createPaywallRenderer({
      ...config,
      unlockButtonLabel: 'Unlock with {credits} Content Credits',
    } as any);
    renderer.render('purchase', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() });
    const button = document.getElementById('cc-paywall-host')!.shadowRoot!.querySelector('button')!;
    expect(button.textContent).toBe('Unlock with Content Credits');
  });

  it('leaves unlockButtonLabel overrides without a token unchanged', () => {
    const renderer = createPaywallRenderer({
      ...config,
      unlockButtonLabel: 'Read this story',
    } as any);
    renderer.render('purchase', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() }, { requiredCredits: 5 });
    const button = document.getElementById('cc-paywall-host')!.shadowRoot!.querySelector('button')!;
    expect(button.textContent).toBe('Read this story');
  });

  // Phase 0 trust fix (CONSUMER_MESSAGING_AUDIT_2026-07.md Part 1.3): a failed
  // purchase must not silently revert the button with zero explanation.
  it('shows an inline error line on a failed purchase and keeps the unlock button clickable for retry', () => {
    const renderer = createPaywallRenderer(config as any);
    const onPurchase = vi.fn();

    renderer.render(
      'purchase',
      { onLogin: vi.fn(), onPurchase, onBuyMoreCredits: vi.fn() },
      { requiredCredits: 3, error: "Something went wrong and your article wasn't unlocked. Please try again." }
    );

    const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
    const errorEl = shadowRoot.querySelector('.cc-error')!;
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe("Something went wrong and your article wasn't unlocked. Please try again.");

    const button = shadowRoot.querySelector<HTMLButtonElement>('.cc-btn')!;
    expect(button.disabled).toBe(false);
    button.click();
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  it('does not render an error line on the purchase state when no error is passed', () => {
    const renderer = createPaywallRenderer(config as any);
    renderer.render('purchase', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() }, { requiredCredits: 3 });
    const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
    expect(shadowRoot.querySelector('.cc-error')).toBeNull();
  });

  // Phase 0 trust fix: a non-401 access-check failure must show a distinct
  // retry state instead of wrongly telling a signed-in reader to sign in.
  it('renders the error state with a working Try again button, distinct from login', () => {
    const renderer = createPaywallRenderer({ ...config, showHeadings: true } as any);
    const onRetry = vi.fn();

    renderer.render(
      'error',
      { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn(), onRetry },
      { error: "We couldn't check your access to this article. Please try again." }
    );

    const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
    expect(shadowRoot.querySelector('h2')!.textContent).toBe('Something went wrong');
    expect(shadowRoot.querySelector('.cc-state-detail')!.textContent)
      .toBe("We couldn't check your access to this article. Please try again.");
    // Not the login state's "Sign in to read" button.
    expect(shadowRoot.textContent).not.toContain('Sign in to read');

    const button = shadowRoot.querySelector<HTMLButtonElement>('.cc-btn')!;
    expect(button.textContent).toBe('Try again');
    button.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows rate-limit copy in the error state for a 429', () => {
    const renderer = createPaywallRenderer(config as any);
    renderer.render(
      'error',
      { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn(), onRetry: vi.fn() },
      { error: 'Too many attempts. Please wait a few minutes and try again.' }
    );
    const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
    expect(shadowRoot.querySelector('.cc-state-detail')!.textContent)
      .toBe('Too many attempts. Please wait a few minutes and try again.');
  });

  // ── Phase 3 structural polish (CONSUMER_MESSAGING_AUDIT_2026-07.md Part 4/5) ──

  describe('accessibility wiring', () => {
    it('sets aria-busy on the button and puts the loading label in an aria-live region', () => {
      const renderer = createPaywallRenderer(config as any);
      renderer.render('login', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() });

      const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
      const button = shadowRoot.querySelector<HTMLButtonElement>('.cc-btn')!;

      renderer.render('loading', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() });
      renderer.setButtonLoading(true);

      expect(button.getAttribute('aria-busy')).toBe('true');
      const liveRegion = button.querySelector('[aria-live="polite"]');
      expect(liveRegion).not.toBeNull();
      expect(liveRegion!.textContent).toContain('Signing in…');
    });

    it('announces the button-specific loading label ("Unlocking…") via the live region', () => {
      const renderer = createPaywallRenderer(config as any);
      renderer.render('purchase', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() }, { requiredCredits: 2 });
      renderer.render('loading', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() });
      renderer.setButtonLoading(true);

      const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
      const button = shadowRoot.querySelector<HTMLButtonElement>('.cc-btn')!;
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.querySelector('[aria-live="polite"]')!.textContent).toContain('Unlocking…');
    });

    it('puts the inline purchase-failure error line in an aria-live="polite" element', () => {
      const renderer = createPaywallRenderer(config as any);
      renderer.render(
        'purchase',
        { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() },
        { requiredCredits: 3, error: "Something went wrong and your article wasn't unlocked. Please try again." }
      );
      const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
      const errorEl = shadowRoot.querySelector('.cc-error')!;
      expect(errorEl.getAttribute('aria-live')).toBe('polite');
    });

    it('puts the error-state detail line in an aria-live="polite" element', () => {
      const renderer = createPaywallRenderer(config as any);
      renderer.render(
        'error',
        { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn(), onRetry: vi.fn() },
        { error: "We couldn't check your access to this article. Please try again." }
      );
      const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
      const detail = shadowRoot.querySelector('.cc-state-detail')!;
      expect(detail.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('paywallCopy overrides (Phase 3 configurable copy)', () => {
    it('overrides the login-state sign-in button label via signInButtonLabel', () => {
      const renderer = createPaywallRenderer({
        ...config,
        paywallCopy: { signInButtonLabel: 'Log in to keep reading' },
      } as any);
      renderer.render('login', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() });
      const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
      expect(shadowRoot.querySelector('.cc-btn')!.textContent).toBe('Log in to keep reading');
    });

    it('defaults the sign-in button label to "Sign in to read" when unset', () => {
      const renderer = createPaywallRenderer(config as any);
      renderer.render('login', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() });
      const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
      expect(shadowRoot.querySelector('.cc-btn')!.textContent).toBe('Sign in to read');
    });

    it('overrides the insufficient-state buy-credits button label via buyCreditsButtonLabel', () => {
      const renderer = createPaywallRenderer({
        ...config,
        paywallCopy: { buyCreditsButtonLabel: 'Top up now' },
      } as any);
      renderer.render('insufficient', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() }, { requiredCredits: 4, creditBalance: 1 });
      const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
      expect(shadowRoot.querySelector('.cc-btn')!.textContent).toBe('Top up now');
    });

    it('defaults the buy-credits button label to "Buy credits" when unset', () => {
      const renderer = createPaywallRenderer(config as any);
      renderer.render('insufficient', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() }, { requiredCredits: 4, creditBalance: 1 });
      const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
      expect(shadowRoot.querySelector('.cc-btn')!.textContent).toBe('Buy credits');
    });

    it('overrides the insufficient-state detail line via insufficientDetail, taking precedence over the cost line', () => {
      const renderer = createPaywallRenderer({
        ...config,
        paywallCopy: { insufficientDetail: 'You need more credits to keep reading.' },
      } as any);
      renderer.render('insufficient', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() }, { requiredCredits: 4, creditBalance: 1 });
      const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
      expect(shadowRoot.querySelector('.cc-state-detail')!.textContent).toBe('You need more credits to keep reading.');
    });

    it('overrides the insufficient-state fallback detail (no price known) via insufficientDetail', () => {
      const renderer = createPaywallRenderer({
        ...config,
        paywallCopy: { insufficientDetail: 'You need more credits to keep reading.' },
      } as any);
      renderer.render('insufficient', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() });
      const shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
      expect(shadowRoot.querySelector('.cc-state-detail')!.textContent).toBe('You need more credits to keep reading.');
    });

    it('falls back to the cost line / static fallback for insufficientDetail when unset', () => {
      const renderer = createPaywallRenderer(config as any);
      renderer.render('insufficient', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() }, { requiredCredits: 4, creditBalance: 1 });
      let shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
      expect(shadowRoot.querySelector('.cc-state-detail')!.textContent).toBe('This article costs 4 credits — you have 1.');

      renderer.render('insufficient', { onLogin: vi.fn(), onPurchase: vi.fn(), onBuyMoreCredits: vi.fn() });
      shadowRoot = document.getElementById('cc-paywall-host')!.shadowRoot!;
      expect(shadowRoot.querySelector('.cc-state-detail')!.textContent)
        .toBe("You don't have enough credits to unlock this article.");
    });
  });
});

describe('comment widget', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('mounts, updates badge count, toggles visibility, and cleans up', () => {
    const onOpen = vi.fn();
    const widget = createCommentWidget('#111111', onOpen);
    widget.mount();

    const el = document.getElementById('cc-comment-widget')!;
    expect(el).not.toBeNull();

    widget.setCount(5);
    expect(el.textContent).toContain('5');

    const clickable = el.querySelector('div')!;
    clickable.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onOpen).toHaveBeenCalledTimes(1);

    widget.hide();
    expect(el.style.display).toBe('none');

    widget.show();
    expect(el.style.display).toBe('flex');

    widget.destroy();
    expect(document.getElementById('cc-comment-widget')).toBeNull();
  });
});
