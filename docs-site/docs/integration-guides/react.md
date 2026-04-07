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

---

## Headless mode — bring your own UI

By default the SDK injects its own paywall overlay and hides/reveals the premium content element for you. If you want **full control** over the UI — your own paywall design, your own show/hide logic, your own paragraph clamping — use **headless mode**.

In headless mode the SDK:

- **Does not touch the DOM** (no `display: none`, no gradient fade, no overlay)
- Exposes reactive **state** via `subscribe()` so your component re-renders on every change
- Exposes **action methods** (`login()`, `purchase()`, `buyMoreCredits()`) you call from your own buttons

### Headless state shape

```ts
interface SDKState {
  isLoading: boolean;       // true while an access-check or purchase is in flight
  isLoaded: boolean;        // true once the first access check has completed
  isLoggedIn: boolean;      // true if the user has an active session
  hasAccess: boolean;       // true if the user has purchased / has access
  user: User | null;        // full user object when logged in
  creditBalance: number | null;   // user's current credit balance
  requiredCredits: number | null; // credits needed to unlock this article
  isExtensionAvailable: boolean;
}
```

### React hook — `useContentCreditsHeadless`

```ts
// hooks/useContentCreditsHeadless.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import type { SDKState } from '@contentcredits/sdk';

interface UseContentCreditsHeadlessReturn {
  state: SDKState | null;
  login: () => void;
  purchase: () => void;
  buyMoreCredits: () => void;
}

export function useContentCreditsHeadless(
  apiKey: string,
  articleUrl?: string
): UseContentCreditsHeadlessReturn {
  const sdkRef = useRef<import('@contentcredits/sdk').ContentCredits | null>(null);
  const [state, setState] = useState<SDKState | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    import('@contentcredits/sdk').then(({ ContentCredits }) => {
      sdkRef.current = ContentCredits.init({
        apiKey,
        articleUrl,
        headless: true,      // ← disable all built-in DOM/UI handling
        enableComments: false,
      });

      // Subscribe to state changes — drives your UI reactively
      unsubscribe = sdkRef.current.subscribe(setState);

      // Seed with the current snapshot (before any change fires)
      setState(sdkRef.current.getState());
    });

    return () => {
      unsubscribe?.();
      sdkRef.current?.destroy();
      sdkRef.current = null;
    };
  }, [apiKey, articleUrl]);

  const login = useCallback(() => { sdkRef.current?.login(); }, []);
  const purchase = useCallback(() => { sdkRef.current?.purchase(); }, []);
  const buyMoreCredits = useCallback(() => { sdkRef.current?.buyMoreCredits(); }, []);

  return { state, login, purchase, buyMoreCredits };
}
```

### Full Next.js example — custom paywall UI

This example shows a custom paywall where **you** decide which paragraphs to show, render your own paywall card, and wire up your own buttons.

```tsx
// components/HeadlessPremiumArticle.tsx
'use client';

import { useContentCreditsHeadless } from '@/hooks/useContentCreditsHeadless';

interface Props {
  paragraphs: string[];   // article body split into paragraphs
  teaserCount?: number;   // how many to show before the paywall
  apiKey: string;
}

export function HeadlessPremiumArticle({ paragraphs, teaserCount = 2, apiKey }: Props) {
  const { state, login, purchase, buyMoreCredits } = useContentCreditsHeadless(apiKey);

  const isLocked = !state?.hasAccess;

  return (
    <div>
      {/* Always show teaser paragraphs */}
      {paragraphs.slice(0, teaserCount).map((p, i) => (
        <p key={i}>{p}</p>
      ))}

      {/* Remaining paragraphs — hidden until access is granted */}
      {!isLocked && paragraphs.slice(teaserCount).map((p, i) => (
        <p key={i}>{p}</p>
      ))}

      {/* Your custom paywall card */}
      {isLocked && (
        <div className="my-paywall-card">
          {!state?.isLoaded ? (
            // Still loading — show a skeleton / nothing
            <p>Loading…</p>
          ) : !state.isLoggedIn ? (
            // User is not logged in
            <>
              <h3>Read the full article</h3>
              <p>Sign in with your Content Credits account to unlock.</p>
              <button onClick={login} disabled={state.isLoading}>
                {state.isLoading ? 'Opening login…' : 'Login & Unlock'}
              </button>
            </>
          ) : state.creditBalance !== null &&
            state.requiredCredits !== null &&
            state.creditBalance < state.requiredCredits ? (
            // Logged in but not enough credits
            <>
              <h3>Not enough credits</h3>
              <p>
                You have {state.creditBalance} credit{state.creditBalance !== 1 ? 's' : ''} but
                this article costs {state.requiredCredits}.
              </p>
              <button onClick={buyMoreCredits}>Top up credits</button>
            </>
          ) : (
            // Logged in, enough credits — show unlock button
            <>
              <h3>Unlock this article</h3>
              {state.requiredCredits !== null && (
                <p>Cost: {state.requiredCredits} credit{state.requiredCredits !== 1 ? 's' : ''}</p>
              )}
              <button onClick={purchase} disabled={state.isLoading}>
                {state.isLoading ? 'Processing…' : 'Unlock now'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

Usage in a page:

```tsx
// app/articles/[slug]/page.tsx
import { HeadlessPremiumArticle } from '@/components/HeadlessPremiumArticle';

export default async function ArticlePage({ params }) {
  const article = await getArticle(params.slug);

  // Split HTML body into paragraphs however suits your content structure
  const paragraphs = article.body
    .split(/<\/p>/i)
    .map(p => p.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);

  return (
    <main>
      <h1>{article.title}</h1>
      {article.isPremium ? (
        <HeadlessPremiumArticle
          paragraphs={paragraphs}
          teaserCount={2}
          apiKey={process.env.NEXT_PUBLIC_CC_API_KEY!}
        />
      ) : (
        <div dangerouslySetInnerHTML={{ __html: article.body }} />
      )}
    </main>
  );
}
```

### Listening to events alongside headless mode

`subscribe()` covers state-driven UI, but you can still use `on()` for side-effects like analytics:

```ts
sdkRef.current.on('article:purchased', ({ creditsSpent, remainingBalance }) => {
  analytics.track('article_purchased', { creditsSpent, remainingBalance });
});

sdkRef.current.on('credits:insufficient', ({ required, available }) => {
  console.warn(`Need ${required} credits, have ${available}`);
});
```

### Plain JavaScript (no framework)

```js
const cc = ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  headless: true,
});

const unsubscribe = cc.subscribe((state) => {
  document.getElementById('paywall').hidden = state.hasAccess;
  document.getElementById('full-content').hidden = !state.hasAccess;

  document.getElementById('btn-login').hidden   = state.isLoggedIn || state.hasAccess;
  document.getElementById('btn-unlock').hidden  = !state.isLoggedIn || state.hasAccess;
  document.getElementById('btn-topup').hidden   = true;

  if (state.isLoggedIn && !state.hasAccess &&
      state.creditBalance !== null && state.requiredCredits !== null &&
      state.creditBalance < state.requiredCredits) {
    document.getElementById('btn-unlock').hidden = true;
    document.getElementById('btn-topup').hidden  = false;
  }
});

document.getElementById('btn-login').addEventListener('click', () => cc.login());
document.getElementById('btn-unlock').addEventListener('click', () => cc.purchase());
document.getElementById('btn-topup').addEventListener('click', () => cc.buyMoreCredits());
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
