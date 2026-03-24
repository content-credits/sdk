---
id: wordpress
title: WordPress
sidebar_position: 2
---

# WordPress Integration

Content Credits has a **dedicated WordPress plugin** that wraps the JS SDK. It's the easiest way to add paywalls and comments to a WordPress site — no custom code required.

---

## Installing the plugin

1. Download the plugin ZIP from your [Content Credits dashboard](https://app.contentcredits.com) → Integrations → WordPress
2. In your WordPress admin: **Plugins → Add New → Upload Plugin**
3. Upload the ZIP and click **Activate**

---

## Configuring the plugin

After activation, go to **Settings → Content Credits** in your WordPress admin panel.

| Setting | Description |
|---------|-------------|
| **API Key** | Your publisher API key (`pub_...`) |
| **Teaser Paragraphs** | How many paragraphs to show before the paywall |
| **Enable Comments** | Toggle the comment widget on/off |
| **Primary Colour** | Brand colour for buttons |

---

## Marking posts as premium

The plugin adds a **"Premium Content"** checkbox to the post editor. When checked:

1. The post content is wrapped in a `<div class="cc-premium-content">` element
2. The Content Credits SDK is loaded on that page with your API key
3. The paywall is shown automatically

For posts **not** marked as premium, the SDK is not loaded — no performance impact on free content.

---

## Using the shortcode

Alternatively, mark any portion of your content as gated using the `[cc_premium]` shortcode:

```
This paragraph is always free.

[cc_premium]
This paragraph is only visible after the reader pays.
This one too.
[/cc_premium]

This paragraph is free again.
```

---

## How the plugin works internally

The plugin:

1. Registers a custom post meta field `_cc_is_premium`
2. On pages where `_cc_is_premium = true`, enqueues the SDK from the CDN
3. Outputs an inline `<script>` that calls `ContentCredits.init()` with the settings from the admin panel
4. Wraps content in `<div class="cc-premium-content">` as the gate selector

The `cc_php_data` JavaScript object is available on every gated page with the publisher's settings.

---

## Manual SDK loading (advanced)

If you want to use the SDK directly in your theme (without the plugin's post meta checkbox), you can enqueue it manually in your theme's `functions.php`:

```php
function my_theme_enqueue_cc_sdk() {
    if ( is_single() && get_post_meta( get_the_ID(), '_is_premium', true ) ) {
        wp_enqueue_script(
            'contentcredits-sdk',
            'https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js',
            [],
            '2.0.0',
            true
        );

        wp_add_inline_script(
            'contentcredits-sdk',
            "ContentCreditsSDK.ContentCredits.init({
                apiKey: 'pub_YOUR_API_KEY',
                contentSelector: '.entry-content .premium',
                teaserParagraphs: 2,
                enableComments: true
            });"
        );
    }
}
add_action( 'wp_enqueue_scripts', 'my_theme_enqueue_cc_sdk' );
```

---

## Theme compatibility

The plugin and SDK are tested with:
- Twenty Twenty-Four / Twenty Twenty-Three (block themes)
- Astra, GeneratePress, Kadence (popular page builder themes)
- Classic themes with `the_content` filter support

The SDK's Shadow DOM architecture means it works regardless of your theme's CSS.

---

## Troubleshooting

**Paywall not appearing:** Check that the post is marked as "Premium Content" in the editor. Open your browser console — if you see `[ContentCredits]` logs (with `debug: true`), the SDK loaded successfully.

**Comments not loading:** Verify your domain is registered in the Content Credits dashboard. The API rejects requests from unregistered domains.

**Style conflicts:** The paywall and comment panel run in a Shadow DOM and should never conflict with your theme. If you see visual issues, check that you're not injecting styles into Shadow DOM via JavaScript.
