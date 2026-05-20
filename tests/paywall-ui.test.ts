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
