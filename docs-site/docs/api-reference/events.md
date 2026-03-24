---
id: events
title: Events Reference
sidebar_position: 3
---

# Events Reference

Complete reference for all events emitted by the SDK.

---

## Event map

```ts
interface SDKEventMap {
  ready:                { state: SDKState };
  'auth:login':         { user: User };
  'auth:logout':        {};
  'paywall:shown':      {};
  'paywall:hidden':     {};
  'article:purchased':  { creditsSpent: number; remainingBalance: number };
  'credits:insufficient': { required: number; available: number };
  'comment:posted':     { comment: Comment };
  'comment:liked':      { commentId: string; hasLiked: boolean };
  'comment:deleted':    { commentId: string };
  error:                { message: string; error?: unknown };
}
```

---

## `ready`

**When:** SDK has finished initialising — access check is complete, all UI is rendered.

```ts
cc.on('ready', ({ state }) => {
  // state: SDKState
});
```

| Payload field | Type | Description |
|---|---|---|
| `state` | `SDKState` | Complete SDK state snapshot |

---

## `auth:login`

**When:** Reader successfully authenticates (popup or redirect flow).

```ts
cc.on('auth:login', ({ user }) => {
  // user: User
});
```

| Payload field | Type | Description |
|---|---|---|
| `user._id` | `string` | Unique reader ID |
| `user.firstName` | `string` | First name |
| `user.lastName` | `string` | Last name |
| `user.email` | `string` | Email address |
| `user.credits` | `number` | Current credit balance |

---

## `auth:logout`

**When:** Reader's session ends — token expired or the API returned 401.

```ts
cc.on('auth:logout', () => { ... });
```

No payload.

---

## `paywall:shown`

**When:** The paywall overlay appears (reader does not have access).

```ts
cc.on('paywall:shown', () => { ... });
```

No payload.

---

## `paywall:hidden`

**When:** The paywall overlay is dismissed and content is revealed. This fires both when a reader already has access (on page load) and when they just purchased.

```ts
cc.on('paywall:hidden', () => { ... });
```

No payload.

---

## `article:purchased`

**When:** Reader successfully purchases the current article.

```ts
cc.on('article:purchased', ({ creditsSpent, remainingBalance }) => {
  // ...
});
```

| Payload field | Type | Description |
|---|---|---|
| `creditsSpent` | `number` | Credits deducted for this article |
| `remainingBalance` | `number` | Reader's remaining credit balance |

---

## `credits:insufficient`

**When:** Reader tries to buy but their credit balance is too low.

```ts
cc.on('credits:insufficient', ({ required, available }) => {
  // The SDK shows a "Top up" button automatically
});
```

| Payload field | Type | Description |
|---|---|---|
| `required` | `number` | Credits needed for this article |
| `available` | `number` | Reader's current balance |

---

## `comment:posted`

**When:** Reader successfully posts a new comment.

```ts
cc.on('comment:posted', ({ comment }) => {
  // comment: Comment
});
```

| Payload field | Type | Description |
|---|---|---|
| `comment._id` | `string` | New comment ID |
| `comment.content` | `string` | Comment text |
| `comment.author` | `CommentAuthor` | Author name/id |
| `comment.createdAt` | `string` | ISO timestamp |

---

## `comment:liked`

**When:** Reader likes or unlikes a comment.

```ts
cc.on('comment:liked', ({ commentId, hasLiked }) => { ... });
```

| Payload field | Type | Description |
|---|---|---|
| `commentId` | `string` | ID of the comment |
| `hasLiked` | `boolean` | `true` if just liked, `false` if just unliked |

---

## `comment:deleted`

**When:** Reader deletes one of their comments.

```ts
cc.on('comment:deleted', ({ commentId }) => { ... });
```

| Payload field | Type | Description |
|---|---|---|
| `commentId` | `string` | ID of the deleted comment |

---

## `error`

**When:** The SDK encounters an error — network failure, API error, or unexpected exception.

```ts
cc.on('error', ({ message, error }) => {
  console.error(message, error);
  Sentry.captureException(error);
});
```

| Payload field | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable error description |
| `error` | `unknown` | The underlying error object (if any) |

---

## Native CustomEvents

All SDK events are also dispatched as native `CustomEvent`s on `document`, prefixed with `contentcredits:`:

```js
// Same as cc.on('auth:login', handler)
document.addEventListener('contentcredits:auth:login', (e) => {
  console.log(e.detail); // { user: { ... } }
});

// Useful for Google Tag Manager
document.addEventListener('contentcredits:article:purchased', (e) => {
  dataLayer.push({ event: 'cc_purchase', ...e.detail });
});
```
