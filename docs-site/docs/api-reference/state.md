---
id: state
title: State Reference
sidebar_position: 4
---

# State Reference

The SDK maintains internal state that you can read at any time via `cc.getState()`.

---

## `SDKState` interface

```ts
interface SDKState {
  isLoading: boolean;
  isExtensionAvailable: boolean;
  isLoggedIn: boolean;
  hasAccess: boolean;
  isLoaded: boolean;
  user: User | null;
  creditBalance: number | null;
  requiredCredits: number | null;
}
```

---

## Fields

### `isLoading` · `boolean`

`true` while the SDK is actively checking access or processing a purchase. Use this to show a loading state in your own UI.

---

### `isLoaded` · `boolean`

`true` once the SDK has finished its initial startup sequence (access check complete). This corresponds to when the `ready` event fires.

---

### `isLoggedIn` · `boolean`

`true` if the reader has a valid auth token. Equivalent to calling `cc.isLoggedIn()`.

---

### `hasAccess` · `boolean`

`true` if the reader has purchased or been granted access to the current article. When this is `true`, the premium content is visible and the paywall overlay is hidden.

---

### `isExtensionAvailable` · `boolean`

`true` if the Content Credits Chrome extension was detected in the reader's browser. When the extension is available, the SDK uses it for faster access checking and authentication.

---

### `user` · `User | null`

The authenticated reader's profile, or `null` if not logged in.

```ts
interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  credits: number;
  roles: ('consumer' | 'publisher' | 'admin')[];
  isVerified: boolean;
  isActive: boolean;
  purchaseHistory: PurchaseItem[];
}
```

---

### `creditBalance` · `number | null`

The reader's current credit balance, or `null` if not known (reader not logged in, or balance not yet fetched).

---

### `requiredCredits` · `number | null`

The number of credits required to unlock the current article, or `null` if not yet known.

---

## Reading state

### Option A — `onStateChange` config callback

Pass `onStateChange` in your `init()` config to receive state on every change. This is the simplest approach for headless mode.

```js
ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  headless: true,
  onStateChange: (state) => {
    document.getElementById('spinner').hidden = !state.isLoading;
    document.getElementById('content').hidden = !state.hasAccess;
  },
});
```

### Option B — `cc.subscribe(fn)`

Call `subscribe()` on the returned instance. Useful when you can't pass callbacks at init time (e.g. inside a React `useEffect`).

```js
const cc = ContentCredits.init({ apiKey: 'pub_YOUR_KEY', headless: true });

const unsubscribe = cc.subscribe((state) => {
  renderPaywall(state);
});

// Later:
unsubscribe();
```

### Option C — `cc.getState()` snapshot

Use `getState()` to read the current state at a specific moment — for example, inside an event handler.

```js
cc.on('ready', () => {
  const state = cc.getState();
  console.log('Access:', state.hasAccess);
  console.log('User:', state.user?.firstName);
});

cc.on('auth:login', () => {
  const state = cc.getState();
  updateHeader(state.user);
});
```

`getState()` returns a snapshot; it does not subscribe to future changes.

---

## Initial state (before `ready` fires)

Before the `ready` event, all fields are in their default/unknown state:

```json
{
  "isLoading": false,
  "isLoaded": false,
  "isLoggedIn": false,
  "hasAccess": false,
  "isExtensionAvailable": false,
  "user": null,
  "creditBalance": null,
  "requiredCredits": null
}
```
