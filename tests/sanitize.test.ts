import { describe, it, expect } from 'vitest';
import { renderCommentContent, sanitizeUrl, safeText, el, sanitizeHtml } from '../src/ui/sanitize';

describe('sanitize.ts', () => {
  describe('renderCommentContent', () => {
    it('renders plain text as text nodes', () => {
      const fragment = renderCommentContent('Hello world');
      const div = document.createElement('div');
      div.appendChild(fragment);
      expect(div.textContent).toBe('Hello world');
      // No HTML tags should be present
      expect(div.innerHTML).toBe('Hello world');
    });

    it('converts newlines to <br> elements', () => {
      const fragment = renderCommentContent('Line 1\nLine 2\nLine 3');
      const div = document.createElement('div');
      div.appendChild(fragment);
      expect(div.querySelectorAll('br').length).toBe(2);
      expect(div.textContent).toBe('Line 1Line 2Line 3');
    });

    it('does NOT render HTML from user input', () => {
      const xssAttempt = '<script>alert(1)</script>';
      const fragment = renderCommentContent(xssAttempt);
      const div = document.createElement('div');
      div.appendChild(fragment);
      // Should be plain text, no script element
      expect(div.querySelector('script')).toBeNull();
      expect(div.textContent).toBe(xssAttempt);
    });

    it('handles angle brackets safely', () => {
      const fragment = renderCommentContent('a < b && c > d');
      const div = document.createElement('div');
      div.appendChild(fragment);
      expect(div.textContent).toBe('a < b && c > d');
    });
  });

  describe('sanitizeUrl', () => {
    it('allows https URLs', () => {
      expect(sanitizeUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
    });

    it('allows http URLs', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
    });

    it('rejects javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    });

    it('rejects data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<h1>xss</h1>')).toBeNull();
    });

    it('rejects invalid URLs', () => {
      expect(sanitizeUrl('not a url at all')).toBeNull();
    });
  });

  describe('el helper', () => {
    it('creates element with text content', () => {
      const div = el('div', 'hello');
      expect(div.tagName).toBe('DIV');
      expect(div.textContent).toBe('hello');
    });

    it('sets attributes', () => {
      const a = el('a', 'link', { href: 'https://example.com', target: '_blank' });
      expect(a.getAttribute('href')).toBe('https://example.com');
      expect(a.getAttribute('target')).toBe('_blank');
    });
  });

  describe('safeText', () => {
    it('creates a text node', () => {
      const t = safeText('<b>bold</b>');
      expect(t.nodeType).toBe(Node.TEXT_NODE);
      expect(t.textContent).toBe('<b>bold</b>');
    });
  });
  describe('sanitizeHtml', () => {
    function render(html: string): HTMLElement {
      const div = document.createElement('div');
      div.appendChild(sanitizeHtml(html));
      return div;
    }

    it('keeps ordinary article markup', () => {
      const div = render('<p>Hello</p><h2 id="s1" class="lead">Section</h2><ul><li>One</li></ul>');
      expect(div.querySelectorAll('p').length).toBe(1);
      expect(div.querySelector('h2')?.getAttribute('id')).toBe('s1');
      expect(div.querySelector('h2')?.getAttribute('class')).toBe('lead');
      expect(div.querySelector('li')?.textContent).toBe('One');
    });

    it('keeps tables and their layout attributes', () => {
      const div = render('<table><tbody><tr><td colspan="2">Cell</td></tr></tbody></table>');
      expect(div.querySelector('td')?.getAttribute('colspan')).toBe('2');
      expect(div.querySelector('td')?.textContent).toBe('Cell');
    });

    it('drops scripts entirely, source and all', () => {
      const div = render('<p>Before</p><script>window.__pwned = true;</script><p>After</p>');
      expect(div.querySelector('script')).toBeNull();
      expect(div.textContent).toBe('BeforeAfter');
    });

    it('drops style, iframe, object and form subtrees', () => {
      const div = render(
        '<style>body{display:none}</style><iframe src="https://evil.example"></iframe>' +
        '<object data="x.swf"></object><form><input name="pw"></form><p>Kept</p>'
      );
      expect(div.querySelector('style')).toBeNull();
      expect(div.querySelector('iframe')).toBeNull();
      expect(div.querySelector('object')).toBeNull();
      expect(div.querySelector('form')).toBeNull();
      expect(div.querySelector('input')).toBeNull();
      expect(div.textContent).toBe('Kept');
    });

    it('strips every event-handler attribute', () => {
      const div = render('<p onclick="steal()" onmouseover="x()">Body</p>');
      const p = div.querySelector('p')!;
      expect(p.hasAttribute('onclick')).toBe(false);
      expect(p.hasAttribute('onmouseover')).toBe(false);
      expect(p.textContent).toBe('Body');
    });

    it('rejects javascript: and data: URLs on links and images', () => {
      const div = render(
        '<a href="javascript:alert(1)">bad</a>' +
        '<img src="data:text/html,<h1>x</h1>" alt="bad">'
      );
      expect(div.querySelector('a')?.hasAttribute('href')).toBe(false);
      expect(div.querySelector('img')?.hasAttribute('src')).toBe(false);
      // The elements survive — only the dangerous attribute is dropped.
      expect(div.querySelector('a')?.textContent).toBe('bad');
    });

    it('resolves relative resource URLs instead of dropping them', () => {
      const div = render('<img src="/wp-content/uploads/pic.png" alt="pic">');
      const src = div.querySelector('img')?.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src).toContain('/wp-content/uploads/pic.png');
      expect(src?.startsWith('http')).toBe(true);
    });

    it('allows inline base64 raster images but not svg data URIs', () => {
      const png = 'data:image/png;base64,iVBORw0KGgo=';
      const svg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
      expect(render(`<img src="${png}">`).querySelector('img')?.getAttribute('src')).toBe(png);
      expect(render(`<img src="${svg}">`).querySelector('img')?.hasAttribute('src')).toBe(false);
    });

    it('unwraps unknown elements but keeps their text', () => {
      const div = render('<custom-widget data-x="1"><p>Inner</p></custom-widget>');
      expect(div.querySelector('custom-widget')).toBeNull();
      expect(div.querySelector('p')?.textContent).toBe('Inner');
    });

    it('keeps safe inline styles and rejects executable ones', () => {
      expect(render('<p style="text-align:center">x</p>').querySelector('p')?.getAttribute('style'))
        .toBe('text-align:center');
      expect(render('<p style="width:expression(alert(1))">x</p>').querySelector('p')?.hasAttribute('style'))
        .toBe(false);
      expect(render('<p style="background:url(https://evil.example/track.png)">x</p>').querySelector('p')?.hasAttribute('style'))
        .toBe(false);
    });

    it('forces rel=noopener on links that open a new tab', () => {
      const a = render('<a href="https://example.com" target="_blank">go</a>').querySelector('a')!;
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('drops comments and returns an empty fragment for empty input', () => {
      expect(render('<!-- secret --><p>Body</p>').innerHTML).toBe('<p>Body</p>');
      expect(sanitizeHtml('').childNodes.length).toBe(0);
    });

    it('keeps aria attributes for accessibility', () => {
      const div = render('<p aria-label="summary" role="note">x</p>');
      expect(div.querySelector('p')?.getAttribute('aria-label')).toBe('summary');
      expect(div.querySelector('p')?.getAttribute('role')).toBe('note');
    });
  });
});
