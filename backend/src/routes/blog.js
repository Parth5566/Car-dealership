const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const env = require("../config/env");
const { query, transaction } = require("../config/db");
const { z, id, wrap, fail } = require("../lib/core");
const { audit } = require("../lib/store");
const { allow } = require("../middleware/auth");
const { imageIds } = require("../lib/blog-document");
const {
  categories,
  blogSchema,
  blogContent,
  blogSlug,
  blogView,
  assertBlogVersion,
} = require("../lib/blog");
const publicRouter = express.Router();
const adminRouter = express.Router();
adminRouter.use(allow("settings"));
const versionSchema = z.number().int().positive();
const pagingSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(12).default(12),
  q: z.string().trim().max(100).default(""),
  category: z.enum(["", ...categories]).default(""),
  status: z
    .enum(["all", "draft", "published", "scheduled", "archived"])
    .default("all"),
});
async function list(req, admin) {
  const p = pagingSchema.parse(req.query);
  const where = [],
    values = [];
  if (!admin || p.status !== "all") {
    where.push("status=?");
    values.push(admin && p.status !== "scheduled" ? p.status : "published");
  }
  if (!admin || p.status === "published")
    where.push("published_at<=UTC_TIMESTAMP()");
  if (admin && p.status === "scheduled")
    where.push("published_at>UTC_TIMESTAMP()");
  if (p.category) {
    where.push("category=?");
    values.push(p.category);
  }
  if (p.q) {
    where.push("CONCAT(title,' ',excerpt) LIKE ?");
    values.push("%" + p.q.replace(/[\\%_]/g, "\\$&") + "%");
  }
  const filter = where.join(" AND ") || "1=1";
  const [count] = await query(
    `SELECT COUNT(*) AS total FROM nw_blog_posts WHERE ${filter}`,
    values,
  );
  const rows = await query(
    `SELECT * FROM nw_blog_posts WHERE ${filter} ORDER BY ${admin ? "updated_at" : "published_at"} DESC,id DESC LIMIT ${p.limit} OFFSET ${(p.page - 1) * p.limit}`,
    values,
  );
  return {
    items: rows.map((row) => blogView(row, admin, true)),
    total: Number(count.total),
    page: p.page,
    pages: Math.ceil(count.total / p.limit),
  };
}
publicRouter.get(
  "/blog",
  wrap(async (req, res) => res.json(await list(req, false))),
);
publicRouter.get(
  "/seo/blog",
  wrap(async (req, res) => {
    const rows = await query(
      "SELECT slug,updated_at,cover_id,published_at FROM nw_blog_posts WHERE status='published' AND published_at<=UTC_TIMESTAMP() ORDER BY id",
    );
    res.json({
      items: rows.map((row) => ({
        slug: row.slug,
        updated_at:
          row.published_at > row.updated_at ? row.published_at : row.updated_at,
        images: row.cover_id ? [`/api/v1/blog-media/${row.cover_id}`] : [],
      })),
    });
  }),
);
publicRouter.get(
  "/blog/:slug",
  wrap(async (req, res) => {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(req.params.slug) ||
      req.params.slug.length > 160
    )
      fail(404, "Post not found");
    const [row] = await query(
      "SELECT * FROM nw_blog_posts WHERE slug=? AND status='published' AND published_at<=UTC_TIMESTAMP()",
      [req.params.slug],
    );
    if (!row) fail(404, "Post not found");
    res.json(blogView(row));
  }),
);
async function sendImage(row, res) {
  if (!row) fail(404, "Photo not found");
  if (!/^blog-[a-f0-9-]+\.webp$/.test(row.storage_key))
    fail(404, "Photo not found");
  let bytes;
  try {
    bytes = await fs.readFile(path.join(env.storage, row.storage_key));
  } catch (error) {
    if (error.code === "ENOENT") fail(404, "Photo not found");
    throw error;
  }
  res.type("image/webp").set("X-Content-Type-Options", "nosniff").send(bytes);
}
publicRouter.get(
  "/blog-media/:id",
  wrap(async (req, res) => {
    const [row] = await query(
      "SELECT m.storage_key FROM nw_blog_media m JOIN nw_blog_posts p ON p.id=m.post_id WHERE m.id=? AND p.status='published' AND p.published_at<=UTC_TIMESTAMP() AND (p.cover_id=m.id OR EXISTS(SELECT 1 FROM nw_blog_media_refs r WHERE r.post_id=p.id AND r.media_id=m.id))",
      [id.parse(req.params.id)],
    );
    await sendImage(row, res);
  }),
);
async function locked(req, db) {
  const version = versionSchema.parse(req.body.version);
  const [row] = await query(
    "SELECT * FROM nw_blog_posts WHERE id=? FOR UPDATE",
    [id.parse(req.params.id)],
    db,
  );
  assertBlogVersion(row, version);
  return row;
}
async function validateMedia(data, postId, db) {
  for (const mediaId of new Set(
    [data.cover_id, ...imageIds(data.body)].filter(Boolean),
  )) {
    const [image] = await query(
      "SELECT id FROM nw_blog_media WHERE id=? AND post_id=?",
      [mediaId, postId],
      db,
    );
    if (!image) fail(422, "Choose photos uploaded for this article");
  }
}
async function saveMediaRefs(data, postId, db) {
  await query("DELETE FROM nw_blog_media_refs WHERE post_id=?", [postId], db);
  for (const mediaId of imageIds(data.body))
    await query(
      "INSERT INTO nw_blog_media_refs(post_id,media_id) VALUES (?,?)",
      [postId, mediaId],
      db,
    );
}
function publicationTime(data, previous) {
  if (data.publish_at === undefined) return previous?.published_at || null;
  if (!data.publish_at) return null;
  const time = new Date(data.publish_at);
  if (
    time.getUTCFullYear() < 1990 ||
    time.getTime() > Date.now() + 2 * 366 * 86400000
  )
    fail(422, "Choose a publication date within the next two years");
  const sql = time.toISOString().slice(0, 19).replace("T", " ");
  if (
    previous?.published_at &&
    new Date(previous.published_at.replace(" ", "T") + "Z").getTime() <=
      Date.now() &&
    sql !== previous.published_at
  )
    fail(
      422,
      "The original publication date cannot be changed after publication",
    );
  return sql;
}
const columns = [
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
const valuesFor = (data, previous) =>
  columns.map((key) =>
    key === "body"
      ? JSON.stringify(data[key])
      : key === "scheduled_at"
        ? data.publish_at === undefined
          ? previous?.scheduled_at || null
          : data.publish_at
            ? new Date(data.publish_at)
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")
            : null
        : data[key],
  );
function duplicateSlug(error) {
  if (error.code === "ER_DUP_ENTRY")
    fail(
      409,
      "That web address is already used by another post. Choose a different one.",
      "BLOG_SLUG_TAKEN",
    );
  throw error;
}
adminRouter.get(
  "/",
  wrap(async (req, res) => res.json(await list(req, true))),
);
adminRouter.get(
  "/:id",
  wrap(async (req, res) => {
    const [row] = await query("SELECT * FROM nw_blog_posts WHERE id=?", [
      id.parse(req.params.id),
    ]);
    if (!row) fail(404, "Post not found");
    res.json(blogView(row, true));
  }),
);
adminRouter.post(
  "/",
  wrap(async (req, res) => {
    const data = blogSchema.parse(req.body);
    data.slug ||= blogSlug(data.title);
    if (data.cover_id || imageIds(data.body).length)
      fail(422, "Save the draft before adding its photos");
    const publishAt = publicationTime(data);
    let post;
    try {
      post = await transaction(async (db) => {
        const result = await query(
          `INSERT INTO nw_blog_posts(${columns.join(",")},created_by,published_at) VALUES (${columns.map(() => "?").join(",")},?,IF(?='published',COALESCE(?,UTC_TIMESTAMP()),NULL))`,
          [...valuesFor(data), req.user.id, data.status, publishAt],
          db,
        );
        await audit(
          req.user.id,
          "blog.create",
          "blog",
          result.insertId,
          { status: data.status },
          db,
        );
        const [row] = await query(
          "SELECT * FROM nw_blog_posts WHERE id=?",
          [result.insertId],
          db,
        );
        return blogView(row, true);
      });
    } catch (error) {
      duplicateSlug(error);
    }
    res.status(201).json(post);
  }),
);
adminRouter.put(
  "/:id",
  wrap(async (req, res) => {
    const { version, ...body } = z
      .object({ version: versionSchema })
      .passthrough()
      .parse(req.body);
    const data = blogSchema.parse(body);
    data.slug ||= blogSlug(data.title);
    let post;
    try {
      post = await transaction(async (db) => {
        const previous = await locked(req, db);
        if (previous.published_at && data.slug !== previous.slug)
          fail(
            422,
            "The web address stays the same after a post is first published",
          );
        await validateMedia(data, previous.id, db);
        const publishAt = publicationTime(data, previous);
        await query(
          `UPDATE nw_blog_posts SET ${columns.map((key) => `${key}=?`).join(",")},published_at=IF(?='published',IF(published_at IS NULL OR published_at>UTC_TIMESTAMP(),COALESCE(?,UTC_TIMESTAMP()),published_at),IF(published_at>UTC_TIMESTAMP(),NULL,published_at)),version=version+1 WHERE id=?`,
          [...valuesFor(data, previous), data.status, publishAt, previous.id],
          db,
        );
        await saveMediaRefs(data, previous.id, db);
        await audit(
          req.user.id,
          "blog.update",
          "blog",
          previous.id,
          { status: data.status },
          db,
        );
        const [row] = await query(
          "SELECT * FROM nw_blog_posts WHERE id=?",
          [previous.id],
          db,
        );
        return blogView(row, true);
      });
    } catch (error) {
      duplicateSlug(error);
    }
    res.json(post);
  }),
);
adminRouter.patch(
  "/:id/status",
  wrap(async (req, res) => {
    const { status } = z
      .object({
        version: versionSchema,
        status: z.enum(["draft", "published", "archived"]),
      })
      .strict()
      .parse(req.body);
    const post = await transaction(async (db) => {
      const previous = await locked(req, db);
      const data = blogSchema.parse({
        ...blogContent(previous),
        status,
        publish_at: previous.scheduled_at
          ? new Date(
              previous.scheduled_at.replace(" ", "T") + "Z",
            ).toISOString()
          : undefined,
      });
      await validateMedia(data, previous.id, db);
      await query(
        "UPDATE nw_blog_posts SET status=?,published_at=IF(?='published',IF(published_at IS NULL OR published_at>UTC_TIMESTAMP(),COALESCE(?,UTC_TIMESTAMP()),published_at),IF(published_at>UTC_TIMESTAMP(),NULL,published_at)),version=version+1 WHERE id=?",
        [status, status, publicationTime(data, previous), previous.id],
        db,
      );
      await saveMediaRefs(data, previous.id, db);
      await audit(
        req.user.id,
        "blog." +
          (status === "published"
            ? "publish"
            : status === "archived"
              ? "archive"
              : "unpublish"),
        "blog",
        previous.id,
        {},
        db,
      );
      const [row] = await query(
        "SELECT * FROM nw_blog_posts WHERE id=?",
        [previous.id],
        db,
      );
      return blogView(row, true);
    });
    res.json(post);
  }),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0 },
}).single("file");
adminRouter.post(
  "/:id/media",
  upload,
  wrap(async (req, res) => {
    const postId = id.parse(req.params.id);
    if (
      !req.file ||
      !["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)
    )
      fail(422, "Choose a JPEG, PNG or WebP photo");
    let output;
    try {
      const source = sharp(req.file.buffer, { limitInputPixels: 40e6 });
      if (!["jpeg", "png", "webp"].includes((await source.metadata()).format))
        fail(422, "Invalid photo");
      output = await source
        .rotate()
        .resize({
          width: 1600,
          height: 1200,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      fail(
        422,
        "This photo could not be read. Choose another JPEG, PNG or WebP file.",
      );
    }
    const key = `blog-${crypto.randomUUID()}.webp`;
    let stored = false,
      imageId;
    try {
      imageId = await transaction(async (db) => {
        const [post] = await query(
          "SELECT id FROM nw_blog_posts WHERE id=? FOR UPDATE",
          [postId],
          db,
        );
        if (!post) fail(404, "Post not found");
        await fs.mkdir(env.storage, { recursive: true, mode: 0o700 });
        const file = await fs.open(path.join(env.storage, key), "wx", 0o600);
        stored = true;
        try {
          await file.writeFile(output.data);
        } finally {
          await file.close();
        }
        const result = await query(
          "INSERT INTO nw_blog_media(post_id,storage_key,width,height) VALUES (?,?,?,?)",
          [postId, key, output.info.width, output.info.height],
          db,
        );
        await audit(req.user.id, "blog.image_upload", "blog", postId, {}, db);
        return result.insertId;
      });
    } catch (error) {
      if (stored && !error.commitOutcomeUnknown)
        await fs
          .rm(path.join(env.storage, key), { force: true })
          .catch(() => {});
      throw error;
    }
    res.status(201).json({
      id: imageId,
      url: `/api/v1/admin/blog/${postId}/media/${imageId}`,
    });
  }),
);
adminRouter.get(
  "/:id/media",
  wrap(async (req, res) => {
    const rows = await query(
      "SELECT id,width,height FROM nw_blog_media WHERE post_id=? ORDER BY id DESC LIMIT 100",
      [id.parse(req.params.id)],
    );
    res.json({
      items: rows.map((image) => ({
        ...image,
        url: `/api/v1/admin/blog/${req.params.id}/media/${image.id}`,
      })),
    });
  }),
);
adminRouter.get(
  "/:id/media/:imageId",
  wrap(async (req, res) => {
    const [row] = await query(
      "SELECT storage_key FROM nw_blog_media WHERE id=? AND post_id=?",
      [id.parse(req.params.imageId), id.parse(req.params.id)],
    );
    await sendImage(row, res);
  }),
);
module.exports = { publicRouter, adminRouter };
