"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { DOMParser as ProseParser } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import {
  Bold,
  Italic,
  Underline,
  Undo2,
  Redo2,
  Link2,
  ImagePlus,
  Images,
  List,
  ListOrdered,
  Quote,
  Minus,
  RemoveFormatting,
  FileUp,
} from "lucide-react";
import {
  articleInsertionRange,
  blogEditorExtensions,
} from "@/lib/blog-editor-extensions";
import {
  articleStats,
  articleHeadings,
  type ArticleDocument,
} from "@/lib/blog-document";
import { cleanArticleHtml, checkDocxArchive } from "@/lib/blog-import";
import { api } from "@/lib/api";
import {
  BlogDialog,
  type BlogAsset,
  type ImageReview,
} from "./blog-editor-dialog";
import { BlogLinkDialog, type ArticleLink } from "./blog-link-dialog";
import styles from "./blog-document-editor.module.css";

type ImageAttrs = {
  mediaId: number;
  alt: string;
  decorative: boolean;
  reviewed: true;
  caption: string;
  width: number;
  align: string;
};
type Props = {
  postId?: string;
  value: ArticleDocument;
  disabled: boolean;
  onChange: (value: ArticleDocument) => void;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
  prepareImage: (options: {
    file?: File;
    asset?: BlogAsset;
    initial?: ImageReview;
  }) => Promise<ImageAttrs | null>;
  readingSpeed?: number;
};
export function BlogRichEditor(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const [busy, setBusy] = useState(false),
    [library, setLibrary] = useState(false),
    [images, setImages] = useState<BlogAsset[]>([]),
    [libraryError, setLibraryError] = useState("");
  const [link, setLink] = useState<{
    initial: ArticleLink;
    from: number;
    to: number;
  } | null>(null);
  const [render, setRender] = useState(0),
    [importNote, setImportNote] = useState("");
  const inFlight = useRef(false),
    alive = useRef(true),
    pasteHandler = useRef<(event: ClipboardEvent) => boolean>(() => false),
    dropHandler = useRef<(event: DragEvent, moved: boolean) => boolean>(
      () => false,
    ),
    linkHandler = useRef<(position?: number) => void>(() => {});
  // Read at render time: a new article gets its id when the first image is
  // added, and rebuilding the editor then would lose the in-progress insert.
  const mediaBase = useRef("");
  mediaBase.current = `/api/v1/admin/blog/${props.postId}/media/`;
  const extensions = useMemo(
    () => blogEditorExtensions(() => mediaBase.current),
    [],
  );
  const editor = useEditor(
    {
      extensions,
      content: props.value,
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-label": "Article body",
          "aria-multiline": "true",
          spellcheck: "true",
        },
        handlePaste: (_view, event) => pasteHandler.current(event),
        handleDrop: (_view, event, _slice, moved) =>
          dropHandler.current(event, moved),
        handleClick: (_view, pos, event) => {
          if ((event.target as HTMLElement).closest("a")) {
            event.preventDefault();
            linkHandler.current(pos);
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor }) =>
        latest.current.onChange(editor.getJSON() as ArticleDocument),
      onSelectionUpdate: () => setRender((value) => value + 1),
    },
    [extensions],
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (
      editor &&
      JSON.stringify(editor.getJSON()) !== JSON.stringify(props.value)
    )
      editor.commands.setContent(props.value, { emitUpdate: false });
  }, [editor, props.value]);
  useEffect(() => {
    editor?.setEditable(!props.disabled && !busy && !link && !library, false);
  }, [editor, props.disabled, busy, link, library]);
  useEffect(() => {
    if (!library || !props.postId) return;
    let active = true;
    setLibraryError("");
    api<{ items: BlogAsset[] }>(`/admin/blog/${props.postId}/media`)
      .then((result) => {
        if (active) setImages(result.items);
      })
      .catch((error) => {
        if (active) setLibraryError(error.message);
      });
    return () => {
      active = false;
    };
  }, [library, props.postId]);
  async function work(action: () => Promise<void>) {
    if (!editor || inFlight.current || latest.current.disabled) return;
    inFlight.current = true;
    setBusy(true);
    latest.current.onBusy(true);
    editor.setEditable(false, false);
    try {
      await action();
    } catch (error) {
      if (alive.current) latest.current.onError((error as Error).message);
    } finally {
      inFlight.current = false;
      if (alive.current) {
        setBusy(false);
        latest.current.onBusy(false);
        editor.setEditable(!latest.current.disabled, false);
        editor.commands.focus();
      }
    }
  }
  async function addImages(files: File[], asset?: BlogAsset) {
    await work(async () => {
      if (!editor) return;
      const bookmark = editor.state.selection.getBookmark(),
        nodes = [];
      for (const file of files) {
        const attrs = await latest.current.prepareImage({ file });
        if (!attrs) return;
        nodes.push({ type: "blogImage", attrs });
      }
      if (asset) {
        const attrs = await latest.current.prepareImage({ asset });
        if (!attrs) return;
        nodes.push({ type: "blogImage", attrs });
      }
      if (!alive.current) return;
      const selection = bookmark.resolve(editor.state.doc);
      editor.commands.insertContentAt(articleInsertionRange(selection), nodes);
    });
  }
  async function reviewedHtml(
    html: string,
    docxImages?: { token: string; mime: string; base64: string; alt: string }[],
    clipboardFiles: File[] = [],
  ) {
    const parsed = new DOMParser().parseFromString(
      cleanArticleHtml(html, true),
      "text/html",
    );
    for (const image of Array.from(parsed.querySelectorAll("img"))) {
      const src = image.getAttribute("data-import-image") || "";
      let file: File | undefined, asset: BlogAsset | undefined;
      const imported = docxImages?.find((item) => item.token === src);
      if (imported || /^data:image\/(png|jpeg|webp);base64,/i.test(src)) {
        const mime = imported?.mime || src.slice(5, src.indexOf(";")),
          base64 = imported?.base64 || src.slice(src.indexOf(",") + 1);
        if (base64.length > 12 * 1024 * 1024)
          throw new Error("A pasted image is larger than 8 MB.");
        const bytes = Uint8Array.from(atob(base64), (character) =>
          character.charCodeAt(0),
        );
        file = new File([bytes], "article-image", { type: mime });
      } else {
        let internal: URL | null = null;
        try {
          internal = new URL(src, window.location.origin);
        } catch {}
        const match =
          internal?.origin === window.location.origin
            ? internal.pathname.match(
                /^\/api\/v1\/admin\/blog\/(\d+)\/media\/(\d+)$/,
              )
            : null;
        if (match && match[1] === latest.current.postId)
          asset = {
            id: Number(match[2]),
            url: `/api/v1/admin/blog/${latest.current.postId}/media/${match[2]}`,
          };
        else if (clipboardFiles.length) file = clipboardFiles.shift();
        else
          throw new Error(
            "Remote or temporary image links cannot be pasted. Download the image and upload it so its alternative text can be reviewed.",
          );
      }
      const attrs = await latest.current.prepareImage({
        file,
        asset,
        initial: {
          alt: imported?.alt || image.getAttribute("alt") || "",
          decorative: false,
        },
      });
      if (!attrs) return null;
      const figure = parsed.createElement("figure");
      figure.setAttribute("data-reviewed-image", JSON.stringify(attrs));
      image.replaceWith(figure);
    }
    return ProseParser.fromSchema(editor!.schema)
      .parse(parsed.body)
      .toJSON() as ArticleDocument;
  }
  pasteHandler.current = (event) => {
    if (props.disabled || busy) {
      event.preventDefault();
      return true;
    }
    const html = event.clipboardData?.getData("text/html"),
      files = Array.from(event.clipboardData?.files || []).filter((file) =>
        file.type.startsWith("image/"),
      );
    if (html && (/<img\b/i.test(html) || !files.length)) {
      event.preventDefault();
      void work(async () => {
        const bookmark = editor!.state.selection.getBookmark();
        const document = await reviewedHtml(html, undefined, files);
        if (document && alive.current) {
          editor!.commands.insertContentAt(
            articleInsertionRange(bookmark.resolve(editor!.state.doc)),
            document.content,
          );
        }
      });
      return true;
    }
    if (files.length) {
      event.preventDefault();
      void addImages(files);
      return true;
    }
    return false;
  };
  dropHandler.current = (event, moved) => {
    if (moved) return false;
    const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
        file.type.startsWith("image/"),
      ),
      html = event.dataTransfer?.getData("text/html");
    if (files.length) {
      event.preventDefault();
      void addImages(files);
      return true;
    }
    if (html) {
      event.preventDefault();
      void work(async () => {
        const bookmark = editor!.state.selection.getBookmark();
        const document = await reviewedHtml(html);
        if (document && alive.current)
          editor!.commands.insertContentAt(
            articleInsertionRange(bookmark.resolve(editor!.state.doc)),
            document.content,
          );
      });
      return true;
    }
    return false;
  };
  function openLink(position?: number) {
    if (!editor || busy) return;
    if (position !== undefined)
      editor.chain().setTextSelection(position).extendMarkRange("link").run();
    else if (editor.isActive("link")) editor.commands.extendMarkRange("link");
    const { from, to } = editor.state.selection,
      attrs = editor.getAttributes("link");
    setLink({
      from,
      to,
      initial: {
        text: editor.state.doc.textBetween(from, to, " "),
        href: attrs.href || "",
        newTab: attrs.target === "_blank",
      },
    });
  }
  linkHandler.current = openLink;
  async function importWord(file?: File) {
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) {
      props.onError("Choose a Word .docx file.");
      return;
    }
    if (
      !window.confirm(
        "Replace the article body with this Word document? The title and publication settings will stay the same.",
      )
    )
      return;
    await work(async () => {
      const buffer = await file.arrayBuffer();
      checkDocxArchive(buffer);
      const result = await new Promise<{
        html: string;
        images: any[];
        warnings: string[];
      }>((resolve, reject) => {
        const worker = new Worker(
            new URL("../lib/blog-docx-worker.ts", import.meta.url),
          ),
          timer = window.setTimeout(() => {
            worker.terminate();
            reject(
              new Error("Word import took too long. Try a smaller document."),
            );
          }, 30000);
        const done = () => {
          window.clearTimeout(timer);
          worker.terminate();
        };
        worker.onmessage = (event) => {
          done();
          if (event.data.error) reject(new Error(event.data.error));
          else resolve(event.data);
        };
        worker.onerror = () => {
          done();
          reject(new Error("This Word document could not be imported."));
        };
        worker.postMessage(buffer, [buffer]);
      });
      const document = await reviewedHtml(result.html, result.images);
      if (document && alive.current) {
        editor!.commands.setContent(document);
        setImportNote(
          result.warnings.length
            ? `Imported. ${result.warnings.length} Word conversion note(s): ${result.warnings.slice(0, 3).join(" ")}`
            : "Word document imported. Review the headings, links and images before publishing.",
        );
      }
    });
  }
  if (!editor)
    return (
      <div className="skeleton tall" aria-label="Loading article editor" />
    );
  const selection = editor.state.selection,
    selectedImage =
      selection instanceof NodeSelection &&
      selection.node.type.name === "blogImage"
        ? selection.node
        : null;
  const locked = props.disabled || busy || !!link || library,
    stats = articleStats(props.value, props.readingSpeed),
    h1 = articleHeadings(props.value).some((heading) => heading.level === 1);
  const control = (
    name: string,
    Icon: any,
    action: () => unknown,
    active = false,
    disabled = false,
    text?: string,
  ) => (
    <button
      key={name}
      type="button"
      title={name}
      aria-label={name}
      aria-pressed={active}
      className={text ? styles.textTool : undefined}
      disabled={locked || !!selectedImage || disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => action()}
    >
      {text ?? <Icon size={18} />}
    </button>
  );
  const level = editor.isActive("heading")
    ? Number(editor.getAttributes("heading").level)
    : 0;
  return (
    <section className={styles.editor} data-selection={render}>
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Article formatting"
      >
        <div className={styles.toolGroup}>
          {control(
            "Undo (Ctrl/⌘ Z)",
            Undo2,
            () => editor.chain().focus().undo().run(),
            false,
            !editor.can().undo(),
          )}
          {control(
            "Redo (Ctrl/⌘ Shift Z)",
            Redo2,
            () => editor.chain().focus().redo().run(),
            false,
            !editor.can().redo(),
          )}
        </div>
        <div className={styles.toolGroup} aria-label="Text style">
          {control(
            "Normal text",
            null,
            () => editor.chain().focus().setParagraph().run(),
            level === 0,
            false,
            "Text",
          )}
          {([1, 2, 3] as const).map((heading) =>
            control(
              `Heading ${heading}`,
              null,
              () =>
                editor.chain().focus().toggleHeading({ level: heading }).run(),
              level === heading,
              false,
              `H${heading}`,
            ),
          )}
        </div>
        <div className={styles.toolGroup}>
          {control(
            "Bold (Ctrl/⌘ B)",
            Bold,
            () => editor.chain().focus().toggleBold().run(),
            editor.isActive("bold"),
          )}
          {control(
            "Italic (Ctrl/⌘ I)",
            Italic,
            () => editor.chain().focus().toggleItalic().run(),
            editor.isActive("italic"),
          )}
          {control(
            "Underline (Ctrl/⌘ U)",
            Underline,
            () => editor.chain().focus().toggleUnderline().run(),
            editor.isActive("underline"),
          )}
          {control(
            "Add or edit link",
            Link2,
            () => openLink(),
            editor.isActive("link"),
          )}
        </div>
        <div className={styles.toolGroup}>
          {control(
            "Bullet list",
            List,
            () => editor.chain().focus().toggleBulletList().run(),
            editor.isActive("bulletList"),
          )}
          {control(
            "Numbered list",
            ListOrdered,
            () => editor.chain().focus().toggleOrderedList().run(),
            editor.isActive("orderedList"),
          )}
          {control(
            "Quote",
            Quote,
            () => editor.chain().focus().toggleBlockquote().run(),
            editor.isActive("blockquote"),
          )}
          {control("Divider line", Minus, () =>
            editor.chain().focus().setHorizontalRule().run(),
          )}
          {control("Clear formatting", RemoveFormatting, () =>
            editor.chain().focus().unsetAllMarks().clearNodes().run(),
          )}
        </div>
        <div className={`${styles.toolGroup} ${styles.insertGroup}`}>
          <label className={styles.fileTool} title="Upload an image">
            <ImagePlus size={18} />
            <span>Image</span>
            <input
              aria-label="Upload article image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={locked}
              onChange={(event) => {
                void addImages(Array.from(event.target.files || []));
                event.target.value = "";
              }}
            />
          </label>
          {props.postId && (
            <button
              type="button"
              className={styles.fileTool}
              title="Choose an image already uploaded for this article"
              aria-label="Image library"
              disabled={locked}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setLibrary(true)}
            >
              <Images size={18} />
              <span>Library</span>
            </button>
          )}
          <label className={styles.fileTool} title="Import a Word document">
            <FileUp size={18} />
            <span>Import Word</span>
            <input
              aria-label="Import Word document"
              type="file"
              accept=".docx"
              disabled={locked}
              onChange={(event) => {
                void importWord(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      {h1 && (
        <p className={styles.guidance} role="status">
          The article title is the page H1. Your body headings will each move
          down one level on the public page (H1 → H2, H2 → H3, and so on); the
          saved document keeps your hierarchy.
        </p>
      )}
      {busy && (
        <p className={styles.guidance} role="status">
          Preparing content. Complete the image reviews to continue.
        </p>
      )}
      {importNote && (
        <p className={styles.guidance} role="status">
          {importNote}
        </p>
      )}
      <EditorContent
        editor={editor}
        className={`${styles.canvas}${editor.isEmpty ? ` ${styles.empty}` : ""}`}
      />
      {selectedImage && (
        <div className={styles.context} aria-label="Image controls">
          <strong>Image settings</strong>
          <button
            type="button"
            disabled={locked}
            onClick={() =>
              void work(async () => {
                const pos = editor.state.selection.from,
                  attrs = await props.prepareImage({
                    asset: {
                      id: selectedImage.attrs.mediaId,
                      url: mediaBase.current + selectedImage.attrs.mediaId,
                    },
                    initial: {
                      alt: selectedImage.attrs.alt,
                      decorative: selectedImage.attrs.decorative,
                    },
                  });
                if (attrs && alive.current)
                  editor
                    .chain()
                    .setNodeSelection(pos)
                    .updateAttributes("blogImage", {
                      alt: attrs.alt,
                      decorative: attrs.decorative,
                      reviewed: true,
                    })
                    .run();
              })
            }
          >
            Edit alternative text
          </button>
          <label className={styles.fileTool}>
            Replace image
            <input
              aria-label="Replace selected image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={locked}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file)
                  void work(async () => {
                    const pos = editor.state.selection.from,
                      attrs = await props.prepareImage({ file });
                    if (attrs && alive.current)
                      editor
                        .chain()
                        .setNodeSelection(pos)
                        .updateAttributes("blogImage", {
                          ...attrs,
                          caption: selectedImage.attrs.caption,
                          width: selectedImage.attrs.width,
                          align: selectedImage.attrs.align,
                        })
                        .run();
                  });
              }}
            />
          </label>
          <label>
            Image alignment
            <select
              aria-label="Image alignment"
              value={selectedImage.attrs.align}
              disabled={locked}
              onChange={(event) =>
                editor.commands.updateAttributes("blogImage", {
                  align: event.target.value,
                })
              }
            >
              {["left", "center", "right"].map((align) => (
                <option key={align}>{align}</option>
              ))}
            </select>
          </label>
          <label>
            Image width
            <select
              aria-label="Image width"
              value={selectedImage.attrs.width}
              disabled={locked}
              onChange={(event) =>
                editor.commands.updateAttributes("blogImage", {
                  width: Number(event.target.value),
                })
              }
            >
              {[25, 50, 75, 100].map((width) => (
                <option key={width} value={width}>
                  {width}%
                </option>
              ))}
            </select>
          </label>
          <label className={styles.caption}>
            Caption
            <input
              aria-label="Image caption"
              maxLength={300}
              value={selectedImage.attrs.caption}
              disabled={locked}
              onChange={(event) =>
                editor.commands.updateAttributes("blogImage", {
                  caption: event.target.value,
                })
              }
            />
          </label>
          <button
            type="button"
            disabled={locked}
            onClick={() => editor.commands.deleteSelection()}
          >
            Remove image
          </button>
        </div>
      )}
      {editor.isActive("table") && (
        <div className={styles.context} aria-label="Table controls">
          {[
            ["Add row", () => editor.chain().focus().addRowAfter().run()],
            ["Add column", () => editor.chain().focus().addColumnAfter().run()],
            ["Remove row", () => editor.chain().focus().deleteRow().run()],
            [
              "Remove column",
              () => editor.chain().focus().deleteColumn().run(),
            ],
            [
              "Toggle header row",
              () => editor.chain().focus().toggleHeaderRow().run(),
            ],
            ["Remove table", () => editor.chain().focus().deleteTable().run()],
          ].map(([title, action]) => (
            <button
              key={String(title)}
              type="button"
              disabled={locked}
              onClick={() => typeof action === "function" && action()}
            >
              {String(title)}
            </button>
          ))}
        </div>
      )}
      <div className={styles.stats}>
        <span>
          {stats.words} words · {stats.characters} characters · {stats.minutes}{" "}
          min read
        </span>
        <span>
          Use Ctrl/⌘ C, X and V to copy, cut and paste · Shift Enter for a line
          break
        </span>
      </div>
      {link && (
        <BlogLinkDialog
          initial={link.initial}
          onComplete={(result) => {
            if (result) {
              const chain = editor
                .chain()
                .setTextSelection({ from: link.from, to: link.to });
              if (result === "remove") chain.unsetLink().run();
              else {
                const attrs = {
                  href: result.href,
                  target: result.newTab ? "_blank" : null,
                  rel: "noopener noreferrer",
                };
                if (result.text === link.initial.text && link.to > link.from)
                  chain.setLink(attrs).run();
                else
                  chain
                    .insertContent({
                      type: "text",
                      text: result.text,
                      marks: [
                        { type: "link", attrs },
                        ...editor.state.selection.$from
                          .marks()
                          .filter((mark) => mark.type.name !== "link")
                          .map((mark) => mark.toJSON()),
                      ],
                    })
                    .run();
              }
            }
            setLink(null);
            queueMicrotask(() => editor.commands.focus());
          }}
        />
      )}
      {library && (
        <BlogDialog
          title="Images uploaded for this article"
          onClose={() => setLibrary(false)}
        >
          <p>Choose an image, then review the alternative text for this use.</p>
          {libraryError && <p role="alert">{libraryError}</p>}
          <div className={styles.library}>
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => {
                  setLibrary(false);
                  void addImages([], image);
                }}
              >
                <img src={image.url} alt={`Uploaded image ${image.id}`} />
                <span>Select image {image.id}</span>
              </button>
            ))}
          </div>
          {!images.length && !libraryError && (
            <p>No images uploaded yet. Use the Image upload button first.</p>
          )}
        </BlogDialog>
      )}
    </section>
  );
}
