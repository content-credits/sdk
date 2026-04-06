import Link from "next/link";
import type { Article } from "@/lib/articles";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="border border-gray-200 rounded-xl p-6 hover:border-gray-400 hover:shadow-sm transition-all bg-white">
      <div className="flex items-center gap-2 mb-3">
        {article.isPremium && (
          <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            Premium
          </span>
        )}
        <span className="text-xs text-gray-400">{article.readTime}</span>
      </div>

      <Link href={`/blog/${article.slug}`}>
        <h2 className="text-xl font-bold text-gray-900 hover:text-green-600 transition-colors leading-snug mb-2">
          {article.title}
        </h2>
      </Link>

      <p className="text-gray-500 text-sm leading-relaxed mb-4">
        {article.excerpt}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
            {article.author.charAt(0)}
          </div>
          <span className="text-sm text-gray-500">{article.author}</span>
        </div>
        <span className="text-xs text-gray-400">{article.date}</span>
      </div>
    </article>
  );
}
