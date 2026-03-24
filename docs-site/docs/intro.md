---
id: intro
title: Introduction
sidebar_position: 1
slug: /
---

# Introduction

**Content Credits** is a micro-transaction platform that lets publishers monetise individual articles without subscriptions. Readers pre-purchase a credit balance and spend credits one article at a time — no monthly commitment, no forgotten renewals.

The **Content Credits JS SDK** is the integration layer that connects your website to this platform. Drop it in with a single `<script>` tag and your site gets:

- **A paywall** — hides premium content until the reader pays the article's credit price
- **A comment system** — threaded discussions, likes, edit/delete, and sorting, all in an isolated Shadow DOM panel
- **Extension support** — detects the Content Credits Chrome extension for a seamless one-click experience

---

## How it works

```
Reader visits article
        │
        ▼
SDK checks credit store / extension
        │
   ┌────┴────┐
   │ Has     │ No access
   │ access? ├──────────► Show paywall overlay
   └────┬────┘                    │
        │ Yes                     ▼
        ▼              Reader logs in or buys credits
   Reveal content                 │
        │                         ▼
        ▼              SDK calls purchaseArticle()
  Comment widget                  │
  appears                         ▼
                         Content unlocked
```

### Three integration paths

| Path | Best for |
|------|----------|
| **Script tag (CDN)** | Any website — WordPress, static, custom CMS |
| **npm package** | React, Next.js, Vue, or any bundled frontend |
| **WordPress plugin** | Direct WordPress integration with no custom code |

---

## Key concepts

### Publishers
Publishers are organisations that own websites and want to gate content. Each publisher gets an **API key** from the Content Credits dashboard. That key is what you pass to `ContentCredits.init()`.

### Readers / Consumers
Readers create accounts at [accounts.contentcredits.com](https://accounts.contentcredits.com), purchase a credit bundle (e.g. 20 credits for $5), and spend credits to unlock individual articles across any participating publisher site.

### Credits
Credits are the currency of the platform. Publishers set a credit price per article (e.g. 3 credits). When a reader unlocks an article, those credits are transferred from the reader's balance to the publisher's earnings.

### The paywall
The SDK gates content **client-side** by hiding DOM elements matching a CSS selector you configure. When a reader is granted access, the elements are revealed. There is no server-side content splitting required.

### Comments
The comment system uses a floating widget button. Clicking it opens a full-featured panel rendered in a **Shadow DOM** (so your site's CSS never interferes with it). Comments are threaded, and readers can like, edit, or delete their own comments.

---

## Architecture overview

```
Your webpage
├── <script> Content Credits SDK (UMD)
│       ├── Auth module      — token storage, popup login
│       ├── API client       — fetch with retry + deduplication
│       ├── Paywall module   — CSS-selector gating + overlay UI
│       └── Comments module  — widget button + Shadow DOM panel
│
└── Communicates with
        ├── api.contentcredits.com  (REST API — article access, comments)
        └── accounts.contentcredits.com  (auth popup / redirect)
```

---

## Next steps

- [Installation](/getting-started/installation) — CDN script tag or npm
- [Quick Start](/getting-started/quick-start) — working paywall in 5 minutes
- [Configuration](/getting-started/configuration) — all options explained
