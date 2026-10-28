import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "../node_modules/typescript/lib/typescript.js";
const requireFrontend = createRequire(
  new URL("../package.json", import.meta.url),
);
const { Editor } = requireFrontend("@tiptap/core");
const { validateDocument } = requireFrontend(
  "../backend/src/lib/blog-document.js",
);
const React = requireFrontend("react"),
  { renderToStaticMarkup } = requireFrontend("react-dom/server");
const root = fileURLToPath(new URL("..", import.meta.url)),
  cache = new Map();
function load(file) {
  file = resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const localRequire = (name) => {
    if (name.endsWith(".css"))
      return {
        __esModule: true,
        default: new Proxy({}, { get: (_, key) => String(key) }),
      };
    if (!name.startsWith(".") && !name.startsWith("@/"))
      return requireFrontend(name);
    const target = name.startsWith("@/")
      ? resolve(root, name.slice(2))
      : resolve(dirname(file), name);
    return load(existsSync(target + ".ts") ? target + ".ts" : target + ".tsx");
  };
  new Function("require", "module", "exports", source)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}
const { blogEditorExtensions, articleInsertionRange } = load(
  "lib/blog-editor-extensions.ts",
);
const documentLib = load("lib/blog-document.ts");
function makeEditor() {
  return new Editor({
    element: null,
    extensions: blogEditorExtensions(() => "/api/v1/admin/blog/1/media/"),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Choose a reliable car for daily journeys." },
          ],
        },
      ],
    },
  });
}
test("pasted blocks preserve a selected image and still replace selected text", () => {
  const editor = makeEditor();
  try {
    const image = {
      type: "blogImage",
      attrs: {
        mediaId: 1,
        alt: "The imported car image",
        decorative: false,
        reviewed: true,
        caption: "",
        width: 100,
        align: "center",
      },
    };
    editor.commands.insertContentAt(editor.state.doc.content.size, [
      image,
      image,
    ]);
    const lastImage = editor.state.doc.content.size - 1;
    editor.commands.setNodeSelection(lastImage);
    const bookmark = editor.state.selection.getBookmark();
    editor.commands.insertContentAt(
      articleInsertionRange(bookmark.resolve(editor.state.doc)),
      [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Pasted advice" }],
        },
      ],
    );
    assert.equal(
      editor.getJSON().content.filter((node) => node.type === "blogImage")
        .length,
      2,
    );
    assert.match(documentLib.articleText(editor.getJSON()), /Pasted advice/);
    editor.commands.setTextSelection({ from: 1, to: 7 });
    editor.commands.insertContentAt(
      articleInsertionRange(editor.state.selection),
      {
        type: "text",
        text: "Select",
      },
    );
    assert.match(
      documentLib.articleText(editor.getJSON()),
      /^Select a reliable/,
    );
    validateDocument(editor.getJSON());
  } finally {
    editor.destroy();
  }
});
test("actual editor commands format selected existing words, retain headings and round-trip JSON through backend validation", () => {
  const editor = makeEditor();
  try {
    editor.commands.setTextSelection({ from: 1, to: 7 });
    for (const command of ["toggleBold", "toggleItalic", "toggleUnderline"])
      assert.equal(editor.commands[command](), true);
    // The owner asked for article formatting only: no strikethrough, code,
    // colours, highlights, sizes, alignment or super/subscript.
    for (const removed of [
      "toggleStrike",
      "toggleCode",
      "setColor",
      "setHighlight",
      "setTextAlign",
      "toggleSuperscript",
      "toggleSubscript",
    ])
      assert.equal(editor.commands[removed], undefined, removed);
    const json = editor.getJSON();
    assert.deepEqual(
      json.content[0].content[0].marks.map((mark) => mark.type).sort(),
      ["bold", "italic", "underline"],
    );
    assert.equal(json.content[0].content[0].text, "Choose");
    assert.equal(
      documentLib.articleText(json),
      "Choose a reliable car for daily journeys.",
    );
    validateDocument(json);
    editor.commands.setHeading({ level: 3 });
    assert.equal(editor.getJSON().content[0].attrs.level, 3);
    assert.equal(editor.commands.setHeading({ level: 4 }), false);
    const reopened = new Editor({
      element: null,
      extensions: blogEditorExtensions(() => "/api/v1/admin/blog/1/media/"),
      content: editor.getJSON(),
    });
    assert.deepEqual(reopened.getJSON(), editor.getJSON());
    validateDocument(reopened.getJSON());
    reopened.destroy();
  } finally {
    editor.destroy();
  }
});
test("actual link commands preserve surrounding text and formatting when links are created, changed and removed", () => {
  const editor = makeEditor();
  try {
    editor.commands.setTextSelection({ from: 1, to: 7 });
    editor.commands.toggleBold();
    assert.equal(
      editor.commands.setLink({
        href: "/contact",
        target: null,
        rel: "noopener noreferrer",
      }),
      true,
    );
    assert.equal(
      editor
        .getJSON()
        .content[0].content[0].marks.find((mark) => mark.type === "link").attrs
        .href,
      "/contact",
    );
    editor.commands.setLink({
      href: "https://example.com/guide",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    validateDocument(editor.getJSON());
    editor.commands.unsetLink();
    assert.equal(
      editor
        .getJSON()
        .content[0].content[0].marks.some((mark) => mark.type === "link"),
      false,
    );
    assert.equal(editor.getJSON().content[0].content[0].marks[0].type, "bold");
    assert.equal(
      documentLib.articleText(editor.getJSON()),
      "Choose a reliable car for daily journeys.",
    );
  } finally {
    editor.destroy();
  }
});
test("public rich rendering escapes scripts, secures links, gives individual images their alt and keeps one title H1", () => {
  const body = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "First section" }],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Second section" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "<script>alert(1)</script>",
            marks: [
              { type: "bold" },
              {
                type: "link",
                attrs: { href: "https://example.com/", target: "_blank" },
              },
            ],
          },
        ],
      },
      ...["The front of a blue car", "A close-up of its dashboard"].map(
        (alt, index) => ({
          type: "blogImage",
          attrs: {
            mediaId: index + 1,
            alt,
            decorative: false,
            reviewed: true,
            width: 75,
            align: "center",
            caption: "Visible caption " + index,
          },
        }),
      ),
    ],
  };
  validateDocument(body);
  const { BlogContent } = load("components/blog-content.tsx");
  const html = renderToStaticMarkup(
    React.createElement(BlogContent, { blocks: body }),
  );
  assert.doesNotMatch(html, /<h1\b|<script>/);
  assert.match(html, /<h2 id="section-0"/);
  assert.match(html, /<h3 id="section-1"/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /alt="The front of a blue car"/);
  assert.match(html, /alt="A close-up of its dashboard"/);
  assert.match(html, /src="\/api\/v1\/blog-media\/2"/);
  assert.match(html, /<figcaption>Visible caption 1/);
});
test("reading statistics agree between editor and server without double-counting formatting, URLs or image descriptions", () => {
  const { readingStats } = requireFrontend(
    "../backend/src/lib/blog-document.js",
  );
  const body = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "hello", marks: [{ type: "bold" }] },
          { type: "text", text: "world one two " },
          {
            type: "text",
            text: "three",
            marks: [
              { type: "italic" },
              {
                type: "link",
                attrs: { href: "https://example.com/extra-words" },
              },
            ],
          },
        ],
      },
    ],
  };
  assert.deepEqual(documentLib.articleStats(body), readingStats(body));
  assert.equal(documentLib.articleStats(body).words, 4);
  assert.equal(
    documentLib.articleStats({ type: "doc", content: [] }).minutes,
    0,
  );
});

test("image transactions reject unreviewed nodes and preserve independently reviewed accessibility attributes", () => {
  const editor = makeEditor();
  try {
    editor.view.updateState(
      editor.state.reconfigure({ plugins: editor.extensionManager.plugins }),
    );
    const before = editor.getJSON();
    editor.commands.insertContent({
      type: "blogImage",
      attrs: { mediaId: 1, alt: "", reviewed: false },
    });
    assert.deepEqual(editor.getJSON(), before);
    const attrs = {
      mediaId: 1,
      alt: "A blue car outside the showroom",
      decorative: false,
      reviewed: true,
      caption: "A useful visible caption",
      width: 50,
      align: "right",
    };
    editor.commands.insertContent({ type: "blogImage", attrs });
    const saved = editor.getJSON();
    validateDocument(saved);
    assert.deepEqual(
      { ...saved.content.find((node) => node.type === "blogImage").attrs },
      attrs,
    );
  } finally {
    editor.destroy();
  }
});

test("Word conversion retains headings, emphasis, links and tables and supplies each image separately for review", async () => {
  const { wordFile } = await import("./fixtures/blog-docx.mjs");
  const word = await wordFile({ buffer: Buffer.from("QA image placeholder") });
  const { checkDocxArchive } = load("lib/blog-import.ts");
  const buffer = word.buffer.buffer.slice(
    word.buffer.byteOffset,
    word.buffer.byteOffset + word.buffer.byteLength,
  );
  checkDocxArchive(buffer);
  const mammoth = requireFrontend("mammoth");
  let output;
  const scope = {
    postMessage: (value) => {
      output = value;
    },
  };
  const worker = ts.transpileModule(
    readFileSync(resolve(root, "lib/blog-docx-worker.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
  new Function("require", "self", "exports", worker)(
    (name) =>
      name === "mammoth"
        ? {
            ...mammoth,
            convertToHtml: (input, options) =>
              mammoth.convertToHtml(
                { buffer: Buffer.from(input.arrayBuffer) },
                options,
              ),
          }
        : load("lib/blog-import.ts"),
    scope,
    {},
  );
  await scope.onmessage({ data: buffer });
  assert.equal(output.error, undefined);
  assert.equal(output.images.length, 2);
  assert.equal(output.images[0].alt, "Original imported image description");
  assert.equal(output.images[1].alt, "");
  assert.match(output.html, /<h1>Imported automotive guide/);
  assert.match(output.html, /<strong>/);
  assert.match(output.html, /<em>/);
  assert.match(output.html, /<u>/);
  assert.match(output.html, /href="\/contact"/);
  assert.match(output.html, /<table>/);
  assert.match(output.html, /src="docx-image-0"/);
  assert.match(output.html, /src="docx-image-1"/);
  assert.throws(() => checkDocxArchive(new ArrayBuffer(24)), /DOCX/);
  const oversized = new ArrayBuffer(9 * 1024 * 1024);
  assert.throws(() => checkDocxArchive(oversized), /8 MB/);
});

test("lists, line breaks and imported table structures validate; older styling is cleaned for the editor", () => {
  const cleaned = documentLib.editorArticle({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 4, textAlign: "center" },
        content: [{ type: "text", text: "Checks" }],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "justify" },
        content: [
          {
            type: "text",
            text: "Tyres",
            marks: [
              { type: "bold" },
              { type: "textStyle", attrs: { color: "#245b66" } },
              { type: "highlight", attrs: { color: "#fef3c7" } },
              { type: "strike" },
            ],
          },
        ],
      },
    ],
  });
  // Values come from the loaded module's own realm; compare as plain JSON.
  const plain = (value) => JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(cleaned.content[0].attrs), { level: 3 });
  assert.deepEqual(plain(cleaned.content[1].attrs), {});
  assert.deepEqual(plain(cleaned.content[1].content[0].marks), [
    { type: "bold" },
  ]);
  const editor = makeEditor();
  try {
    editor.commands.setTextSelection({ from: 1, to: 7 });
    editor.commands.setContent(cleaned);
    assert.deepEqual(plain(editor.getJSON().content[0].attrs), { level: 3 });
    editor.commands.setTextSelection({ from: 1, to: 2 });
    validateDocument(editor.getJSON());
    editor.commands.toggleBulletList();
    validateDocument(editor.getJSON());
    editor.commands.setHardBreak();
    validateDocument(editor.getJSON());
    editor.commands.toggleBulletList();
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
    validateDocument(editor.getJSON());
    assert.ok(editor.getJSON().content.some((node) => node.type === "table"));
  } finally {
    editor.destroy();
  }
});
