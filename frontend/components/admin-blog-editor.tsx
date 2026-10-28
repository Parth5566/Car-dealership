"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, ImagePlus, Search } from "lucide-react";
import { api, send } from "@/lib/api";
import { blogCategories, blogDate, type BlogPost } from "@/lib/blog";
import { site } from "@/lib/site";
import {
  editorArticle,
  articleStats,
  imageProblems,
  validImageAlt,
  type ArticleDocument,
} from "@/lib/blog-document";
import { BlogContent } from "./blog-content";
import { BlogRichEditor } from "./blog-rich-editor";
import {
  ImageAltDialog,
  type BlogAsset,
  type ImageReview,
} from "./blog-editor-dialog";
import { useAuth, useToast } from "./providers";
import { Field, Notice, Status } from "./ui";
import styles from "./blog-document-editor.module.css";

type Draft = {
  title: string;
  slug: string;
  excerpt: string;
  category: BlogPost["category"];
  author_name: string;
  body: ArticleDocument;
  cover_id: number | null;
  cover_alt: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
};
const emptyDraft: Draft = {
  title: "",
  slug: "",
  excerpt: "",
  category: "buying",
  author_name: "NCR Wheelz",
  body: { type: "doc", content: [{ type: "paragraph" }] },
  cover_id: null,
  cover_alt: "",
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
};
// These are writing guides; search engines may choose a different snippet.
const counter = (value: string, ideal: number) =>
  `${value.length}/${ideal}${value.length > ideal ? " · may be cut off in search results" : ""}`;
function istInput(value?: string | null) {
  return value
    ? new Date(new Date(value).getTime() + 330 * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
}
export function AdminBlogEditor({ id }: { id?: string }) {
  const { user } = useAuth(),
    allowed = !!user?.permissions.includes("settings"),
    toast = useToast();
  // A new article gets its id from its first save, or silently when the first
  // image, cover or Word image is added; the address bar follows without a reload.
  const [postId, setPostId] = useState(id),
    postIdRef = useRef(id),
    creating = useRef<Promise<string> | null>(null);
  if (postId) postIdRef.current = postId;
  const [record, setRecord] = useState<BlogPost | null>(null),
    [draft, setDraft] = useState<Draft>(emptyDraft),
    [cover, setCover] = useState<BlogPost["cover"]>(null),
    [loading, setLoading] = useState(!!id),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [mediaBusy, setMediaBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false),
    [reload, setReload] = useState(0),
    [publishAt, setPublishAt] = useState(""),
    [autosave, setAutosave] = useState(false),
    [savedAt, setSavedAt] = useState("");
  const [pending, setPending] = useState<{
    asset: BlogAsset;
    initial?: ImageReview;
    cover?: boolean;
    reviewId: number;
    resolve: (value: ImageReview | null) => void;
  } | null>(null);
  const pendingRef = useRef<typeof pending>(null),
    inFlight = useRef(false),
    imageOperation = useRef(false),
    coverOperation = useRef(false),
    reviewSequence = useRef(0),
    mounted = useRef(true),
    generation = useRef(0),
    draftRef = useRef(draft);
  draftRef.current = draft;
  const firstPublished = !!record?.published_at && !record.is_scheduled;
  function apply(post: BlogPost) {
    setDraft({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      category: post.category,
      author_name: post.author_name,
      body: editorArticle(post.body),
      cover_id: post.cover_id || null,
      cover_alt: post.cover_alt,
      seo_title: post.seo_title,
      seo_description: post.seo_description,
      seo_keywords: post.seo_keywords || "",
    });
    setCover(post.cover);
    setRecord(post);
    setDirty(false);
    setPublishAt(istInput(post.scheduled_at || post.published_at));
    setSavedAt(
      new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      }),
    );
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingRef.current?.resolve(null);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setError("");
    // Load the opened post, or the current one when "Reload" is chosen; a new
    // id appearing mid-edit must not reload and overwrite in-progress work.
    const target = postIdRef.current || id;
    if (!allowed || !target) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<BlogPost>("/admin/blog/" + target)
      .then((post) => {
        if (active) apply(post);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, allowed, reload]);
  useEffect(() => {
    if (!dirty && !mediaBusy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        anchor.origin !== location.origin ||
        anchor.pathname + anchor.search === location.pathname + location.search
      )
        return;
      if (
        mediaBusy ||
        !window.confirm("Leave this article without saving your changes?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, mediaBusy]);
  function adopt(post: BlogPost) {
    const created = String(post.id);
    postIdRef.current = created;
    setPostId(created);
    window.history.replaceState(null, "", `/admin/blog/${created}`);
  }
  async function ensurePost(): Promise<string> {
    if (postIdRef.current) return postIdRef.current;
    creating.current ||= (async () => {
      const post = await api<BlogPost>(
        "/admin/blog",
        send("POST", {
          ...draftRef.current,
          cover_id: null,
          cover_alt: "",
          status: "draft",
          publish_at: null,
        }),
      );
      if (mounted.current) {
        adopt(post);
        setRecord(post);
        toast("Draft created so your images can be added");
      }
      return String(post.id);
    })().finally(() => {
      creating.current = null;
    });
    return creating.current;
  }
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    generation.current++;
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }
  async function save(
    status: "draft" | "published" | "archived",
    automatic = false,
  ) {
    if (
      inFlight.current ||
      mediaBusy ||
      imageOperation.current ||
      coverOperation.current
    )
      return;
    const snapshot = draftRef.current,
      problems = imageProblems(snapshot.body);
    if (
      problems.length ||
      (snapshot.cover_id && !validImageAlt(snapshot.cover_alt))
    ) {
      setError(
        problems[0] ||
          "Review the cover photo's alternative text before saving.",
      );
      return;
    }
    // Once a post has gone live its original publication time is fixed, even
    // after it is unpublished or archived. Send it exactly: the date box only
    // has minute precision, and a seconds mismatch is rejected as a change.
    const time = firstPublished
      ? new Date(record!.published_at!)
      : publishAt
        ? new Date(publishAt + "+05:30")
        : null;
    if (time && !Number.isFinite(time.getTime())) {
      setError("Choose a valid publication date and time in IST.");
      return;
    }
    const version = generation.current;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const existing = postIdRef.current || (await creating.current) || "";
      const post = await api<BlogPost>(
        existing ? `/admin/blog/${existing}` : "/admin/blog",
        send(existing ? "PUT" : "POST", {
          ...snapshot,
          status,
          publish_at: time?.toISOString() || null,
          ...(existing ? { version: record?.version } : {}),
        }),
      );
      if (!mounted.current) return;
      if (version === generation.current) apply(post);
      else {
        setRecord(post);
        setDirty(true);
      }
      if (!automatic)
        toast(
          post.is_scheduled
            ? "Post scheduled for publication"
            : status === "published"
              ? "Your post is live on the website"
              : status === "archived"
                ? "Post archived"
                : "Draft saved",
        );
      if (!postIdRef.current) adopt(post);
    } catch (error) {
      if (mounted.current) {
        setError((error as Error).message);
        if (automatic) setAutosave(false);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (
      !autosave ||
      !dirty ||
      !postId ||
      busy ||
      mediaBusy ||
      preview ||
      error ||
      record?.status !== "draft"
    )
      return;
    const timer = window.setTimeout(() => void save("draft", true), 4000);
    return () => window.clearTimeout(timer);
  }, [
    autosave,
    dirty,
    postId,
    busy,
    mediaBusy,
    preview,
    error,
    draft,
    publishAt,
    record?.version,
    record?.status,
  ]);
  async function prepareImage(options: {
    file?: File;
    asset?: BlogAsset;
    initial?: ImageReview;
    cover?: boolean;
  }) {
    if (pendingRef.current || imageOperation.current) return null;
    imageOperation.current = true;
    try {
      let asset = options.asset;
      if (options.file) {
        if (
          options.file.size > 8 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(options.file.type)
        )
          throw new Error(
            "Choose a JPEG, PNG or WebP image smaller than 8 MB.",
          );
        const target = await ensurePost();
        const form = new FormData();
        form.set("file", options.file);
        asset = await api<BlogAsset>(`/admin/blog/${target}/media`, {
          method: "POST",
          body: form,
        });
      }
      if (!asset || !mounted.current) return null;
      const result = await new Promise<ImageReview | null>((resolve) => {
        const item = {
          reviewId: ++reviewSequence.current,
          asset: asset!,
          initial: options.initial,
          cover: options.cover,
          resolve,
        };
        pendingRef.current = item;
        setPending(item);
      });
      if (!result) return null;
      return {
        mediaId: asset.id,
        alt: result.alt,
        decorative: result.decorative,
        reviewed: true as const,
        caption: "",
        width: 100,
        align: "center",
      };
    } finally {
      imageOperation.current = false;
    }
  }
  async function chooseCover(file?: File, editing = false) {
    if (busy || mediaBusy || coverOperation.current || (!file && !cover))
      return;
    coverOperation.current = true;
    setMediaBusy(true);
    setError("");
    try {
      const attrs = await prepareImage({
        file,
        asset: !file && cover ? cover : undefined,
        initial: editing
          ? { alt: draft.cover_alt, decorative: false }
          : undefined,
        cover: true,
      });
      if (attrs && mounted.current) {
        setCover({
          id: attrs.mediaId,
          url: `/api/v1/admin/blog/${postIdRef.current}/media/${attrs.mediaId}`,
        });
        generation.current++;
        setDraft((current) => ({
          ...current,
          cover_id: attrs.mediaId,
          cover_alt: attrs.alt,
        }));
        setDirty(true);
      }
    } catch (error) {
      if (mounted.current) setError((error as Error).message);
    } finally {
      coverOperation.current = false;
      if (mounted.current) setMediaBusy(false);
    }
  }
  function openPreview() {
    const problems = imageProblems(draft.body);
    if (problems.length || (cover && !validImageAlt(draft.cover_alt))) {
      setError(
        problems[0] || "Review the cover alternative text before previewing.",
      );
      return;
    }
    setPreview((value) => !value);
  }
  function reloadSaved() {
    if (
      !dirty ||
      window.confirm("Replace your unsaved edits with the saved version?")
    )
      setReload((value) => value + 1);
  }
  const locked = busy || mediaBusy,
    published = record?.status === "published" && !record.is_scheduled,
    stats = articleStats(draft.body, record?.reading_wpm);
  if (!allowed)
    return (
      <Notice
        error
        message="You need content and settings permission to manage the blog."
      />
    );
  if (loading) return <div className="skeleton tall" />;
  if (id && !record)
    return (
      <>
        <Notice error message={error || "This post could not be loaded."} />
        <button className="btn outline small" onClick={reloadSaved}>
          Retry loading post
        </button>
      </>
    );
  return (
    <div className={styles.desk}>
      <Link href="/admin/blog" className="text-link">
        <ArrowLeft size={15} />
        All blog posts
      </Link>
      <div className={styles.heading}>
        <div>
          <span className="eyebrow">THE EDITOR’S DESK</span>
          <h1>{postId ? "Make it a good read." : "Start a new story."}</h1>
          <p role="status">
            {dirty
              ? "Unsaved changes"
              : savedAt
                ? `Saved at ${savedAt} IST`
                : "Your article starts here."}
          </p>
        </div>
        <div className={styles.actions}>
          <Status
            value={
              record?.is_scheduled ? "scheduled" : record?.status || "draft"
            }
          />
          <button
            type="button"
            className="btn outline small"
            disabled={locked}
            onClick={openPreview}
          >
            <Eye size={16} />
            {preview ? "Back to writing" : "Preview post"}
          </button>
          {published && (
            <Link
              href={`/blog/${record!.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              Read live ↗
            </Link>
          )}
        </div>
      </div>
      {error && (
        <div>
          <Notice error message={error} />
          {postId && (
            <button
              type="button"
              className="text-button"
              disabled={locked}
              onClick={reloadSaved}
            >
              Reload saved version
            </button>
          )}
        </div>
      )}
      {preview ? (
        <section className={styles.preview} aria-label="Private blog preview">
          <span className="eyebrow">
            PRIVATE PREVIEW · {blogCategories[draft.category]}
          </span>
          <h2>{draft.title || "Your article title"}</h2>
          <p>{draft.excerpt}</p>
          <div className={styles.byline}>
            By {draft.author_name} ·{" "}
            {published ? blogDate(record!.published_at) : "Not published yet"} ·{" "}
            {stats.minutes} min read
          </div>
          {cover && <img src={cover.url} alt={draft.cover_alt} />}
          <BlogContent
            blocks={draft.body}
            mediaBase={`/api/v1/admin/blog/${postId}/media/`}
          />
        </section>
      ) : (
        <div className={styles.layout}>
          <div className={styles.writing}>
            <section className={styles.metadata}>
              <Field label="Post title">
                <input
                  name="title"
                  data-display-text
                  value={draft.title}
                  disabled={locked}
                  maxLength={160}
                  placeholder="Give your story a title"
                  onChange={(event) => update("title", event.target.value)}
                />
              </Field>
              <Field
                label="Short introduction"
                hint="Shown on article cards and below the title."
              >
                <textarea
                  name="excerpt"
                  value={draft.excerpt}
                  disabled={locked}
                  maxLength={320}
                  rows={3}
                  placeholder="What will readers learn?"
                  onChange={(event) => update("excerpt", event.target.value)}
                />
              </Field>
            </section>
            <h2 className={styles.canvasHeading}>Write your article</h2>
            <BlogRichEditor
              postId={postId}
              value={draft.body}
              disabled={locked}
              onChange={(body) => update("body", body)}
              onBusy={setMediaBusy}
              onError={setError}
              prepareImage={prepareImage}
              readingSpeed={record?.reading_wpm}
            />
          </div>
          <aside className={styles.sidebar}>
            <section>
              <h2>Publication</h2>
              <Field label="Author / team name">
                <input
                  name="author_name"
                  value={draft.author_name}
                  disabled={locked}
                  maxLength={100}
                  onChange={(event) =>
                    update("author_name", event.target.value)
                  }
                />
              </Field>
              <Field label="Topic">
                <select
                  value={draft.category}
                  disabled={locked}
                  onChange={(event) =>
                    update(
                      "category",
                      event.target.value as BlogPost["category"],
                    )
                  }
                >
                  {Object.entries(blogCategories).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Publication date and time (IST)"
                hint={
                  firstPublished
                    ? "The original publication date is kept, even if the post is unpublished. Updates have a separate date."
                    : "Leave blank to publish now, or choose a future time and select Schedule post."
                }
              >
                <input
                  type="datetime-local"
                  value={publishAt}
                  disabled={locked || firstPublished}
                  onChange={(event) => {
                    generation.current++;
                    setPublishAt(event.target.value);
                    setDirty(true);
                  }}
                />
              </Field>
              {record?.is_scheduled && (
                <p className={styles.guidance}>
                  Scheduled for{" "}
                  {new Date(record.published_at!).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST. This article is still private.
                </p>
              )}
              {record?.published_at && !record.is_scheduled && (
                <p>
                  First published {blogDate(record.published_at)}
                  <br />
                  Last updated {blogDate(record.updated_at)}
                </p>
              )}
              <Field
                label="Web address"
                hint={
                  record?.published_at
                    ? "Kept stable after first publication or scheduling."
                    : "Leave blank to generate it from the title."
                }
              >
                <input
                  name="slug"
                  value={draft.slug}
                  disabled={locked}
                  readOnly={!!record?.published_at}
                  maxLength={160}
                  placeholder="your-article-title"
                  onChange={(event) => update("slug", event.target.value)}
                />
              </Field>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={autosave}
                  disabled={!postId || record?.status !== "draft" || locked}
                  onChange={(event) => setAutosave(event.target.checked)}
                />
                Auto-save this draft after 4 seconds
              </label>
              <small>
                Auto-save never publishes a post. It pauses if saving fails.
              </small>
            </section>
            <section>
              <h2>Cover photo</h2>
              {cover && (
                <>
                  <img
                    className={styles.cover}
                    src={cover.url}
                    alt={draft.cover_alt}
                  />
                  <p>{draft.cover_alt}</p>
                  <button
                    type="button"
                    className="text-button"
                    disabled={locked}
                    onClick={() => void chooseCover(undefined, true)}
                  >
                    Edit cover alternative text
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={locked}
                    onClick={() => {
                      setCover(null);
                      update("cover_id", null);
                      update("cover_alt", "");
                    }}
                  >
                    Remove cover
                  </button>
                </>
              )}
              <label className={styles.fileTool}>
                <ImagePlus size={18} />
                {cover ? "Replace cover" : "Upload cover photo"}
                <input
                  aria-label="Upload blog cover photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={locked}
                  onChange={(event) => {
                    void chooseCover(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              <small>
                JPEG, PNG or WebP, up to 8 MB. You’ll describe the photo
                (alternative text) before it’s used.
              </small>
            </section>
            <section className={styles.seoPanel} aria-labelledby="blog-seo">
              <h2 id="blog-seo">
                <Search size={17} aria-hidden="true" /> Search engine (SEO)
              </h2>
              <Field
                label="Meta title"
                hint={`${counter((draft.seo_title || draft.title) + " | NCR Wheelz", 60)} including the site name. Leave blank to use the post title.`}
              >
                <input
                  name="seo_title"
                  value={draft.seo_title}
                  disabled={locked}
                  maxLength={160}
                  placeholder={draft.title || "Title shown in search results"}
                  onChange={(event) => update("seo_title", event.target.value)}
                />
              </Field>
              <Field
                label="Meta description"
                hint={`${counter(draft.seo_description || draft.excerpt, 160)}. Leave blank to use the short introduction.`}
              >
                <textarea
                  name="seo_description"
                  value={draft.seo_description}
                  disabled={locked}
                  maxLength={320}
                  rows={3}
                  placeholder={
                    draft.excerpt || "One or two sentences about the article"
                  }
                  onChange={(event) =>
                    update("seo_description", event.target.value)
                  }
                />
              </Field>
              <Field
                label="Meta keywords"
                hint="Optional: up to 12 phrases and 255 characters in total, separated by commas. Google does not use meta keywords for ranking."
              >
                <input
                  name="seo_keywords"
                  value={draft.seo_keywords}
                  disabled={locked}
                  maxLength={255}
                  placeholder="used cars delhi, car loan emi"
                  onChange={(event) =>
                    update("seo_keywords", event.target.value)
                  }
                />
              </Field>
              <div className={styles.serp} aria-label="Search result preview">
                <span className={styles.serpUrl}>
                  {new URL(site).host} › blog ›{" "}
                  {draft.slug || "your-article-title"}
                </span>
                <strong className={styles.serpTitle}>
                  {(draft.seo_title || draft.title || "Your article title") +
                    " | NCR Wheelz"}
                </strong>
                <p className={styles.serpText}>
                  {draft.seo_description ||
                    draft.excerpt ||
                    "Your meta description or short introduction appears here."}
                </p>
              </div>
              <p className={styles.guidance}>
                This is a preview, not a guaranteed search result. Publishing
                automatically sets the canonical URL, author, dates, social
                preview and article schema, and adds the article to the sitemap.
                Drafts and future scheduled articles stay out of public feeds.
              </p>
              {!cover && (
                <p className={styles.guidance}>
                  Add a relevant cover photo with descriptive alt text for a
                  stronger article and sharing preview.
                </p>
              )}
            </section>
          </aside>
        </div>
      )}
      {!preview && (
        <div className={styles.saveBar}>
          <div>
            <strong>
              {published
                ? "This article is public."
                : record?.is_scheduled
                  ? "This article is scheduled."
                  : "Your draft stays private."}
            </strong>
            <p>
              {published
                ? "Saving updates the live article."
                : "Review your writing and images before publishing."}
            </p>
          </div>
          <div className={styles.actions}>
            <button
              className="btn primary"
              type="button"
              disabled={locked}
              onClick={() =>
                save(record?.status === "published" ? "published" : "draft")
              }
            >
              {busy
                ? "Saving…"
                : record?.is_scheduled
                  ? "Update scheduled post"
                  : published
                    ? "Update published post"
                    : "Save draft"}
            </button>
            {published || record?.is_scheduled ? (
              <button
                className="btn outline"
                type="button"
                disabled={locked}
                onClick={() => save("draft")}
              >
                {record?.is_scheduled
                  ? "Cancel schedule & save draft"
                  : "Unpublish & save draft"}
              </button>
            ) : null}
            {!published && !record?.is_scheduled && (
              <button
                className="btn gold"
                type="button"
                disabled={locked}
                onClick={() => save("published")}
              >
                {publishAt &&
                new Date(publishAt + "+05:30").getTime() > Date.now()
                  ? "Schedule post"
                  : "Publish post"}
              </button>
            )}
            {record && record.status !== "archived" && (
              <button
                className="text-button"
                type="button"
                disabled={locked}
                onClick={() => save("archived")}
              >
                Archive post
              </button>
            )}
          </div>
        </div>
      )}
      {pending && (
        <ImageAltDialog
          key={pending.reviewId}
          image={pending.asset}
          initial={pending.initial}
          cover={pending.cover}
          onComplete={(result) => {
            pendingRef.current = null;
            setPending(null);
            pending.resolve(result);
          }}
        />
      )}
    </div>
  );
}
