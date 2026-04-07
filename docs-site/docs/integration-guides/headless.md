---
id: headless
title: Headless / Custom UI
sidebar_position: 4
---

# Headless / Custom UI

By default the SDK manages its own paywall overlay — it hides your content, injects a built-in UI panel, and reveals the article once access is confirmed. **Headless mode turns all of that off.**

Set `headless: true` and the SDK becomes a pure logic layer: it runs the access check, manages the auth session, executes purchases, and fires callbacks. It never touches the DOM. You design and render everything.

---

## How it works

```
SDK responsibilities (headless: true)       Your responsibilities
────────────────────────────────────────    ────────────────────────────────────────
✓ Detect extension / validate token         ✓ Show / hide the premium content
✓ Call the access-check API                 ✓ Render the paywall UI
✓ Run the login popup or redirect           ✓ Clamp or blur teaser paragraphs
✓ Execute the purchase API call             ✓ Show loading / skeleton states
✓ Fire callbacks at every state change      ✓ Handle errors in your own UI
```

---

## Quick start

Pass `headless: true` plus the callbacks you need. No extra wiring required.

```js
const cc = ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  headless: true,

  onLoginRequired() {
    // User hit the paywall and is not logged in — show your login UI
    showSection('ui-login');
  },

  onPurchaseRequired({ requiredCredits, creditBalance }) {
    // Logged in but article not purchased — show your unlock UI
    document.getElementById('credit-cost').textContent = requiredCredits;
    showSection('ui-purchase');
  },

  onInsufficientCredits({ required, available }) {
    // Logged in but balance is too low — show a top-up prompt
    document.getElementById('credits-needed').textContent = required - available;
    showSection('ui-topup');
  },

  onAccessGranted() {
    // Access confirmed — reveal your full content
    document.getElementById('premium-content').style.display = 'block';
    document.getElementById('paywall').style.display = 'none';
  },

  onStateChange(state) {
    // Fires on every change — useful for loading indicators
    document.getElementById('spinner').hidden = !state.isLoading;
  },
});

// Wire your buttons to SDK action methods
document.getElementById('btn-login').onclick    = () => cc.login();
document.getElementById('btn-purchase').onclick = () => cc.purchase();
document.getElementById('btn-topup').onclick    = () => cc.buyMoreCredits();
```

---

## Callbacks reference

All callbacks are passed directly in the `init()` config object. They fire regardless of whether `headless` is `true` or `false` — in headless mode they are your only UI trigger.

| Callback | When it fires | Typical response |
|---|---|---|
| `onLoginRequired()` | Paywall hit, user not logged in | Show login UI → call `cc.login()` |
| `onPurchaseRequired({ requiredCredits, creditBalance })` | Logged in, article not purchased | Show unlock UI → call `cc.purchase()` |
| `onInsufficientCredits({ required, available })` | Logged in, balance too low | Show top-up UI → call `cc.buyMoreCredits()` |
| `onAccessGranted()` | Access confirmed (existing or just purchased) | Reveal full content |
| `onStateChange(state)` | Any state field changes | Drive loading spinners, reactive UI |
| `onReady(state)` | First access check complete | Hide initial skeleton |
| `onPurchased({ creditsSpent, remainingBalance })` | Purchase succeeded | Analytics, update balance display |
| `onUserLogin(user)` | User authenticated | Update nav / avatar |
| `onUserLogout()` | User logged out | Update nav |
| `onError({ message, error? })` | Any SDK error | Show error toast |

---

## Action methods reference

Call these on the `cc` instance returned by `ContentCredits.init()`.

| Method | What it does |
|---|---|
| `cc.login()` | Opens the login popup (desktop) or full-page redirect (mobile) |
| `cc.purchase()` | Runs the article purchase flow — auto-opens login first if needed |
| `cc.buyMoreCredits()` | Opens the Content Credits credit top-up dashboard in a new tab |
| `cc.checkAccess()` | Re-runs the access check (useful after SPA navigation) |
| `cc.getState()` | Returns a snapshot of the current `SDKState` |
| `cc.subscribe(fn)` | Subscribe to state changes — alternative to `onStateChange` in config |
| `cc.on(event, handler)` | Subscribe to a named event (see [Events reference](/features/events)) |
| `cc.destroy()` | Tear down the SDK instance (call on SPA unmount / navigation) |

---

## `SDKState` reference

Returned by `cc.getState()` and passed to `onStateChange` / `cc.subscribe()`.

| Field | Type | Meaning |
|---|---|---|
| `isLoading` | `boolean` | Access-check or purchase request in flight |
| `isLoaded` | `boolean` | First access check has completed |
| `isLoggedIn` | `boolean` | User has a valid session |
| `hasAccess` | `boolean` | User has access to this article |
| `creditBalance` | `number \| null` | User's current credit balance |
| `requiredCredits` | `number \| null` | Credits needed to unlock this article |
| `user` | `User \| null` | Full user object when logged in |
| `isExtensionAvailable` | `boolean` | Content Credits browser extension is installed |

---

## Vanilla JS example

A complete self-contained example — no framework, no bundler.

```html
<!-- Your article markup -->
<div id="article-teaser">
  <p>First paragraph — always visible.</p>
  <p>Second paragraph — always visible.</p>
</div>

<div id="article-full" style="display:none">
  <p>Third paragraph…</p>
  <p>Fourth paragraph…</p>
</div>

<!-- Your paywall UI — one section per state -->
<div id="paywall">
  <div id="ui-loading">Checking access…</div>

  <div id="ui-login" style="display:none">
    <h2>Read the full article</h2>
    <p>Sign in to unlock with Content Credits.</p>
    <button id="btn-login">Sign in</button>
  </div>

  <div id="ui-purchase" style="display:none">
    <h2>Unlock this article</h2>
    <p>Cost: <strong id="credit-cost">—</strong> credits</p>
    <p>Your balance: <strong id="credit-balance">—</strong></p>
    <button id="btn-purchase">Unlock now</button>
  </div>

  <div id="ui-topup" style="display:none">
    <h2>Not enough credits</h2>
    <p>You need <strong id="credits-needed">—</strong> more credits.</p>
    <button id="btn-topup">Get more credits</button>
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
      document.getElementById('paywall').style.display      = 'none';
      document.getElementById('article-full').style.display = 'block';
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

## React / Next.js example

This is the exact `PremiumGate` component used in the [SDK example app](https://github.com/content-credits/sdk/tree/main/examples/nextjs-blog). It uses `headless: true` — the SDK delivers state only, every pixel of the paywall UI is owned by your component.

### How the content teaser works

Instead of CSS hacks or DOM manipulation, pass your pre-rendered content as a `blocks` array. The component slices the array in React — no `display: none`, no `!important`, no flash of full content on load (React renders the teaser server-side so the initial HTML is already correct).

### `PremiumGate` component

```tsx
// components/PremiumGate.tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface CCState {
  isLoading: boolean;
  isLoaded: boolean;
  isLoggedIn: boolean;
  hasAccess: boolean;
  creditBalance: number | null;
  requiredCredits: number | null;
}

const INITIAL_STATE: CCState = {
  isLoading: false,
  isLoaded: false,
  isLoggedIn: false,
  hasAccess: false,
  creditBalance: null,
  requiredCredits: null,
};

interface PremiumGateProps {
  apiKey: string;
  blocks: React.ReactNode[];   // pre-rendered content blocks
  teaserCount?: number;        // how many blocks to show before the paywall
}

export function PremiumGate({ apiKey, blocks, teaserCount = 3 }: PremiumGateProps) {
  const sdkRef = useRef<any>(null);
  const [state, setState] = useState<CCState>(INITIAL_STATE);

  useEffect(() => {
    // Dynamic import keeps the SDK out of the SSR bundle
    import('@contentcredits/sdk').then(({ ContentCredits }) => {
      const cc = ContentCredits.init({
        apiKey,
        headless: true,
        enableComments: false,
        onStateChange: (s: CCState) => setState({ ...s }),
      });
      sdkRef.current = cc;
      setState({ ...(cc.getState() as CCState) });
    });

    return () => { sdkRef.current?.destroy(); sdkRef.current = null; };
  }, [apiKey]);

  const login          = useCallback(() => sdkRef.current?.login(),          []);
  const purchase       = useCallback(() => sdkRef.current?.purchase(),       []);
  const buyMoreCredits = useCallback(() => sdkRef.current?.buyMoreCredits(), []);

  const { isLoaded, isLoggedIn, hasAccess, creditBalance, requiredCredits } = state;
  const balance  = creditBalance ?? 0;
  const cost     = requiredCredits;
  const notEnough = isLoggedIn && !hasAccess && cost !== null && balance < cost;

  return (
    <div>
      {/* Content — full array when access granted, sliced teaser otherwise */}
      {hasAccess ? (
        <div className="prose-content">{blocks}</div>
      ) : (
        <div className="relative overflow-hidden">
          <div className="prose-content">{blocks.slice(0, teaserCount)}</div>
          {/* Gradient fade over the last teaser block */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent 0%, #f9fafb 75%)' }}
          />
        </div>
      )}

      {/* Paywall panel — hidden once access is granted */}
      {!hasAccess && (
        <div className="border-t-[3px] border-gray-900 mt-2 pt-12 pb-16">
          <div className="max-w-sm mx-auto text-center">

            {/* Loading skeleton */}
            {!isLoaded && (
              <div className="animate-pulse space-y-4">
                <div className="h-7 bg-gray-200 rounded w-3/4 mx-auto" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
                <div className="h-12 bg-gray-300 rounded-full w-full mt-6" />
              </div>
            )}

            {/* Not logged in */}
            {isLoaded && !isLoggedIn && (
              <>
                <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-5">
                  Premium Article
                </p>
                <h2 className="text-3xl font-bold leading-snug mb-3"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                  Sign in to read this story.
                </h2>
                <p className="text-gray-500 text-sm mb-8">
                  This article is available to Content Credits members.
                </p>
                <button onClick={login}
                  className="w-full bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold tracking-wide py-3.5 rounded-full transition-colors">
                  Sign In to Read
                </button>
              </>
            )}

            {/* Logged in — insufficient credits */}
            {isLoaded && isLoggedIn && notEnough && (
              <>
                <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-5">
                  Premium Article
                </p>
                <h2 className="text-3xl font-bold leading-snug mb-3"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                  You need more credits.
                </h2>
                <p className="text-gray-500 text-sm mb-8">
                  This article costs <strong className="text-gray-700">{cost}</strong> credits.
                  Your balance is <strong className="text-gray-700">{balance}</strong>.
                </p>
                <button onClick={buyMoreCredits}
                  className="w-full bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold tracking-wide py-3.5 rounded-full transition-colors">
                  Get More Credits
                </button>
              </>
            )}

            {/* Logged in — can purchase */}
            {isLoaded && isLoggedIn && !notEnough && !hasAccess && (
              <>
                <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-5">
                  Premium Article
                </p>
                <h2 className="text-3xl font-bold leading-snug mb-3"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                  Unlock this story.
                </h2>
                <p className="text-gray-500 text-sm mb-8">
                  Spend <strong className="text-gray-700">{cost} credits</strong> from your
                  balance of <strong className="text-gray-700">{balance}</strong> to read
                  the full article instantly.
                </p>
                <button onClick={purchase}
                  className="w-full bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold tracking-wide py-3.5 rounded-full transition-colors">
                  {cost !== null ? `Unlock for ${cost} Credits` : 'Unlock Article'}
                </button>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium">or</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <button onClick={buyMoreCredits}
                  className="w-full border border-gray-300 hover:border-gray-500 text-gray-700 text-sm font-semibold tracking-wide py-3.5 rounded-full transition-colors">
                  Get More Credits
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
```

### Article page usage

Render your content blocks as an array first, then pass the array to `PremiumGate`. The component handles the teaser slice internally — your page stays clean.

```tsx
// app/articles/[slug]/page.tsx
import { PremiumGate } from '@/components/PremiumGate';

export default async function ArticlePage({ params }) {
  const article = await getArticle(params.slug);
  const apiKey  = process.env.NEXT_PUBLIC_CC_API_KEY!;

  // Build an array of React elements — one per paragraph / heading / code block
  const blocks = article.body.split('\n\n').map((block, i) => {
    if (block.startsWith('## '))
      return <h2 key={i} className="text-2xl font-bold mt-10 mb-4">{block.slice(3)}</h2>;
    return <p key={i} className="text-gray-700 leading-relaxed mb-5">{block}</p>;
  });

  return (
    <article>
      <h1>{article.title}</h1>

      {article.isPremium ? (
        // Pass the array — PremiumGate slices it internally
        <PremiumGate apiKey={apiKey} blocks={blocks} teaserCount={3} />
      ) : (
        <div>{blocks}</div>
      )}
    </article>
  );
}
```

:::info Why blocks instead of children?
Passing `children` as a single node means the teaser has to be done with CSS (`display: none`). Passing `blocks` as an array lets the component slice it in React — the teaser is rendered as genuine HTML, no DOM hacks needed, no flash of hidden content.
:::

---

## `useContentCredits` hook

If you prefer a hook-based API, here's a thin wrapper that wires `onStateChange` into React state automatically.

```tsx
// hooks/useContentCredits.ts
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { SDKConfig, SDKState } from '@contentcredits/sdk';

export function useContentCredits(apiKey: string, extraConfig?: Partial<SDKConfig>) {
  const sdkRef = useRef<any>(null);
  const [state, setState] = useState<SDKState | null>(null);

  useEffect(() => {
    import('@contentcredits/sdk').then(({ ContentCredits }) => {
      const cc = ContentCredits.init({
        ...extraConfig,
        apiKey,
        headless: true,
        onStateChange: (s: SDKState) => {
          setState(s);
          extraConfig?.onStateChange?.(s);
        },
      });
      sdkRef.current = cc;
      setState(cc.getState() as SDKState);
    });
    return () => { sdkRef.current?.destroy(); sdkRef.current = null; };
  }, [apiKey]);

  return {
    state,
    login:          useCallback(() => sdkRef.current?.login(),          []),
    purchase:       useCallback(() => sdkRef.current?.purchase(),       []),
    buyMoreCredits: useCallback(() => sdkRef.current?.buyMoreCredits(), []),
  };
}
```

Usage:

```tsx
export function PremiumArticle({ apiKey, paragraphs }: Props) {
  const { state, login, purchase, buyMoreCredits } = useContentCredits(apiKey);

  const hasAccess  = state?.hasAccess  ?? false;
  const isLoaded   = state?.isLoaded   ?? false;
  const isLoggedIn = state?.isLoggedIn ?? false;
  const balance    = state?.creditBalance   ?? 0;
  const cost       = state?.requiredCredits ?? 0;
  const notEnough  = isLoggedIn && !hasAccess && balance < cost;

  return (
    <article>
      {paragraphs.slice(0, 2).map((p, i) => <p key={i}>{p}</p>)}

      {hasAccess && paragraphs.slice(2).map((p, i) => <p key={i}>{p}</p>)}

      {!hasAccess && (
        <div>
          {!isLoaded ? (
            <p>Loading…</p>
          ) : !isLoggedIn ? (
            <button onClick={login}>Sign in to read</button>
          ) : notEnough ? (
            <button onClick={buyMoreCredits}>Get more credits (need {cost - balance} more)</button>
          ) : (
            <button onClick={purchase}>Unlock for {cost} credits</button>
          )}
        </div>
      )}
    </article>
  );
}
```

---

## Comparison: default vs headless

| | Default mode | Headless mode |
|---|---|---|
| **Content hiding** | SDK injects CSS, hides elements | You slice/condition in React or set `display:none` yourself |
| **Paywall UI** | SDK renders built-in overlay | You render whatever you like |
| **Theming** | CSS variables + `paywallTemplate` | Full control — it's your markup |
| **Callbacks** | Optional — fire alongside built-in UI | Required — your only UI trigger |
| **When to use** | Fast setup, standard look | Custom design, framework-native UI |

---

## Full working example

The SDK repository contains a complete Next.js 14 blog that uses this exact headless pattern:

**[`examples/nextjs-blog`](https://github.com/content-credits/sdk/tree/main/examples/nextjs-blog)**
