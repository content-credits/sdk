import { describe, it, expect, beforeEach } from 'vitest';
import { createGate } from '../src/paywall/gate';

function setArticle(html: string) {
  document.body.innerHTML = `<div id="article">${html}</div>`;
  return document.getElementById('article') as HTMLElement;
}

const isHidden = (el: Element | null) =>
  !!el && (el as HTMLElement).style.display === 'none';

describe('createGate — teaser gating', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the first N paragraphs visible and hides the rest', () => {
    const el = setArticle(
      ['<p>p1</p>', '<p>p2</p>', '<p>p3</p>', '<p>p4</p>', '<p>p5</p>', '<p>p6</p>'].join(''),
    );
    const gate = createGate({ selector: '#article', teaserParagraphs: 4, paywallMode: 'inline' });

    expect(gate.hide()).toBe(true);

    const ps = Array.from(el.querySelectorAll('p'));
    // First 4 paragraphs (the teaser) stay visible…
    expect(isHidden(ps[0])).toBe(false);
    expect(isHidden(ps[1])).toBe(false);
    expect(isHidden(ps[2])).toBe(false);
    expect(isHidden(ps[3])).toBe(false);
    // …everything from the 5th paragraph on is hidden.
    expect(isHidden(ps[4])).toBe(true);
    expect(isHidden(ps[5])).toBe(true);
  });

  it('keeps a leading image + teaser paragraphs visible (publisher case)', () => {
    // Mirrors the WordPress .cc-premium-content shape: <p>, image wrapper, then more <p>.
    const el = setArticle(
      [
        '<p>intro</p>',
        '<div class="img"><img src="x.jpg"></div>',
        '<p>p2</p>',
        '<p>p3</p>',
        '<p>p4</p>',
        '<p>p5</p>',
      ].join(''),
    );
    const gate = createGate({ selector: '#article', teaserParagraphs: 4, paywallMode: 'inline' });
    gate.hide();

    const intro = el.querySelector('p');
    const imgWrap = el.querySelector('.img');
    const ps = Array.from(el.querySelectorAll('p'));
    // Photo and the first four paragraphs remain visible.
    expect(isHidden(intro)).toBe(false);
    expect(isHidden(imgWrap)).toBe(false);
    expect(isHidden(ps[3])).toBe(false); // p4 — 4th paragraph
    // The 5th paragraph is gated.
    expect(isHidden(ps[4])).toBe(true);
  });

  it('reveal() restores every hidden node', () => {
    const el = setArticle(['<p>p1</p>', '<p>p2</p>', '<p>p3</p>', '<p>p4</p>'].join(''));
    const gate = createGate({ selector: '#article', teaserParagraphs: 2, paywallMode: 'inline' });
    gate.hide();
    expect(isHidden(el.querySelectorAll('p')[3])).toBe(true);

    gate.reveal();
    Array.from(el.querySelectorAll('p')).forEach(p => expect(isHidden(p)).toBe(false));
  });

  it('teaserParagraphs: 0 hides all content', () => {
    const el = setArticle(['<p>p1</p>', '<p>p2</p>'].join(''));
    const gate = createGate({ selector: '#article', teaserParagraphs: 0, paywallMode: 'inline' });
    gate.hide();
    Array.from(el.querySelectorAll('p')).forEach(p => expect(isHidden(p)).toBe(true));
  });

  it('shows everything when the article has fewer paragraphs than the teaser threshold', () => {
    const el = setArticle(['<p>p1</p>', '<p>p2</p>'].join(''));
    const gate = createGate({ selector: '#article', teaserParagraphs: 4, paywallMode: 'inline' });
    gate.hide();
    Array.from(el.querySelectorAll('p')).forEach(p => expect(isHidden(p)).toBe(false));
  });
});
