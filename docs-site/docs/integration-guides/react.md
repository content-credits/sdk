---
id: react
title: React & Next.js
sidebar_position: 3
---

# React & Next.js

Use the npm package for React and Next.js projects. The SDK is framework-agnostic TypeScript — it works the same in any bundled environment.

---

## Installation

```bash
npm install @contentcredits/sdk
```

---

## React — basic usage

```tsx
import { useEffect, useRef } from 'react';
import { ContentCredits } from '@contentcredits/sdk';

export function PremiumArticle({ apiKey, children }) {
  const ccRef = useRef(null);

  useEffect(() => {
    // Init after the component has mounted (DOM is ready)
    ccRef.current = ContentCredits.init({
      apiKey,
      contentSelector: '#premium-content',
      teaserParagraphs: 2,
      enableComments: true,
    });

    // Cleanup on unmount
    return () => {
      ccRef.current?.destroy();
      ccRef.current = null;
    };
  }, [apiKey]);

  return (
    <article>
      <p>This paragraph is free to read.</p>
      <p>This one too.</p>

      <div id="premium-content">
        {children}
      </div>
    </article>
  );
}
```

---

## React Hook

For cleaner component code, wrap the SDK in a custom hook:

```ts
// hooks/useContentCredits.ts
import { useEffect, useRef, useCallback } from 'react';
import { ContentCredits } from '@contentcredits/sdk';
import type { SDKConfig, SDKState } from '@contentcredits/sdk';

export function useContentCredits(config: SDKConfig) {
  const sdkRef = useRef<ContentCredits | null>(null);

  useEffect(() => {
    sdkRef.current = ContentCredits.init(config);
    return () => {
      sdkRef.current?.destroy();
      sdkRef.current = null;
    };
  }, [config.apiKey]);

  const on = useCallback(
    (event: string, handler: (payload: any) => void) =>
      sdkRef.current?.on(event as any, handler),
    []
  );

  const getState = useCallback(
    (): SDKState | null => sdkRef.current?.getState() ?? null,
    []
  );

  return { on, getState, sdk: sdkRef };
}
```

---

## Next.js (App Router)

The SDK uses browser APIs (`window`, `document`, `sessionStorage`) so it **cannot run during SSR**. Use a dynamic `import()` inside `useEffect` — this prevents the module from being evaluated by Node.js during prerendering.

### Recommended: `PremiumGate` component with SSR flash prevention

The `<style>` tag below is server-rendered, so content beyond the teaser is hidden **at HTML parse time** — before any JavaScript runs. This eliminates the flash of full content that would otherwise appear while the SDK bundle loads.

```tsx
// components/PremiumGate.tsx
'use client';

import { useEffect, useRef } from 'react';

interface PremiumGateProps {
  apiKey: string;
  children: React.ReactNode;
  teaserParagraphs?: number;
}

const GATE_STYLE_ID = 'cc-premium-gate-style';

export function PremiumGate({
  apiKey,
  children,
  teaserParagraphs = 2,
}: PremiumGateProps) {
  const ccRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    // Dynamic import prevents SSR from executing the SDK (no `document` in Node)
    import('@contentcredits/sdk').then(({ ContentCredits }) => {
      ccRef.current = ContentCredits.init({
        apiKey,
        contentSelector: '#premium-content',
        teaserParagraphs,
        onAccessGranted: () => {
          // Remove the SSR hide-style once access is confirmed
          document.getElementById(GATE_STYLE_ID)?.remove();
        },
      });
    });

    return () => { ccRef.current?.destroy(); };
  }, [apiKey, teaserParagraphs]);

  return (
    <>
      {/* Server-rendered — hides content at HTML parse time before JS runs */}
      <style id={GATE_STYLE_ID}>{`
        #premium-content > *:nth-child(n+${teaserParagraphs + 1}) { display: none !important; }
      `}</style>
      {/* --cc-bg controls the gradient fade colour — match your background */}
      <div id="premium-content" style={{ '--cc-bg': '#fff' } as React.CSSProperties}>
        {children}
      </div>
    </>
  );
}
```

Then in your page:

```tsx
// app/articles/[slug]/page.tsx
import { PremiumGate } from '@/components/PremiumGate';

export default async function ArticlePage({ params }) {
  const article = await getArticle(params.slug);

  return (
    <main>
      <h1>{article.title}</h1>

      {article.isPremium ? (
        <PremiumGate apiKey={process.env.NEXT_PUBLIC_CC_API_KEY!}>
          <div dangerouslySetInnerHTML={{ __html: article.body }} />
        </PremiumGate>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: article.body }} />
      )}
    </main>
  );
}
```

:::info Why dynamic import?
Top-level `import { ContentCredits } from '@contentcredits/sdk'` will fail during Next.js prerendering because the SDK immediately accesses `document` and `window` when the module is loaded — which don't exist in Node.js. Using `import()` inside `useEffect` defers module evaluation to the browser.
:::

---

## Next.js (Pages Router)

```tsx
// pages/articles/[slug].tsx
import { useEffect, useRef } from 'react';
import type { GetServerSideProps } from 'next';

export default function ArticlePage({ article, apiKey }) {
  const ccRef = useRef(null);

  useEffect(() => {
    if (!article.isPremium) return;

    import('@contentcredits/sdk').then(({ ContentCredits }) => {
      ccRef.current = ContentCredits.init({
        apiKey,
        contentSelector: '#premium-content',
      });
    });

    return () => { ccRef.current?.destroy(); };
  }, [article.isPremium, apiKey]);

  return (
    <article>
      <h1>{article.title}</h1>
      <div
        id="premium-content"
        dangerouslySetInnerHTML={{ __html: article.body }}
      />
    </article>
  );
}
```

---

## Headless mode — fully custom UI

Set `headless: true` and the SDK becomes a pure logic layer: it never touches the DOM, never injects any UI, and never hides or shows anything. You get callbacks for every paywall state change and methods to trigger every action. Your design, your markup, your framework.

### How it works

```
SDK responsibilities (headless: true)       Your responsibilities
────────────────────────────────────────    ────────────────────────────────────────
✓ Detect extension / check token            ✓ Show / hide the premium content
✓ Call the access-check API                 ✓ Render the paywall UI (login / purchase)
✓ Run the login popup or redirect           ✓ Clamp or blur paragraphs
✓ Run the purchase API call                 ✓ Show loading spinners
✓ Fire callbacks at every state change      ✓ Handle errors in your own UI
```

### Minimal setup — callbacks only

Pass callbacks directly in `init()`. No `subscribe()` or `on()` calls needed.

```js
const cc = ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  headless: true,

  // ── State-transition callbacks ───────────────────────────────────────────

  onLoginRequired() {
    // User hit the paywall and is not logged in.
    // Show your login UI. Call cc.login() when they click the button.
    showSection('ui-login');
  },

  onPurchaseRequired({ requiredCredits, creditBalance }) {
    // User is logged in but hasn't bought this article.
    // Show your purchase UI. Call cc.purchase() when they click the button.
    document.getElementById('credit-cost').textContent = requiredCredits;
    showSection('ui-purchase');
  },

  onInsufficientCredits({ required, available }) {
    // User is logged in but their balance is too low.
    // Show a top-up prompt. Call cc.buyMoreCredits() to open the dashboard.
    document.getElementById('credits-needed').textContent = required - available;
    showSection('ui-topup');
  },

  onAccessGranted() {
    // Access confirmed — reveal your full content.
    document.getElementById('premium-content').style.display = 'block';
    document.getElementById('paywall').style.display = 'none';
  },

  // ── Optional ─────────────────────────────────────────────────────────────

  onStateChange(state) {
    // Fires on every state change. Useful for loading indicators.
    document.getElementById('spinner').hidden = !state.isLoading;
  },

  onPurchased({ creditsSpent, remainingBalance }) {
    analytics.track('article_purchased', { creditsSpent, remainingBalance });
  },

  onError({ message }) {
    console.error('[CC]', message);
  },
});

// ── Action methods — call these from your own buttons ──────────────────────

document.getElementById('btn-login').onclick    = () => cc.login();
document.getElementById('btn-purchase').onclick = () => cc.purchase();
document.getElementById('btn-topup').onclick    = () => cc.buyMoreCredits();
```

That's it. No framework. No extra wiring.

---

### All callbacks reference

These go directly in the `init()` config object.

| Callback | When it fires | What to do |
|---|---|---|
| `onLoginRequired()` | Paywall hit, user not logged in | Show login UI → call `cc.login()` |
| `onPurchaseRequired({ requiredCredits, creditBalance })` | Logged in, article not purchased | Show unlock UI → call `cc.purchase()` |
| `onInsufficientCredits({ required, available })` | Logged in, balance too low | Show top-up UI → call `cc.buyMoreCredits()` |
| `onAccessGranted()` | Access confirmed (existing or just purchased) | Reveal full content |
| `onStateChange(state)` | Any state field changes | Drive loading spinners, reactive UI |
| `onReady(state)` | First access check complete | Ideal for hiding initial skeletons |
| `onPurchased({ creditsSpent, remainingBalance })` | Purchase succeeded | Analytics, balance display |
| `onUserLogin(user)` | User authenticated | Update nav/avatar |
| `onUserLogout()` | User logged out | Update nav |
| `onError({ message, error? })` | Any SDK error | Show error toast |

### All action methods reference

Call these on the `cc` instance returned by `ContentCredits.init()`.

| Method | What it does |
|---|---|
| `cc.login()` | Opens the login popup (desktop) or full-page redirect (mobile) |
| `cc.purchase()` | Runs the article purchase flow. Auto-opens login first if needed |
| `cc.buyMoreCredits()` | Opens the Content Credits credit top-up dashboard in a new tab |
| `cc.checkAccess()` | Re-runs the access check manually (useful after navigation) |
| `cc.getState()` | Returns a snapshot of the current `SDKState` |
| `cc.subscribe(fn)` | Subscribe to state changes — alternative to `onStateChange` in config |
| `cc.on(event, handler)` | Subscribe to a named event (see Events reference) |
| `cc.destroy()` | Tear down the SDK instance (call on SPA navigation) |

### `SDKState` reference

Returned by `getState()` and passed to `onStateChange` and `subscribe()`.

| Field | Type | Meaning |
|---|---|---|
| `isLoading` | `boolean` | Access-check or purchase in flight |
| `isLoaded` | `boolean` | First access check has completed |
| `isLoggedIn` | `boolean` | User has a valid session |
| `hasAccess` | `boolean` | User has access to this article |
| `user` | `User \| null` | Full user object when logged in |
| `creditBalance` | `number \| null` | User's current credit balance |
| `requiredCredits` | `number \| null` | Credits needed to unlock this article |
| `isExtensionAvailable` | `boolean` | Content Credits extension is installed |

---

### Complete vanilla JS example

```html
<!-- Your article markup — you control all of this -->
<div id="article-teaser">
  <p>First paragraph — always visible.</p>
  <p>Second paragraph — always visible.</p>
</div>

<div id="article-full" style="display:none">
  <p>Third paragraph…</p>
  <p>Fourth paragraph…</p>
  <!-- rest of article -->
</div>

<!-- Your paywall UI — one section per state -->
<div id="paywall">
  <div id="ui-loading"  class="paywall-state">Checking access…</div>

  <div id="ui-login" class="paywall-state" style="display:none">
    <h2>Read the full article</h2>
    <p>Sign in with your Content Credits account to unlock.</p>
    <button id="btn-login">Log in</button>
  </div>

  <div id="ui-purchase" class="paywall-state" style="display:none">
    <h2>Unlock this article</h2>
    <p>Cost: <strong id="credit-cost">—</strong> credits</p>
    <p>Your balance: <strong id="credit-balance">—</strong></p>
    <button id="btn-purchase">Unlock now</button>
  </div>

  <div id="ui-topup" class="paywall-state" style="display:none">
    <h2>Not enough credits</h2>
    <p>You need <strong id="credits-needed">—</strong> more credits.</p>
    <button id="btn-topup">Buy credits</button>
  </div>
</div>

<script src="https://cdn.contentcredits.com/sdk/v2/content-credits.umd.min.js"></script>
<script>
  function showState(id) {
    ['ui-loading', 'ui-login', 'ui-purchase', 'ui-topup'].forEach(s => {
      document.getElementById(s).style.display = s === id ? 'block' : 'none';
    });
  }

  const cc = ContentCreditsSDK.ContentCredits.init({
    apiKey: 'pub_YOUR_KEY',
    headless: true,

    onLoginRequired() {
      showState('ui-login');
    },

    onPurchaseRequired({ requiredCredits, creditBalance }) {
      document.getElementById('credit-cost').textContent    = requiredCredits ?? '?';
      document.getElementById('credit-balance').textContent = creditBalance   ?? '?';
      showState('ui-purchase');
    },

    onInsufficientCredits({ required, available }) {
      document.getElementById('credits-needed').textContent = required - available;
      showState('ui-topup');
    },

    onAccessGranted() {
      document.getElementById('paywall').style.display       = 'none';
      document.getElementById('article-full').style.display  = 'block';
    },

    onStateChange(state) {
      if (state.isLoading) showState('ui-loading');
    },

    onError({ message }) {
      console.error('[ContentCredits]', message);
    },
  });

  document.getElementById('btn-login').onclick    = () => cc.login();
  document.getElementById('btn-purchase').onclick = () => cc.purchase();
  document.getElementById('btn-topup').onclick    = () => cc.buyMoreCredits();
</script>
```

---

### React / Next.js — `useContentCredits` hook

Use `onStateChange` in config to push state into React. All the logic stays in `init()` — the hook is just a thin bridge.

```tsx
// hooks/useContentCredits.ts
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { SDKConfig, SDKState, ContentCredits } from '@contentcredits/sdk';

export function useContentCredits(config: SDKConfig & { headless: true }) {
  const sdkRef = useRef<ContentCredits | null>(null);
  const [state, setState] = useState<SDKState | null>(null);

  useEffect(() => {
    import('@contentcredits/sdk').then(({ ContentCredits }) => {
      sdkRef.current = ContentCredits.init({
        ...config,
        onStateChange: (s) => {
          setState(s);
          config.onStateChange?.(s);  // forward if caller also passed one
        },
      });
      setState(sdkRef.current.getState());
    });
    return () => { sdkRef.current?.destroy(); sdkRef.current = null; };
  }, [config.apiKey]);

  return {
    state,
    login:          useCallback(() => sdkRef.current?.login(),          []),
    purchase:       useCallback(() => sdkRef.current?.purchase(),       []),
    buyMoreCredits: useCallback(() => sdkRef.current?.buyMoreCredits(), []),
  };
}
```

Component usage — the SDK calls your callbacks for navigation/side-effects; React state drives the render:

```tsx
// components/PremiumArticle.tsx
'use client';
import { useContentCredits } from '@/hooks/useContentCredits';

interface Props {
  content: string[];      // article paragraphs
  teaserCount?: number;
  apiKey: string;
}

export function PremiumArticle({ content, teaserCount = 2, apiKey }: Props) {
  const { state, login, purchase, buyMoreCredits } = useContentCredits({
    apiKey,
    headless: true,
    onPurchased: ({ creditsSpent }) => {
      analytics.track('article_purchased', { creditsSpent });
    },
  });

  const hasAccess     = state?.hasAccess   ?? false;
  const isLoading     = state?.isLoading   ?? true;
  const isLoaded      = state?.isLoaded    ?? false;
  const isLoggedIn    = state?.isLoggedIn  ?? false;
  const balance       = state?.creditBalance   ?? 0;
  const cost          = state?.requiredCredits ?? 0;
  const notEnough     = isLoggedIn && !hasAccess && balance < cost;

  return (
    <article>
      {/* Teaser — always visible */}
      {content.slice(0, teaserCount).map((p, i) => <p key={i}>{p}</p>)}

      {/* Full content — only when access is granted */}
      {hasAccess && content.slice(teaserCount).map((p, i) => <p key={i}>{p}</p>)}

      {/* Paywall — hidden once access is granted */}
      {!hasAccess && (
        <div className="paywall">
          {!isLoaded || isLoading ? (
            <p>Checking access…</p>

          ) : !isLoggedIn ? (
            <>
              <h3>Continue reading</h3>
              <p>Log in to unlock this article with Content Credits.</p>
              <button onClick={login}>Log in</button>
            </>

          ) : notEnough ? (
            <>
              <h3>Not enough credits</h3>
              <p>Need {cost}, have {balance}.</p>
              <button onClick={buyMoreCredits}>Top up</button>
            </>

          ) : (
            <>
              <h3>Unlock this article</h3>
              <p>{cost} credit{cost !== 1 ? 's' : ''}</p>
              <button onClick={purchase} disabled={isLoading}>
                {isLoading ? 'Processing…' : 'Unlock'}
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
```

Page:

```tsx
// app/articles/[slug]/page.tsx
import { PremiumArticle } from '@/components/PremiumArticle';

export default async function ArticlePage({ params }) {
  const article = await getArticle(params.slug);
  const paragraphs = article.body.split('\n').filter(Boolean);

  return (
    <main>
      <h1>{article.title}</h1>
      {article.isPremium ? (
        <PremiumArticle
          content={paragraphs}
          teaserCount={2}
          apiKey={process.env.NEXT_PUBLIC_CC_API_KEY!}
        />
      ) : (
        paragraphs.map((p, i) => <p key={i}>{p}</p>)
      )}
    </main>
  );
}
```

---

## TypeScript types

The package exports all relevant types:

```ts
import type {
  SDKConfig,
  SDKState,
  SDKEventName,
  SDKEventHandler,
  User,
  Comment,
  CommentSortBy,
} from '@contentcredits/sdk';
```

---

## Environment variable for API key

Never hardcode API keys in source files. Use environment variables:

```bash
# .env.local
NEXT_PUBLIC_CC_API_KEY=pub_YOUR_API_KEY
```

```tsx
ContentCredits.init({
  apiKey: process.env.NEXT_PUBLIC_CC_API_KEY!,
  ...
});
```

The `pub_` prefix API keys are **safe for client-side use** — they identify your publisher account but don't grant any privileged access. They are similar to Stripe's publishable keys.

---

## SPAs and client-side routing

In single-page apps where the URL changes without a full page reload, call `destroy()` and reinitialise when navigating to a new article:

```ts
let cc: ContentCredits | null = null;

router.on('navigate', (newUrl) => {
  cc?.destroy();
  cc = ContentCredits.init({
    apiKey: 'pub_YOUR_KEY',
    articleUrl: newUrl,
    contentSelector: '#premium-content',
  });
});
```

The `articleUrl` option ensures the access check is done for the new article, not the previous one.

---

## Full example

A complete, runnable Next.js 14 blog using this pattern is available in the SDK repository:

**[`examples/nextjs-blog`](https://github.com/content-credits/sdk/tree/main/examples/nextjs-blog)**

It includes free and premium articles, the `PremiumGate` component, and a one-click Vercel deploy button.
