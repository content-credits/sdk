# @contentcredits/sdk

[![npm version](https://img.shields.io/npm/v/@contentcredits/sdk)](https://www.npmjs.com/package/@contentcredits/sdk)
[![license](https://img.shields.io/badge/license-Apache%202.0-blue)](https://github.com/contentcredits/sdk/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

Drop-in paywall and threaded comment system for any website. Add credit-based article monetisation in under 5 minutes — no backend changes required.

**[Full documentation →](https://docs.contentcredits.com)**

---

## What it does

- **Paywall** — hides premium content behind a credit gate using a CSS selector. Reveals it instantly when the reader pays. No server-side content splitting needed.
- **Customisable top slot** — inject your own content (React widget, donation banner, structured items) above the SDK's unlock button.
- **Comments** — threaded comment panel with likes, edit, delete, and sorting. Rendered in a Shadow DOM so it never conflicts with your CSS.
- **Auth** — popup-based login on desktop, redirect flow on mobile. Tokens stored in memory (never cookies).
- **Extension support** — detects the Content Credits Chrome extension for a one-click experience, with automatic fallback if the extension service worker is unresponsive.

---

## Installation

```bash
npm install @contentcredits/sdk
```

Or via CDN (no build step):

```html
<script src="https://cdn.jsdelivr.net/npm/@contentcredits/sdk@2.12.0/dist/content-credits.umd.min.js"></script>
```

---

## Quick start

### Script tag (CDN)

```html
<!-- Wrap your premium content -->
<div id="premium-content">
  <p>This content is only visible after the reader pays.</p>
</div>

<!-- Load and initialise the SDK -->
<script src="https://cdn.jsdelivr.net/npm/@contentcredits/sdk@2.12.0/dist/content-credits.umd.min.js"></script>
<script>
  ContentCreditsSDK.ContentCredits.init({
    apiKey: 'pub_YOUR_API_KEY',
    contentSelector: '#premium-content',
    teaserParagraphs: 2,
    enableComments: true,
  });
</script>
```

### Auto-init (zero JavaScript)

```html
<script
  src="https://cdn.jsdelivr.net/npm/@contentcredits/sdk@2.12.0/dist/content-credits.umd.min.js"
  data-api-key="pub_YOUR_API_KEY"
  data-content-selector="#premium-content"
  data-teaser-paragraphs="2"
></script>
```

### npm / ES module

```ts
import { ContentCredits } from '@contentcredits/sdk';

const cc = ContentCredits.init({
  apiKey: 'pub_YOUR_API_KEY',
  contentSelector: '#premium-content',
  teaserParagraphs: 2,
  enableComments: true,
});

cc.on('paywall:hidden', () => {
  console.log('Article unlocked!');
});
```

---

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | **required** | Your publisher API key from the dashboard |
| `contentSelector` | `string` | `'.cc-premium-content'` | CSS selector for the gated element |
| `teaserParagraphs` | `number` | `2` | Paragraphs to show before the paywall |
| `contentEndpoint` | `string` | — | **Opt-in.** Absolute URL of your own endpoint serving the full article to entitled readers — see [Server-side teaser](#server-side-teaser) |
| `enableComments` | `boolean` | `true` | Show the comment widget |
| `articleUrl` | `string` | `location.href` | Canonical URL of the article |
| `paywallMode` | `'overlay' \| 'inline'` | `'overlay'` | Paywall layout — overlay sits directly below the teaser; inline is the legacy flow-based panel |
| `paywallTopSlot` | see below | — | Content rendered above the SDK's unlock button — accepts a React element, structured items, `HTMLElement`, or factory function |
| `reactDOM` | `ReactDOMAdapter` | — | Your `ReactDOM` instance — required when `paywallTopSlot` is a React element |
| `theme.primaryColor` | `string` | `'#44C678'` | Brand colour for buttons |
| `theme.fontFamily` | `string` | system UI | Font for all SDK UI |
| `enableBeacon` | `boolean` | `true` | Send the post-discovery / view beacon on page load (`data-cc-enable-beacon="false"` to disable) |
| `analyticsConsent` | `'granted' \| 'denied' \| 'unknown'` | `'unknown'` | Your reader-consent state for analytics identifiers (`data-cc-analytics-consent`). When `'denied'` the SDK never creates, reads or sends its anonymous `anonId` on the view beacon or the offer-exposure event |
| `headless` | `boolean` | `false` | Disable all built-in DOM/UI — manage everything yourself via state and callbacks |
| `onAccessGranted` | `() => void` | — | Fires when content is unlocked |
| `debug` | `boolean` | `false` | Verbose console logging |

---

## Server-side teaser

By default the SDK assumes the whole article is already in the page and hides
everything past the teaser. That is client-side gating: the paid content is in
the HTML, so it is readable in view-source, in the REST/RSS output, and to any
scraper.

Set `contentEndpoint` and the model flips — your server ships **only the
teaser**, and the SDK fetches the rest once the reader is entitled:

```ts
ContentCredits.init({
  apiKey: 'pub_YOUR_API_KEY',
  contentSelector: '#premium-content',
  contentEndpoint: 'https://example.com/wp-json/content-credits/v1/posts/42/content',
});
```

Or, for script-tag installs, as a data attribute:

```html
<script src="https://cdn.jsdelivr.net/npm/@contentcredits/sdk@3"
        data-cc-api-key="pub_YOUR_API_KEY"
        data-cc-content-selector="#premium-content"
        data-cc-content-endpoint="https://example.com/wp-json/content-credits/v1/posts/42/content"></script>
```

### What your endpoint must implement

The SDK uses the URL exactly as supplied — it never appends a path — and sends
the reader's Content Credits token:

```
GET <your contentEndpoint>
Authorization: Bearer <reader Content Credits JWT>
```

| Status | Body | Meaning |
|--------|------|---------|
| `200` | `{ "success": true, "content": "<full post HTML>" }` | Reader is entitled — serve the article |
| `401` | `{ "success": false, "code": "UNAUTHENTICATED" }` | Token missing or invalid |
| `403` | `{ "success": false, "code": "NO_ACCESS" }` | Valid reader, no entitlement to this post |
| `503` | `{ "success": false, "code": "UPSTREAM_UNAVAILABLE" }` | Verification temporarily unavailable |

Your endpoint is the security boundary: it must verify the token itself and
never return content to a reader who hasn't unlocked the article.

### Behaviour

- The returned HTML is **sanitized** (allowlist of article elements and
  attributes; scripts, event handlers, iframes, forms and non-`http(s)` URLs
  are stripped) before it replaces the contents of `contentSelector`.
- Reveal happens **after** injection, so the reader never sees a flash of
  half-populated content.
- If the fetch fails, a reader who has already spent credits is shown an
  explicit failure with a **Try again** action — never a silent teaser and
  never the unlock panel again. `paywall:hidden`, `article:purchased` and
  `onAccessGranted` are held back until the article is genuinely on the page.
- A 401 from *your* endpoint does not sign the reader out of Content Credits.
- Ignored in `headless` mode — your app owns the DOM.
- Leave `contentEndpoint` unset and nothing changes: the SDK behaves exactly as
  it always has.

---

## Paywall top slot

The `paywallTopSlot` lets you inject custom content — a donation widget, promo banner, or anything else — above the SDK's own unlock button. The slot sits inside the SDK's Shadow DOM so your styles are isolated from the host page.

### React widget (recommended for React apps)

Pass your ReactDOM instance alongside the JSX element. Works with React 18 (`createRoot`) and React 16/17 (`render`).

```tsx
import ReactDOM from 'react-dom/client'; // React 18
import { ContentCredits } from '@contentcredits/sdk';
import { DonationWidget } from './DonationWidget';

ContentCredits.init({
  apiKey: 'pub_YOUR_API_KEY',
  reactDOM,
  paywallTopSlot: <DonationWidget />,
});
```

### Structured items

The SDK renders and styles these consistently inside its Shadow DOM:

```ts
ContentCredits.init({
  apiKey: 'pub_YOUR_API_KEY',
  paywallTopSlot: [
    { type: 'heading',  content: 'Donate to access this story.' },
    { type: 'text',     content: 'Donate now for unlimited stories. Cancel anytime.' },
    { type: 'button',   content: 'See Donation Options', variant: 'primary', onClick: () => openDonateFlow() },
  ],
});
```

Available item types:

| `type` | Description | Extra props |
|--------|-------------|-------------|
| `heading` | Large bold heading | `content` |
| `subheading` | Medium bold text | `content` |
| `text` | Body copy | `content` |
| `button` | Styled button | `content`, `variant` (`primary` \| `secondary` \| `outline`), `onClick` |
| `divider` | Horizontal rule with optional label | `content` |

### HTMLElement

```ts
const banner = document.createElement('div');
banner.innerHTML = '<strong>Support independent journalism</strong>';

ContentCredits.init({
  apiKey: 'pub_YOUR_API_KEY',
  paywallTopSlot: banner,
});
```

### Factory function

Full control — receives the slot container element and mounts whatever you need:

```ts
ContentCredits.init({
  apiKey: 'pub_YOUR_API_KEY',
  paywallTopSlot: (container) => {
    // vanilla JS, Vue, Svelte — anything goes
    container.innerHTML = `<p>Support us to keep reading.</p>`;
  },
});
```

---

## Events

```ts
cc.on('ready',               ({ state }) => { });
cc.on('auth:login',          ({ user }) => { });
cc.on('auth:logout',         () => { });
cc.on('paywall:shown',       () => { });
cc.on('paywall:hidden',      () => { });
cc.on('article:purchased',   ({ creditsSpent, remainingBalance }) => { });
cc.on('credits:insufficient',({ required, available }) => { });
cc.on('comment:posted',      ({ comment }) => { });
cc.on('comment:liked',       ({ commentId, hasLiked }) => { });
cc.on('comment:deleted',     ({ commentId }) => { });
cc.on('error',               ({ message, error }) => { });
```

All events are also dispatched as native `CustomEvent`s on `document` with the prefix `contentcredits:` — useful for Google Tag Manager and analytics integrations.

---

## API

```ts
const cc = ContentCredits.init(config);

cc.on(event, handler)    // subscribe — returns unsubscribe fn
cc.off(event, handler)   // unsubscribe
cc.subscribe(fn)         // reactive state changes — returns unsubscribe fn
cc.getState()            // → SDKState snapshot
cc.checkAccess()         // trigger access check manually
cc.login()               // open login flow programmatically
cc.purchase()            // trigger article purchase
cc.buyMoreCredits()      // open dashboard to top up balance
cc.openComments()        // open comment panel
cc.closeComments()       // close comment panel
cc.isLoggedIn()          // → boolean
cc.getToken()            // → access token string | null
cc.logout()              // revoke session and clear local auth state
cc.destroy()             // tear down SDK, restore hidden content

ContentCredits.version   // → "2.12.0"
```

---

## React / Next.js

### Default UI with a React top slot

The simplest integration — the SDK handles all paywall rendering; you only supply the top section:

```tsx
'use client';

import { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ContentCredits } from '@contentcredits/sdk';
import { DonationWidget } from './DonationWidget';

export function PremiumGate({ apiKey }: { apiKey: string }) {
  useEffect(() => {
    const cc = ContentCredits.init({
      apiKey,
      contentSelector: '#premium-content',
      reactDOM,
      paywallTopSlot: <DonationWidget />,
    });
    return () => cc.destroy();
  }, [apiKey]);

  return <div id="premium-content">{/* article content */}</div>;
}
```

### Headless mode (full custom UI)

Use `headless: true` when you want to build the entire paywall UI yourself in React. The SDK manages auth and access checks but renders no DOM of its own.

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ContentCredits } from '@contentcredits/sdk';
import type { SDKState } from '@contentcredits/sdk';

export function PremiumGate({ apiKey, children }: { apiKey: string; children: React.ReactNode }) {
  const ccRef = useRef<ContentCredits | null>(null);
  const [state, setState] = useState<SDKState | null>(null);

  useEffect(() => {
    const cc = ContentCredits.init({
      apiKey,
      headless: true,
      onStateChange: setState,
    });
    ccRef.current = cc;
    return () => cc.destroy();
  }, [apiKey]);

  if (state?.hasAccess) return <>{children}</>;

  return (
    <div>
      {/* your teaser content */}
      <button onClick={() => ccRef.current?.purchase()}>Unlock article</button>
    </div>
  );
}
```

See [`examples/nextjs-blog`](./examples/nextjs-blog) for a full working Next.js 14 (App Router) implementation.

---

## Requirements

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Your domain must be registered as a publisher at [app.contentcredits.com](https://app.contentcredits.com)
- HTTPS required in production

---

## Examples

| Example | Description |
|---------|-------------|
| [`examples/nextjs-blog`](./examples/nextjs-blog) | Next.js 14 (App Router) blog with free and premium articles — the fastest way to see the SDK in a real project |

---

## Links

- [Full documentation](https://docs.contentcredits.com)
- [Quick start guide](https://docs.contentcredits.com/getting-started/quick-start)
- [API reference](https://docs.contentcredits.com/api-reference/contentcredits-class)
- [Publisher dashboard](https://app.contentcredits.com)
- [Content Credits website](https://contentcredits.com)
