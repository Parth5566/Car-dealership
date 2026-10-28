"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { validImageAlt } from "@/lib/blog-document";
import styles from "./blog-document-editor.module.css";
export type BlogAsset = {
  id: number;
  url: string;
  width?: number;
  height?: number;
};
export type ImageReview = { alt: string; decorative: boolean };
export function BlogDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    (dialog.querySelector("[data-autofocus]") as HTMLElement | null)?.focus();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={styles.dialogHeading}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ImageAltDialog({
  image,
  initial,
  cover,
  onComplete,
}: {
  image: BlogAsset;
  initial?: ImageReview;
  cover?: boolean;
  onComplete: (result: ImageReview | null) => void;
}) {
  const [alt, setAlt] = useState(initial?.alt || ""),
    [decorative, setDecorative] = useState(
      cover ? false : !!initial?.decorative,
    ),
    [error, setError] = useState("");
  return (
    <BlogDialog
      title={cover ? "Describe the cover image" : "Image alternative text"}
      onClose={() => onComplete(null)}
    >
      <img
        className={styles.modalImage}
        src={image.url}
        alt="Image to describe"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = decorative ? "" : alt.trim();
          if (!validImageAlt(value, decorative)) {
            setError(
              "Describe the relevant visual content in at least 3 characters. Use a description, not a filename or ‘photo’.",
            );
            return;
          }
          onComplete({ alt: value, decorative });
        }}
      >
        <label className={styles.dialogField}>
          Alternative text (alt text)
          <input
            data-autofocus
            value={alt}
            disabled={decorative}
            maxLength={200}
            onChange={(event) => setAlt(event.target.value)}
          />
        </label>
        <p>
          Describe what this image shows and why it matters to the article. A
          caption is separate and visible to all readers.
        </p>
        {!cover && (
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={decorative}
              onChange={(event) => setDecorative(event.target.checked)}
            />
            Decorative image — adds no information; screen readers will skip it.
          </label>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.dialogActions}>
          <button
            type="button"
            className="btn outline small"
            onClick={() => onComplete(null)}
          >
            Cancel
          </button>
          <button className="btn primary small" type="submit">
            Insert Image
          </button>
        </div>
      </form>
    </BlogDialog>
  );
}
