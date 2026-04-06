import { getAllArticles } from "@/lib/articles";
import { ArticleCard } from "@/components/ArticleCard";

export default function HomePage() {
  const articles = getAllArticles();
  const freeArticles = articles.filter((a) => !a.isPremium);
  const premiumArticles = articles.filter((a) => a.isPremium);

  return (
    <div>
      {/* Hero */}
      <section className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          The Dev Dispatch
        </h1>
        <p className="text-lg text-gray-500 max-w-xl">
          In-depth articles on Next.js, TypeScript, and modern web development.
          Free articles for everyone — premium deep-dives for serious builders.
        </p>
      </section>

      {/* Free articles */}
      <section className="mb-12">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">
          Free Articles
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {freeArticles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </section>

      {/* Premium articles */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            Premium Articles
          </h2>
          <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
            Requires credits
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {premiumArticles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </section>
    </div>
  );
}
