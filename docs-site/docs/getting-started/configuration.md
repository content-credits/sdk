---
id: configuration
title: Configuration
sidebar_position: 3
---

# Configuration

All configuration is passed to `ContentCredits.init()` as a plain JavaScript object.

```ts
ContentCredits.init({
  // Required
  apiKey: 'pub_YOUR_API_KEY',

  // Core options
  contentSelector: '#premium-content',
  teaserParagraphs: 2,
  enableComments: true,
  articleUrl: window.location.href,
  theme: {
    primaryColor: '#44C678',
    fontFamily: 'Georgia, serif',
  },
  debug: false,

  // Headless mode (no built-in UI)
  headless: false,

  // Callbacks
  onAccessGranted: () => { },
  onStateChange: (state) => { },
  onLoginRequired: () => { },
  onPurchaseRequired: ({ requiredCredits, creditBalance }) => { },
  onInsufficientCredits: ({ required, available }) => { },
  onPurchased: ({ creditsSpent, remainingBalance }) => { },
  onUserLogin: (user) => { },
  onUserLogout: () => { },
  onError: ({ message }) => { },
  onReady: (state) => { },
});
```

---

## Core options

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | **Required.** Publisher API key (`pub_...`) |
| `contentSelector` | `string` | `'.cc-premium-content'` | CSS selector for the element to gate |
| `teaserParagraphs` | `number` | `2` | Visible paragraphs before the paywall |
| `enableComments` | `boolean` | `true` | Show the comment widget |
| `articleUrl` | `string` | `window.location.href` | Canonical URL for the article |
| `theme.primaryColor` | `string` | `'#44C678'` | Brand colour for buttons and accents |
| `theme.fontFamily` | `string` | System UI | Font for all SDK text |
| `paywallTemplate` | `string` | — | Custom HTML for the paywall overlay |
| `extensionId` | `string` | Built-in ID | Override the Chrome extension ID |
| `debug` | `boolean` | `false` | Verbose console logging |

---

## Headless mode

Set `headless: true` to disable **all** built-in DOM manipulation and UI rendering. The SDK becomes a pure logic layer — it runs the access check, manages auth, and fires callbacks, but never hides content or injects UI.

```js
ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  headless: true,
  onLoginRequired() { /* show your login UI */ },
  onPurchaseRequired({ requiredCredits }) { /* show your unlock UI */ },
  onAccessGranted() { /* reveal your content */ },
});
```

See the [Headless mode guide](/integration-guides/react#headless-mode--fully-custom-ui) for complete examples.

---

## Callbacks

Callbacks fire in both default and headless mode. In headless mode they are your only UI triggers — the built-in overlay never appears.

| Callback | Fires when |
|---|---|
| `onAccessGranted()` | Access confirmed (existing or just purchased) |
| `onStateChange(state)` | Any state field changes — use for reactive UI |
| `onReady(state)` | First access check complete |
| `onLoginRequired()` | Paywall hit, user not logged in |
| `onPurchaseRequired({ requiredCredits, creditBalance })` | Logged in, article not purchased |
| `onInsufficientCredits({ required, available })` | Balance too low |
| `onPurchased({ creditsSpent, remainingBalance })` | Purchase succeeded |
| `onUserLogin(user)` | User authenticated |
| `onUserLogout()` | Session ended |
| `onError({ message, error? })` | Any SDK error |

:::tip Events vs callbacks
Callbacks in the config object and events via `cc.on(...)` cover the same moments. Use whichever fits your code style — they work identically. The full event list is in the [Events reference](/api-reference/events).
:::

---

## Data attribute equivalents (CDN auto-init)

When using the CDN `<script>` tag, core options can be set as `data-*` attributes:

| JS option | `data-*` attribute |
|---|---|
| `apiKey` | `data-api-key` |
| `contentSelector` | `data-content-selector` |
| `teaserParagraphs` | `data-teaser-paragraphs` |
| `enableComments` | `data-enable-comments` |
| `debug` | `data-debug` |

```html
<script
  src="https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js"
  data-api-key="pub_YOUR_KEY"
  data-content-selector="#premium-content"
  data-teaser-paragraphs="3"
  data-enable-comments="true"
></script>
```

:::note
`theme`, `articleUrl`, `extensionId`, `paywallTemplate`, `headless`, and all callback options are JavaScript-only — they have no `data-*` equivalent.
:::

---

## Full option reference

For detailed descriptions of every option including types, defaults, and edge cases, see the [Configuration Reference](/api-reference/configuration).
