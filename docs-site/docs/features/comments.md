---
id: comments
title: Comment System
sidebar_position: 2
---

# Comment System

The Content Credits comment system is a full-featured, threaded discussion panel that appears on every article. It's built inside a **Shadow DOM**, so it never conflicts with your site's CSS or JavaScript.

---

## What readers can do

- Post top-level comments on the article
- Reply to any comment (one level of threading)
- Like / unlike any comment
- Edit or delete their own comments
- Sort comments by **Top** (most liked), **Newest**, or **Most Tipped**
- View comment count and author info

Publishers and admins can moderate comments from the Content Credits dashboard.

---

## The floating widget

When the comment system is enabled, a floating circular button appears in the **bottom-right corner** of the page. It shows the total comment count as a badge.

- **Draggable** — readers can drag it anywhere on screen; position is saved to `localStorage`
- **Touch-friendly** — works on mobile with tap and drag
- Clicking the button opens the full comment panel

---

## The comment panel

Clicking the widget opens a slide-in panel (Shadow DOM) with the full thread:

```
┌─────────────────────────────────────────┐
│ Comments (12)        [Sort: Top ▼] [✕]  │
├─────────────────────────────────────────┤
│                                         │
│ 👤 Jane W. · 2h ago            ♥ 14    │
│ Great analysis of the credit model.     │
│   [Reply] [Edit] [Delete]               │
│                                         │
│   └─ 👤 Sam K. · 1h ago       ♥ 3     │
│      Agreed — especially the third      │
│      point about infrastructure.        │
│      [Reply]                            │
│                                         │
│ 👤 Alex M. · 5h ago            ♥ 8    │
│ The bounce rate data is fascinating.    │
│   [Reply]                               │
│                                         │
├─────────────────────────────────────────┤
│ Write a comment...                      │
│                                [Post]   │
└─────────────────────────────────────────┘
```

---

## Enabling / disabling

Comments are enabled by default. To disable them:

```js
ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  contentSelector: '#premium-content',
  enableComments: false,   // ← disables widget and panel entirely
});
```

Or via data attribute:

```html
<script
  src="..."
  data-api-key="pub_YOUR_KEY"
  data-enable-comments="false"
></script>
```

---

## Programmatic control

You can open and close the comment panel from your own code:

```js
const cc = ContentCredits.init({ ... });

// Open the panel
cc.openComments();

// Close the panel
cc.closeComments();
```

This is useful if you want to add your own "View comments" button in your article template.

---

## Authentication for comments

Readers must be logged in to post, edit, delete, or like comments. If a reader who isn't logged in tries to interact:

- On **desktop**: a login popup opens automatically
- On **mobile**: the reader is redirected to the login page and returned after authenticating

Readers who are not logged in can still **read** all comments.

---

## Comment events

Subscribe to comment activity through the SDK event system:

```js
cc.on('comment:posted', ({ comment }) => {
  console.log('New comment:', comment.content);
});

cc.on('comment:liked', ({ commentId, hasLiked }) => {
  console.log(commentId, hasLiked ? 'liked' : 'unliked');
});

cc.on('comment:deleted', ({ commentId }) => {
  console.log('Comment deleted:', commentId);
});
```

See the full [Events reference](/api-reference/events) for all available events.

---

## Shadow DOM isolation

The entire comment panel — HTML, CSS, JavaScript interactions — lives inside a `ShadowRoot`. This means:

- **Your CSS cannot accidentally break the panel**, and the panel's CSS cannot bleed into your page
- No class name conflicts
- No `z-index` wars
- Works correctly even if your page uses CSS reset libraries or opinionated frameworks

---

## Security

All comment content is rendered using safe DOM construction — user-provided text is set via `element.textContent`, never `innerHTML`. This prevents XSS attacks even if a reader submits malicious HTML in a comment.
