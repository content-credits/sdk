import { notFound } from "next/navigation";
import Link from "next/link";
import { getArticleBySlug, getAllArticles } from "@/lib/articles";
import { PremiumGate } from "@/components/PremiumGate";

// Pre-generate all article pages at build time
export function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const article = getArticleBySlug(params.slug);
  if (!article) return {};
  return { title: `${article.title} — The Dev Dispatch` };
}

export default function ArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const article = getArticleBySlug(params.slug);
  if (!article) notFound();

  const apiKey = process.env.NEXT_PUBLIC_CC_API_KEY ?? "";

  // Render article body paragraphs as plain HTML paragraphs
  const bodyBlocks = article.content.split("\n\n").map((block, i) => {
    if (block.startsWith("## ")) {
      return (
        <h2
          key={i}
          className="text-2xl font-bold mt-10 mb-4 text-gray-900"
        >
          {block.slice(3)}
        </h2>
      );
    }
    if (block.startsWith("```")) {
      const lines = block.split("\n");
      const code = lines.slice(1, -1).join("\n");
      return (
        <pre
          key={i}
          className="bg-gray-900 text-green-400 rounded-lg p-4 overflow-x-auto text-sm my-6 font-mono"
        >
          <code>{code}</code>
        </pre>
      );
    }
    return (
      <p key={i} className="text-gray-700 leading-relaxed mb-5 text-lg">
        {block}
      </p>
    );
  });

  const articleBody = (
    <div className="prose-content">{bodyBlocks}</div>
  );

  return (
    <article className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-8"
      >
        ← All articles
      </Link>

      {/* Header */}
      <header className="mb-10">
        {article.isPremium && (
          <span className="inline-block text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full mb-4">
            Premium Article
          </span>
        )}
        <h1 className="text-4xl font-bold tracking-tight leading-tight mb-4 text-gray-900">
          {article.title}
        </h1>
        <p className="text-gray-500 text-lg mb-6">{article.excerpt}</p>
        <div className="flex items-center gap-3 text-sm text-gray-400 pb-8 border-b border-gray-200">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">
            {article.author.charAt(0)}
          </div>
          <span className="font-medium text-gray-600">{article.author}</span>
          <span>·</span>
          <span>{article.date}</span>
          <span>·</span>
          <span>{article.readTime}</span>
        </div>
      </header>

      {/* Body — gated or free */}
      {article.isPremium ? (
        <PremiumGate apiKey={apiKey}>{articleBody}</PremiumGate>
      ) : (
        articleBody
      )}
    </article>
  );
}
