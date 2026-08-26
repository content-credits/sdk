/**
 * Adversarial probes for `sanitizeHtml`.
 *
 * The sanitizer guards the server-side-teaser path: HTML fetched from a
 * publisher's own content endpoint is injected into their page. The publisher
 * origin already controls that page, so this is defence-in-depth rather than a
 * trust boundary — but a compromised or misconfigured content route must not
 * be able to escalate into script execution.
 *
 * These probes assert on the LIVE DOM, not on serialized HTML. That distinction
 * matters: handler-looking text inside an attribute *value* is inert, because
 * the sanitizer's output is inserted via appendChild of real nodes and never
 * re-parsed from a string. What must never exist is an element carrying an
 * attribute whose NAME is an event handler, or an element from a foreign
 * (SVG/MathML) namespace.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../src/ui/sanitize';

function render(html: string): HTMLElement {
  const div = document.createElement('div');
  div.appendChild(sanitizeHtml(html));
  return div;
}

const TAB = String.fromCharCode(9);

const PAYLOADS: [string, string][] = [
  ['svg foreignObject namespace confusion', '<svg><foreignObject><p onclick="x()">t</p></foreignObject></svg>'],
  ['svg anchor with javascript href', '<svg><a href="javascript:alert(1)"><text>go</text></a></svg>'],
  ['math annotation-xml mXSS', '<math><annotation-xml encoding="text/html"><p onclick="x()">t</p></annotation-xml></math>'],
  // Scripting is disabled in a DOMParser document, so <noscript> contents parse
  // as ordinary markup: the title attribute swallows the payload as text and no
  // <img> is ever created. Nothing executable reaches the DOM.
  ['noscript mXSS', '<noscript><p title="</noscript><img src=x onerror=alert(1)>">t</p></noscript>'],
  ['script nested in an unwrapped element', '<center><script>alert(1)</script></center>'],
  ['style with javascript url', '<p style="background:url(javascript:alert(1))">t</p>'],
  ['form action + formaction', '<form action="javascript:x()"><button formaction="javascript:y()">go</button></form>'],
  ['img srcset', '<img srcset="x.png 1x" src="https://ok.example/a.png">'],
  ['anchor with xlink:href', '<a xlink:href="javascript:alert(1)" href="javascript:alert(1)">t</a>'],
  ['base tag hijack', '<base href="https://evil.example/"><a href="/x">t</a>'],
  ['iframe srcdoc', '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
  ['object and embed data', '<object data="javascript:alert(1)"></object><embed src="javascript:alert(1)">'],
  ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.example">'],
  ['template escape', '<template><script>alert(1)</script></template>'],
  ['uppercase and spaced handlers', '<P ONCLICK ="alert(1)" oNmOuSeOvEr="x()">t</P>'],
  ['space-split scheme', '<a href="java script:alert(1)">t</a>'],
  ['tab-split scheme', '<a href="java' + TAB + 'script:alert(1)">t</a>'],
  ['DOM clobbering via name', '<img name="body" src="https://ok.example/a.png"><div name="cookie"></div>'],
  ['deep nesting', '<div>'.repeat(300) + 'deep' + '</div>'.repeat(300)],
];

const FORBIDDEN_TAGS = [
  'script', 'iframe', 'object', 'embed', 'svg', 'math', 'form',
  'base', 'meta', 'template', 'button', 'input', 'noscript', 'style',
];

describe('sanitizeHtml adversarial probes', () => {
  it.each(PAYLOADS)('neutralizes: %s', (_name, payload) => {
    const div = render(payload);

    for (const tag of FORBIDDEN_TAGS) {
      expect(div.querySelector(tag)).toBeNull();
    }

    for (const el of Array.from(div.querySelectorAll('*'))) {
      // Everything left is a plain HTML-namespace element — no foreign content,
      // which is where the classic mXSS parser confusions live.
      expect(el.namespaceURI).toBe('http://www.w3.org/1999/xhtml');

      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        // No live event handler, and no attribute that enables DOM clobbering
        // or a second URL channel.
        expect(name.startsWith('on')).toBe(false);
        expect(['name', 'srcset', 'srcdoc', 'formaction', 'xlink:href']).not.toContain(name);

        // No URL-bearing attribute may carry a non-http(s) scheme.
        if (['href', 'src', 'poster', 'cite'].includes(name)) {
          expect(attr.value).toMatch(/^(https?:|data:image\/)/);
        }
      }
    }
  });

  it('does not blow the stack on pathological nesting', () => {
    expect(() => render('<div>'.repeat(2000) + 'x' + '</div>'.repeat(2000))).not.toThrow();
  });

  it('is a fixed point when re-sanitized — no mutation XSS on a serialize/reparse round trip', () => {
    for (const [, payload] of PAYLOADS) {
      const once = render(payload).innerHTML;
      const twice = render(once).innerHTML;
      expect(twice).toBe(once);
    }
  });
});
