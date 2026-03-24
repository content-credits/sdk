---
id: mobile
title: Mobile Auth Flow
sidebar_position: 2
---

# Mobile Auth Flow

Authentication works differently on mobile browsers because popups are blocked or unreliable on iOS Safari and Android Chrome.

---

## Desktop vs mobile

| | Desktop | Mobile |
|---|---|---|
| Auth method | Popup window | Full-page redirect |
| Token delivery | `postMessage` | URL parameter |
| UX | Reader stays on the article | Reader leaves and returns |
| Popup blocker risk | Yes (mitigated) | N/A |

---

## The mobile redirect flow

When a mobile reader clicks "Sign in" or "Unlock":

```
1. SDK saves current article URL to sessionStorage
         key: "cc_return_url"
         value: "https://yoursite.com/article/..."

2. SDK redirects reader to:
         https://accounts.contentcredits.com/login
           ?return_url=https://yoursite.com/article/...

3. Reader authenticates on accounts.contentcredits.com

4. Auth server redirects back to:
         https://yoursite.com/article/...?cc_token=eyJhbGci...

5. SDK detects the token in the URL on page load:
         - Reads cc_token from query string
         - Immediately removes it from the URL (history.replaceState)
         - Stores token in memory + sessionStorage
         - Continues with access check
```

---

## How the SDK detects mobile

The SDK uses a heuristic based on `navigator.userAgent` and touch support:

```ts
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
    .test(navigator.userAgent) || window.innerWidth < 768;
}
```

If `isMobileDevice()` returns `true`, the redirect flow is used instead of a popup.

---

## Popup blocker detection (desktop)

On desktop, the SDK opens a popup using `window.open()`. If a popup blocker prevents it, `window.open()` returns `null`. The SDK detects this and falls back to the redirect flow:

```ts
const popup = window.open(loginUrl, '_blank', 'width=480,height=600,...');
if (!popup) {
  // Popup was blocked — fall back to redirect
  window.location.href = loginUrl;
  return;
}
```

There is also a 5-minute timeout on the popup. If the reader doesn't complete auth within 5 minutes, the popup times out and the overlay returns to its previous state.

---

## Deep link support

Some publishers want readers to be able to share article URLs that, when opened, automatically prompt for authentication. This works out of the box — when the reader opens the URL:

1. The SDK runs its access check
2. If not logged in, the paywall overlay appears with a "Sign in" button
3. The entire auth + redirect flow runs against the current page URL

No special configuration required.

---

## Testing the mobile flow

To test the mobile flow on desktop, you can either:

**Option 1 — DevTools mobile emulation:**
Open Chrome DevTools → toggle device toolbar → select a mobile device. The SDK's `isMobileDevice()` check uses `window.innerWidth < 768`, so narrow the viewport to trigger mobile mode.

**Option 2 — Force redirect:**
Temporarily override the check in your dev environment by setting `window.innerWidth` via DevTools console, or use the SDK's debug mode (`debug: true`) which logs which auth path is being used.

---

## SessionStorage and private browsing

On iOS Safari in Private Browsing mode, `sessionStorage` is available but is wiped more aggressively. In practice, the redirect flow still works because the token is read from the URL query parameter on the return visit — `sessionStorage` is only used for the return URL fallback.

If `sessionStorage` is unavailable for any reason, the SDK falls back to reading `document.referrer` and the current URL to determine the return destination.
