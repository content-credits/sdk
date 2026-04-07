---
id: contentcredits-class
title: ContentCredits Class
sidebar_position: 1
---

# ContentCredits Class

The main class exported by the SDK. You create one instance per page via `ContentCredits.init()`.

---

## `ContentCredits.init(config)` · static

Creates and starts an SDK instance. Returns the instance immediately; the async startup (access check, UI render) runs in the background.

```ts
const cc = ContentCredits.init(config: SDKConfig): ContentCredits
```

**Throws** if `apiKey` is missing, empty, or not a string.

```ts
const cc = ContentCredits.init({
  apiKey: 'pub_YOUR_API_KEY',
  contentSelector: '#premium-content',
  teaserParagraphs: 2,
  enableComments: true,
});
```

See the [Configuration reference](/api-reference/configuration) for all options.

---

## `cc.on(event, handler)` → unsubscribe

Subscribe to an SDK event. Returns an unsubscribe function.

```ts
cc.on(event: SDKEventName, handler: SDKEventHandler<K>): () => void
```

```ts
const unsub = cc.on('auth:login', ({ user }) => {
  console.log('Logged in:', user.email);
});

// Later, to stop listening:
unsub();
```

See the [Events reference](/api-reference/events) for all event names and payload types.

---

## `cc.off(event, handler)`

Unsubscribe a specific handler from an event.

```ts
cc.off(event: SDKEventName, handler: SDKEventHandler<K>): void
```

```ts
const handler = ({ user }) => console.log(user);
cc.on('auth:login', handler);

// Later:
cc.off('auth:login', handler);
```

---

## `cc.subscribe(fn)` → unsubscribe

Subscribe to state changes. The callback fires with a full `SDKState` snapshot every time any field changes. Returns an unsubscribe function.

```ts
cc.subscribe(fn: (state: SDKState) => void): () => void
```

```ts
const unsubscribe = cc.subscribe((state) => {
  document.getElementById('spinner').hidden = !state.isLoading;
  document.getElementById('paywall').hidden = state.hasAccess;
});

// Later, to stop listening:
unsubscribe();
```

Equivalent to passing `onStateChange` in the config. Useful in headless mode when you can't pass callbacks at init time (e.g. inside a React hook).

---

## `cc.login()` → `Promise<void>`

Trigger the login flow programmatically.

```ts
cc.login(): Promise<void>
```

- **Desktop**: opens a popup window to `accounts.contentcredits.com`
- **Mobile**: performs a full-page redirect
- **Extension**: delegates to the browser extension

Use this in headless mode to wire your own "Log in" button:

```js
document.getElementById('btn-login').onclick = () => cc.login();
```

---

## `cc.purchase()` → `Promise<void>`

Trigger the article purchase flow programmatically. Deducts the required credits and emits `article:purchased` on success. If the user is not logged in, opens the login flow first.

```ts
cc.purchase(): Promise<void>
```

```js
document.getElementById('btn-unlock').onclick = () => cc.purchase();
```

---

## `cc.buyMoreCredits()`

Open the Content Credits credit top-up dashboard in a new tab.

```ts
cc.buyMoreCredits(): void
```

```js
document.getElementById('btn-topup').onclick = () => cc.buyMoreCredits();
```

---

## `cc.getState()` → `SDKState`

Returns a snapshot of the current SDK state. Does not subscribe to changes — call it after events to get fresh values.

```ts
cc.getState(): SDKState
```

```ts
const state = cc.getState();
console.log(state.isLoggedIn);    // boolean
console.log(state.hasAccess);     // boolean
console.log(state.user);          // User | null
console.log(state.creditBalance); // number | null
```

See the [State reference](/api-reference/state) for all fields.

---

## `cc.checkAccess()` → `Promise<void>`

Programmatically trigger an article access check. The SDK checks the extension first, then calls the API. Results are emitted via events (`paywall:shown`, `paywall:hidden`).

```ts
await cc.checkAccess(): Promise<void>
```

Useful if your page content is dynamically loaded and you want to trigger the check after content is in the DOM:

```js
// Load article content dynamically
const html = await fetchArticleHtml();
document.getElementById('content').innerHTML = html;

// Now trigger the access check
await cc.checkAccess();
```

---

## `cc.openComments()`

Programmatically open the comment panel. Has no effect if `enableComments` was set to `false`.

```ts
cc.openComments(): void
```

```js
document.getElementById('my-comments-btn').addEventListener('click', () => {
  cc.openComments();
});
```

---

## `cc.closeComments()`

Programmatically close the comment panel.

```ts
cc.closeComments(): void
```

---

## `cc.isLoggedIn()` → `boolean`

Returns `true` if the reader currently has a valid auth token stored.

```ts
cc.isLoggedIn(): boolean
```

```js
if (cc.isLoggedIn()) {
  showPersonalisedUI();
}
```

---

## `cc.destroy()`

Tears down the SDK completely:
- Removes all UI elements (paywall overlay, comment widget, comment panel)
- Removes all event listeners (both internal and `document` CustomEvent listeners)
- Clears all stored state
- Restores any hidden content to visible

```ts
cc.destroy(): void
```

Always call `destroy()` before re-initialising on the same page, or when navigating in a SPA.

---

## `ContentCredits.version` · static, read-only

The current SDK version string.

```ts
ContentCredits.version: string
```

```js
console.log(ContentCredits.version); // "2.3.0"
```
