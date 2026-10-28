import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { serverApi } from "@/lib/server";
import type { BlogPage } from "@/lib/blog";
import { BlogCard } from "./blog-card";
import styles from "./blog.module.css";
export async function RecentBlogPosts() {
  const { data } = await serverApi<BlogPage>("/blog?limit=3");
  if (!data?.items?.length) return null;
  return (
    <section
      className={`container section ${styles.recent}`}
      aria-labelledby="recent-blog-heading"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE NCR WHEELZ JOURNAL</span>
          <h2 id="recent-blog-heading">Good reads for the road ahead.</h2>
        </div>
        <Link className="text-link" href="/blog">
          Explore the blog <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className={styles.grid}>
        {data.items.map((post) => (
          <BlogCard post={post} key={post.id} />
        ))}
      </div>
    </section>
  );
}
