"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, BookOpen, ArrowUpRight } from "lucide-react";
import { api, send } from "@/lib/api";
import {
  blogCategories,
  blogDate,
  type BlogPage,
  type BlogPost,
} from "@/lib/blog";
import { useAuth, useToast } from "./providers";
import { Notice, Status } from "./ui";
import styles from "./admin-blog.module.css";

export function AdminBlogList() {
  const { user } = useAuth();
  const allowed = !!user?.permissions.includes("settings");
  const params = useSearchParams();
  const scope = "/admin/blog?" + params;
  const generation = useRef(0);
  const currentScope = useRef("");
  const [data, setData] = useState<BlogPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const toast = useToast();
  const load = useCallback(async () => {
    if (currentScope.current !== scope) return;
    const current = ++generation.current;
    try {
      const result = await api<BlogPage>(scope);
      if (current === generation.current && currentScope.current === scope)
        setData(result);
    } catch (error) {
      if (current === generation.current && currentScope.current === scope)
        throw error;
    }
  }, [scope]);
  useEffect(() => {
    setData(null);
    setError("");
    currentScope.current = allowed ? scope : "";
    if (allowed) load().catch((error) => setError(error.message));
    return () => {
      ++generation.current;
      currentScope.current = "";
    };
  }, [allowed, load]);
  async function changeStatus(
    post: BlogPost,
    status: "draft" | "published" | "archived",
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<BlogPost>(
        `/admin/blog/${post.id}/status`,
        send("PATCH", { version: post.version, status }),
      );
      if (currentScope.current !== scope) return;
      await load();
      toast(
        result.is_scheduled
          ? "Post scheduled for publication"
          : post.is_scheduled && status === "draft"
            ? "Publication schedule cancelled"
            : status === "published"
              ? "Post published on the website"
              : status === "archived"
                ? "Post archived"
                : "Post saved as a draft",
      );
    } catch (error) {
      if (currentScope.current === scope) setError((error as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function pageUrl(page: number) {
    const query = new URLSearchParams(params.toString());
    query.set("page", String(page));
    return "/admin/blog?" + query;
  }
  if (!allowed)
    return (
      <Notice
        error
        message="You need content and settings permission to manage the blog."
      />
    );
  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">THE NCR WHEELZ JOURNAL</span>
          <h1>Your stories. Your website.</h1>
          <p>Write, preview and publish articles for your readers.</p>
        </div>
        <div className={styles.actions}>
          <Link className="btn outline small" href="/blog">
            View blog <ArrowUpRight size={16} />
          </Link>
          <Link className="btn primary small" href="/admin/blog/new">
            <Plus size={17} /> Write a post
          </Link>
        </div>
      </div>
      <form className="toolbar" action="/admin/blog">
        <input
          name="q"
          aria-label="Search blog posts"
          placeholder="Search posts"
          maxLength={100}
          defaultValue={params.get("q") || ""}
        />
        <select
          aria-label="Post status"
          name="status"
          defaultValue={params.get("status") || "all"}
        >
          <option value="all">All posts</option>
          <option value="draft">Drafts</option>
          <option value="published">Published</option>
          <option value="scheduled">Scheduled</option>
          <option value="archived">Archived</option>
        </select>
        <button className="btn primary small">Filter</button>
        <Link className="text-link" href="/admin/blog">
          Reset
        </Link>
      </form>
      {error && <Notice error message={error} />}
      {!data ? (
        error ? (
          <button
            className="btn outline small"
            onClick={() =>
              load()
                .then(() => setError(""))
                .catch((error) => setError(error.message))
            }
          >
            Retry loading posts
          </button>
        ) : (
          <div className="skeleton tall" />
        )
      ) : data.items.length ? (
        <>
          <p className="subtle">
            {data.total} {data.total === 1 ? "post" : "posts"}
          </p>
          <div className={styles.posts}>
            {data.items.map((post) => (
              <article key={post.id} className={styles.postRow}>
                <div className={styles.thumbnail}>
                  {post.cover ? (
                    <img src={post.cover.url} alt="" width={160} height={120} />
                  ) : (
                    <BookOpen size={30} strokeWidth={1.3} />
                  )}
                </div>
                <div className={styles.postCopy}>
                  <div className={styles.postMeta}>
                    <Status
                      value={
                        post.is_scheduled ? "scheduled" : post.status || "draft"
                      }
                    />
                    <span>{blogCategories[post.category]}</span>
                  </div>
                  <h2>
                    <Link href={`/admin/blog/${post.id}`}>
                      {post.title || "Untitled post"}
                    </Link>
                  </h2>
                  <p>
                    {post.excerpt ||
                      "Add a short introduction to help readers choose your article."}
                  </p>
                  <small>
                    {post.is_scheduled
                      ? "Scheduled " + blogDate(post.published_at)
                      : post.status === "published"
                        ? "Published " + blogDate(post.published_at)
                        : "Updated " + blogDate(post.updated_at)}
                  </small>
                </div>
                <div className={styles.rowActions}>
                  <Link
                    className="btn outline small"
                    href={`/admin/blog/${post.id}`}
                  >
                    Edit post
                  </Link>
                  {post.status === "published" ? (
                    <>
                      {!post.is_scheduled && (
                        <Link className="text-link" href={`/blog/${post.slug}`}>
                          Read live ↗
                        </Link>
                      )}
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => changeStatus(post, "draft")}
                      >
                        {post.is_scheduled ? "Cancel schedule" : "Unpublish"}
                      </button>
                    </>
                  ) : (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        changeStatus(
                          post,
                          post.status === "archived" ? "draft" : "published",
                        )
                      }
                    >
                      {post.status === "archived"
                        ? "Restore draft"
                        : post.scheduled_at &&
                            new Date(post.scheduled_at).getTime() > Date.now()
                          ? "Schedule post"
                          : "Publish post"}
                    </button>
                  )}
                  {post.status !== "archived" && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => changeStatus(post, "archived")}
                    >
                      Archive
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <nav className="pagination" aria-label="Admin blog pages">
            {data.page > 1 && (
              <Link className="btn outline small" href={pageUrl(data.page - 1)}>
                Previous
              </Link>
            )}
            <span>
              Page {data.page} of {data.pages}
            </span>
            {data.page < data.pages && (
              <Link className="btn primary small" href={pageUrl(data.page + 1)}>
                Next
              </Link>
            )}
          </nav>
        </>
      ) : (
        <div className={`panel ${styles.empty}`}>
          <BookOpen size={42} strokeWidth={1.2} />
          <h2>
            {params.size
              ? "No posts match these filters."
              : "Your first post starts here."}
          </h2>
          <p>
            Save an idea as a draft, add a cover photo and publish when you’re
            ready.
          </p>
          <Link className="btn primary" href="/admin/blog/new">
            Write a post <Plus size={17} />
          </Link>
        </div>
      )}
    </>
  );
}
