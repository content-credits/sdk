---
id: html
title: Plain HTML / Any Website
sidebar_position: 1
---

# Plain HTML / Any Website

This guide covers integration with plain HTML sites, static site generators, and any CMS that lets you add custom HTML.

---

## The minimal setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Article Title</title>
</head>
<body>

  <!-- Your article -->
  <article>
    <h1>Article Heading</h1>
    <p>First paragraph — free to read.</p>
    <p>Second paragraph — free to read.</p>

    <div id="premium-content">
      <p>This starts the premium section.</p>
      <p>More premium content...</p>
    </div>
  </article>

  <!-- 1. Load the SDK -->
  <script src="https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js"></script>

  <!-- 2. Initialise -->
  <script>
    ContentCreditsSDK.ContentCredits.init({
      apiKey: 'pub_YOUR_API_KEY',
      contentSelector: '#premium-content',
      teaserParagraphs: 2,
    });
  </script>

</body>
</html>
```

That's the complete integration. No build tools, no frameworks, no configuration files.

---

## Choosing a content selector

Use a CSS selector that uniquely identifies the element(s) you want to gate:

```html
<!-- By ID (most reliable) -->
<div id="premium-content">...</div>
<script>
  ContentCredits.init({ contentSelector: '#premium-content', ... });
</script>

<!-- By class -->
<div class="subscriber-only">...</div>
<script>
  ContentCredits.init({ contentSelector: '.subscriber-only', ... });
</script>

<!-- By data attribute -->
<section data-cc-gate>...</section>
<script>
  ContentCredits.init({ contentSelector: '[data-cc-gate]', ... });
</script>
```

---

## Gating multiple sections

If your article has multiple premium sections (e.g. an article with an embedded chart and a second half), the selector can match multiple elements — all of them will be hidden:

```html
<div class="premium">Section A...</div>
<div class="premium">Section B...</div>

<script>
  ContentCredits.init({
    contentSelector: '.premium',  // gates both divs
    ...
  });
</script>
```

---

## Auto-init (zero JavaScript)

Add the config directly on the `<script>` tag for a fully declarative setup:

```html
<script
  src="https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js"
  data-api-key="pub_YOUR_API_KEY"
  data-content-selector="#premium-content"
  data-teaser-paragraphs="2"
  data-enable-comments="true"
></script>
```

No `<script>` block needed at all.

---

## Handling the SDK instance

If you need to call SDK methods or listen to events, capture the return value of `init()`:

```html
<script>
  const cc = ContentCreditsSDK.ContentCredits.init({
    apiKey: 'pub_YOUR_API_KEY',
    contentSelector: '#premium-content',
  });

  // Listen for events
  cc.on('paywall:hidden', () => {
    document.getElementById('read-time').style.display = 'block';
  });

  cc.on('auth:login', ({ user }) => {
    document.getElementById('welcome').textContent = `Hi, ${user.firstName}!`;
  });
</script>
```

---

## Static site generators (Hugo, Jekyll, Eleventy)

For static generators, add the script to your base layout template. The `contentSelector` can be a class you apply in your article frontmatter:

**Hugo example** (`layouts/_default/single.html`):
```html
{{ if .Params.premium }}
<script
  src="https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js"
  data-api-key="pub_YOUR_API_KEY"
  data-content-selector=".premium-body"
></script>
{{ end }}
```

---

## Placement tip

Place the `<script>` tag just before `</body>` so the page content is already in the DOM when the SDK initialises. Alternatively, place it in `<head>` — the SDK's auto-init waits for `DOMContentLoaded` automatically.

---

## Testing locally

Since the production API only accepts requests from registered domains, use one of these approaches for local development:

**Option 1 — ngrok tunnel:**
```bash
ngrok http 3000
# Register the ngrok URL in your Content Credits dashboard
```

**Option 2 — Local backend:**
Build the SDK with `USE_LOCALHOST=true`:
```bash
cd content-credits-js-sdk
npm run build:dev
```
This targets `http://localhost:5000` instead of the production API.
