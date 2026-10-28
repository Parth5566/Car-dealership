const express = require("express");
const { query, transaction } = require("../config/db");
const { z, id, wrap, fail } = require("../lib/core");
const { allow } = require("../middleware/auth");
const { audit } = require("../lib/store");
const {
  offerSchema,
  validatePublication,
  offerView,
  offerValues,
} = require("../lib/offers");
const router = express.Router();
router.use(allow("settings"));
const versionSchema = z.number().int().positive();
async function locked(req, db) {
  const [row] = await query(
    "SELECT * FROM nw_offers WHERE id=? FOR UPDATE",
    [id.parse(req.params.id)],
    db,
  );
  if (!row) fail(404, "This offer no longer exists");
  if (row.version !== versionSchema.parse(req.body.version))
    fail(
      409,
      "This offer changed in another session. Reload it before saving.",
      "STALE_OFFER",
    );
  return row;
}
router.get(
  "/",
  wrap(async (req, res) => {
    const p = z
      .object({
        q: z.string().trim().max(100).default(""),
        status: z
          .enum(["all", "draft", "active", "scheduled", "expired"])
          .default("all"),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .parse(req.query);
    const conditions = {
      all: "1=1",
      draft: "status='draft'",
      active:
        "status='published' AND starts_at<=UTC_TIMESTAMP() AND expires_at>UTC_TIMESTAMP()",
      scheduled: "status='published' AND starts_at>UTC_TIMESTAMP()",
      expired: "status='published' AND expires_at<=UTC_TIMESTAMP()",
    };
    const where =
      conditions[p.status] +
      (p.q
        ? " AND CONCAT(JSON_UNQUOTE(JSON_EXTRACT(data,'$.title')),' ',JSON_UNQUOTE(JSON_EXTRACT(data,'$.benefit'))) LIKE ?"
        : "");
    const values = p.q ? ["%" + p.q.replace(/[\\%_]/g, "\\$&") + "%"] : [];
    const [count] = await query(
      "SELECT COUNT(*) AS total FROM nw_offers WHERE " + where,
      values,
    );
    const rows = await query(
      `SELECT * FROM nw_offers WHERE ${where} ORDER BY featured DESC,sort_order,id DESC LIMIT 12 OFFSET ${(p.page - 1) * 12}`,
      values,
    );
    const [stats] = await query(
      "SELECT COUNT(*) AS total,COALESCE(SUM(status='draft'),0) AS draft,COALESCE(SUM(status='published' AND starts_at<=UTC_TIMESTAMP() AND expires_at>UTC_TIMESTAMP()),0) AS active,COALESCE(SUM(status='published' AND starts_at>UTC_TIMESTAMP()),0) AS scheduled,COALESCE(SUM(status='published' AND expires_at<=UTC_TIMESTAMP()),0) AS expired FROM nw_offers",
    );
    res.json({
      items: rows.map((r) => offerView(r, true)),
      total: count.total,
      page: p.page,
      pages: Math.ceil(count.total / 12),
      stats,
    });
  }),
);
router.get(
  "/:id",
  wrap(async (req, res) => {
    const [row] = await query("SELECT * FROM nw_offers WHERE id=?", [
      id.parse(req.params.id),
    ]);
    if (!row) fail(404, "This offer no longer exists");
    res.json(offerView(row, true));
  }),
);
router.post(
  "/",
  wrap(async (req, res) => {
    const d = validatePublication(offerSchema.parse(req.body));
    const offer = await transaction(async (db) => {
      const result = await query(
        "INSERT INTO nw_offers(status,starts_at,expires_at,featured,sort_order,data) VALUES (?,?,?,?,?,?)",
        offerValues(d),
        db,
      );
      await audit(
        req.user.id,
        "offer.create",
        "offer",
        result.insertId,
        { status: d.status },
        db,
      );
      const [row] = await query(
        "SELECT * FROM nw_offers WHERE id=?",
        [result.insertId],
        db,
      );
      return offerView(row, true);
    });
    res.status(201).json(offer);
  }),
);
router.put(
  "/:id",
  wrap(async (req, res) => {
    const { version, ...body } = z
      .object({ version: versionSchema })
      .passthrough()
      .parse(req.body);
    const d = validatePublication(offerSchema.parse(body));
    const offer = await transaction(async (db) => {
      const row = await locked(req, db);
      await query(
        "UPDATE nw_offers SET status=?,starts_at=?,expires_at=?,featured=?,sort_order=?,data=?,version=version+1 WHERE id=?",
        [...offerValues(d), row.id],
        db,
      );
      await audit(
        req.user.id,
        "offer.update",
        "offer",
        row.id,
        { status: d.status },
        db,
      );
      const [updated] = await query(
        "SELECT * FROM nw_offers WHERE id=?",
        [row.id],
        db,
      );
      return offerView(updated, true);
    });
    res.json(offer);
  }),
);
router.patch(
  "/:id/status",
  wrap(async (req, res) => {
    const { status } = z
      .object({
        status: z.enum(["draft", "published"]),
        version: versionSchema,
      })
      .strict()
      .parse(req.body);
    const offer = await transaction(async (db) => {
      const row = await locked(req, db);
      const {
        id: unusedId,
        version,
        updated_at,
        ...content
      } = offerView(row, true);
      validatePublication(offerSchema.parse({ ...content, status }));
      await query(
        "UPDATE nw_offers SET status=?,version=version+1 WHERE id=?",
        [status, row.id],
        db,
      );
      await audit(
        req.user.id,
        status === "published" ? "offer.publish" : "offer.unpublish",
        "offer",
        row.id,
        {},
        db,
      );
      const [updated] = await query(
        "SELECT * FROM nw_offers WHERE id=?",
        [row.id],
        db,
      );
      return offerView(updated, true);
    });
    res.json(offer);
  }),
);
router.delete(
  "/:id",
  wrap(async (req, res) => {
    z.object({ version: versionSchema }).strict().parse(req.body);
    await transaction(async (db) => {
      const row = await locked(req, db);
      await query("DELETE FROM nw_offers WHERE id=?", [row.id], db);
      await audit(req.user.id, "offer.delete", "offer", row.id, {}, db);
    });
    res.json({ message: "Offer removed" });
  }),
);
module.exports = { router };
