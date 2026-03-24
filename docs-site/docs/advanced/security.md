---
id: security
title: Security Model
sidebar_position: 1
---

# Security Model

This page documents the security decisions made in the Content Credits SDK v2 and why they were made.

---

## Token storage

### What we do

Auth tokens are stored in **memory first**, with `sessionStorage` as a fallback if the in-memory store is cleared (e.g. page hidden event, back-forward cache).

```
Token lifecycle:
  Login → in-memory store (primary)
             └─ sessionStorage (fallback, same tab only)

  Page reload → read from sessionStorage → back into memory
  Tab close   → sessionStorage cleared by browser
  Token expiry → auto-cleared on read
```

### Why not cookies?

The original SDK (v1) stored the auth token in a cookie named `cc-token` with no `HttpOnly` flag. This meant:

1. Any JavaScript on the page (including third-party ad scripts) could read the token via `document.cookie`
2. The token was sent to every request to your domain, not just Content Credits API calls
3. CSRF attacks were possible

The v2 SDK never writes to `document.cookie`. The token is only ever accessible to the SDK's own closure.

### Why not `localStorage`?

`localStorage` persists indefinitely across all tabs and browser sessions. A stolen token stored in `localStorage` would remain valid until it expires. `sessionStorage` is scoped to a single tab and is cleared automatically when the tab is closed.

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
5. On 401 response → emits `auth:logout` and clears the stored token

---

## API key exposure

Publisher API keys (`pub_...`) are intentionally designed to be safe for client-side inclusion. They identify your publisher account for the purposes of loading articles and routing payments — they do not grant admin access or the ability to manage accounts. Think of them as similar to Stripe's publishable key.

The secret key (used for server-to-server API calls, if applicable) must never be included in client-side code.
