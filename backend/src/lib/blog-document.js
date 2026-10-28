// The public renderer accepts this closed document vocabulary, never HTML.
const TEXT_COLOURS = ["#172b3a", "#245b66", "#854d0e", "#9f1239"];
const HIGHLIGHTS = ["#fef3c7", "#dcfce7", "#dbeafe"];
function safeBlogUrl(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 2000 ||
    /[\u0000-\u0020\\]/.test(value)
  )
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
function meaningfulAlt(value, decorative = false) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  return decorative
    ? text === ""
    : text.length >= 3 &&
        text.length <= 200 &&
        !/^(image|photo|picture|img|untitled|test|alt(?: text)?|\S+\.(?:png|jpe?g|webp))$/i.test(
          text,
        );
}
function legacyDocument(blocks) {
  return {
    type: "doc",
    content: blocks.map((block) => {
      const text = (value) => (value ? [{ type: "text", text: value }] : []);
      if (["bullets", "numbered"].includes(block.type))
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
      return {
        type: ["heading", "subheading"].includes(block.type)
          ? "heading"
          : "paragraph",
        ...(["heading", "subheading"].includes(block.type)
          ? { attrs: { level: block.type === "heading" ? 2 : 3 } }
          : {}),
        content: text(block.text),
      };
    }),
  };
}
function asDocument(body) {
  return Array.isArray(body) ? legacyDocument(body) : body;
}
function documentText(body) {
  const walk = (node) =>
    node.type === "text"
      ? node.text
      : node.type === "blogImage"
        ? node.attrs?.caption || ""
        : (node.content || [])
            .map(walk)
            .join(
              [
                "listItem",
                "tableCell",
                "tableHeader",
                "doc",
                "tableRow",
                "table",
                "bulletList",
                "orderedList",
                "blockquote",
              ].includes(node.type)
                ? " "
                : "",
            ) + (node.type === "hardBreak" ? " " : "");
  return walk(asDocument(body)).trim();
}
function readingStats(body, speed = 220) {
  const text = documentText(body);
  const words = text
    ? text.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length
    : 0;
  return {
    words,
    characters: text.length,
    minutes: words ? Math.max(1, Math.ceil(words / speed)) : 0,
  };
}
function imageIds(body) {
  const ids = new Set();
  const walk = (node) => {
    if (node.type === "blogImage") ids.add(node.attrs.mediaId);
    (node.content || []).forEach(walk);
  };
  walk(asDocument(body));
  return [...ids];
}
function validateDocument(doc) {
  let count = 0,
    imageCount = 0;
  const error = (message) => {
    throw new Error(message);
  };
  const keys = (value, allowed) => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key))
    )
      error("Unsupported document attributes");
  };
  const inline = ["text", "hardBreak"];
  const blocks = [
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "blockquote",
    "horizontalRule",
    "blogImage",
    "table",
  ];
  function walk(node, depth, parent) {
    if (++count > 3000 || depth > 14)
      error("This article has too many nested elements");
    keys(node, ["type", "attrs", "content", "text", "marks"]);
    const type = node.type,
      attrs = node.attrs || {},
      children = node.content || [];
    if (
      !Array.isArray(children) ||
      ![
        "doc",
        ...inline,
        ...blocks,
        "listItem",
        "tableRow",
        "tableCell",
        "tableHeader",
      ].includes(type)
    )
      error("Unsupported article element");
    const accepts =
      parent === "doc" ||
      parent === "blockquote" ||
      parent === "tableCell" ||
      parent === "tableHeader"
        ? blocks
        : ["paragraph", "heading"].includes(parent)
          ? inline
          : ["bulletList", "orderedList"].includes(parent)
            ? ["listItem"]
            : parent === "listItem"
              ? blocks
              : parent === "table"
                ? ["tableRow"]
                : parent === "tableRow"
                  ? ["tableCell", "tableHeader"]
                  : [];
    if (parent && !accepts.includes(type)) error("Invalid article structure");
    if (type === "doc" && parent) error("Nested documents are not supported");
    if (
      !["text", "hardBreak"].includes(type) &&
      (node.text !== undefined || node.marks !== undefined)
    )
      error("Only text may have formatting marks");
    if (type === "text" || type === "hardBreak") {
      keys(attrs, []);
      if (
        (type === "text" && (typeof node.text !== "string" || !node.text)) ||
        (type === "hardBreak" && node.text !== undefined) ||
        children.length
      )
        error("Invalid article text");
      if (node.marks && (!Array.isArray(node.marks) || node.marks.length > 10))
        error("Invalid text formatting");
      const seen = new Set();
      for (const mark of node.marks || []) {
        keys(mark, ["type", "attrs"]);
        if (seen.has(mark.type)) error("Duplicate text formatting");
        seen.add(mark.type);
        const a = mark.attrs || {};
        if (
          [
            "bold",
            "italic",
            "underline",
            "strike",
            "code",
            "subscript",
            "superscript",
          ].includes(mark.type)
        )
          keys(a, []);
        else if (mark.type === "link") {
          keys(a, ["href", "target", "rel", "class", "title"]);
          if (
            a.title != null &&
            (typeof a.title !== "string" || a.title.length > 300)
          )
            error("Invalid link title");
          if (
            !safeBlogUrl(a.href) ||
            ![undefined, null, "_blank", "_self"].includes(a.target) ||
            a.class ||
            (a.rel &&
              a.rel !== "noopener noreferrer nofollow" &&
              a.rel !== "noopener noreferrer")
          )
            error("Use a safe HTTPS or internal link");
        } else if (mark.type === "textStyle") {
          keys(a, ["color", "fontSize"]);
          if (a.color && !TEXT_COLOURS.includes(a.color.toLowerCase()))
            error("Choose a supported text colour");
          if (a.fontSize && !["16px", "18px", "22px"].includes(a.fontSize))
            error("Choose a supported text size");
        } else if (mark.type === "highlight") {
          keys(a, ["color"]);
          if (a.color && !HIGHLIGHTS.includes(a.color.toLowerCase()))
            error("Choose a supported highlight colour");
        } else error("Unsupported text formatting");
      }
    } else if (type === "heading" || type === "paragraph") {
      keys(attrs, type === "heading" ? ["level", "textAlign"] : ["textAlign"]);
      if (type === "heading" && ![1, 2, 3, 4].includes(attrs.level))
        error("Choose heading 1 to 4");
      if (
        ![undefined, null, "left", "center", "right", "justify"].includes(
          attrs.textAlign,
        )
      )
        error("Invalid text alignment");
    } else if (type === "blogImage") {
      keys(attrs, [
        "mediaId",
        "alt",
        "decorative",
        "reviewed",
        "caption",
        "width",
        "align",
      ]);
      if (
        ++imageCount > 30 ||
        !Number.isSafeInteger(attrs.mediaId) ||
        attrs.mediaId < 1 ||
        attrs.reviewed !== true ||
        typeof attrs.decorative !== "boolean" ||
        !meaningfulAlt(attrs.alt, attrs.decorative)
      )
        error("Review alternative text for every article image");
      if (
        typeof attrs.caption !== "string" ||
        attrs.caption.length > 300 ||
        ![25, 50, 75, 100].includes(attrs.width) ||
        !["left", "center", "right"].includes(attrs.align) ||
        children.length
      )
        error("Invalid article image settings");
    } else if (type === "orderedList") {
      keys(attrs, ["start", "type"]);
      if (
        attrs.start !== undefined &&
        (!Number.isInteger(attrs.start) ||
          attrs.start < 1 ||
          attrs.start > 10000)
      )
        error("Invalid list numbering");
      if (attrs.type && attrs.type !== "1") error("Unsupported list style");
    } else if (type === "tableCell" || type === "tableHeader") {
      keys(attrs, ["colspan", "rowspan", "colwidth", "align"]);
      if (
        ![undefined, null, "left", "center", "right", "justify"].includes(
          attrs.align,
        )
      )
        error("Invalid cell alignment");
      for (const key of ["colspan", "rowspan"])
        if (
          attrs[key] !== undefined &&
          (!Number.isInteger(attrs[key]) || attrs[key] < 1 || attrs[key] > 20)
        )
          error("Table is too large");
      if (
        attrs.colwidth != null &&
        (!Array.isArray(attrs.colwidth) ||
          attrs.colwidth.length > 20 ||
          attrs.colwidth.some(
            (value) => !Number.isInteger(value) || value < 25 || value > 1500,
          ))
      )
        error("Invalid table widths");
    } else keys(attrs, []);
    if (
      ["text", "hardBreak", "horizontalRule", "blogImage"].includes(type) &&
      children.length
    )
      error("Invalid leaf content");
    if (
      ["table", "tableRow", "listItem", "bulletList", "orderedList"].includes(
        type,
      ) &&
      !children.length
    )
      error("Remove empty lists or tables");
    children.forEach((child) => walk(child, depth + 1, type));
  }
  if (!doc || doc.type !== "doc") error("Invalid article document");
  walk(doc, 0, null);
  return doc;
}
module.exports = {
  safeBlogUrl,
  meaningfulAlt,
  asDocument,
  documentText,
  readingStats,
  imageIds,
  validateDocument,
};
