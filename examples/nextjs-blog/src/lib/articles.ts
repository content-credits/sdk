export interface Article {
  slug: string;
  title: string;
  author: string;
  date: string;
  excerpt: string;
  readTime: string;
  isPremium: boolean;
  content: string;
}

export const articles: Article[] = [
  {
    slug: "getting-started-with-nextjs",
    title: "Getting Started with Next.js 14",
    author: "Sarah Chen",
    date: "April 2, 2025",
    excerpt:
      "A beginner-friendly walkthrough of Next.js 14's App Router, server components, and the new file-based routing conventions.",
    readTime: "5 min read",
    isPremium: false,
    content: `
Next.js 14 introduces a powerful App Router that changes how you think about routing and data fetching. Instead of the old pages/ directory, you now work inside app/ — and everything is a React Server Component by default.

## Setting up your first project

Run the following to scaffold a new app:

\`\`\`bash
npx create-next-app@latest my-blog --typescript --tailwind --app
\`\`\`

The CLI will ask a few questions. Accept the defaults and you'll have a working project in under a minute.

## File-based routing

Every folder inside app/ becomes a URL segment. A file named page.tsx inside that folder is the page component that renders for that route.

\`\`\`
app/
  page.tsx          → /
  about/
    page.tsx        → /about
  blog/
    [slug]/
      page.tsx      → /blog/:slug
\`\`\`

## Server vs Client Components

By default every component is a Server Component — it runs only on the server and sends plain HTML. This means faster initial loads and no unnecessary JavaScript shipped to the browser.

When you need interactivity (event handlers, useState, useEffect), add "use client" at the top of the file. That's the only change required.

## Data fetching

Server Components can be async functions. Fetch your data directly inside the component — no getServerSideProps, no useEffect:

\`\`\`tsx
export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await getPostBySlug(params.slug);
  return <article>{post.content}</article>;
}
\`\`\`

This is the mental model shift Next.js 14 introduces: components own their data needs, and the framework handles the rest.
    `.trim(),
  },
  {
    slug: "tailwind-tips-and-tricks",
    title: "10 Tailwind CSS Tricks Every Developer Should Know",
    author: "Marcus Rivera",
    date: "March 28, 2025",
    excerpt:
      "From arbitrary values to the JIT engine, these lesser-known Tailwind features will level up your workflow.",
    readTime: "4 min read",
    isPremium: false,
    content: `
Tailwind CSS has grown from a controversial utility-first experiment into the dominant CSS framework for modern web development. But most developers only scratch the surface of what it can do.

## 1. Arbitrary values

Need a one-off value that isn't in the default scale? Use square brackets:

\`\`\`html
<div class="w-[327px] mt-[13px] bg-[#1a2b3c]">
\`\`\`

This works for any property and keeps you from reaching for a separate CSS file.

## 2. Group hover

Apply styles to children when a parent is hovered using the group modifier:

\`\`\`html
<div class="group">
  <p class="opacity-0 group-hover:opacity-100 transition">Shows on hover</p>
</div>
\`\`\`

## 3. Peer modifier

The peer modifier lets a sibling react to another element's state — perfect for form validation:

\`\`\`html
<input class="peer" required />
<p class="hidden peer-invalid:block text-red-500">This field is required</p>
\`\`\`

## 4. Container queries

Tailwind v3.2+ supports container queries so you can style components based on their own width, not the viewport:

\`\`\`html
<div class="@container">
  <p class="@lg:text-xl">Big text in large containers</p>
</div>
\`\`\`

## 5. Dark mode

Add the dark: prefix to any utility. Set darkMode: 'class' in your config, then toggle the dark class on \`<html>\`.

These five tricks alone will make your Tailwind code leaner and more expressive. The remaining five are just as powerful — experiment with the docs and you'll keep finding new ways to do more with less.
    `.trim(),
  },
  {
    slug: "advanced-typescript-patterns",
    title: "Advanced TypeScript Patterns for Large Codebases",
    author: "Priya Nair",
    date: "April 1, 2025",
    excerpt:
      "Template literal types, conditional types, and the builder pattern — techniques that scale as your project grows.",
    readTime: "8 min read",
    isPremium: true,
    content: `
TypeScript's type system is far more expressive than most developers realise. Once you move beyond basic interfaces and generics, a whole category of compile-time guarantees becomes available.

## Template literal types

TypeScript 4.1 introduced template literal types, letting you construct string types programmatically:

\`\`\`typescript
type EventName = "click" | "focus" | "blur";
type Handler = \`on\${Capitalize<EventName>}\`; // "onClick" | "onFocus" | "onBlur"
\`\`\`

This is invaluable for building typed event systems, CSS-in-JS libraries, or any API that encodes information in string shapes.

## Conditional types

Conditional types let you branch on type relationships:

\`\`\`typescript
type NonNullable<T> = T extends null | undefined ? never : T;
type Flatten<T> = T extends Array<infer Item> ? Item : T;
\`\`\`

The infer keyword is what makes conditional types especially powerful — you can extract parts of a type and use them elsewhere.

## The builder pattern

For complex object construction with optional fields, the builder pattern gives you a clean API without overloaded constructors:

\`\`\`typescript
class QueryBuilder<T extends object> {
  private filters: Partial<T> = {};

  where<K extends keyof T>(key: K, value: T[K]): this {
    this.filters[key] = value;
    return this;
  }

  build(): Partial<T> {
    return this.filters;
  }
}
\`\`\`

Each call to where() returns this, so you get a fluent interface with full type safety. The generic constraint T extends object prevents primitive misuse.

## Mapped types with remapping

Mapped types iterate over union members, but you can also remap the keys:

\`\`\`typescript
type Getters<T> = {
  [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K];
};
\`\`\`

Combined with template literals this opens up automatic API generation from plain data types — no runtime magic required.

## Discriminated unions at scale

For state machines and complex UI states, discriminated unions beat boolean flags every time:

\`\`\`typescript
type RequestState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };
\`\`\`

TypeScript narrows the type based on status, so you can never accidentally access data in the error case or vice versa. This pattern eliminates an entire class of runtime bugs.
    `.trim(),
  },
  {
    slug: "building-a-design-system",
    title: "Building a Design System from Scratch in 2025",
    author: "Jordan Lee",
    date: "March 25, 2025",
    excerpt:
      "How to create a token-based design system that works across web and mobile — from color primitives to component APIs.",
    readTime: "10 min read",
    isPremium: true,
    content: `
A design system is not a component library. That distinction matters. A component library is an implementation; a design system is a shared language between designers and engineers. Getting this right from the start saves months of rework.

## Start with tokens, not components

Design tokens are the atomic values your system is built on — colors, spacing, typography, shadows. Define them in a format that can be consumed by any platform:

\`\`\`json
{
  "color": {
    "brand": { "primary": "#44C678", "secondary": "#1a2b3c" },
    "neutral": { "100": "#f5f5f5", "900": "#111" }
  },
  "space": { "1": "4px", "2": "8px", "4": "16px", "8": "32px" }
}
\`\`\`

Tools like Style Dictionary transform these JSON tokens into CSS custom properties, iOS Swift constants, Android XML resources — or anything else.

## The three-tier token model

Raw values → Semantic aliases → Component tokens.

\`\`\`css
/* Tier 1: raw */
--color-green-500: #44C678;

/* Tier 2: semantic */
--color-brand-primary: var(--color-green-500);

/* Tier 3: component */
--button-bg: var(--color-brand-primary);
\`\`\`

This indirection means you can retheme the entire system by only changing tier 2. Component implementations never reference raw values.

## Component API design

The hardest part of a design system is not the visual design — it's the API. Every prop you expose is a commitment.

Start with the minimum viable API. A Button component probably needs variant (primary | secondary | ghost), size (sm | md | lg), and disabled. It does not need 12 color props, a renderLeft function, and an asChild pattern until someone actually needs those.

## Documentation as a first-class concern

A design system without living documentation is just code. Every component needs:

1. Visual examples at all variants
2. Props table with types and defaults
3. Do / Don't usage examples
4. Copy-paste code snippets

Storybook, Docusaurus, and Astro Starlight are all solid choices. The right tool is the one your team will actually maintain.

## Versioning and breaking changes

Design systems are APIs. Version them with semver. Major bumps for breaking changes, minor for new tokens/components, patch for bug fixes. Communicate migrations clearly — your consumers have deadlines too.
    `.trim(),
  },
  {
    slug: "monetising-developer-content",
    title: "How to Monetise Your Technical Blog Without Losing Readers",
    author: "Alex Thompson",
    date: "April 3, 2025",
    excerpt:
      "A practical guide to introducing a paywall on a developer blog — pricing strategies, reader psychology, and implementation.",
    readTime: "6 min read",
    isPremium: true,
    content: `
Developer audiences are notoriously skeptical of paywalls. They have ad blockers, they share links internally, and they'll freely post your paywalled content to Hacker News. So why do paywalls work at all for technical content?

Because the value proposition is different. You're not selling news — you're selling depth.

## The depth paywall model

Free articles demonstrate your expertise and build trust. Premium articles go further: complete source code, production-ready patterns, deep dives into edge cases. The paywall isn't a barrier; it's a signal that what's behind it is worth the friction.

The sweet spot: two to three paragraphs of free content, then the gate. Enough to show quality, not enough to substitute for the full article.

## Pricing developer content

Per-article micro-payments outperform subscriptions for developer blogs with lower posting frequency. Readers pay for what they read rather than committing to a recurring charge they might forget.

Content Credits uses a credit-based model: readers buy a pack of credits (say $5 for 50 credits), then spend 3–10 credits per article depending on depth. This front-loads the purchase decision and removes per-article friction.

## What to gate and what to leave free

Gate: complete working codebases, architecture decision records, performance benchmarks with source, multi-part series conclusions.

Leave free: introductions, concept explanations, opinion pieces, anything you want indexed and shared.

The ratio matters. If 80% of your content is premium, new readers never experience enough to pay. If 20% is premium, the business doesn't work. Aim for 40–60% premium on a well-established blog.

## The reader experience

A bad paywall experience is worse than no paywall. The reader should:

1. See enough content to understand the value
2. Get a clear, frictionless path to purchase
3. Return to exactly where they left off after paying

This is why cookie-based paywalls that redirect to a payment page fail — by the time the reader returns, the context is gone. A good implementation keeps the reader on the page and unlocks the content in place.

## Measuring success

Track unlock rate (purchases / paywall impressions) by article. Anything above 8% is strong for developer content. Use that data to calibrate: high unlock rates mean you can price higher; low rates mean the teaser isn't convincing enough or the content isn't differentiated.
    `.trim(),
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getAllArticles(): Article[] {
  return articles;
}
