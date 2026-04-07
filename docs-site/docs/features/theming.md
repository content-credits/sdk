---
id: theming
title: Theming & Customisation
sidebar_position: 4
---

# Theming & Customisation

The Content Credits SDK ships with a clean default theme. You can customise colours and fonts to match your brand with two configuration options.

---

## Theme options

```js
ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  contentSelector: '#premium-content',
  theme: {
    primaryColor: '#0066cc',     // your brand colour
    fontFamily: 'Georgia, serif', // your font stack
  },
});
```

### `primaryColor`

Any valid CSS colour value. Used for:
- "Unlock" and "Buy" buttons
- Login button
- Hover states and accents
- Comment like button (active state)
- Widget button background
- Progress indicators

```js
theme: { primaryColor: '#e63946' }      // red
theme: { primaryColor: '#2d6a4f' }      // forest green
theme: { primaryColor: '#3a86ff' }      // blue
theme: { primaryColor: 'hsl(38,95%,50%)' } // amber
```

### `fontFamily`

Any valid CSS `font-family` value. Applies to all text inside the SDK's Shadow DOM: paywall overlay, comment panel, widget button.

```js
theme: { fontFamily: "'Playfair Display', Georgia, serif" }
theme: { fontFamily: "'Inter', system-ui, sans-serif" }
theme: { fontFamily: "system-ui, -apple-system, sans-serif" } // default
```

:::tip Web fonts
If you're using a custom web font (e.g. from Google Fonts), make sure it's loaded on your page **before** the SDK initialises. Since the comment panel uses a Shadow DOM, fonts loaded via `@font-face` in your main stylesheet may not be inherited automatically. Load the font via a `<link>` tag in `<head>` instead — those are accessible inside Shadow DOMs.
:::

---

## Shadow DOM isolation

All SDK UI is rendered inside a `ShadowRoot`. This is a browser security boundary that means:

- **Your CSS does not affect SDK UI** — no accidental style overrides
- **SDK CSS does not affect your page** — no leaking styles
- This is intentional and by design — it makes the SDK a true drop-in that works on every publisher site regardless of their CSS

Because of this boundary, the only way to style SDK UI is through the `theme` configuration object above.

---

## Custom paywall template

For publishers who need complete control over the paywall overlay design, you can supply a custom HTML string:

```js
ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  contentSelector: '#premium-content',
  paywallTemplate: `
    <div class="my-paywall">
      <img src="/logo.png" alt="My Site" />
      <h2>This is premium content</h2>
      <p>Unlock with Content Credits</p>
    </div>
  `,
});
```

:::caution
When using `paywallTemplate`, the SDK's built-in login and purchase buttons will not be rendered. You are responsible for wiring up actions yourself.

For full custom UI control, consider using `headless: true` instead — it completely disables all SDK UI and gives you explicit callbacks (`onLoginRequired`, `onPurchaseRequired`, etc.) and action methods (`cc.login()`, `cc.purchase()`, `cc.buyMoreCredits()`). See the [Headless mode guide](/integration-guides/react#headless-mode--fully-custom-ui).

For minor visual changes (colours, font), use the `theme` option — no custom template needed.
:::

---

## Examples

### News publisher (serif, dark red)

```js
ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  contentSelector: '#article-body',
  theme: {
    primaryColor: '#8b0000',
    fontFamily: "'Merriweather', Georgia, serif",
  },
});
```

### Tech blog (sans, blue)

```js
ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  contentSelector: '.post-content',
  theme: {
    primaryColor: '#2563eb',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
});
```

### Magazine (custom brand green)

```js
ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  contentSelector: '#premium-zone',
  theme: {
    primaryColor: '#44C678',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
});
```
