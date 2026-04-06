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

Usage:

```tsx
function ArticlePage({ apiKey }) {
  const { on } = useContentCredits({
    apiKey,
    contentSelector: '#premium-content',
  });

  useEffect(() => {
    const unsub = on('auth:login', ({ user }) => {
      console.log('Logged in:', user.email);
    });
    return unsub;
  }, [on]);

  return (
    <article>
      <div id="premium-content">...</div>
    </article>
  );
}
```

---

## Next.js (App Router)

The SDK uses browser APIs (`window`, `document`, `sessionStorage`) so it must be initialised **client-side only**. Use the `'use client'` directive and `useEffect`:

```tsx
// components/PremiumGate.tsx
'use client';

import { useEffect } from 'react';
import { ContentCredits } from '@contentcredits/sdk';

interface PremiumGateProps {
  apiKey: string;
  selector?: string;
  children: React.ReactNode;
}

export function PremiumGate({
  apiKey,
  selector = '#premium-content',
  children,
}: PremiumGateProps) {
  useEffect(() => {
    const cc = ContentCredits.init({
      apiKey,
      contentSelector: selector,
      enableComments: true,
    });

    return () => cc.destroy();
  }, [apiKey, selector]);

  return (
    <div id="premium-content">
      {children}
    </div>
  );
}
```

Then in your page component:

```tsx
// app/articles/[slug]/page.tsx
import { PremiumGate } from '@/components/PremiumGate';

export default function ArticlePage({ params }) {
  const article = await getArticle(params.slug);

  return (
    <main>
      <h1>{article.title}</h1>
      <p>{article.teaser}</p>

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

---

## Next.js (Pages Router)

```tsx
// pages/articles/[slug].tsx
import { useEffect } from 'react';
import { ContentCredits } from '@contentcredits/sdk';
import type { GetServerSideProps } from 'next';

export default function ArticlePage({ article, apiKey }) {
  useEffect(() => {
    if (!article.isPremium) return;

    const cc = ContentCredits.init({
      apiKey,
      contentSelector: '#premium-content',
    });

    return () => cc.destroy();
  }, [article.isPremium, apiKey]);

  return (
    <article>
      <h1>{article.title}</h1>
      <p>{article.teaser}</p>
      <div
        id="premium-content"
        dangerouslySetInnerHTML={{ __html: article.body }}
      />
    </article>
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

Never hardcode API keys in client-side code that gets committed to version control. Use environment variables:

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
