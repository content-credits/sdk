---
id: configuration
title: Configuration Reference
sidebar_position: 2
---

# Configuration Reference

Full reference for the `SDKConfig` object passed to `ContentCredits.init()`.

```ts
interface SDKConfig {
  apiKey: string;
  articleUrl?: string;
  contentSelector?: string;
  teaserParagraphs?: number;
  enableComments?: boolean;
  extensionId?: string;
  theme?: SDKTheme;
  paywallTemplate?: string;
  onAccessGranted?: () => void;
  debug?: boolean;
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

## Optional

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

---

### `teaserParagraphs` · `number`

Default: `2`

Number of `<p>` elements inside the gated element to remain visible as a preview.

```ts
teaserParagraphs: 0   // hide everything immediately
teaserParagraphs: 3   // show 3 paragraphs before the overlay
```

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

Visual customisation options. See [Theming](/features/theming) for full details.

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

---

### `paywallTemplate` · `string`

Custom HTML template for the paywall overlay. Replaces the default overlay UI entirely.

```ts
paywallTemplate: '<div class="my-overlay"><h2>Premium Content</h2></div>'
```

---

### `onAccessGranted` · `() => void`

Callback that fires when the reader gains access. Equivalent to listening to the `'paywall:hidden'` event.

```ts
onAccessGranted: () => {
  analytics.track('article_unlocked');
}
```

---

### `debug` · `boolean`

Default: `false`

Enables verbose console logging for development and troubleshooting.

```ts
debug: true
```

---

## Data attribute equivalents

For CDN auto-init, these `data-*` attributes can be set directly on the `<script>` tag:

| Config option | Data attribute |
|---------------|----------------|
| `apiKey` | `data-api-key` |
| `contentSelector` | `data-content-selector` |
| `teaserParagraphs` | `data-teaser-paragraphs` |
| `enableComments` | `data-enable-comments` |
| `debug` | `data-debug` |

`theme`, `articleUrl`, `extensionId`, `paywallTemplate`, and `onAccessGranted` are JS-only and have no data attribute equivalent.
