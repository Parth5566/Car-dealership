import { Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { NodeSelection, Plugin, type Selection } from "@tiptap/pm/state";
import { validImageAlt, safeArticleUrl } from "./blog-document";

// Pasting or adding content beside a selected image must not replace the image.
// Text selections still behave normally, replacing just the selected text.
export function articleInsertionRange(selection: Selection) {
  return {
    from: selection instanceof NodeSelection ? selection.to : selection.from,
    to: selection.to,
  };
}

// The editor offers only article formatting: H1–H3, bold, italic, underline,
// lists, quotes, dividers, links, images and (imported) tables. Colours, text
// sizes, alignment, strikethrough, code and super/subscript are left out, so
// pasted or imported Word content is cleaned to the site's typography.
// `mediaBase` is read when an image renders, so a draft created mid-edit can
// supply its id without rebuilding the editor.
export function blogEditorExtensions(mediaBase: () => string) {
  const BlogImage = Node.create({
    name: "blogImage",
    group: "block",
    atom: true,
    selectable: true,
    draggable: false,
    addAttributes() {
      return {
        mediaId: { default: null },
        alt: { default: null },
        decorative: { default: false },
        reviewed: { default: false },
        caption: { default: "" },
        width: { default: 100 },
        align: { default: "center" },
      };
    },
    parseHTML() {
      return [
        {
          tag: "figure[data-reviewed-image]",
          getAttrs: (element) => {
            try {
              return JSON.parse(
                (element as HTMLElement).getAttribute("data-reviewed-image") ||
                  "null",
              );
            } catch {
              return false;
            }
          },
        },
      ];
    },
    renderHTML({ node }) {
      return [
        "figure",
        { "data-reviewed-image": JSON.stringify(node.attrs) },
        [
          "img",
          { src: mediaBase() + node.attrs.mediaId, alt: node.attrs.alt || "" },
        ],
        ...(node.attrs.caption ? [["figcaption", {}, node.attrs.caption]] : []),
      ] as any;
    },
    addNodeView() {
      return ({ node }) => {
        const figure = document.createElement("figure"),
          img = document.createElement("img"),
          caption = document.createElement("figcaption");
        figure.contentEditable = "false";
        const update = (current: typeof node) => {
          if (current.type.name !== "blogImage") return false;
          img.src = mediaBase() + current.attrs.mediaId;
          img.alt = current.attrs.alt || "";
          caption.textContent = current.attrs.caption;
          caption.hidden = !current.attrs.caption;
          figure.style.width = `${current.attrs.width}%`;
          figure.style.marginLeft =
            current.attrs.align === "left" ? "0" : "auto";
          figure.style.marginRight =
            current.attrs.align === "right" ? "0" : "auto";
          return true;
        };
        figure.append(img, caption);
        update(node);
        return { dom: figure, update };
      };
    },
    addProseMirrorPlugins() {
      return [
        new Plugin({
          filterTransaction(transaction) {
            if (!transaction.docChanged) return true;
            let valid = true;
            transaction.doc.descendants((node) => {
              if (
                node.type.name === "blogImage" &&
                (node.attrs.reviewed !== true ||
                  typeof node.attrs.alt !== "string" ||
                  !validImageAlt(node.attrs.alt, node.attrs.decorative) ||
                  !Number.isSafeInteger(node.attrs.mediaId) ||
                  node.attrs.mediaId < 1)
              )
                valid = false;
            });
            return valid;
          },
        }),
      ];
    },
  });
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      code: false,
      strike: false,
      link: {
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        protocols: ["https"],
        isAllowedUri: (url) => safeArticleUrl(url),
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: null,
          class: null,
        },
      },
    }),
    TableKit.configure({ table: { resizable: false } }),
    BlogImage,
  ];
}
