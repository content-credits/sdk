import { describe, it, expect } from 'vitest';
import { renderCommentContent, sanitizeUrl, safeText, el } from '../src/ui/sanitize';

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
});
