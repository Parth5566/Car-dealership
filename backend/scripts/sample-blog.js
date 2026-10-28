// Explicit local starter content. Does not run during migration or startup.
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const env = require("../src/config/env");
const { pool, query, transaction } = require("../src/config/db");
const { blogSchema } = require("../src/lib/blog");
const { readingStats } = require("../src/lib/blog-document");
const { audit } = require("../src/lib/store");
const sample = require("../src/lib/sample-blog");

(async () => {
  let uploadedPath;
  try {
    const action = process.argv[2] || "plan";
    if (!["plan", "add"].includes(action)) throw new Error("Use plan or add");
    const data = blogSchema.parse({ ...sample, status: "published" });
    if (action === "plan") {
      console.log(
        JSON.stringify(
          {
            title: data.title,
            path: `/blog/${data.slug}`,
            author: data.author_name,
            ...readingStats(data.body),
            status:
              "Will publish one editable starter article with a WebP cover",
          },
          null,
          2,
        ),
      );
      return;
    }
    if (
      env.production ||
      !["127.0.0.1", "localhost", "::1"].includes(env.db.host)
    )
      throw new Error(
        "The sample importer only runs against a local development database",
      );
    const result = await transaction(async (db) => {
      const [existing] = await query(
        "SELECT id,status FROM nw_blog_posts WHERE slug=? FOR UPDATE",
        [data.slug],
        db,
      );
      if (existing) return { ...existing, created: false };
      const [admin] = await query(
        "SELECT id FROM nw_users WHERE role='admin' AND active=TRUE ORDER BY id LIMIT 1",
        [],
        db,
      );
      if (!admin)
        throw new Error("Create an administrator before importing the article");
      const post = await query(
        "INSERT INTO nw_blog_posts(slug,title,excerpt,category,author_name,body,seo_title,seo_description,seo_keywords,cover_alt,status,created_by,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,'published',?,UTC_TIMESTAMP())",
        [
          data.slug,
          data.title,
          data.excerpt,
          data.category,
          data.author_name,
          JSON.stringify(data.body),
          data.seo_title,
          data.seo_description,
          data.seo_keywords,
          data.cover_alt,
          admin.id,
        ],
        db,
      );
      const source = path.resolve(
        __dirname,
        "../../frontend/public/images/brand/inspection.webp",
      );
      const { data: bytes, info } = await sharp(source)
        .webp({ quality: 86 })
        .toBuffer({ resolveWithObject: true });
      const storageKey = `blog-${crypto.randomUUID()}.webp`;
      await fs.mkdir(env.storage, { recursive: true });
      uploadedPath = path.join(env.storage, storageKey);
      await fs.writeFile(uploadedPath, bytes, { flag: "wx" });
      const media = await query(
        "INSERT INTO nw_blog_media(post_id,storage_key,width,height) VALUES (?,?,?,?)",
        [post.insertId, storageKey, info.width, info.height],
        db,
      );
      // Run the same cover-alt validation used by the admin API.
      blogSchema.parse({ ...data, cover_id: media.insertId });
      await query(
        "UPDATE nw_blog_posts SET cover_id=? WHERE id=?",
        [media.insertId, post.insertId],
        db,
      );
      await audit(
        admin.id,
        "blog.sample.create",
        "blog",
        post.insertId,
        { slug: data.slug },
        db,
      );
      return { id: post.insertId, status: "published", created: true };
    });
    console.log(
      JSON.stringify(
        {
          ...result,
          article: `/blog/${data.slug}`,
          editor: `/admin/blog/${result.id}`,
          message: result.created
            ? "Starter article published locally. Edit or unpublish it in Admin → Blog posts."
            : "This article already exists. Its content and publication status were preserved.",
        },
        null,
        2,
      ),
    );
  } catch (error) {
    // Never remove a file when the database may already have committed it.
    if (uploadedPath && !error.commitOutcomeUnknown)
      await fs.unlink(uploadedPath).catch(() => {});
    console.error(
      error.code === "EPERM"
        ? "Local database access is blocked in this session. Run npm run blog:sample in your terminal."
        : error.code === "ER_NO_SUCH_TABLE" ||
            error.code === "ER_BAD_FIELD_ERROR"
          ? "Apply the blog migrations with npm run db:migrate, then run npm run blog:sample again."
          : `Sample article failed: ${error.code || error.message}`,
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
