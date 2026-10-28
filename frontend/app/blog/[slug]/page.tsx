import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { serverApi } from "@/lib/server";
import {
  blogCategories,
  blogDate,
  blogMetadata,
  blogSchema,
  type BlogPost,
} from "@/lib/blog";
import { StructuredData } from "@/components/structured-data";
import { BlogContent } from "@/components/blog-content";
import { articleHeadings } from "@/lib/blog-document";
import styles from "@/components/blog.module.css";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const { data } = await serverApi<BlogPost>(
    "/blog/" + encodeURIComponent(slug),
  );
  return data
    ? blogMetadata(data)
    : { title: "Article unavailable", robots: { index: false, follow: true } };
}
export default async function Article({ params }: Props) {
  const { slug } = await params;
  const { data: post, status } = await serverApi<BlogPost>(
    "/blog/" + encodeURIComponent(slug),
  );
  if (!post) {
    if (status === 404) notFound();
    return (
      <div className="container section">
        <h1>Article temporarily unavailable.</h1>
        <p className="notice error">
          We couldn’t load this article. Please try again shortly.
        </p>
        <Link className="text-link" href="/blog">
          Back to the blog
        </Link>
      </div>
    );
  }
  const headings = articleHeadings(post.body);
  return (
    <article className={styles.article}>
      <StructuredData data={blogSchema(post)} />
      <header className={`container ${styles.articleHeader}`}>
        <Link className={styles.back} href="/blog">
          <ArrowLeft size={15} /> Back to the journal
        </Link>
        <span className={styles.category}>{blogCategories[post.category]}</span>
        <h1>{post.title}</h1>
        <p className={styles.standfirst}>{post.excerpt}</p>
        <div className={styles.articleMeta}>
          <span>By {post.author_name}</span>
          <time dateTime={post.published_at || undefined}>
            {blogDate(post.published_at)}
          </time>
          <span>{post.reading_minutes} min read</span>
          {post.updated_at &&
            post.published_at &&
            new Date(post.updated_at).getTime() -
              new Date(post.published_at).getTime() >
              60000 && (
              <span>
                Updated{" "}
                <time dateTime={post.updated_at}>
                  {blogDate(post.updated_at)}
                </time>
              </span>
            )}
        </div>
      </header>
      {post.cover && (
        <figure className={`container ${styles.articleCover}`}>
          <img
            src={post.cover.url}
            alt={post.cover_alt}
            width={1600}
            height={1000}
            fetchPriority="high"
          />
        </figure>
      )}
      <div className={`container ${styles.articleGrid}`}>
        <div>
          <BlogContent blocks={post.body} />
          <div className={styles.articleEnd}>
            <p>Written by {post.author_name}</p>
            <Link href="/blog" className="text-link">
              More from the journal <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
        <aside className={styles.sidebar}>
          {headings.length > 0 && (
            <nav aria-label="Article contents">
              <span className="eyebrow">IN THIS ARTICLE</span>
              {headings.map((heading) => (
                <a key={heading.id} href={`#${heading.id}`}>
                  {heading.text}
                </a>
              ))}
            </nav>
          )}
          <div className={styles.sidebarCard}>
            <span className="eyebrow">YOUR NEXT CHAPTER</span>
            <h2>Ready to put the reading into practice?</h2>
            <p>
              Explore our vehicles or talk through your questions with the team.
            </p>
            <Link
              className="btn primary small"
              href={post.category === "commercial" ? "/commercial" : "/cars"}
            >
              Explore vehicles <ArrowUpRight size={16} />
            </Link>
            <Link className="text-link" href="/contact">
              Talk to NCR Wheelz ↗
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
