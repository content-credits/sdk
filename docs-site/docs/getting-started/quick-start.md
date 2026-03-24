---
id: quick-start
title: Quick Start
sidebar_position: 2
---

# Quick Start

Get a working paywall and comment system on your site in under 5 minutes.

---

## Prerequisites

1. A **Content Credits publisher account** — [sign up at app.contentcredits.com](https://app.contentcredits.com)
2. Your **API key** — found in Dashboard → Settings → API Keys (format: `pub_xxxxxxxxxxxxxxxx`)
3. Your domain registered as a publisher website in the dashboard

---

## Step 1 — Add the script tag

Paste this into the `<head>` or end of `<body>` of your page:

```html
<script
  src="https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js"
  crossorigin="anonymous"
></script>
```

---

## Step 2 — Wrap your premium content

Give your premium section a class or ID:

```html
<article>
  <!-- Free teaser — always visible -->
  <p>This is the opening paragraph that everyone can read for free.</p>
  <p>And a second teaser paragraph before the gate kicks in.</p>

  <!-- Everything inside this div is gated -->
  <div id="premium-content">
    <p>This paragraph is only visible after the reader pays.</p>
    <p>More exclusive content here...</p>
  </div>
</article>
```

---

## Step 3 — Initialise the SDK

Add this inline script **after** the SDK `<script>` tag:

```html
<script>
  ContentCreditsSDK.ContentCredits.init({
    apiKey: 'pub_YOUR_API_KEY',
    contentSelector: '#premium-content',
    teaserParagraphs: 2,
    enableComments: true,
  });
</script>
```

---

## Step 4 — Test it

Open your page in a browser. You should see:

- The first 2 paragraphs of your article are visible
- The `#premium-content` section is hidden
- A paywall overlay appears over the hidden content
- A comment widget button appears in the bottom-right corner

:::info Localhost note
The production API (`api.contentcredits.com`) only accepts requests from **registered publisher domains**. If you're testing on `localhost`, API calls will fail with CORS errors.

Use [ngrok](https://ngrok.com) to expose your local server on a public URL, then register that URL in your dashboard.
:::

---

## Full working example

Here's a complete standalone HTML page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>My Article</title>
</head>
<body>

  <article>
    <h1>The Future of Independent Publishing</h1>

    <p>The economics of digital publishing have never been more precarious...</p>
    <p>Into this tension steps a new model: micro-transactions at the article level.</p>

    <div id="premium-content">
      <h2>Why Per-Article Pricing Works Now</h2>
      <p>Three conditions have converged to make this moment different...</p>
      <p>Publishers set their own per-article credit price...</p>
    </div>
  </article>

  <!-- Content Credits SDK -->
  <script src="https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js"></script>
  <script>
    ContentCreditsSDK.ContentCredits.init({
      apiKey: 'pub_YOUR_API_KEY',
      contentSelector: '#premium-content',
      teaserParagraphs: 2,
      enableComments: true,
    });
  </script>

</body>
</html>
```

---

## Or use the auto-init shorthand

If you don't want any inline JavaScript at all, put the config directly on the `<script>` tag:

```html
<script
  src="https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js"
  data-api-key="pub_YOUR_API_KEY"
  data-content-selector="#premium-content"
  data-teaser-paragraphs="2"
  data-enable-comments="true"
></script>
```

---

## Next steps

- [Configuration](/getting-started/configuration) — customise theming, article URL, credit pricing display
- [Paywall feature](/features/paywall) — understand how the gate and overlay work
- [Comments feature](/features/comments) — threading, likes, moderation
- [Events](/features/events) — react to SDK events in your own code
