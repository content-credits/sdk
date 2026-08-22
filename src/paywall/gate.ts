/**
 * Content gating — hides premium content and shows a teaser.
 *
 * Usage:
 *   const gate = createGate({ selector: '#article-body', teaserParagraphs: 2 })
 *   gate.hide()    → wraps content, shows teaser
 *   gate.reveal()  → removes overlay, shows full content
 */
export interface GateOptions {
  /** CSS selector for the premium content element */
  selector: string;
  /** Number of paragraphs to show before the paywall */
  teaserParagraphs: number;
  /**
   * Paywall display mode. In overlay mode the gradient is rendered inside the
   * paywall panel itself, so the gate skips injecting its own fade element.
   */
  paywallMode: 'inline' | 'overlay';
}

export interface Gate {
  hide(): boolean;
  reveal(): void;
  isGated(): boolean;
}

const GATE_ATTR = 'data-cc-gated';

export function createGate(options: GateOptions): Gate {
  let gated = false;
  let contentEl: HTMLElement | null = null;
  let hiddenNodes: Node[] = [];

  function findContent(): HTMLElement | null {
    return document.querySelector<HTMLElement>(options.selector);
  }

  function hide(): boolean {
    contentEl = findContent();
    if (!contentEl) return false;
    if (contentEl.hasAttribute(GATE_ATTR)) return true; // already gated

    const paragraphs = Array.from(contentEl.querySelectorAll('p, h2, h3, h4, blockquote, ul, ol'));

    // Collect nodes to hide (everything after the teaser threshold)
    if (paragraphs.length > options.teaserParagraphs) {
      const hideFrom = paragraphs[options.teaserParagraphs];
      const childNodes = Array.from(contentEl.childNodes);
      // Find the direct child that IS, or CONTAINS, the first paragraph past the
      // teaser threshold — that's where hiding begins. `hideFrom` may be nested
      // (e.g. a <p> inside a wrapper div), so we can't rely on identity alone.
      // NOTE: this previously used compareDocumentPosition & DOCUMENT_POSITION_FOLLOWING,
      // which matches the FIRST child that precedes hideFrom — always index 0 —
      // so the entire article was hidden and the teaser never showed (the paywall
      // appeared immediately regardless of teaserParagraphs).
      const pivotIndex = childNodes.findIndex(
        n => n === hideFrom || (n.nodeType === Node.ELEMENT_NODE && (n as Element).contains(hideFrom)),
      );

      hiddenNodes = childNodes.slice(pivotIndex < 0 ? options.teaserParagraphs : pivotIndex);
      hiddenNodes.forEach(n => {
        if (n instanceof HTMLElement || n instanceof Text) {
          (n as HTMLElement).style?.setProperty?.('display', 'none');
          (n as HTMLElement).setAttribute?.('data-cc-hidden', 'true');
        }
      });
    } else if (options.teaserParagraphs === 0) {
      // Explicitly hide everything — caller requested no teaser (teaserParagraphs: 0)
      hiddenNodes = Array.from(contentEl.childNodes);
      hiddenNodes.forEach(n => {
        if (n instanceof HTMLElement) n.style.display = 'none';
      });
    }
    // else: content has at most as many paragraphs as the teaser threshold allows
    // (e.g. server-side teaser splitting already trimmed the DOM) — show everything

    contentEl.setAttribute(GATE_ATTR, 'true');
    gated = true;

    // In overlay mode the gradient is part of the paywall panel itself.
    // In inline mode inject a fade element at the bottom of the teaser.
    if (options.paywallMode === 'inline' && !contentEl.querySelector('[data-cc-fade]')) {
      const prevPos = contentEl.style.position;
      if (!prevPos || prevPos === 'static') contentEl.style.position = 'relative';
      const fadeEl = document.createElement('div');
      fadeEl.setAttribute('data-cc-fade', 'true');
      fadeEl.style.cssText =
        'position:absolute;bottom:0;left:0;width:100%;height:160px;' +
        'background:linear-gradient(to bottom,transparent 0%,var(--cc-bg,#fff) 100%);' +
        'pointer-events:none;z-index:1;';
      contentEl.appendChild(fadeEl);
    }

    return true;
  }

  function reveal(): void {
    if (!gated) return;

    hiddenNodes.forEach(n => {
      if (n instanceof HTMLElement) {
        n.style.removeProperty('display');
        n.removeAttribute('data-cc-hidden');
      }
    });

    // Remove gradient fade
    const fadeEl = contentEl?.querySelector('[data-cc-fade]');
    if (fadeEl) fadeEl.remove();

    hiddenNodes = [];
    contentEl?.removeAttribute(GATE_ATTR);
    gated = false;
  }

  function isGated(): boolean {
    return gated;
  }

  return { hide, reveal, isGated };
}
