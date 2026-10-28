const { z, fail } = require("./core");
const { parse } = require("./store");

const offerSchema = z
  .object({
    title: z.string().trim().max(100).default(""),
    description: z.string().trim().max(600).default(""),
    benefit: z.string().trim().max(60).default(""),
    eligibility: z.string().trim().max(500).default(""),
    terms: z.string().trim().max(3000).default(""),
    badge: z.string().trim().max(32).default("SPECIAL OFFER"),
    theme: z.enum(["gold", "midnight", "emerald", "rose"]).default("gold"),
    pattern: z.enum(["glow", "rings", "grid", "plain"]).default("glow"),
    icon: z.enum(["gift", "sparkles", "badge", "truck"]).default("gift"),
    cta_label: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .default("Enquire about this offer"),
    cta_href: z.enum(["/contact", "/cars", "/commercial"]).default("/contact"),
    coupon_code: z
      .string()
      .trim()
      .max(24)
      .regex(/^[A-Za-z0-9_-]*$/)
      .default(""),
    featured: z.boolean().default(false),
    sort_order: z.number().int().min(0).max(9999).default(0),
    starts_at: z.iso.datetime({ offset: true }).nullable().default(null),
    expires_at: z.iso.datetime({ offset: true }).nullable().default(null),
    status: z.enum(["draft", "published"]).default("draft"),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (
      d.starts_at &&
      d.expires_at &&
      Date.parse(d.starts_at) >= Date.parse(d.expires_at)
    )
      ctx.addIssue({
        code: "custom",
        path: ["expires_at"],
        message: "End time must be after start time",
      });
    if (d.status === "published") {
      for (const key of [
        "title",
        "description",
        "benefit",
        "eligibility",
        "terms",
        "starts_at",
        "expires_at",
      ])
        if (!d[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Required before publishing",
          });
    }
  });
function validatePublication(d) {
  if (d.status === "published" && Date.parse(d.expires_at) <= Date.now())
    fail(422, "Choose a future expiry before publishing this offer");
  return d;
}
const sqlTime = (value) =>
  value ? new Date(value).toISOString().slice(0, 19).replace("T", " ") : null;
const isoTime = (value) =>
  value
    ? new Date(
        typeof value === "string" && !value.includes("T")
          ? value.replace(" ", "T") + "Z"
          : value,
      ).toISOString()
    : null;
function offerView(row, admin = false) {
  const { data = {} } = parse(row);
  const result = {
    ...data,
    id: row.id,
    starts_at: isoTime(row.starts_at),
    expires_at: isoTime(row.expires_at),
    featured: !!row.featured,
    sort_order: row.sort_order,
  };
  return admin
    ? {
        ...result,
        status: row.status,
        version: row.version,
        updated_at: isoTime(row.updated_at),
      }
    : result;
}
function offerValues(d) {
  const { starts_at, expires_at, featured, sort_order, status, ...content } = d;
  return [
    status,
    sqlTime(starts_at),
    sqlTime(expires_at),
    featured,
    sort_order,
    JSON.stringify(content),
  ];
}
module.exports = { offerSchema, validatePublication, offerView, offerValues };
