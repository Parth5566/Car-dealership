"use client";
import { useEffect, useState } from "react";
import { safeArticleUrl } from "@/lib/blog-document";
import { publicPages } from "@/lib/seo";
import { api } from "@/lib/api";
import { BlogDialog } from "./blog-editor-dialog";
import styles from "./blog-document-editor.module.css";
export type ArticleLink = { text: string; href: string; newTab: boolean };
export function BlogLinkDialog({
  initial,
  onComplete,
}: {
  initial: ArticleLink;
  onComplete: (value: ArticleLink | "remove" | null) => void;
}) {
  const [value, setValue] = useState(initial),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<{ title: string; href: string }[]>([]),
    [searchError, setSearchError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      try {
        const [blogs, cars] = await Promise.all([
          api<any>(`/blog?q=${encodeURIComponent(query)}&limit=5`),
          api<any>(`/vehicles?q=${encodeURIComponent(query)}&limit=5`),
        ]);
        if (active) {
          setSearchError("");
          setResults([
            ...blogs.items.map((post: any) => ({
              title: post.title,
              href: `/blog/${post.slug}`,
            })),
            ...cars.items.map((car: any) => ({
              title: `${car.year} ${car.make} ${car.model}`,
              href: `/vehicles/${car.id}/${car.slug}`,
            })),
          ]);
        }
      } catch {
        if (active)
          setSearchError(
            "Search is unavailable. You can paste an internal page URL.",
          );
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);
  return (
    <BlogDialog
      title={initial.href ? "Edit link" : "Add a link"}
      onClose={() => onComplete(null)}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!value.text.trim() || !safeArticleUrl(value.href.trim())) {
            setError(
              "Add display text and a full HTTPS URL or an internal path starting with /.",
            );
            return;
          }
          onComplete({
            ...value,
            text: value.text.trim(),
            href: value.href.trim(),
          });
        }}
      >
        <label className={styles.dialogField}>
          Display text
          <input
            data-autofocus
            value={value.text}
            maxLength={4000}
            onChange={(event) =>
              setValue({ ...value, text: event.target.value })
            }
          />
        </label>
        <label className={styles.dialogField}>
          Destination URL
          <input
            value={value.href}
            maxLength={2000}
            placeholder="https://… or /contact"
            onChange={(event) =>
              setValue({ ...value, href: event.target.value })
            }
          />
        </label>
        <p>
          {value.href.startsWith("/")
            ? "Internal NCR Wheelz link"
            : "External link — use HTTPS"}
        </p>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={value.newTab}
            onChange={(event) =>
              setValue({ ...value, newTab: event.target.checked })
            }
          />
          Open in a new tab
        </label>
        <details>
          <summary>Find an NCR Wheelz page or article</summary>
          <label className={styles.dialogField}>
            Website pages
            <select
              value=""
              onChange={(event) =>
                setValue({ ...value, href: event.target.value })
              }
            >
              <option value="">Choose a page</option>
              {Object.entries(publicPages).map(([href, page]) => (
                <option key={href} value={href}>
                  {page.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.dialogField}>
            Search articles and vehicles
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={100}
            />
          </label>
          {searchError && <p role="status">{searchError}</p>}
          <ul className={styles.searchResults}>
            {results.map((result) => (
              <li key={result.href}>
                <button
                  type="button"
                  onClick={() =>
                    setValue({
                      ...value,
                      href: result.href,
                      text: value.text || result.title,
                    })
                  }
                >
                  {result.title}
                  <small>{result.href}</small>
                </button>
              </li>
            ))}
          </ul>
        </details>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.dialogActions}>
          {initial.href && (
            <button
              type="button"
              className="text-button"
              onClick={() => onComplete("remove")}
            >
              Remove link
            </button>
          )}
          <button
            type="button"
            className="btn outline small"
            onClick={() => onComplete(null)}
          >
            Cancel
          </button>
          <button type="submit" className="btn primary small">
            Save link
          </button>
        </div>
      </form>
    </BlogDialog>
  );
}
