import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { blogCategories, blogDate, type BlogPost } from "@/lib/blog";
import styles from "./blog.module.css";

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <article className={styles.card}>
      <Link
        href={`/blog/${post.slug}`}
        className={styles.cardImage}
        tabIndex={-1}
        aria-hidden="true"
      >
        {post.cover ? (
          <img
            src={post.cover.url}
            alt=""
            width={800}
            height={500}
            loading="lazy"
          />
        ) : (
          <div className={styles.coverArt}>
            <BookOpen size={64} strokeWidth={1} />
            <span>NCR WHEELZ JOURNAL</span>
          </div>
        )}
      </Link>
      <div className={styles.cardCopy}>
        <span className={styles.category}>{blogCategories[post.category]}</span>
        <h2>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h2>
        <p>{post.excerpt}</p>
        <div className={styles.cardMeta}>
          <time dateTime={post.published_at || undefined}>
            {blogDate(post.published_at)}
          </time>
          <span>{post.reading_minutes} min read</span>
        </div>
        <Link className={styles.readLink} href={`/blog/${post.slug}`}>
          Read article <ArrowUpRight size={17} />
        </Link>
      </div>
    </article>
  );
}
