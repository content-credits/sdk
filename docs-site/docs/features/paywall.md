---
id: paywall
title: Paywall & Content Gating
sidebar_position: 1
---

# Paywall & Content Gating

The paywall is the core feature of the Content Credits SDK. It hides premium content until the reader pays the article's credit price, then reveals it instantly without a page reload.

---

## How it works

The SDK uses **CSS-selector-based client-side gating**:

1. On initialisation, the SDK finds the element matching your `contentSelector`
2. It optionally leaves the first N paragraphs visible (`teaserParagraphs`)
3. The rest of the content is hidden using CSS (`visibility: hidden`)
4. An overlay is rendered on top of the hidden area inside a **Shadow DOM** (completely isolated from your page's CSS)
5. The overlay shows one of several states depending on the reader's access level

```
Article page loads
      │
      ▼
SDK hides #premium-content (CSS)
      │
      ▼
SDK checks access (extension first, then API)
      │
 ┌────┴─────────────────────────────────────┐
 │                                          │
 ▼                                          ▼
Access granted                         No access
      │                               Show overlay
      ▼                                    │
Content revealed                    ┌──────┴──────┐
Overlay removed                     │             │
                               Not logged in   Logged in
                               Show login btn  Show buy btn
```

---

## Overlay states

The paywall overlay automatically shows the right UI for every situation:

| State | What the reader sees |
|-------|---------------------|
| **Checking** | Spinner while the SDK verifies access |
| **Login** | "Sign in to read" button — reader not authenticated |
| **Purchase** | "Unlock for X credits" button — reader authenticated, hasn't bought |
| **Insufficient credits** | "Top up credits" message — reader is logged in but balance is too low |
| **Granted** | Overlay fades out, content is revealed |
| **Loading** | Spinner while a purchase is being processed |

---

## The teaser

The `teaserParagraphs` option controls how many paragraphs inside your gated element are shown as a preview. This gives readers enough context to decide if the article is worth paying for.

```
┌─────────────────────────────────────────┐
│ Article Title                           │
│                                         │
│ Free paragraph 1 (always visible)       │
│                                         │
│ Free paragraph 2 (always visible)       │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Teaser paragraph 3 (still visible)  │ │◄── teaserParagraphs: 3
│ │                                     │ │
│ │ Teaser paragraph 4 (still visible)  │ │
│ │                                     │ │
│ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ │◄── Paywall overlay starts here
│ │░░░ Unlock this article             ░│ │
│ │░░░  3 credits  [Buy Now]           ░│ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

The paragraphs before the overlay boundary are inside the gated element but shown normally. The overlay overlaps from the first hidden paragraph downward.

---

## The Chrome extension path

The SDK first checks if the reader has the **Content Credits Chrome extension** installed. If they do, the extension handles the access check and payment natively — providing a faster, smoother experience with a single click.

If the extension is not installed, the SDK falls back to the standard API flow (popup login + API-based purchase).

---

## Authentication flow

### Desktop
When a reader clicks "Sign in", the SDK opens a **popup window** pointing to `accounts.contentcredits.com`. After the reader logs in, the popup posts the auth token back to the SDK via `postMessage`. The popup closes automatically.

### Mobile
Popups don't work reliably on mobile browsers. On mobile, the SDK performs a **redirect** instead:
1. Saves the current article URL to `sessionStorage`
2. Redirects the reader to the login page
3. After login, the auth server redirects back to the article URL with a token in the URL fragment
4. The SDK reads the token, immediately removes it from the URL (via `history.replaceState`), and stores it in memory

---

## Credit purchase flow

Once authenticated, if the reader doesn't yet have access:

1. The overlay shows the credit price for the article
2. Reader clicks "Unlock" → SDK calls the purchase API
3. Credits are deducted from reader's balance
4. Content is immediately revealed (no page reload)
5. `onAccessGranted` callback fires + `paywall:hidden` event emitted

If the reader doesn't have enough credits, the overlay shows a "Top up" button that takes them to the credits purchase page.

---

## Markup requirements

The gated content must be **already present in the DOM** when the SDK initialises. Server-side rendered HTML and most CMS platforms work out of the box.

```html
<!-- ✅ Correct — content is in the DOM -->
<div id="premium-content">
  <p>Premium paragraph 1</p>
  <p>Premium paragraph 2</p>
</div>

<!-- ❌ Wrong — SDK can't gate content loaded asynchronously after init -->
```

If your content loads asynchronously, call `ContentCredits.init()` after the content is in the DOM.
