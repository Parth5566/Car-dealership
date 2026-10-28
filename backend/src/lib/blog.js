const crypto = require("node:crypto");
const { z, fail } = require("./core");
const {
  validateDocument,
  documentText,
  readingStats,
  meaningfulAlt,
  asDocument,
} = require("./blog-document");
const richDocument = z.unknown().transform((value, ctx) => {
  try {
    return validateDocument(value);
  } catch (error) {
    ctx.addIssue({ code: "custom", message: error.message });
    return z.NEVER;
  }
});
const categories = ["buying", "selling", "car-care", "commercial", "updates"];
// Meta keywords: comma-separated, trimmed, de-duplicated (case-insensitive),
// at most 12 keywords of 50 characters each.
const keywordList = z
  .string()
  .max(1000)
  .default("")
  .transform((value, ctx) => {
    const seen = new Set();
    const keywords = value
      .split(",")
      .map((keyword) => keyword.trim().replace(/\s+/g, " "))
      .filter((keyword) => {
        const key = keyword.toLowerCase();
        if (!keyword || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (keywords.length > 12 || keywords.some((k) => k.length > 50)) {
      ctx.addIssue({
        code: "custom",
        message: "Use up to 12 keywords of 50 characters or fewer",
      });
      return z.NEVER;
    }
    const joined = keywords.join(", ");
    if (joined.length > 255) {
      ctx.addIssue({
        code: "custom",
        message: "Keep the combined keywords within 255 characters",
      });
      return z.NEVER;
    }
    return joined;
  });
const blockSchema = z
  .object({
    type: z.enum([
      "paragraph",
      "heading",
      "subheading",
      "bullets",
      "numbered",
      "quote",
    ]),
    text: z.string().trim().max(12000),
  })
  .strict();
const blogSchema = z
  .object({
    title: z.string().trim().max(160).default(""),
    slug: z
      .string()
      .trim()
      .max(160)
      .regex(
        /^([a-z0-9]+(?:-[a-z0-9]+)*)?$/,
        "Use lowercase letters, numbers and hyphens",
      )
      .default(""),
    excerpt: z.string().trim().max(320).default(""),
    category: z.enum(categories).default("buying"),
    author_name: z.string().trim().min(1).max(100).default("NCR Wheelz"),
    body: z.union([z.array(blockSchema).max(60), richDocument]).default([]),
    cover_id: z.number().int().positive().nullable().default(null),
    cover_alt: z.string().trim().max(200).default(""),
    seo_title: z.string().trim().max(160).default(""),
    seo_description: z.string().trim().max(320).default(""),
    seo_keywords: keywordList,
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    publish_at: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Buffer.byteLength(JSON.stringify(data.body), "utf8") > 180000)
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: "This article is too long. Shorten it before saving.",
      });
    if (data.cover_id && !meaningfulAlt(data.cover_alt))
      ctx.addIssue({
        code: "custom",
        path: ["cover_alt"],
        message: "Describe the cover photo before saving",
      });
    if (data.status !== "published") return;
    for (const field of ["title", "excerpt"])
      if (!data[field])
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Required before publishing",
        });
    const hasParagraph = (node) =>
      (node.type === "paragraph" &&
        documentText({ type: "doc", content: [node] }).length >= 20) ||
      (node.content || []).some(hasParagraph);
    if (!hasParagraph(asDocument(data.body)))
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: "Add at least one paragraph before publishing",
      });
    if (Array.isArray(data.body) && data.body.some((block) => !block.text))
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: "Fill in or remove the empty content blocks",
      });
  });
const contentKeys = [
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
];
function blogContent(row) {
  const content = Object.fromEntries(contentKeys.map((key) => [key, row[key]]));
  if (typeof content.body === "string") content.body = JSON.parse(content.body);
  return content;
}
function blogSlug(title) {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 150)
      .replace(/-$/, "") || `article-${crypto.randomUUID().slice(0, 8)}`
  );
}
function blogView(row, admin = false, summary = false) {
  const content = blogContent(row);
  const iso = (value) =>
    value
      ? new Date(
          typeof value === "string" && !value.includes("T")
            ? value.replace(" ", "T") + "Z"
            : value,
        ).toISOString()
      : null;
  const { status, cover_id, body, ...fields } = content;
  return {
    ...fields,
    id: row.id,
    ...(summary ? {} : { body }),
    reading_minutes: readingStats(
      body,
      Math.min(300, Math.max(100, Number(process.env.BLOG_READING_WPM) || 220)),
    ).minutes,
    word_count: readingStats(body).words,
    cover: cover_id
      ? {
          id: cover_id,
          url: admin
            ? `/api/v1/admin/blog/${row.id}/media/${cover_id}`
            : `/api/v1/blog-media/${cover_id}`,
        }
      : null,
    published_at: iso(row.published_at),
    updated_at:
      row.published_at && iso(row.published_at) > iso(row.updated_at)
        ? iso(row.published_at)
        : iso(row.updated_at),
    ...(admin
      ? {
          status,
          version: row.version,
          cover_id,
          created_at: iso(row.created_at),
          scheduled_at: iso(row.scheduled_at),
          is_scheduled:
            row.status === "published" &&
            !!row.published_at &&
            new Date(iso(row.published_at)).getTime() > Date.now(),
          reading_wpm: Math.min(
            300,
            Math.max(100, Number(process.env.BLOG_READING_WPM) || 220),
          ),
        }
      : {}),
  };
}
function assertBlogVersion(row, version) {
  if (!row) fail(404, "This post no longer exists");
  if (row.version !== version)
    fail(
      409,
      "This post changed in another session. Reload the saved version before editing again.",
      "STALE_BLOG",
    );
}
module.exports = {
  categories,
  blogSchema,
  blogContent,
  blogSlug,
  blogView,
  assertBlogVersion,
};
