---
id: events
title: Events
sidebar_position: 3
---

# Events

The SDK emits typed events throughout the reader's lifecycle. Subscribe to them to trigger analytics, update your UI, or integrate with third-party tools.

:::tip Two ways to listen
Every event also has a **config callback equivalent** you can pass directly to `init()` — no need to call `cc.on()` separately:

| Event | Config callback |
|---|---|
| `ready` | `onReady(state)` |
| `auth:login` | `onUserLogin(user)` |
| `auth:logout` | `onUserLogout()` |
| `paywall:shown` | `onLoginRequired()` / `onPurchaseRequired(...)` |
| `paywall:hidden` | `onAccessGranted()` |
| `article:purchased` | `onPurchased({ creditsSpent, remainingBalance })` |
| `credits:insufficient` | `onInsufficientCredits({ required, available })` |
| `error` | `onError({ message, error? })` |

Use `on()` for side-effects like analytics. Use config callbacks for driving UI — especially in [headless mode](/integration-guides/react#headless-mode--fully-custom-ui).
:::

---

## Subscribing to events

```js
const cc = ContentCredits.init({ apiKey: 'pub_YOUR_KEY', ... });

// Subscribe — returns an unsubscribe function
const unsubscribe = cc.on('ready', ({ state }) => {
  console.log('SDK ready, state:', state);
});

// Unsubscribe
unsubscribe();

// Or unsubscribe by handler reference
const handler = ({ user }) => console.log('Logged in:', user.email);
cc.on('auth:login', handler);
cc.off('auth:login', handler);
```

---

## All events

### `ready`

Fired once when the SDK has finished initialising (access check complete, UI rendered).

```ts
cc.on('ready', ({ state }) => {
  // state: SDKState — the full current state snapshot
  console.log('Has access:', state.hasAccess);
  console.log('User:', state.user);
});
```

---

### `auth:login`

Fired when the reader successfully authenticates.

```ts
cc.on('auth:login', ({ user }) => {
  // user.firstName, user.lastName, user.email, user.credits
  console.log(`Welcome, ${user.firstName}!`);
  analytics.identify(user._id, { email: user.email });
});
```

---

### `auth:logout`

Fired when the reader's session ends (token expiry or explicit sign-out).

```ts
cc.on('auth:logout', () => {
  console.log('Reader logged out');
});
```

---

### `paywall:shown`

Fired when the paywall overlay appears (reader doesn't have access).

```ts
cc.on('paywall:shown', () => {
  analytics.track('paywall_shown', { url: window.location.href });
});
```

---

### `paywall:hidden`

Fired when the paywall overlay is removed and content is revealed. This is effectively the "article unlocked" event.

```ts
cc.on('paywall:hidden', () => {
  analytics.track('article_unlocked');
  // Same as the onAccessGranted callback in config
});
```

---

### `article:purchased`

Fired when the reader successfully purchases access to the current article.

```ts
cc.on('article:purchased', ({ creditsSpent, remainingBalance }) => {
  console.log(`Spent ${creditsSpent} credits. Balance: ${remainingBalance}`);
  analytics.track('article_purchased', { creditsSpent });
});
```

---

### `credits:insufficient`

Fired when the reader tries to purchase but doesn't have enough credits.

```ts
cc.on('credits:insufficient', ({ required, available }) => {
  console.log(`Need ${required} credits, only have ${available}`);
  // In default mode: the SDK shows a "Top up" button automatically
  // In headless mode: show your own top-up UI and call cc.buyMoreCredits()
});
```

---

### `comment:posted`

Fired when the reader successfully posts a comment.

```ts
cc.on('comment:posted', ({ comment }) => {
  console.log('New comment:', comment.content, 'by', comment.author?.firstName);
});
```

---

### `comment:liked`

Fired when the reader likes or unlikes a comment.

```ts
cc.on('comment:liked', ({ commentId, hasLiked }) => {
  console.log(commentId, hasLiked ? '→ liked' : '→ unliked');
});
```

---

### `comment:deleted`

Fired when the reader deletes one of their comments.

```ts
cc.on('comment:deleted', ({ commentId }) => {
  console.log('Deleted:', commentId);
});
```

---

### `error`

Fired when the SDK encounters a non-fatal error (e.g. network failure, API error).

```ts
cc.on('error', ({ message, error }) => {
  console.error('SDK error:', message, error);
  Sentry.captureException(error);
});
```

---

## Native CustomEvents

In addition to the typed event emitter, the SDK also dispatches **native browser `CustomEvent`s** on `document`. This lets you listen without a reference to the SDK instance — useful for analytics libraries, tag managers, or iframe integrations.

Event names are prefixed with `contentcredits:`:

```js
document.addEventListener('contentcredits:auth:login', (e) => {
  console.log('Reader logged in:', e.detail);
});

document.addEventListener('contentcredits:paywall:hidden', () => {
  dataLayer.push({ event: 'article_unlocked' });
});
```

All events listed above are available as both SDK emitter events and native CustomEvents.

---

## Analytics integration example

```js
const cc = ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  contentSelector: '#premium-content',
});

cc.on('ready', ({ state }) => {
  if (state.hasAccess) {
    analytics.track('article_viewed_with_access');
  } else {
    analytics.track('article_viewed_paywalled');
  }
});

cc.on('article:purchased', ({ creditsSpent }) => {
  analytics.track('purchase', { value: creditsSpent, currency: 'credits' });
});

cc.on('auth:login', ({ user }) => {
  analytics.identify(user._id);
});
```
