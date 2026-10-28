const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const sharp = require("sharp");
const storage = require("node:fs").mkdtempSync(
  path.join(os.tmpdir(), "ncr-blog-tests-"),
);
process.env.STORAGE_DIR = storage;
process.env.JWT_SECRET = "isolated-blog-test-secret-".repeat(4);
const db = require("../src/config/db");
let posts, media, refs, audits, commitError;
const fields = [
  "title",
  "slug",
  "excerpt",
  "category",
  "author_name",
  "body",
  "cover_id",
  "cover_alt",
  "seo_title",
  "seo_description",
  "seo_keywords",
  "status",
  "scheduled_at",
];
db.query = async (sql, values = []) => {
  if (sql.startsWith("INSERT INTO nw_audit")) {
    audits.push(values);
    return { insertId: audits.length };
  }
  if (sql.startsWith("INSERT INTO nw_blog_posts")) {
    if (posts.some((post) => post.slug === values[1]))
      throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
    const post = {
      ...Object.fromEntries(
        fields.map((field, index) => [field, values[index]]),
      ),
      id: posts.length + 1,
      created_by: values[fields.length],
      version: 1,
      created_at: "2026-10-26 00:00:00",
      updated_at: "2026-10-26 00:00:00",
      published_at:
        values[fields.indexOf("status")] === "published"
          ? values[fields.length + 2] || "2026-10-26 00:00:00"
          : null,
    };
    posts.push(post);
    return { insertId: post.id };
  }
  if (sql.startsWith("UPDATE nw_blog_posts")) {
    const post = posts.find((post) => post.id === values.at(-1));
    if (sql.includes("title=?")) {
      if (
        posts.some((other) => other.id !== post.id && other.slug === values[1])
      )
        throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
      Object.assign(
        post,
        Object.fromEntries(
          fields.map((field, index) => [field, values[index]]),
        ),
      );
    } else post.status = values[0];
    if (
      post.status === "published" &&
      (!post.published_at ||
        new Date(post.published_at.replace(" ", "T") + "Z").getTime() >
          Date.now())
    )
      post.published_at = values.at(-2) || "2026-10-26 00:00:00";
    else if (
      post.status !== "published" &&
      post.published_at &&
      new Date(post.published_at.replace(" ", "T") + "Z").getTime() > Date.now()
    )
      post.published_at = null;
    post.version++;
    return { affectedRows: 1 };
  }
  if (sql.startsWith("SELECT * FROM nw_blog_posts WHERE id="))
    return structuredClone(
      posts.filter((post) => post.id === Number(values[0])),
    );
  if (sql.startsWith("SELECT id FROM nw_blog_posts"))
    return posts
      .filter((post) => post.id === Number(values[0]))
      .map((post) => ({ id: post.id }));
  if (sql.startsWith("SELECT * FROM nw_blog_posts WHERE slug="))
    return structuredClone(
      posts.filter(
        (post) =>
          post.slug === values[0] &&
          post.status === "published" &&
          new Date(post.published_at.replace(" ", "T") + "Z").getTime() <=
            Date.now(),
      ),
    );
  if (
    sql.startsWith("SELECT * FROM nw_blog_posts WHERE") ||
    sql.startsWith("SELECT COUNT(*) AS total FROM nw_blog_posts WHERE")
  ) {
    const filtered = posts.filter(
      (post) =>
        (!sql.includes("status=?") || post.status === values[0]) &&
        (!sql.includes("published_at<=") ||
          (post.published_at &&
            new Date(post.published_at.replace(" ", "T") + "Z").getTime() <=
              Date.now())) &&
        (!sql.includes("published_at>") ||
          (post.published_at &&
            new Date(post.published_at.replace(" ", "T") + "Z").getTime() >
              Date.now())),
    );
    return sql.startsWith("SELECT COUNT")
      ? [{ total: filtered.length }]
      : structuredClone(filtered);
  }
  if (sql.startsWith("SELECT slug,updated_at,cover_id"))
    return posts
      .filter(
        (post) =>
          post.status === "published" &&
          new Date(post.published_at.replace(" ", "T") + "Z").getTime() <=
            Date.now(),
      )
      .map(({ slug, updated_at, cover_id }) => ({
        slug,
        updated_at,
        cover_id,
      }));
  if (sql.startsWith("DELETE FROM nw_blog_media_refs")) {
    refs = refs.filter((ref) => ref.post_id !== values[0]);
    return { affectedRows: 1 };
  }
  if (sql.startsWith("INSERT INTO nw_blog_media_refs")) {
    refs.push({ post_id: values[0], media_id: values[1] });
    return { affectedRows: 1 };
  }
  if (sql.startsWith("INSERT INTO nw_blog_media(")) {
    const image = {
      id: media.length + 1,
      post_id: values[0],
      storage_key: values[1],
      width: values[2],
      height: values[3],
    };
    media.push(image);
    return { insertId: image.id };
  }
  if (
    sql.startsWith("SELECT id FROM nw_blog_media") ||
    sql.startsWith("SELECT storage_key FROM nw_blog_media")
  )
    return media.filter(
      (image) => image.id === values[0] && image.post_id === values[1],
    );
  if (sql.startsWith("SELECT m.storage_key"))
    return media.filter(
      (image) =>
        image.id === Number(values[0]) &&
        posts.some(
          (post) =>
            post.id === image.post_id &&
            (post.cover_id === image.id ||
              refs.some(
                (ref) => ref.post_id === post.id && ref.media_id === image.id,
              )) &&
            post.status === "published" &&
            new Date(post.published_at.replace(" ", "T") + "Z").getTime() <=
              Date.now(),
        ),
    );
  throw new Error("Unexpected blog SQL: " + sql);
};
db.transaction = async (work) => {
  const snapshot = structuredClone({ posts, media, refs, audits });
  try {
    const result = await work({});
    if (commitError) throw commitError;
    return result;
  } catch (error) {
    ({ posts, media, refs, audits } = snapshot);
    throw error;
  }
};
const { adminRouter, publicRouter } = require("../src/routes/blog");
const { blogSchema, blogView } = require("../src/lib/blog");
const content = {
  title: "Choosing a car for your daily commute",
  slug: "daily-commute",
  excerpt:
    "A practical guide to choosing a used car that fits your routes and budget.",
  category: "buying",
  author_name: "NCR Wheelz",
  body: [
    { type: "heading", text: "Start with your routes" },
    {
      type: "paragraph",
      text: "Consider your daily distance, the space you need and your monthly running budget before you build a shortlist.",
    },
  ],
};
beforeEach(() => {
  refs = [];
  posts = [];
  media = [];
  audits = [];
  commitError = null;
});
async function invoke(router, routePath, method, body = {}, extras = {}) {
  const route = router.stack.find(
    (layer) => layer.route?.path === routePath && layer.route.methods[method],
  ).route;
  let result,
    error,
    status = 200,
    bytes;
  await route.stack.at(-1).handle(
    {
      body,
      query: {},
      params: { id: "1", slug: content.slug },
      user: { id: 7, role: "admin" },
      ...extras,
    },
    {
      status(value) {
        status = value;
        return this;
      },
      json(value) {
        result = value;
        return this;
      },
      type() {
        return this;
      },
      set() {
        return this;
      },
      send(value) {
        bytes = value;
        return this;
      },
    },
    (value) => {
      error = value;
    },
  );
  return {
    body: result,
    error,
    status: error?.status || (error?.name === "ZodError" ? 422 : status),
    bytes,
  };
}
test("blog drafts stay private until deliberate publication and disappear on unpublish or archive", async () => {
  const created = await invoke(adminRouter, "/", "post", content);
  assert.equal(created.status, 201);
  assert.equal(created.body.status, "draft");
  assert.equal((await invoke(publicRouter, "/blog/:slug", "get")).status, 404);
  assert.equal((await invoke(publicRouter, "/blog", "get")).body.total, 0);
  assert.equal(
    (
      await invoke(
        publicRouter,
        "/blog",
        "get",
        {},
        { query: { status: "draft" } },
      )
    ).body.total,
    0,
  );
  const published = await invoke(adminRouter, "/:id/status", "patch", {
    version: 1,
    status: "published",
  });
  assert.equal(published.body.version, 2);
  assert.ok(published.body.published_at);
  const publicPost = (await invoke(publicRouter, "/blog/:slug", "get")).body;
  for (const key of [
    "version",
    "status",
    "created_by",
    "created_at",
    "cover_id",
    "storage_key",
  ])
    assert.equal(key in publicPost, false, key);
  assert.equal(publicPost.body[0].type, "heading");
  const listing = (await invoke(publicRouter, "/blog", "get")).body;
  assert.equal(listing.total, 1);
  assert.equal("body" in listing.items[0], false);
  assert.equal(
    (await invoke(publicRouter, "/seo/blog", "get")).body.items.length,
    1,
  );
  await invoke(adminRouter, "/:id/status", "patch", {
    version: 2,
    status: "draft",
  });
  assert.equal((await invoke(publicRouter, "/blog/:slug", "get")).status, 404);
  await invoke(adminRouter, "/:id/status", "patch", {
    version: 3,
    status: "archived",
  });
  assert.equal(
    (await invoke(publicRouter, "/seo/blog", "get")).body.items.length,
    0,
  );
  const restored = await invoke(adminRouter, "/:id/status", "patch", {
    version: 4,
    status: "draft",
  });
  assert.equal(restored.body.status, "draft");
});
test("blog publishing validates required fields, block types, lengths and image descriptions", async () => {
  assert.equal(
    (await invoke(adminRouter, "/", "post", { title: "An unfinished idea" }))
      .status,
    201,
  );
  assert.equal(
    (
      await invoke(adminRouter, "/:id/status", "patch", {
        status: "published",
        version: 1,
      })
    ).status,
    422,
  );
  for (const value of [
    { ...content, slug: "../escape" },
    { ...content, slug: "Bad Address" },
    { ...content, body: [{ type: "html", text: "<script>evil()</script>" }] },
    { ...content, body: Array(61).fill({ type: "paragraph", text: "text" }) },
    {
      ...content,
      body: Array(30).fill({ type: "paragraph", text: "a".repeat(10000) }),
    },
    { ...content, status: "published", cover_id: 1, cover_alt: "" },
    {
      ...content,
      status: "published",
      body: [...content.body, { type: "heading", text: "" }],
    },
    { ...content, created_by: 99 },
  ])
    assert.equal(blogSchema.safeParse(value).success, false);
});
test("stale post edits cannot overwrite content, publication status or a cover", async () => {
  await invoke(adminRouter, "/", "post", content);
  const updated = await invoke(adminRouter, "/:id", "put", {
    ...content,
    title: "Updated title",
    version: 1,
  });
  assert.equal(updated.body.version, 2);
  const stale = await invoke(adminRouter, "/:id", "put", {
    ...content,
    version: 1,
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.error.code, "STALE_BLOG");
  assert.equal(
    (
      await invoke(adminRouter, "/:id/status", "patch", {
        version: 1,
        status: "published",
      })
    ).status,
    409,
  );
  assert.equal(posts[0].title, "Updated title");
  assert.equal(posts[0].status, "draft");
});
test("published post addresses stay stable, duplicate addresses return conflicts and failed commits report failure", async () => {
  await invoke(adminRouter, "/", "post", { ...content, status: "published" });
  assert.equal(
    (
      await invoke(adminRouter, "/:id", "put", {
        ...content,
        slug: "renamed",
        version: 1,
      })
    ).status,
    422,
  );
  assert.equal((await invoke(adminRouter, "/", "post", content)).status, 409);
  commitError = new Error("Commit failed");
  const failed = await invoke(adminRouter, "/:id", "put", {
    ...content,
    title: "Must not persist",
    status: "published",
    version: 1,
  });
  assert.equal(failed.error.message, "Commit failed");
  assert.equal(failed.body, undefined);
  assert.equal(posts[0].title, content.title);
});
test("blog photo uploads are WebP, remain private until selected for a live post and cannot cross post ownership", async () => {
  await invoke(adminRouter, "/", "post", content);
  const buffer = await sharp({
    create: { width: 70, height: 40, channels: 3, background: "#244f48" },
  })
    .png()
    .toBuffer();
  const uploaded = await invoke(
    adminRouter,
    "/:id/media",
    "post",
    {},
    { file: { mimetype: "image/png", buffer } },
  );
  assert.equal(uploaded.status, 201);
  assert.match(uploaded.body.url, /^\/api\/v1\/admin\/blog\/1\/media\//);
  assert.equal(
    (await invoke(publicRouter, "/blog-media/:id", "get")).status,
    404,
  );
  const photo = await invoke(
    adminRouter,
    "/:id/media/:imageId",
    "get",
    {},
    { params: { id: "1", imageId: "1" } },
  );
  assert.equal((await sharp(photo.bytes).metadata()).format, "webp");
  await invoke(adminRouter, "/", "post", { ...content, slug: "second-post" });
  const stolen = await invoke(
    adminRouter,
    "/:id",
    "put",
    {
      ...content,
      slug: "second-post",
      cover_id: 1,
      cover_alt: "A green car",
      version: 1,
    },
    { params: { id: "2" } },
  );
  assert.equal(stolen.status, 422);
  await invoke(adminRouter, "/:id", "put", {
    ...content,
    cover_id: 1,
    cover_alt: "A green car",
    status: "published",
    version: 1,
  });
  assert.ok((await invoke(publicRouter, "/blog-media/:id", "get")).bytes);
  await invoke(adminRouter, "/:id/status", "patch", {
    status: "draft",
    version: 2,
  });
  assert.equal(
    (await invoke(publicRouter, "/blog-media/:id", "get")).status,
    404,
  );
  assert.equal(blogView(posts[0]).cover.url, "/api/v1/blog-media/1");
});
test("rejected uploads clean their files and unknown commit outcomes retain recoverable images", async () => {
  await invoke(adminRouter, "/", "post", content);
  const invalid = await invoke(
    adminRouter,
    "/:id/media",
    "post",
    {},
    { file: { mimetype: "image/png", buffer: Buffer.from("not a photo") } },
  );
  assert.equal(invalid.status, 422);
  const buffer = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const before = (await fs.readdir(storage)).length;
  commitError = new Error("Commit failed");
  assert.ok(
    (
      await invoke(
        adminRouter,
        "/:id/media",
        "post",
        {},
        { file: { mimetype: "image/png", buffer } },
      )
    ).error,
  );
  assert.equal((await fs.readdir(storage)).length, before);
  commitError = Object.assign(new Error("Unknown outcome"), {
    commitOutcomeUnknown: true,
  });
  assert.ok(
    (
      await invoke(
        adminRouter,
        "/:id/media",
        "post",
        {},
        { file: { mimetype: "image/png", buffer } },
      )
    ).error,
  );
  assert.equal((await fs.readdir(storage)).length, before + 1);
});
test("only content-authorised administrators can manage posts", () => {
  for (const role of ["admin", "sales", "reviewer", "customer"]) {
    let error;
    adminRouter.stack[0].handle({ user: { role } }, {}, (value) => {
      error = value;
    });
    assert.equal(error?.status, role === "admin" ? undefined : 403);
  }
});
after(async () => {
  await fs.rm(storage, { recursive: true, force: true });
  await db.pool.end();
});

const {
  validateDocument,
  readingStats,
  documentText,
  safeBlogUrl,
  meaningfulAlt,
} = require("../src/lib/blog-document");
const richBody = () => ({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Choosing a car" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Useful " },
        {
          type: "text",
          text: "car advice",
          marks: [
            { type: "bold" },
            { type: "italic" },
            { type: "underline" },
            { type: "strike" },
          ],
        },
        { type: "text", text: " for your daily commute." },
      ],
    },
  ],
});
const imageNode = (mediaId, alt = "A blue hatchback outside the showroom") => ({
  type: "blogImage",
  attrs: {
    mediaId,
    alt,
    decorative: false,
    reviewed: true,
    caption: "A city car",
    width: 75,
    align: "center",
  },
});
test("rich documents retain inline formatting and headings while rejecting executable or unsupported content", () => {
  const body = richBody();
  assert.deepEqual(validateDocument(body), body);
  for (const href of [
    "/contact",
    "/blog/a-guide",
    "https://example.com/advice",
  ])
    assert.equal(safeBlogUrl(href), true);
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,evil",
    "//evil.test",
    "/\\evil.test",
    "https://person:password@example.com",
    "/x%0ay",
    "\nhttps://example.com",
  ])
    assert.equal(safeBlogUrl(href), false, href);
  for (const change of [
    { type: "script", text: "alert(1)" },
    {
      type: "text",
      text: "unsafe",
      marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
    },
    {
      type: "text",
      text: "unsafe",
      marks: [{ type: "bold", attrs: { onclick: "evil()" } }],
    },
    {
      type: "paragraph",
      attrs: JSON.parse('{"__proto__":{"onclick":"evil()"}}'),
    },
    { type: "heading", attrs: { level: 8 } },
    imageNode(1, "   "),
    { ...imageNode(1), attrs: { ...imageNode(1).attrs, reviewed: false } },
    {
      ...imageNode(1),
      attrs: {
        ...imageNode(1).attrs,
        src: "https://elsewhere.test/tracker.png",
      },
    },
  ]) {
    const candidate = richBody();
    candidate.content.push(change);
    assert.throws(() => validateDocument(candidate));
    assert.equal(
      blogSchema.safeParse({ ...content, body: candidate }).success,
      false,
    );
  }
  const decorative = imageNode(1, "");
  decorative.attrs.decorative = true;
  assert.doesNotThrow(() =>
    validateDocument({ type: "doc", content: [decorative] }),
  );
  assert.equal(meaningfulAlt("photo"), false);
  assert.equal(meaningfulAlt("car.jpg"), false);
  assert.equal(meaningfulAlt("A hatchback parked outside"), true);
});
test("reading time counts actual text once across formatting boundaries and excludes image metadata", () => {
  const body = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "hello", marks: [{ type: "bold" }] },
          { type: "text", text: "world is " },
          {
            type: "text",
            text: "one phrase",
            marks: [
              {
                type: "link",
                attrs: { href: "https://example.com/ignore-these-words" },
              },
            ],
          },
        ],
      },
      imageNode(1, "Ignore all these image description words"),
    ],
  };
  body.content[1].attrs.caption = "";
  assert.equal(documentText(body), "helloworld is one phrase");
  assert.equal(readingStats(body).words, 4);
  assert.equal(readingStats(body).minutes, 1);
  assert.equal(readingStats({ type: "doc", content: [] }).minutes, 0);
  assert.equal(
    readingStats({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "word ".repeat(441) }],
        },
      ],
    }).minutes,
    3,
  );
  assert.equal(
    readingStats([{ type: "paragraph", text: "legacy text still works" }])
      .words,
    4,
  );
});
test("rich article media references, per-use alt text and content survive saves atomically", async () => {
  await invoke(adminRouter, "/", "post", content);
  media.push(
    { id: 1, post_id: 1, storage_key: "unused.webp", width: 800, height: 500 },
    { id: 2, post_id: 2, storage_key: "other.webp", width: 800, height: 500 },
  );
  const body = richBody();
  body.content.push(
    imageNode(1),
    imageNode(1, "The same hatchback with a different editorial purpose"),
  );
  const saved = await invoke(adminRouter, "/:id", "put", {
    ...content,
    body,
    version: 1,
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.body, body);
  assert.deepEqual(refs, [{ post_id: 1, media_id: 1 }]);
  const wrong = richBody();
  wrong.content.push(imageNode(2));
  const rejected = await invoke(adminRouter, "/:id", "put", {
    ...content,
    body: wrong,
    version: 2,
  });
  assert.equal(rejected.status, 422);
  assert.deepEqual(refs, [{ post_id: 1, media_id: 1 }]);
  commitError = new Error("Lost commit");
  const failure = await invoke(adminRouter, "/:id", "put", {
    ...content,
    body: richBody(),
    version: 2,
  });
  assert.ok(failure.error);
  assert.deepEqual(refs, [{ post_id: 1, media_id: 1 }]);
  commitError = null;
  await invoke(adminRouter, "/:id", "put", {
    ...content,
    body: richBody(),
    version: 2,
  });
  assert.deepEqual(refs, []);
  assert.equal(media.length, 2, "removing an image does not delete an asset");
});
test("scheduled articles remain absent from public pages, feeds and media until their UTC publication time", async () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const created = await invoke(adminRouter, "/", "post", {
    ...content,
    status: "published",
    publish_at: future,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.is_scheduled, true);
  assert.ok(created.body.scheduled_at);
  assert.equal((await invoke(publicRouter, "/blog/:slug", "get")).status, 404);
  assert.equal((await invoke(publicRouter, "/blog", "get")).body.total, 0);
  assert.equal(
    (await invoke(publicRouter, "/seo/blog", "get")).body.items.length,
    0,
  );
  assert.equal(
    (
      await invoke(
        adminRouter,
        "/",
        "get",
        {},
        { query: { status: "scheduled" } },
      )
    ).body.total,
    1,
  );
  posts[0].published_at = "2026-10-25 00:00:00";
  const live = (await invoke(publicRouter, "/blog/:slug", "get")).body;
  assert.ok(live.published_at);
  assert.equal((await invoke(publicRouter, "/blog", "get")).body.total, 1);
  const unchanged = await invoke(adminRouter, "/:id", "put", {
    ...content,
    version: 1,
    status: "published",
    publish_at: live.published_at,
  });
  assert.equal(unchanged.status, 200);
  assert.equal(unchanged.body.published_at, live.published_at);
  const changed = await invoke(adminRouter, "/:id", "put", {
    ...content,
    version: 2,
    status: "published",
    publish_at: future,
  });
  assert.equal(changed.status, 422);
});
test("meta keywords are trimmed, de-duplicated and limited to twelve", async () => {
  const { blogSchema } = require("../src/lib/blog");
  assert.equal(
    blogSchema.parse({
      seo_keywords: "  used cars ,Used Cars, car  loan EMI,, delhi ncr ",
    }).seo_keywords,
    "used cars, car loan EMI, delhi ncr",
  );
  assert.equal(blogSchema.parse({}).seo_keywords, "");
  assert.throws(() =>
    blogSchema.parse({
      seo_keywords: Array.from({ length: 13 }, (_, i) => `k${i}`).join(","),
    }),
  );
  assert.throws(() => blogSchema.parse({ seo_keywords: "x".repeat(51) }));
  assert.throws(
    () =>
      blogSchema.parse({
        seo_keywords: Array.from(
          { length: 6 },
          (_, i) => `${i}${"x".repeat(49)}`,
        ).join(", "),
      }),
    /255 characters/,
  );
  const created = await invoke(adminRouter, "/", "post", {
    ...content,
    seo_keywords: "suv, SUV, family car",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.seo_keywords, "suv, family car");
});
