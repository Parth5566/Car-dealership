import { createElement, Fragment, type ReactNode } from "react";
import {
  articleDocument,
  articleHeadings,
  safeArticleUrl,
  textColours,
  highlightColours,
  validImageAlt,
  type ArticleBody,
  type ArticleNode,
} from "@/lib/blog-document";
import styles from "./blog-rich-content.module.css";

// A closed React renderer; stored and imported HTML is never executed.
export function BlogContent({
  blocks,
  mediaBase = "/api/v1/blog-media/",
}: {
  blocks: ArticleBody;
  mediaBase?: string;
}) {
  let heading = 0;
  const shift = articleHeadings(blocks).some((item) => item.level === 1)
    ? 1
    : 0;
  function render(node: ArticleNode, key: number): ReactNode {
    const attrs = node.attrs || {};
    const children = (node.content || []).map(render);
    const align = ["left", "center", "right", "justify"].includes(
      attrs.textAlign,
    )
      ? attrs.textAlign
      : undefined;
    if (node.type === "text") {
      let text: ReactNode = node.text || "";
      for (const [index, mark] of (node.marks || []).entries()) {
        const a = mark.attrs || {};
        const tag = (
          {
            bold: "strong",
            italic: "em",
            underline: "u",
            strike: "s",
            code: "code",
            superscript: "sup",
            subscript: "sub",
          } as Record<string, string>
        )[mark.type];
        if (tag) text = createElement(tag, { key: index }, text);
        else if (mark.type === "link" && safeArticleUrl(a.href || ""))
          text = (
            <a
              key={index}
              href={a.href}
              target={a.target === "_blank" ? "_blank" : undefined}
              rel={a.target === "_blank" ? "noopener noreferrer" : undefined}
            >
              {text}
            </a>
          );
        else if (mark.type === "highlight")
          text = (
            <mark
              key={index}
              style={{
                backgroundColor: highlightColours.includes(a.color)
                  ? a.color
                  : highlightColours[0],
              }}
            >
              {text}
            </mark>
          );
        else if (mark.type === "textStyle")
          text = (
            <span
              key={index}
              style={{
                color: textColours.includes(a.color) ? a.color : undefined,
                fontSize: ["16px", "18px", "22px"].includes(a.fontSize)
                  ? a.fontSize
                  : undefined,
              }}
            >
              {text}
            </span>
          );
      }
      return <Fragment key={key}>{text}</Fragment>;
    }
    if (node.type === "paragraph")
      return (
        <p key={key} style={{ textAlign: align }}>
          {children.length ? children : <br />}
        </p>
      );
    if (node.type === "heading")
      return createElement(
        `h${Math.min(5, Math.max(2, (attrs.level || 2) + shift))}`,
        { key, id: `section-${heading++}`, style: { textAlign: align } },
        children,
      );
    if (node.type === "hardBreak") return <br key={key} />;
    if (node.type === "horizontalRule") return <hr key={key} />;
    if (node.type === "blockquote")
      return <blockquote key={key}>{children}</blockquote>;
    if (node.type === "bulletList") return <ul key={key}>{children}</ul>;
    if (node.type === "orderedList")
      return (
        <ol
          key={key}
          start={Number.isInteger(attrs.start) ? attrs.start : undefined}
        >
          {children}
        </ol>
      );
    if (node.type === "listItem") return <li key={key}>{children}</li>;
    if (node.type === "table")
      return (
        <div key={key} className={styles.tableWrap}>
          <table>
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    if (node.type === "tableRow") return <tr key={key}>{children}</tr>;
    if (node.type === "tableCell" || node.type === "tableHeader")
      return createElement(
        node.type === "tableHeader" ? "th" : "td",
        {
          key,
          colSpan: attrs.colspan || 1,
          rowSpan: attrs.rowspan || 1,
          style: {
            textAlign: ["left", "center", "right", "justify"].includes(
              attrs.align,
            )
              ? attrs.align
              : undefined,
          },
          ...(node.type === "tableHeader" ? { scope: "col" } : {}),
        },
        children,
      );
    if (
      node.type === "blogImage" &&
      Number.isSafeInteger(attrs.mediaId) &&
      attrs.mediaId > 0 &&
      attrs.reviewed === true &&
      typeof attrs.alt === "string" &&
      validImageAlt(attrs.alt, attrs.decorative)
    )
      return (
        <figure
          key={key}
          className={styles.image}
          style={{
            width: `${[25, 50, 75, 100].includes(attrs.width) ? attrs.width : 100}%`,
            marginLeft: attrs.align === "left" ? 0 : "auto",
            marginRight: attrs.align === "right" ? 0 : "auto",
          }}
        >
          <img
            src={mediaBase + attrs.mediaId}
            alt={attrs.decorative ? "" : attrs.alt}
            loading="lazy"
          />
          {attrs.caption && <figcaption>{attrs.caption}</figcaption>}
        </figure>
      );
    return null;
  }
  return (
    <div className={styles.prose}>
      {articleDocument(blocks).content.map(render)}
    </div>
  );
}
