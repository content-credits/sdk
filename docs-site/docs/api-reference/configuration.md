---
id: configuration
title: Configuration Reference
sidebar_position: 2
---

# Configuration Reference

Full reference for the `SDKConfig` object passed to `ContentCredits.init()`.

```ts
interface SDKConfig {
  // ── Required ──────────────────────────────────────────────────────────────
  apiKey: string;

  // ── Core options ──────────────────────────────────────────────────────────
  articleUrl?: string;
  contentSelector?: string;
  teaserParagraphs?: number;
  enableComments?: boolean;
  extensionId?: string;
  theme?: SDKTheme;
  paywallTemplate?: string;
  debug?: boolean;

  // ── Headless mode ─────────────────────────────────────────────────────────
  headless?: boolean;

  // ── Callbacks ─────────────────────────────────────────────────────────────
  onAccessGranted?: () => void;
  onStateChange?: (state: SDKState) => void;
  onReady?: (state: SDKState) => void;
  onLoginRequired?: () => void;
  onPurchaseRequired?: (info: { requiredCredits: number | null; creditBalance: number | null }) => void;
  onInsufficientCredits?: (info: { required: number; available: number }) => void;
  onPurchased?: (info: { creditsSpent: number; remainingBalance: number }) => void;
  onUserLogin?: (user: User) => void;
  onUserLogout?: () => void;
  onError?: (info: { message: string; error?: unknown }) => void;
}
```

---

## Required

### `apiKey` · `string`

Your publisher API key. Get it from [accounts.contentcredits.com](https://accounts.contentcredits.com) → Settings → API Keys.

```ts
apiKey: 'pub_abc123def456ghi789'
```

Must be non-empty. Throws `Error` if missing or blank.

---

## Core options

### `articleUrl` · `string`

Default: `window.location.href`

The canonical URL used to identify the article in the Content Credits system. Override this if your canonical URL differs from the browser's current URL.

```ts
articleUrl: 'https://yoursite.com/articles/my-article-slug'
```

---

### `contentSelector` · `string`

Default: `'.cc-premium-content'`

CSS selector for the element(s) to gate. All matching elements are hidden until the reader pays.

```ts
contentSelector: '#premium-content'
contentSelector: '.paywalled'
contentSelector: 'article > section:last-of-type'
```

Not used in `headless: true` mode — you control content visibility yourself.

---

### `teaserParagraphs` · `number`

Default: `2`

Number of `<p>` elements inside the gated element to remain visible as a preview.

```ts
teaserParagraphs: 0   // hide everything immediately
teaserParagraphs: 3   // show 3 paragraphs before the overlay
```

Not used in `headless: true` mode.

---

### `enableComments` · `boolean`

Default: `true`

Whether to show the floating comment widget and panel. Set to `false` to disable the comment system entirely.

```ts
enableComments: false
```

---

### `extensionId` · `string`

Default: built-in Content Credits extension ID

Override the Chrome extension ID the SDK looks for. Only needed if you're using a custom extension build.

```ts
extensionId: 'abcdefghijklmnopqrstuvwxyz123456'
```

---

### `theme` · `SDKTheme`

Visual customisation options for the built-in paywall overlay and comment panel. See [Theming](/features/theming) for full details.

```ts
interface SDKTheme {
  primaryColor?: string;  // default: '#44C678'
  fontFamily?: string;    // default: system UI
}
```

```ts
theme: {
  primaryColor: '#0066cc',
  fontFamily: "'Inter', system-ui, sans-serif",
}
```

Not used in `headless: true` mode.

---

### `paywallTemplate` · `string`

Custom HTML template for the paywall overlay. Replaces the default overlay UI entirely.

```ts
paywallTemplate: '<div class="my-overlay"><h2>Premium Content</h2></div>'
```

:::tip
For full custom UI control, use `headless: true` instead — it disables all SDK UI and lets you render anything you like. See the [Headless mode section](/integration-guides/headless) of the React guide.
:::

---

### `debug` · `boolean`

Default: `false`

Enables verbose console logging for development and troubleshooting.

```ts
debug: true
```

---

## Headless mode

### `headless` · `boolean`

Default: `false`

When `true`, the SDK does **not** touch the DOM at all — no content hiding, no gradient fade, no paywall overlay. You are responsible for all UI using the callbacks and action methods below.

```ts
headless: true
```

See the [Headless mode guide](/integration-guides/headless) for full examples.

---

## Callbacks

All callbacks are optional. They fire regardless of whether `headless` is `true` or `false` — in default mode they run alongside the built-in UI; in headless mode they are your only UI trigger.

---

### `onAccessGranted` · `() => void`

Fires when the reader gains access (either already purchased or just bought now). Equivalent to the `paywall:hidden` event.

```ts
onAccessGranted: () => {
  analytics.track('article_unlocked');
}
```

---

### `onStateChange` · `(state: SDKState) => void`

Fires on every state change. Receives the complete state snapshot. Use this as the single reactive hook for headless mode — equivalent to calling `cc.subscribe()` separately.

```ts
onStateChange: (state) => {
  document.getElementById('spinner').hidden = !state.isLoading;
}
```

See [State Reference](/api-reference/state) for all `SDKState` fields.

---

### `onReady` · `(state: SDKState) => void`

Fires once when the SDK finishes its first access check. Equivalent to the `ready` event.

```ts
onReady: (state) => {
  if (!state.hasAccess) showPaywall();
}
```

---

### `onLoginRequired` · `() => void`

Fires when the paywall is reached and the user is **not logged in**. Show your login UI here and call `cc.login()` from your button.

```ts
onLoginRequired: () => {
  document.getElementById('login-prompt').style.display = 'block';
}
```

---

### `onPurchaseRequired` · `(info) => void`

Fires when the user is logged in but has **not yet purchased** this article. Show your unlock UI here and call `cc.purchase()` from your button.

```ts
onPurchaseRequired: ({ requiredCredits, creditBalance }) => {
  document.getElementById('cost').textContent = requiredCredits;
  document.getElementById('balance').textContent = creditBalance;
  document.getElementById('purchase-prompt').style.display = 'block';
}
```

| `info` field | Type | Description |
|---|---|---|
| `requiredCredits` | `number \| null` | Credits needed to unlock |
| `creditBalance` | `number \| null` | Reader's current balance |

---

### `onInsufficientCredits` · `(info) => void`

Fires when the user is logged in but their balance is below the article price. Show a top-up UI here and call `cc.buyMoreCredits()`.

```ts
onInsufficientCredits: ({ required, available }) => {
  const needed = required - available;
  document.getElementById('topup-message').textContent =
    `You need ${needed} more credits.`;
  document.getElementById('topup-prompt').style.display = 'block';
}
```

| `info` field | Type | Description |
|---|---|---|
| `required` | `number` | Credits needed for this article |
| `available` | `number` | Reader's current balance |

---

### `onPurchased` · `(info) => void`

Fires after a successful purchase. Equivalent to the `article:purchased` event.

```ts
onPurchased: ({ creditsSpent, remainingBalance }) => {
  analytics.track('purchase', { creditsSpent, remainingBalance });
}
```

| `info` field | Type | Description |
|---|---|---|
| `creditsSpent` | `number` | Credits deducted |
| `remainingBalance` | `number` | Reader's updated balance |

---

### `onUserLogin` · `(user: User) => void`

Fires when the reader authenticates. Equivalent to the `auth:login` event.

```ts
onUserLogin: (user) => {
  document.getElementById('welcome').textContent = `Hi, ${user.firstName}!`;
}
```

---

### `onUserLogout` · `() => void`

Fires when the reader's session ends. Equivalent to the `auth:logout` event.

```ts
onUserLogout: () => {
  location.reload();
}
```

---

### `onError` · `(info) => void`

Fires when the SDK encounters an error. Equivalent to the `error` event.

```ts
onError: ({ message, error }) => {
  console.error('[CC]', message, error);
  Sentry.captureException(error);
}
```

| `info` field | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable description |
| `error` | `unknown \| undefined` | Underlying error object |

---

## Data attribute equivalents

For CDN auto-init, these `data-*` attributes can be set directly on the `<script>` tag:

| Config option | Data attribute |
|---|---|
| `apiKey` | `data-api-key` |
| `contentSelector` | `data-content-selector` |
| `teaserParagraphs` | `data-teaser-paragraphs` |
| `enableComments` | `data-enable-comments` |
| `debug` | `data-debug` |

All callback options (`onStateChange`, `onLoginRequired`, etc.), `theme`, `articleUrl`, `extensionId`, `paywallTemplate`, and `headless` are JavaScript-only and have no `data-*` equivalent.
