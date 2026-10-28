import { safeArticleUrl } from "./blog-document";

// Parse into an inert document, then rebuild the supported vocabulary. Never
// insert source HTML into the live DOM or retain arbitrary style/URL attributes.
export function cleanArticleHtml(html: string, keepImages = false) {
  if (html.length > 500000)
    throw new Error("The pasted document is too large.");
  // Template contents are inert: pasted remote images/iframes must not load
  // before the supported nodes and reviewed image sources are reconstructed.
  const source = document.createElement("template");
  source.innerHTML = html;
  const target = document.implementation.createHTMLDocument("");
  const allowed = new Set([
    "p",
    "div",
    "h1",
    "h2",
    "h3",
    "h4",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "del",
    "sub",
    "sup",
    "code",
    "ul",
    "ol",
    "li",
    "blockquote",
    "hr",
    "br",
    "a",
    "table",
    "tbody",
    "thead",
    "tr",
    "th",
    "td",
    "span",
  ]);
  let count = 0;
  function copy(node: Node, parent: Node, depth: number) {
    if (++count > 6000 || depth > 25)
      throw new Error("The pasted document is too complex.");
    if (node.nodeType === 3) {
      parent.appendChild(target.createTextNode(node.textContent || ""));
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as HTMLElement,
      tag = element.tagName.toLowerCase();
    if (
      [
        "script",
        "style",
        "iframe",
        "object",
        "embed",
        "svg",
        "math",
        "form",
        "input",
        "button",
        "video",
        "audio",
        "link",
        "meta",
      ].includes(tag)
    )
      return;
    if (tag === "img") {
      if (keepImages) {
        const img = target.createElement("img");
        img.setAttribute(
          "data-import-image",
          element.getAttribute("src") || "",
        );
        img.setAttribute("alt", element.getAttribute("alt") || "");
        parent.appendChild(img);
      }
      return;
    }
    if (!allowed.has(tag)) {
      Array.from(node.childNodes).forEach((child) =>
        copy(child, parent, depth + 1),
      );
      return;
    }
    // Word/Docs frequently store bold/italic/underline in styled spans.
    let result = target.createElement(
      tag === "div"
        ? "p"
        : tag === "b" && element.style.fontWeight === "normal"
          ? "span"
          : tag,
    );
    const start = result;
    if (tag === "a") {
      const href = element.getAttribute("href") || "";
      if (safeArticleUrl(href)) {
        result.setAttribute("href", href);
        if (element.getAttribute("target") === "_blank") {
          result.setAttribute("target", "_blank");
          result.setAttribute("rel", "noopener noreferrer");
        }
      }
    }
    if (["td", "th"].includes(tag))
      for (const key of ["colspan", "rowspan"]) {
        const value = Number(element.getAttribute(key));
        if (value > 0 && value <= 20) result.setAttribute(key, String(value));
      }
    if (tag === "ol") {
      const start = Number(element.getAttribute("start"));
      if (start > 0 && start <= 10000)
        result.setAttribute("start", String(start));
    }
    if (tag === "span" || tag === "b") {
      const wrappers: string[] = [];
      if (
        element.style.fontWeight === "bold" ||
        Number(element.style.fontWeight) >= 600
      )
        wrappers.push("strong");
      if (element.style.fontStyle === "italic") wrappers.push("em");
      if (element.style.textDecoration.includes("underline"))
        wrappers.push("u");
      if (element.style.textDecoration.includes("line-through"))
        wrappers.push("s");
      for (const wrapper of wrappers) {
        const inner = target.createElement(wrapper);
        result.appendChild(inner);
        result = inner;
      }
    }
    parent.appendChild(start);
    Array.from(node.childNodes).forEach((child) =>
      copy(child, result, depth + 1),
    );
  }
  Array.from(source.content.childNodes).forEach((node) =>
    copy(node, target.body, 0),
  );
  return target.body.innerHTML;
}

export function checkDocxArchive(buffer: ArrayBuffer) {
  if (buffer.byteLength > 8 * 1024 * 1024)
    throw new Error("Choose a DOCX file smaller than 8 MB.");
  const view = new DataView(buffer);
  let end = -1;
  for (
    let offset = buffer.byteLength - 22;
    offset >= Math.max(0, buffer.byteLength - 65557);
    offset--
  )
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  if (end < 0) throw new Error("This is not a readable DOCX file.");
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true),
    total = 0,
    document = false;
  if (count > 4000)
    throw new Error("This Word document contains too many files.");
  for (let index = 0; index < count; index++) {
    if (
      cursor + 46 > buffer.byteLength ||
      view.getUint32(cursor, true) !== 0x02014b50
    )
      throw new Error("The Word document is incomplete.");
    const size = view.getUint32(cursor + 24, true),
      nameLength = view.getUint16(cursor + 28, true),
      extra = view.getUint16(cursor + 30, true),
      comment = view.getUint16(cursor + 32, true);
    total += size;
    if (total > 24 * 1024 * 1024 || view.getUint16(cursor + 8, true) & 1)
      throw new Error("This Word document is too large or password protected.");
    if (
      new TextDecoder().decode(
        new Uint8Array(buffer, cursor + 46, nameLength),
      ) === "word/document.xml"
    )
      document = true;
    cursor += 46 + nameLength + extra + comment;
  }
  if (!document) throw new Error("Choose a Word .docx document.");
}
