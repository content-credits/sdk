---
id: security
title: Security Model
sidebar_position: 1
---

# Security Model

This page documents the security decisions made in the Content Credits SDK v2 and why they were made.

---

## Token storage

The SDK uses a **three-layer model** that separates two different tokens with different lifetimes and different security requirements.

### The two tokens

| | Access token | Refresh token |
|---|---|---|
| **What it is** | JWT | Long-lived opaque string |
| **Lifetime** | 7 days | 30 days |
| **Purpose** | Authorise every API call | Silently obtain a new access token |
| **Stored in** | Memory + `sessionStorage` | `localStorage` |
| **Survives browser close?** | No | Yes |

### Access token — memory + sessionStorage

```
Login
  └─▶ in-memory store (primary)
        └─▶ sessionStorage (fallback)

Page reload   → read from sessionStorage → warm up memory
Tab close     → sessionStorage cleared by browser
Browser close → sessionStorage cleared by browser
Token expiry  → auto-cleared on next read
```

The access token never touches `localStorage` or `document.cookie`. It is accessible only inside the SDK's own closure.

### Refresh token — localStorage

```
Login
  └─▶ localStorage  (key: cc_rt)

Browser close + reopen
  └─▶ SDK init reads cc_rt from localStorage
        └─▶ POST /auth/refresh → new access token + new refresh token
              └─▶ User silently re-authenticated, no popup shown
```

The refresh token lives in `localStorage` on the **publisher's domain** — this is first-party storage, so it is never affected by third-party cookie or storage blocking in any browser (Safari ITP, Firefox ETP, Chrome Privacy Sandbox).

### Refresh token rotation

Every call to `/auth/refresh` returns a **new** refresh token and immediately invalidates the old one. This means:

- A stolen refresh token can only be used once before the legitimate user rotates it
- If a token is used that has already been rotated (reuse detected), the backend treats it as a potential theft and **immediately revokes all active sessions for that user** — forcing a fresh login
- There is no persistent credential that stays valid indefinitely

### Silent re-authentication flow

```
User closes browser
  └─▶ Access token cleared (memory + sessionStorage gone)
       Refresh token persists (localStorage)

User opens publisher site next day
  └─▶ SDK initialises
        └─▶ tokenStorage.has() → false
              └─▶ tryRefreshSession() called
                    └─▶ POST /auth/refresh with stored refresh token
                          ├─▶ Success → new access token in memory
                          │            new refresh token in localStorage
                          │            paywall check runs, no popup shown
                          └─▶ Failure → refresh token cleared
                                        login popup shown as normal
```

### Why not cookies?

The original SDK (v1) stored the auth token in a cookie named `cc-token` with no `HttpOnly` flag. This meant:

1. Any JavaScript on the page (including third-party ad scripts) could read the token via `document.cookie`
2. The token was sent to every request to your domain, not just Content Credits API calls
3. CSRF attacks were possible

The v2 SDK never writes to `document.cookie`.

### Why not an iframe-based silent auth?

The previous approach to cross-session persistence (used by Auth0's `checkSession()`) opened a hidden `<iframe>` to `accounts.contentcredits.com` and relied on that domain's cookie being readable inside the iframe. This is blocked by:

- **Safari** — Intelligent Tracking Prevention (since 2017)
- **Firefox** — Enhanced Tracking Protection
- **Chrome** — Third-party cookie deprecation (rolling out now)

The refresh token approach avoids this entirely because storage is read from the **publisher's own domain**, not a cross-origin iframe.

---

## URL token scrubbing

After a mobile auth redirect, the token arrives in the URL fragment:

```
https://yoursite.com/article?cc_token=eyJhbGci...
```

The SDK reads the token and **immediately removes it from the URL** using `history.replaceState`:

```ts
// Token is read
const token = params.get('cc_token');

// URL is cleaned before anything else
history.replaceState(null, '', window.location.pathname);

// Now store the token
tokenStorage.set(token);
```

This prevents:
- The token appearing in browser history
- The token being captured in server access logs if the page is subsequently refreshed
- Accidental token sharing if a user copies and pastes the URL

---

## `postMessage` origin validation

The popup-based login flow uses `postMessage` to deliver the token from `accounts.contentcredits.com` to your page.

The SDK validates the `origin` of every incoming message against an allowlist:

```ts
const ALLOWED_ORIGINS = [
  'https://accounts.contentcredits.com',
  window.location.origin,  // the current publisher page
];

window.addEventListener('message', (event) => {
  if (!ALLOWED_ORIGINS.includes(event.origin)) return; // ignore
  // process token
});
```

This prevents malicious pages from injecting fake auth tokens by calling `postMessage` with a forged payload.

---

## XSS prevention in comments

User-submitted comment content is rendered using safe DOM construction. We never call `innerHTML` with user data:

```ts
// ✅ Safe
const p = document.createElement('p');
p.textContent = comment.content;  // textContent, not innerHTML

// ❌ Never
element.innerHTML = comment.content;
```

Newlines in comments are converted to `<br>` elements by creating real DOM nodes, not by inserting HTML strings. This means a comment containing `<script>alert(1)</script>` renders as literal text, not executable code.

---

## Shadow DOM isolation

All SDK UI (paywall overlay, comment panel, widget button) is rendered inside a `ShadowRoot`. This provides:

1. **CSS isolation** — your page styles cannot accidentally override SDK styles (and vice versa)
2. **DOM isolation** — `document.querySelector()` from the host page cannot reach inside the Shadow DOM
3. **Event isolation** — some events don't bubble out of Shadow DOM by default

---

## Content gating approach

The v2 SDK gates content **client-side** by hiding DOM elements with CSS. This is different from some paywall implementations that store article content in a JavaScript variable.

### Why not a JavaScript variable?

Storing hidden content in `window.cc_hidden_content = "..."` means:
- A reader can open DevTools and read the full article for free
- The content is in the page source

### Our approach

The SDK hides elements using `visibility: hidden` and `height: 0`. The content is in the DOM but not visible. A determined reader with DevTools can still reveal it.

**This is the same trade-off made by every major paywall including The New York Times, The Atlantic, and The FT.** True content protection requires server-side rendering with conditional content delivery based on the auth token — which requires significant backend changes per publisher. The SDK's client-side approach is the standard industry practice for JavaScript-based paywalls.

For publishers who need stronger protection, contact us about the server-side verification API.

---

## Request security

Every API request made by the SDK:

1. Includes `Authorization: Bearer <token>` header (not cookie)
2. Has a 12-second timeout via `AbortController`
3. Retries up to 3 times on network errors and 5xx responses with exponential backoff (1s → 2s → 4s)
4. Uses request deduplication — if the same request is already in-flight, the duplicate waits for the first to complete rather than firing a second network call
5. On 401 response → attempts one silent token refresh automatically, then retries the original request; if the refresh also fails, emits `auth:logout` and clears both tokens

---

## API key exposure

Publisher API keys (`pub_...`) are intentionally designed to be safe for client-side inclusion. They identify your publisher account for the purposes of loading articles and routing payments — they do not grant admin access or the ability to manage accounts. Think of them as similar to Stripe's publishable key.

The secret key (used for server-to-server API calls, if applicable) must never be included in client-side code.
