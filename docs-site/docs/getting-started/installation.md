---
id: installation
title: Installation
sidebar_position: 1
---

# Installation

The Content Credits SDK ships in three formats. Pick the one that matches your setup.

---

## Option 1 — CDN (recommended for most publishers)

No build step required. Add one `<script>` tag to your page and you're done.

```html
<script
  src="https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js"
  crossorigin="anonymous"
></script>
```

The SDK is available globally as `window.ContentCreditsSDK.ContentCredits` after the script loads.

### Auto-init via data attributes

If you add `data-api-key` directly on the script tag, the SDK **initialises automatically** — no additional JavaScript needed:

```html
<script
  src="https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js"
  data-api-key="pub_YOUR_API_KEY"
  data-content-selector="#premium-content"
  data-teaser-paragraphs="2"
  data-enable-comments="true"
></script>
```

All `data-*` attributes map directly to SDK configuration options. See the [Configuration reference](/getting-started/configuration) for the full list.

---

## Option 2 — npm

Install the package for use in React, Next.js, Vue, or any bundled project:

```bash
npm install @contentcredits/sdk
```

Then import and initialise:

```ts
import { ContentCredits } from '@contentcredits/sdk';

const cc = ContentCredits.init({
  apiKey: 'pub_YOUR_API_KEY',
  contentSelector: '#premium-content',
});
```

The package ships with full TypeScript declarations (`.d.ts` files).

---

## Option 3 — WordPress plugin

If you're using WordPress, the dedicated plugin handles everything without any custom code. See the [WordPress integration guide](/integration-guides/wordpress).

---

## Requirements

| Requirement | Detail |
|-------------|--------|
| Browser support | All modern browsers (Chrome, Firefox, Safari, Edge) |
| IE 11 | Not supported |
| Backend | Calls `api.contentcredits.com` — your domain must be registered as a publisher |
| HTTPS | Required in production (the auth popup uses `postMessage` across origins) |

---

## Verify the install

After adding the script tag, open your browser console and run:

```js
ContentCreditsSDK.ContentCredits.version
// → "2.0.0"
```

If you see a version number, the SDK loaded correctly.

:::tip Domain registration
Your domain must be registered as a publisher in the [Content Credits dashboard](https://accounts.contentcredits.com) before API calls will work. The API rejects requests from unregistered domains.
:::
