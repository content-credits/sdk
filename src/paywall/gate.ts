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
      const pivotIndex = childNodes.findIndex(n => n === hideFrom || contentEl!.contains(n as Node) && n.compareDocumentPosition(hideFrom) & Node.DOCUMENT_POSITION_FOLLOWING);

      hiddenNodes = childNodes.slice(pivotIndex < 0 ? options.teaserParagraphs : pivotIndex);
      hiddenNodes.forEach(n => {
        if (n instanceof HTMLElement || n instanceof Text) {
          (n as HTMLElement).style?.setProperty?.('display', 'none');
          (n as HTMLElement).setAttribute?.('data-cc-hidden', 'true');
        }
      });
    } else {
      // Not enough paragraphs to split — hide the entire content
      hiddenNodes = Array.from(contentEl.childNodes);
      hiddenNodes.forEach(n => {
        if (n instanceof HTMLElement) n.style.display = 'none';
      });
    }

    contentEl.setAttribute(GATE_ATTR, 'true');
    gated = true;
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

    hiddenNodes = [];
    contentEl?.removeAttribute(GATE_ATTR);
    gated = false;
  }

  function isGated(): boolean {
    return gated;
  }

  return { hide, reveal, isGated };
}
