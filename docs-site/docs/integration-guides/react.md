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

Set `headless: true` and the SDK becomes a pure logic layer: it never touches the DOM, never injects any UI, and never hides or shows anything. You get callbacks for every paywall state change and action methods to trigger login, purchase, and top-up flows. Your design, your markup, your framework.

:::tip Full guide
See the dedicated **[Headless / Custom UI guide](/integration-guides/headless)** for the complete reference — vanilla JS example, full `PremiumGate` component, `useContentCredits` hook, all callbacks, all action methods, and an `SDKState` field table.
:::

```js
const cc = ContentCredits.init({
  apiKey: 'pub_YOUR_KEY',
  headless: true,

  onLoginRequired()                              { /* show your login UI  */ },
  onPurchaseRequired({ requiredCredits })        { /* show unlock UI      */ },
  onInsufficientCredits({ required, available }) { /* show top-up UI      */ },
  onAccessGranted()                              { /* reveal full content */ },
  onStateChange(state)                           { /* drive loading state */ },
});

document.getElementById('btn-login').onclick    = () => cc.login();
document.getElementById('btn-purchase').onclick = () => cc.purchase();
document.getElementById('btn-topup').onclick    = () => cc.buyMoreCredits();
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
