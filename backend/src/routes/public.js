const express = require("express");
const rateLimit = require("express-rate-limit");
const { query, transaction } = require("../config/db");
const {
  z,
  wrap,
  fail,
  id,
  contact,
  text,
  requestConsent,
} = require("../lib/core");
const { optional } = require("../middleware/auth");
const { parse, publicVehicle, history } = require("../lib/store");
const env = require("../config/env");
const { offerView } = require("../lib/offers");
const { enqueueNotification } = require("../lib/notifications");
const router = express.Router();
router.get(
  "/offers",
  wrap(async (req, res) => {
    const items = await query(
      "SELECT * FROM nw_offers WHERE status='published' AND starts_at<=UTC_TIMESTAMP() AND expires_at>UTC_TIMESTAMP() ORDER BY featured DESC,sort_order,starts_at DESC,id DESC",
    );
    res.json({ items: items.map((row) => offerView(row)) });
  }),
);
const submitLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMIT",
      message: "Too many requests. Please try again later.",
    },
  },
});
// Compare native strings explicitly: JSON booleans combined with SQL booleans
// through COALESCE can be coerced differently than a direct JSON comparison.
const nonSampleWhere =
  "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data,'$.is_sample')),'false')='false'";
function publicPredicate(production) {
  return (
    "approved=TRUE AND status IN ('published','reserved')" +
    (production ? " AND " + nonSampleWhere : "")
  );
}
const publicWhere = publicPredicate(env.production);
function isPublicVehicle(vehicle) {
  return (
    vehicle.approved &&
    ["published", "reserved"].includes(vehicle.status) &&
    (!env.production || !parse(vehicle).data?.is_sample)
  );
}
function search(input) {
  const q = z
    .object({
      type: z.enum(["passenger", "commercial"]).optional(),
      q: z.string().max(100).optional(),
      make: z.string().max(80).optional(),
      fuel: z.string().max(30).optional(),
      transmission: z.string().max(30).optional(),
      location: z.string().max(120).optional(),
      body_type: z.string().max(80).optional(),
      min_price: z.coerce.number().nonnegative().optional(),
      max_price: z.coerce.number().nonnegative().optional(),
      min_year: z.coerce.number().int().min(1950).optional(),
      max_mileage: z.coerce.number().nonnegative().optional(),
      min_payload: z.coerce.number().nonnegative().optional(),
      featured: z.enum(["true", "false"]).optional(),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(24).default(12),
      sort: z
        .enum(["newest", "price_asc", "price_desc", "year_desc", "mileage_asc"])
        .default("newest"),
    })
    .parse(input);
  const conditions = [publicWhere],
    values = [];
  for (const key of [
    "type",
    "make",
    "fuel",
    "transmission",
    "location",
    "body_type",
  ])
    if (q[key]) {
      conditions.push(`${key}=?`);
      values.push(q[key]);
    }
  for (const [key, column, op] of [
    ["min_price", "price", ">="],
    ["max_price", "price", "<="],
    ["min_year", "year", ">="],
    ["max_mileage", "mileage", "<="],
    ["min_payload", "payload_kg", ">="],
  ])
    if (q[key] != null) {
      conditions.push(`${column}${op}?`);
      values.push(q[key]);
    }
  if (q.q) {
    conditions.push("CONCAT(make,' ',model,' ',location,' ',body_type) LIKE ?");
    values.push("%" + q.q.replace(/[\\%_]/g, "\\$&") + "%");
  }
  if (q.featured === "true") conditions.push("featured=TRUE");
  const order = {
    newest: "created_at DESC,id DESC",
    price_asc: "price ASC,id DESC",
    price_desc: "price DESC,id DESC",
    year_desc: "year DESC,id DESC",
    mileage_asc: "mileage ASC,id DESC",
  }[q.sort];
  return { q, where: conditions.join(" AND "), values, order };
}
router.get(
  "/settings",
  wrap(async (req, res) => {
    const [r] = await query("SELECT data FROM nw_settings WHERE id=1");
    res.json(parse(r)?.data || {});
  }),
);
router.get(
  "/vehicles",
  wrap(async (req, res) => {
    const s = search(req.query);
    const [count] = await query(
      "SELECT COUNT(*) AS total FROM nw_vehicles WHERE " + s.where,
      s.values,
    );
    const rows = await query(
      `SELECT * FROM nw_vehicles WHERE ${s.where} ORDER BY ${s.order} LIMIT ${s.q.limit} OFFSET ${(s.q.page - 1) * s.q.limit}`,
      s.values,
    );
    res.json({
      items: await Promise.all(rows.map((v) => publicVehicle(v))),
      total: count.total,
      page: s.q.page,
      pages: Math.ceil(count.total / s.q.limit),
    });
  }),
);
router.get(
  "/vehicles/:id",
  wrap(async (req, res) => {
    const [v] = await query(
      "SELECT * FROM nw_vehicles WHERE id=? AND " + publicWhere,
      [id.parse(req.params.id)],
    );
    if (!v) fail(404, "This listing is no longer available");
    await query(
      "UPDATE nw_vehicles SET views=views+1,updated_at=updated_at WHERE id=?",
      [v.id],
    );
    res.json(await publicVehicle(v));
  }),
);
router.post(
  "/enquiries",
  submitLimit,
  optional,
  wrap(async (req, res) => {
    const d = contact
      .extend({
        ...requestConsent,
        vehicle_id: id.nullable().optional(),
        source: z.string().max(200).default("contact"),
      })
      .parse(req.body);
    const enquiryId = await transaction(async (db) => {
      if (d.vehicle_id) {
        const [v] = await query(
          "SELECT id FROM nw_vehicles WHERE id=? AND " + publicWhere,
          [d.vehicle_id],
          db,
        );
        if (!v) fail(404, "Vehicle is no longer available");
      }
      const r = await query(
        "INSERT INTO nw_leads(vehicle_id,user_id,name,email,phone,message,source,consent_at,consent_version) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(),?)",
        [
          d.vehicle_id || null,
          req.user?.id || null,
          d.name,
          d.email,
          d.phone,
          d.message,
          d.source,
          d.consent_version,
        ],
        db,
      );
      await history(
        "lead",
        r.insertId,
        "new",
        req.user?.id,
        "Enquiry received",
        db,
      );
      await enqueueNotification(
        {
          kind: d.vehicle_id ? "enquiry" : "contact",
          id: r.insertId,
          contact: d,
          vehicleId: d.vehicle_id,
          source: d.source,
          message: d.message,
        },
        db,
      );
      return r.insertId;
    });
    res.status(201).json({
      id: enquiryId,
      message: "Your enquiry has been received.",
    });
  }),
);
router.get(
  "/seo/listings",
  wrap(async (req, res) => {
    const where = publicWhere + " AND " + nonSampleWhere;
    const items = await query(
      "SELECT id,slug,updated_at FROM nw_vehicles WHERE " + where,
    );
    const photos = await query(
      "SELECT id,vehicle_id FROM nw_images WHERE vehicle_id IN (SELECT id FROM nw_vehicles WHERE " +
        where +
        ") ORDER BY vehicle_id,sort_order,id",
    );
    res.json({
      items: items.map((v) => ({
        ...v,
        images: photos
          .filter((p) => p.vehicle_id === v.id)
          .map((p) => `/api/v1/media/${p.id}`),
      })),
    });
  }),
);
// Lightweight existence/slug check for the frontend proxy, so missing listings
// return a real 404 and outdated slugs a 308 before the page starts streaming.
// Unlike /vehicles/:id it does not count a view.
router.get(
  "/seo/listings/:id",
  wrap(async (req, res) => {
    const [v] = await query(
      "SELECT id,slug FROM nw_vehicles WHERE id=? AND " + publicWhere,
      [id.parse(req.params.id)],
    );
    if (!v) fail(404, "This listing is no longer available");
    res.json(v);
  }),
);
router.get(
  "/facets",
  wrap(async (req, res) => {
    const type = z
      .enum(["passenger", "commercial"])
      .optional()
      .parse(req.query.type);
    res.json({
      makes: await query(
        "SELECT make,COUNT(*) AS count FROM nw_vehicles WHERE " +
          publicWhere +
          (type ? " AND type=?" : "") +
          " GROUP BY make ORDER BY count DESC,make LIMIT 12",
        type ? [type] : [],
      ),
    });
  }),
);
module.exports = {
  router,
  publicWhere,
  publicPredicate,
  nonSampleWhere,
  isPublicVehicle,
  search,
  submitLimit,
};
