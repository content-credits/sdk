# @contentcredits/sdk

[![npm version](https://img.shields.io/npm/v/@contentcredits/sdk)](https://www.npmjs.com/package/@contentcredits/sdk)
[![license](https://img.shields.io/badge/license-Apache%202.0-blue)](https://github.com/contentcredits/sdk/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

Drop-in paywall and threaded comment system for any website. Add credit-based article monetisation in under 5 minutes — no backend changes required.

**[Full documentation →](https://docs.contentcredits.com)**

---

## What it does

- **Paywall** — hides premium content behind a credit gate using a CSS selector. Reveals it instantly when the reader pays. No server-side content splitting needed.
- **Comments** — threaded comment panel with likes, edit, delete, and sorting. Rendered in a Shadow DOM so it never conflicts with your CSS.
- **Auth** — popup-based login on desktop, redirect flow on mobile. Tokens stored in memory (never cookies).
- **Extension support** — detects the Content Credits Chrome extension for a one-click experience.

---

## Installation

```bash
npm install @contentcredits/sdk
```

Or via CDN (no build step):

```html
<script src="https://cdn.jsdelivr.net/npm/@contentcredits/sdk@2.0.0/dist/content-credits.umd.min.js"></script>
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
<script src="https://cdn.jsdelivr.net/npm/@contentcredits/sdk@2.0.0/dist/content-credits.umd.min.js"></script>
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
  src="https://cdn.jsdelivr.net/npm/@contentcredits/sdk@2.0.0/dist/content-credits.umd.min.js"
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
| `enableComments` | `boolean` | `true` | Show the comment widget |
| `articleUrl` | `string` | `location.href` | Canonical URL of the article |
| `theme.primaryColor` | `string` | `'#44C678'` | Brand colour for buttons |
| `theme.fontFamily` | `string` | system UI | Font for all SDK UI |
| `onAccessGranted` | `() => void` | — | Fires when content is unlocked |
| `debug` | `boolean` | `false` | Verbose console logging |

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
cc.getState()            // → SDKState snapshot
cc.checkAccess()         // trigger access check manually
cc.openComments()        // open comment panel
cc.closeComments()       // close comment panel
cc.isLoggedIn()          // → boolean
cc.destroy()             // tear down SDK, restore hidden content

ContentCredits.version   // → "2.0.0"
```

---

## React / Next.js

```tsx
'use client'; // Next.js App Router

import { useEffect } from 'react';
import { ContentCredits } from '@contentcredits/sdk';

export function PremiumGate({ apiKey, children }) {
  useEffect(() => {
    const cc = ContentCredits.init({
      apiKey,
      contentSelector: '#premium-content',
    });
    return () => cc.destroy();
  }, [apiKey]);

  return <div id="premium-content">{children}</div>;
}
```

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
