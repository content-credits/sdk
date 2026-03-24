---
id: configuration
title: Configuration
sidebar_position: 3
---

# Configuration

All configuration is passed to `ContentCredits.init()` as a plain JavaScript object.

```ts
ContentCredits.init({
  apiKey: 'pub_YOUR_API_KEY',           // required
  contentSelector: '#premium-content',  // optional (default: '.cc-premium-content')
  teaserParagraphs: 2,                  // optional (default: 2)
  enableComments: true,                 // optional (default: true)
  articleUrl: window.location.href,     // optional (default: current URL)
  theme: {
    primaryColor: '#44C678',
    fontFamily: 'Georgia, serif',
  },
  onAccessGranted: () => {
    console.log('Reader unlocked the article!');
  },
  debug: false,
});
```

---

## Full option reference

### `apiKey` · `string` · **required**

Your publisher API key from the Content Credits dashboard. Always starts with `pub_`.

```js
apiKey: 'pub_abc123def456ghi789'
```

---

### `contentSelector` · `string` · default `'.cc-premium-content'`

A **CSS selector** that identifies the element(s) containing your premium content. The SDK hides all matching elements until the reader pays.

```js
contentSelector: '#premium-section'
// or
contentSelector: '.paywalled-content'
// or
contentSelector: 'article > section:last-child'
```

Multiple matching elements are all hidden simultaneously.

---

### `teaserParagraphs` · `number` · default `2`

How many `<p>` elements inside the **gated element** to show before it gets hidden. This lets readers see a preview before the paywall kicks in.

```js
teaserParagraphs: 3   // show 3 paragraphs, hide the rest
teaserParagraphs: 0   // hide the entire element immediately
```

:::info How teaser paragraphs work
The SDK counts `<p>` elements that are **direct or shallow children** of the gated element. If you have `teaserParagraphs: 2`, the first 2 paragraphs remain visible and the rest are hidden. The paywall overlay appears at the boundary.
:::

---

### `enableComments` · `boolean` · default `true`

Whether to activate the comment system. When `true`, a floating widget button appears in the bottom-right corner of the page.

```js
enableComments: false   // disable comments entirely
```

---

### `articleUrl` · `string` · default `window.location.href`

The canonical URL of the article. Used to look up the article in the Content Credits system. Only set this manually if your canonical URL differs from the browser's current URL (e.g. in SPAs or when using query parameters that shouldn't be part of the article identity).

```js
articleUrl: 'https://yoursite.com/articles/the-future-of-publishing'
```

---

### `theme` · `object` · optional

Visual customisation for all SDK UI (paywall overlay, comment panel, widget button).

```js
theme: {
  primaryColor: '#0066cc',    // brand colour for buttons and accents
  fontFamily: 'Georgia, serif', // font for all SDK text
}
```

| Property | Type | Default |
|----------|------|---------|
| `primaryColor` | `string` (CSS colour) | `'#44C678'` |
| `fontFamily` | `string` (CSS font stack) | System UI sans-serif |

---

### `onAccessGranted` · `() => void` · optional

A callback that fires the moment the reader gains access to the article (either because they already purchased it, or just bought it now). Use this to trigger analytics events, remove a loading state, etc.

```js
onAccessGranted: () => {
  analytics.track('article_unlocked');
}
```

This is equivalent to listening to the `'paywall:hidden'` event.

---

### `extensionId` · `string` · optional

Override the Chrome extension ID the SDK looks for when detecting the Content Credits extension. Only needed if you're using a custom-built version of the extension.

```js
extensionId: 'abcdefghijklmnopqrstuvwxyz123456'
```

---

### `debug` · `boolean` · default `false`

When `true`, the SDK logs verbose messages to the browser console — useful for development and troubleshooting.

```js
debug: true
```

---

## Data attribute equivalents (CDN auto-init)

When using the CDN `<script>` tag, every option can be set as a `data-*` attribute:

| JS option | `data-*` attribute |
|-----------|-------------------|
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
  data-debug="false"
></script>
```

:::note
`theme`, `articleUrl`, `extensionId`, and `onAccessGranted` can only be set via the JavaScript API — they have no data attribute equivalent.
:::
