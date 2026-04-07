---
id: paywall
title: Paywall & Content Gating
sidebar_position: 1
---

# Paywall & Content Gating

The paywall is the core feature of the Content Credits SDK. It hides premium content until the reader pays the article's credit price, then reveals it instantly without a page reload.

---

## How it works

The SDK uses **CSS-selector-based client-side gating**:

1. On initialisation, the SDK synchronously hides the element matching your `contentSelector`
2. The first N paragraphs stay visible (`teaserParagraphs`) — a gradient fade covers the cut-off
3. An **inline paywall panel** is inserted directly below the teaser in the page flow
4. The panel shows one of several states depending on the reader's access level
5. When the reader pays, the panel is removed and the full content is revealed

```
Article page loads
      │
      ▼
SDK hides #premium-content immediately (synchronous — no flash)
      │
      ▼
SDK checks access (extension first, then API)
      │
 ┌────┴─────────────────────────────────────┐
 │                                          │
 ▼                                          ▼
Access granted                         No access
Content revealed                    Inline paywall panel shown
Panel removed                       below teaser content
```

---

## Paywall design

The paywall renders as an **inline panel** directly below the teaser — not a modal dialog or full-page overlay. This keeps the reader in context and makes the paywall feel like a natural part of the page.

```
┌──────────────────────────────────────────────────┐
│ Article Title                                    │
│                                                  │
│ First paragraph — always visible                 │
│                                                  │
│ Second paragraph — always visible                │
│                                                  │
│                                    ▓▓▓▓▓▓▓▓▓▓▓▓ │ ← gradient fade
├──────────────────────────────────────────────────┤ ← coloured top border
│                                                  │
│         Unlock this article                      │
│         ┌──────────────────────────┐             │
│         │  Buy for 2 Credits       │             │
│         └──────────────────────────┘             │
│                                                  │
│              Powered by Content Credits          │
└──────────────────────────────────────────────────┘
```

The top border uses your `theme.primaryColor`. All paywall HTML lives inside a **Shadow DOM** so your page's CSS cannot interfere with it.

---

## Flash prevention

By default, the SDK hides content **synchronously as the first thing it does**, before any async network calls (token refresh, access check). Readers with access still get a brief hide/reveal cycle, but there is no flash of the full article for paywalled content.

### Next.js / SSR — zero-flash approach

For server-rendered pages, add a `<style>` tag that hides content at HTML parse time — before any JavaScript runs at all:

```tsx
// components/PremiumGate.tsx
'use client';
import { useEffect, useRef } from 'react';

const GATE_STYLE_ID = 'cc-premium-gate-style';

export function PremiumGate({ apiKey, children, teaserParagraphs = 2 }) {
  const ccRef = useRef(null);

  useEffect(() => {
    import('@contentcredits/sdk').then(({ ContentCredits }) => {
      ccRef.current = ContentCredits.init({
        apiKey,
        contentSelector: '#premium-content',
        teaserParagraphs,
        onAccessGranted: () => {
          // Remove the SSR hide-style once access is confirmed
          document.getElementById(GATE_STYLE_ID)?.remove();
        },
      });
    });
    return () => { ccRef.current?.destroy(); };
  }, [apiKey, teaserParagraphs]);

  return (
    <>
      {/* Hides content at HTML parse time — before JS loads */}
      <style id={GATE_STYLE_ID}>{`
        #premium-content > *:nth-child(n+${teaserParagraphs + 1}) { display: none !important; }
      `}</style>
      <div id="premium-content" style={{ '--cc-bg': '#fff' }}>
        {children}
      </div>
    </>
  );
}
```

The `--cc-bg` CSS variable controls what colour the gradient fades to. Set it to match your article background.

---

## Overlay states

| State | What the reader sees |
|-------|---------------------|
| **Login** | "Sign in" button — reader not authenticated |
| **Purchase** | "Unlock for X credits" button — reader authenticated, hasn't bought |
| **Insufficient credits** | "Top up credits" message — reader is logged in but balance is too low |
| **Granted** | Panel removed, full content revealed |
| **Loading** | Spinner while a purchase is being processed |

> The `checking` spinner state was removed in v2.1.0. Content is hidden synchronously so there is nothing visible to indicate a check is in progress — the paywall panel only appears once the SDK knows access has been denied.

---

## The teaser

The `teaserParagraphs` option controls how many block elements inside your gated element are shown as a preview. The SDK counts `<p>`, `<h2>`–`<h4>`, `<blockquote>`, `<ul>`, and `<ol>` elements.

```js
teaserParagraphs: 0   // hide the entire element immediately
teaserParagraphs: 2   // show 2 paragraphs (default)
teaserParagraphs: 4   // show 4 paragraphs
```

A gradient fade is automatically added to the bottom of the teaser so the cutoff looks intentional.

---

## The Chrome extension path

The SDK first checks if the reader has the **Content Credits Chrome extension** installed. If they do, the extension handles the access check and payment natively — providing a faster, smoother experience with a single click.

If the extension is not installed, the SDK falls back to the standard API flow (popup login + API-based purchase).

---

## Authentication flow

### Desktop
When a reader clicks "Sign in", the SDK opens a **popup window** pointing to `accounts.contentcredits.com`. After the reader logs in, the popup sends the auth token back to the parent page via `postMessage` and then closes automatically.

### Mobile
Popups don't work reliably on mobile browsers. On mobile, the SDK performs a **redirect** instead:
1. Redirects the reader to the login page
2. After login, the auth server redirects back to the article URL with a token in the query string
3. The SDK reads the token, removes it from the URL (via `history.replaceState`), and stores it in memory

---

## Credit purchase flow

Once authenticated, if the reader doesn't yet have access:

1. The inline panel shows the credit price for the article
2. Reader clicks "Unlock" → SDK calls the purchase API
3. Credits are deducted from reader's balance
4. Content is immediately revealed (no page reload)
5. `onAccessGranted` callback fires + `paywall:hidden` event emitted

If the reader doesn't have enough credits, the panel shows a "Top up" button that takes them to the credits purchase page.

---

## Markup requirements

The gated content must be **already present in the DOM** when the SDK initialises. Server-side rendered HTML and most CMS platforms work out of the box.

```html
<!-- ✅ Correct — content is in the DOM -->
<div id="premium-content">
  <p>Premium paragraph 1</p>
  <p>Premium paragraph 2</p>
</div>

<!-- ❌ Wrong — SDK can't gate content loaded asynchronously after init -->
```

If your content loads asynchronously, call `ContentCredits.init()` after the content is in the DOM.

---

## Headless mode — no built-in UI

If you want complete control over the paywall UI — your own design, your own show/hide logic, your own paragraph clamping — set `headless: true`. The SDK will:

- **Not** hide or reveal any DOM elements
- **Not** inject the paywall overlay or gradient fade
- **Call your callbacks** at each state transition instead

```js
const cc = ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  headless: true,

  onLoginRequired() {
    showMyLoginUI();
  },
  onPurchaseRequired({ requiredCredits }) {
    showMyUnlockUI(requiredCredits);
  },
  onAccessGranted() {
    document.getElementById('premium-content').style.display = 'block';
    document.getElementById('paywall').style.display = 'none';
  },
});

document.getElementById('btn-login').onclick    = () => cc.login();
document.getElementById('btn-purchase').onclick = () => cc.purchase();
```

See the [Headless mode guide](/integration-guides/react#headless-mode--fully-custom-ui) for complete examples including vanilla JS, React, and Next.js.

---

## Background colour customisation

The gradient fade that covers the teaser cutoff defaults to fading to white (`#fff`). If your article has a different background colour, set the `--cc-bg` CSS variable on the content element:

```html
<div id="premium-content" style="--cc-bg: #f9fafb;">
  ...
</div>
```

```css
/* or in your stylesheet */
#premium-content {
  --cc-bg: #1a1a2e; /* dark background */
}
```
