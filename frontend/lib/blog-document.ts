export type ArticleMark = { type: string; attrs?: Record<string, any> };
export type ArticleNode = {
  type: string;
  attrs?: Record<string, any>;
  content?: ArticleNode[];
  text?: string;
  marks?: ArticleMark[];
};
export type ArticleDocument = ArticleNode & {
  type: "doc";
  content: ArticleNode[];
};
export type LegacyBlock = {
  type:
    "paragraph" | "heading" | "subheading" | "bullets" | "numbered" | "quote";
  text: string;
};
export type ArticleBody = ArticleDocument | LegacyBlock[];
export const textColours = ["#172b3a", "#245b66", "#854d0e", "#9f1239"];
export const highlightColours = ["#fef3c7", "#dcfce7", "#dbeafe"];
export function safeArticleUrl(value: string) {
  if (!value || value.length > 2000 || /[\u0000-\u0020\\]/.test(value))
    return false;
  if (value.startsWith("/"))
    return (
      !value.startsWith("//") && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f])/i.test(value)
    );
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function validImageAlt(value: string, decorative = false) {
  const text = value.trim();
  return decorative
    ? text === ""
    : text.length >= 3 &&
        text.length <= 200 &&
        !/^(image|photo|picture|img|untitled|test|alt(?: text)?|\S+\.(?:png|jpe?g|webp))$/i.test(
          text,
        );
}
export function articleDocument(body: ArticleBody): ArticleDocument {
  if (!Array.isArray(body)) return body;
  const text = (value: string): ArticleNode[] =>
    value ? [{ type: "text", text: value }] : [];
  return {
    type: "doc",
    content: body.map((block) => {
      if (block.type === "bullets" || block.type === "numbered")
        return {
          type: block.type === "bullets" ? "bulletList" : "orderedList",
          content: block.text
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => ({
              type: "listItem",
              content: [{ type: "paragraph", content: text(line) }],
            })),
        };
      if (block.type === "quote")
        return {
          type: "blockquote",
          content: [{ type: "paragraph", content: text(block.text) }],
        };
      if (block.type === "heading" || block.type === "subheading")
        return {
          type: "heading",
          attrs: { level: block.type === "heading" ? 2 : 3 },
          content: text(block.text),
        };
      return { type: "paragraph", content: text(block.text) };
    }),
  };
}
// The editor supports a deliberately small set of formatting. Older or pasted
// documents may carry colours, sizes, alignment or extra marks; drop those and
// cap headings at H3 so the editor can always open the article.
const editorMarks = ["bold", "italic", "underline", "link"];
export function editorArticle(body: ArticleBody): ArticleDocument {
  const clean = (node: ArticleNode): ArticleNode => {
    const next: ArticleNode = { ...node };
    if (node.marks)
      next.marks = node.marks.filter((mark) => editorMarks.includes(mark.type));
    if (node.attrs && ["paragraph", "heading"].includes(node.type)) {
      const { textAlign, ...attrs } = node.attrs;
      if (node.type === "heading")
        attrs.level = Math.min(3, Math.max(1, Number(attrs.level) || 2));
      next.attrs = attrs;
    }
    if (node.content) next.content = node.content.map(clean);
    return next;
  };
  return clean(articleDocument(body)) as ArticleDocument;
}
export function articleText(body: ArticleBody): string {
  const walk = (node: ArticleNode): string =>
    node.type === "text"
      ? node.text || ""
      : node.type === "blogImage"
        ? node.attrs?.caption || ""
        : (node.content || [])
            .map(walk)
            .join(
              [
                "doc",
                "blockquote",
                "listItem",
                "bulletList",
                "orderedList",
                "table",
                "tableRow",
                "tableCell",
                "tableHeader",
              ].includes(node.type)
                ? " "
                : "",
            ) + (node.type === "hardBreak" ? " " : "");
  return walk(articleDocument(body)).trim();
}
export function articleStats(body: ArticleBody, speed = 220) {
  const text = articleText(body);
  const words = text
    ? text.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length
    : 0;
  return {
    words,
    characters: text.length,
    minutes: words
      ? Math.max(1, Math.ceil(words / Math.min(300, Math.max(100, speed))))
      : 0,
  };
}
export function articleHeadings(body: ArticleBody) {
  const headings: { id: string; text: string; level: number }[] = [];
  let index = 0;
  const walk = (node: ArticleNode) => {
    if (node.type === "heading")
      headings.push({
        id: `section-${index++}`,
        text: articleText({ type: "doc", content: [node] }),
        level: node.attrs?.level || 2,
      });
    (node.content || []).forEach(walk);
  };
  walk(articleDocument(body));
  return headings;
}
export function imageProblems(body: ArticleBody) {
  const problems: string[] = [];
  const walk = (node: ArticleNode) => {
    if (
      node.type === "blogImage" &&
      (node.attrs?.reviewed !== true ||
        typeof node.attrs?.alt !== "string" ||
        !validImageAlt(node.attrs.alt, node.attrs.decorative))
    )
      problems.push(
        "Review the alternative text for every image before previewing or saving.",
      );
    (node.content || []).forEach(walk);
  };
  walk(articleDocument(body));
  return problems;
}
