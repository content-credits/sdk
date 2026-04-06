# Content Credits — Next.js Blog Example

A realistic Next.js 14 blog that demonstrates how to integrate the [Content Credits](https://contentcredits.com) paywall SDK. Free articles render in full; premium articles show a two-paragraph teaser then gate the rest until the reader purchases access with credits.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcontent-credits%2Fsdk%2Ftree%2Fmain%2Fexamples%2Fnextjs-blog&env=NEXT_PUBLIC_CC_API_KEY&envDescription=Your+Content+Credits+API+key&envLink=https%3A%2F%2Faccounts.contentcredits.com)

---

## What's inside

| File | What it shows |
|---|---|
| `src/components/PremiumGate.tsx` | The core integration — a Client Component that runs `ContentCredits.init()` |
| `src/app/blog/[slug]/page.tsx` | How to conditionally gate content in an App Router page |
| `src/lib/articles.ts` | Mock article data with `isPremium` flag |

---

## Quick start

**1. Install dependencies**

```bash
cd examples/nextjs-blog
npm install
```

**2. Set your API key**

```bash
cp .env.example .env.local
```

Open `.env.local` and replace `pub_your_api_key_here` with your real key. Get it from the [Content Credits dashboard](https://accounts.contentcredits.com) under **My Websites → your domain → API Key**.

**3. Run the dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Free articles load fully; click any **Premium** article to see the paywall in action.

---

## How the integration works

```tsx
// src/components/PremiumGate.tsx
"use client";
import { useEffect } from "react";
import { ContentCredits } from "@contentcredits/sdk";

export function PremiumGate({ apiKey, children }) {
  useEffect(() => {
    const cc = ContentCredits.init({
      apiKey,
      contentSelector: "#premium-content",
      teaserParagraphs: 2,
    });
    return () => cc.destroy(); // clean up on navigation
  }, [apiKey]);

  return <div id="premium-content">{children}</div>;
}
```

The page wraps premium content in `<PremiumGate>`:

```tsx
// src/app/blog/[slug]/page.tsx
{article.isPremium ? (
  <PremiumGate apiKey={process.env.NEXT_PUBLIC_CC_API_KEY}>
    {articleBody}
  </PremiumGate>
) : (
  articleBody
)}
```

The SDK handles everything else: hiding content, showing the paywall UI, managing authentication, and unlocking on purchase.

---

## Deploy to Vercel

Click the **Deploy** button above, or run:

```bash
npx vercel
```

Set `NEXT_PUBLIC_CC_API_KEY` in your Vercel project environment variables. Make sure the deployed domain is registered in your Content Credits publisher dashboard.

---

## Going further

- [SDK documentation](https://sdk.contentcredits.com)
- [Full configuration options](https://sdk.contentcredits.com/docs/getting-started/configuration)
- [React / Next.js integration guide](https://sdk.contentcredits.com/docs/integration-guides/react)
- [Events API](https://sdk.contentcredits.com/docs/features/events) — hook into paywall shown, purchase complete, etc.
