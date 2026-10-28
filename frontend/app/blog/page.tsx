import Link from "next/link";
import { BookOpen, ArrowUpRight, Search } from "lucide-react";
import { PageSchema } from "@/components/structured-data";
import { serverApi } from "@/lib/server";
import { blogCategories, blogIndexMetadata, type BlogPage } from "@/lib/blog";
import { BlogCard } from "@/components/blog-card";
import styles from "@/components/blog.module.css";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ searchParams }: Props) {
  return blogIndexMetadata(await searchParams);
}
export default async function Blog({ searchParams }: Props) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["q", "category", "page"])
    if (typeof params[key] === "string") query.set(key, params[key]);
  const { data, error } = await serverApi<BlogPage>("/blog?" + query);
  function pageUrl(page: number) {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return "/blog?" + next;
  }
  return (
    <>
      <PageSchema path="/blog" />
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div>
            <div className="breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <span>Blog</span>
            </div>
            <span className="eyebrow">THE NCR WHEELZ JOURNAL</span>
            <h1>
              A little insight.
              <br />
              <em>A better next drive.</em>
            </h1>
            <p>
              Buying, selling or putting your cab to work? Explore practical
              reads, fresh perspectives and news from NCR Wheelz.
            </p>
          </div>
          <div className={styles.heroArt} aria-hidden="true">
            <BookOpen size={112} strokeWidth={0.8} />
            <span>
              IDEAS FOR
              <br />
              THE ROAD AHEAD.
            </span>
            <span className={styles.artStamp}>NCR WHEELZ ↗</span>
          </div>
        </div>
      </section>
      <section
        className={`container ${styles.listing}`}
        aria-label="Blog articles"
      >
        <form className={styles.filters} action="/blog">
          <label>
            <span className="sr-only">Search articles</span>
            <Search size={18} aria-hidden="true" />
            <input
              name="q"
              placeholder="Search articles"
              defaultValue={query.get("q") || ""}
              maxLength={100}
            />
          </label>
          <select
            name="category"
            aria-label="Article category"
            defaultValue={query.get("category") || ""}
          >
            <option value="">All topics</option>
            {Object.entries(blogCategories).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          <button className="btn primary small">Search</button>
          {query.size > 0 && (
            <Link href="/blog" className="text-link">
              Clear filters
            </Link>
          )}
        </form>
        {error ? (
          <div className="notice error" role="alert">
            We couldn’t load the articles. Please try again.{" "}
            <Link className="text-link" href="/blog">
              Reload blog
            </Link>
          </div>
        ) : data?.items.length ? (
          <>
            <p className={styles.resultCount}>
              {data.total} {data.total === 1 ? "article" : "articles"}
            </p>
            <div className={styles.grid}>
              {data.items.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
            <nav className="pagination" aria-label="Blog pages">
              {data.page > 1 && (
                <Link
                  className="btn outline small"
                  href={pageUrl(data.page - 1)}
                >
                  Previous
                </Link>
              )}
              <span>
                Page {data.page} of {data.pages}
              </span>
              {data.page < data.pages && (
                <Link
                  className="btn primary small"
                  href={pageUrl(data.page + 1)}
                >
                  Next
                </Link>
              )}
            </nav>
          </>
        ) : (
          <div className={styles.empty}>
            <BookOpen size={42} strokeWidth={1.3} />
            <h2>
              {query.size
                ? "No articles match your search."
                : "New stories are on the way."}
            </h2>
            <p>
              {query.size
                ? "Try another topic or clear your search."
                : "Our published guides and updates will appear here. In the meantime, take a look at our vehicles."}
            </p>
            <Link className="btn primary" href={query.size ? "/blog" : "/cars"}>
              {query.size ? "View all articles" : "Browse passenger cars"}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
