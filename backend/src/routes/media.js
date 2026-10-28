const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const env = require("../config/env");
const { query, transaction } = require("../config/db");
const { authenticate, allow, permissions } = require("../middleware/auth");
const { wrap, fail, id, z, requirements } = require("../lib/core");
const { audit, history } = require("../lib/store");
const { ownSubmission, editable } = require("./account");
const { publicWhere } = require("./public");
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 },
}).single("file");
async function discardStored(key) {
  const keys = [
    key,
    ...(key.endsWith(".webp") ? [key.replace(".webp", ".thumb.webp")] : []),
  ];
  for (const filename of keys) {
    try {
      await fs.rm(path.join(env.storage, filename), { force: true });
    } catch (error) {
      console.error(
        JSON.stringify({ event: "upload_cleanup_failed", code: error.code }),
      );
    }
  }
}
function editableInventory(vehicle) {
  if (!vehicle) fail(404, "Vehicle not found");
  if (vehicle.status !== "draft")
    fail(
      409,
      "Move the listing to draft before changing its photos. Photo changes require fresh approval.",
    );
}
async function lockInventory(req, db) {
  const [vehicle] = await query(
    "SELECT * FROM nw_vehicles WHERE id=? FOR UPDATE",
    [id.parse(req.params.id)],
    db,
  );
  editableInventory(vehicle);
  return vehicle;
}
async function invalidateApproval(vehicle, db) {
  await query(
    "UPDATE nw_vehicles SET approved=FALSE WHERE id=?",
    [vehicle.id],
    db,
  );
}
async function nextPhotoOrder(field, ownerId, db) {
  const [n] = await query(
    `SELECT COUNT(*) AS total,COALESCE(MAX(sort_order),-1)+1 AS next_order FROM nw_images WHERE ${field}=?`,
    [ownerId],
    db,
  );
  if (n.total >= 20) fail(422, "A maximum of 20 photos is allowed");
  if (n.next_order <= 100) return n.next_order;
  // Keep appended images within the same editable order bounds after order 100.
  const photos = await query(
    `SELECT id FROM nw_images WHERE ${field}=? ORDER BY sort_order,id`,
    [ownerId],
    db,
  );
  for (const [order, photo] of photos.entries())
    await query(
      `UPDATE nw_images SET sort_order=? WHERE id=? AND ${field}=?`,
      [order, photo.id, ownerId],
      db,
    );
  return photos.length;
}
async function save(buffer, ext) {
  await fs.mkdir(env.storage, { recursive: true, mode: 0o700 });
  const key = crypto.randomUUID() + "." + ext;
  try {
    await fs.writeFile(path.join(env.storage, key), buffer, {
      mode: 0o600,
      flag: "wx",
    });
    if (ext === "webp") {
      await fs.writeFile(
        path.join(env.storage, key.replace(".webp", ".thumb.webp")),
        await sharp(buffer)
          .resize({
            width: 600,
            height: 400,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 78 })
          .toBuffer(),
        { mode: 0o600, flag: "wx" },
      );
    }
    return key;
  } catch (error) {
    await discardStored(key);
    throw error;
  }
}
async function normaliseImage(file) {
  if (!file) fail(422, "Choose a file");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
    fail(422, "Use JPEG, PNG, or WebP images");
  try {
    const meta = await sharp(file.buffer, {
      limitInputPixels: 40e6,
    }).metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format))
      fail(422, "Invalid image format");
    return await sharp(file.buffer, { limitInputPixels: 40e6 })
      .rotate()
      .resize({
        width: 1800,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (e) {
    fail(422, "The image is invalid or exceeds the pixel limit");
  }
}
async function ownerOrReviewer(req, res, next) {
  const [s] = await query("SELECT * FROM nw_submissions WHERE id=?", [
    id.parse(req.params.id),
  ]);
  if (
    !s ||
    (s.seller_id !== req.user.id &&
      !permissions[req.user.role]?.includes("reviews"))
  )
    fail(404, "Submission not found");
  req.submission = s;
  next();
}
router.get(
  "/media/:id",
  wrap(async (req, res) => {
    const [img] = await query(
      "SELECT i.storage_key FROM nw_images i JOIN nw_vehicles v ON v.id=i.vehicle_id WHERE i.id=? AND " +
        publicWhere,
      [id.parse(req.params.id)],
    );
    if (!img) fail(404, "Image unavailable");
    res.type("webp");
    res.set("Cache-Control", "public, max-age=3600");
    let key = img.storage_key;
    if (req.query.size === "thumb") {
      const thumb = key.replace(".webp", ".thumb.webp");
      try {
        await fs.access(path.join(env.storage, thumb));
        key = thumb;
      } catch {}
    }
    res.sendFile(path.join(env.storage, key));
  }),
);
router.get(
  "/private-images/:imageId",
  authenticate,
  wrap(async (req, res) => {
    const [img] = await query(
      "SELECT i.storage_key,i.vehicle_id,s.seller_id,s.status AS submission_status FROM nw_images i LEFT JOIN nw_vehicles v ON v.id=i.vehicle_id LEFT JOIN nw_submissions s ON s.id=COALESCE(v.submission_id,i.submission_id) WHERE i.id=?",
      [id.parse(req.params.imageId)],
    );
    if (
      !img ||
      (img.seller_id !== req.user.id &&
        !(
          permissions[req.user.role]?.includes("reviews") ||
          ((img.vehicle_id || img.submission_status === "approved") &&
            permissions[req.user.role]?.includes("inventory"))
        ))
    )
      fail(404, "Image unavailable");
    res.type("webp");
    let key = img.storage_key;
    if (req.query.size === "thumb") {
      const thumb = key.replace(".webp", ".thumb.webp");
      try {
        await fs.access(path.join(env.storage, thumb));
        key = thumb;
      } catch {}
    }
    res.sendFile(path.join(env.storage, key));
  }),
);
router.post(
  "/account/submissions/:id/images",
  authenticate,
  wrap(async (req, res, next) => {
    const s = await ownSubmission(req.params.id, req.user);
    editable(s);
    next();
  }),
  upload,
  wrap(async (req, res) => {
    const buffer = await normaliseImage(req.file),
      key = await save(buffer, "webp");
    try {
      await transaction(async (db) => {
        const s = await ownSubmission(req.params.id, req.user, db, true);
        editable(s);
        const order = await nextPhotoOrder("submission_id", s.id, db);
        await query(
          "INSERT INTO nw_images(submission_id,storage_key,alt_text,sort_order) VALUES (?,?,?,?)",
          // Blank = automatic: the website describes it from current vehicle details.
          [s.id, key, "", order],
          db,
        );
      });
    } catch (e) {
      if (!e.commitOutcomeUnknown) await discardStored(key);
      throw e;
    }
    res.status(201).json({ ok: true });
  }),
);
router.delete(
  "/account/submissions/:id/images/:imageId",
  authenticate,
  wrap(async (req, res) => {
    await transaction(async (db) => {
      const s = await ownSubmission(req.params.id, req.user, db, true);
      editable(s);
      await query(
        "DELETE FROM nw_images WHERE id=? AND submission_id=?",
        [id.parse(req.params.imageId), s.id],
        db,
      );
    });
    res.json({ ok: true });
  }),
);
router.patch(
  "/account/submissions/:id/images/reorder",
  authenticate,
  wrap(async (req, res) => {
    const { image_ids } = z
      .object({
        image_ids: z
          .array(id)
          .min(1)
          .max(20)
          .refine(
            (ids) => new Set(ids).size === ids.length,
            "Photo IDs must be unique",
          ),
      })
      .parse(req.body);
    await transaction(async (db) => {
      const s = await ownSubmission(req.params.id, req.user, db, true);
      editable(s);
      const photos = await query(
        "SELECT id FROM nw_images WHERE submission_id=? ORDER BY sort_order,id FOR UPDATE",
        [s.id],
        db,
      );
      if (
        photos.length !== image_ids.length ||
        photos.some((photo) => !image_ids.includes(photo.id))
      )
        fail(
          409,
          "The photos changed. Reload before reordering.",
          "STALE_PHOTOS",
        );
      for (const [order, imageId] of image_ids.entries())
        await query(
          "UPDATE nw_images SET sort_order=? WHERE id=? AND submission_id=?",
          [order, imageId, s.id],
          db,
        );
    });
    res.json({ ok: true });
  }),
);
router.patch(
  "/account/submissions/:id/images/:imageId",
  authenticate,
  wrap(async (req, res) => {
    const d = z
      .object({
        // Empty restores the automatic description.
        alt_text: z.string().trim().max(200),
        sort_order: z.number().int().min(0).max(100),
      })
      .parse(req.body);
    await transaction(async (db) => {
      const s = await ownSubmission(req.params.id, req.user, db, true);
      editable(s);
      await query(
        "UPDATE nw_images SET alt_text=?,sort_order=? WHERE id=? AND submission_id=?",
        [d.alt_text, d.sort_order, id.parse(req.params.imageId), s.id],
        db,
      );
    });
    res.json({ ok: true });
  }),
);
router.post(
  "/account/submissions/:id/documents",
  authenticate,
  wrap(async (req, res, next) => {
    const s = await ownSubmission(req.params.id, req.user);
    editable(s);
    next();
  }),
  upload,
  wrap(async (req, res) => {
    const type = z
      .enum([
        "rc",
        "ownership_authority",
        "insurance",
        "puc",
        "loan_status",
        "challans",
        "fitness",
        "permit",
        "tax",
      ])
      .parse(req.body.type);
    if (!req.file) fail(422, "Choose a document");
    let buffer, ext, mime;
    if (
      req.file.mimetype === "application/pdf" &&
      req.file.buffer.subarray(0, 5).toString() === "%PDF-"
    ) {
      buffer = req.file.buffer;
      ext = "pdf";
      mime = "application/pdf";
    } else {
      buffer = await normaliseImage(req.file);
      ext = "webp";
      mime = "image/webp";
    }
    const key = await save(buffer, ext);
    try {
      await transaction(async (db) => {
        const s = await ownSubmission(req.params.id, req.user, db, true);
        editable(s);
        await query(
          "INSERT INTO nw_documents(submission_id,type,storage_key,mime,size_bytes,uploaded_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE storage_key=VALUES(storage_key),mime=VALUES(mime),size_bytes=VALUES(size_bytes),uploaded_at=UTC_TIMESTAMP(),status='pending',review_note=NULL,reviewed_by=NULL",
          [s.id, type, key, mime, buffer.length],
          db,
        );
        await history(
          "submission",
          s.id,
          s.status,
          req.user.id,
          `Uploaded ${type.replaceAll("_", " ")} for review`,
          db,
        );
        await audit(
          req.user.id,
          "document.upload",
          "submission",
          s.id,
          { type },
          db,
        );
      });
    } catch (e) {
      if (!e.commitOutcomeUnknown) await discardStored(key);
      throw e;
    }
    res.status(201).json({ ok: true });
  }),
);
router.get(
  "/account/submissions/:id/documents/:documentId",
  authenticate,
  wrap(ownerOrReviewer),
  wrap(async (req, res) => {
    const [d] = await query(
      "SELECT * FROM nw_documents WHERE id=? AND submission_id=?",
      [id.parse(req.params.documentId), req.submission.id],
    );
    if (!d) fail(404, "Document not found");
    await audit(req.user.id, "document.download", "document", d.id);
    res.set("Content-Security-Policy", "default-src 'none'; sandbox");
    res.type(d.mime);
    res.set(
      "Content-Disposition",
      `attachment; filename="${d.type}.${d.mime === "application/pdf" ? "pdf" : "webp"}"`,
    );
    res.sendFile(path.join(env.storage, d.storage_key));
  }),
);
router.post(
  "/admin/vehicles/:id/images",
  authenticate,
  allow("inventory"),
  wrap(async (req, res, next) => {
    const [v] = await query("SELECT id,status FROM nw_vehicles WHERE id=?", [
      id.parse(req.params.id),
    ]);
    editableInventory(v);
    next();
  }),
  upload,
  wrap(async (req, res) => {
    const buffer = await normaliseImage(req.file),
      key = await save(buffer, "webp");
    try {
      await transaction(async (db) => {
        const v = await lockInventory(req, db);
        const order = await nextPhotoOrder("vehicle_id", v.id, db);
        await query(
          "INSERT INTO nw_images(vehicle_id,submission_id,storage_key,alt_text,sort_order) VALUES (?,?,?,?,?)",
          [v.id, v.submission_id || null, key, "", order],
          db,
        );
        await invalidateApproval(v, db);
        await audit(
          req.user.id,
          "inventory.image_upload",
          "vehicle",
          v.id,
          {},
          db,
        );
      });
    } catch (error) {
      if (!error.commitOutcomeUnknown) await discardStored(key);
      throw error;
    }
    res.status(201).json({ ok: true });
  }),
);
router.patch(
  "/admin/vehicles/:id/images/:imageId",
  authenticate,
  allow("inventory"),
  wrap(async (req, res) => {
    const d = z
      .object({
        // Empty restores the automatic description.
        alt_text: z.string().trim().max(200),
        sort_order: z.number().int().min(0).max(100),
      })
      .parse(req.body);
    await transaction(async (db) => {
      const v = await lockInventory(req, db);
      const [image] = await query(
        "SELECT id FROM nw_images WHERE id=? AND vehicle_id=?",
        [id.parse(req.params.imageId), v.id],
        db,
      );
      if (!image) fail(404, "Image not found");
      await query(
        "UPDATE nw_images SET alt_text=?,sort_order=? WHERE id=? AND vehicle_id=?",
        [
          d.alt_text,
          d.sort_order,
          id.parse(req.params.imageId),
          id.parse(req.params.id),
        ],
        db,
      );
      await invalidateApproval(v, db);
      await audit(
        req.user.id,
        "inventory.image_update",
        "vehicle",
        req.params.id,
        {},
        db,
      );
    });
    res.json({ ok: true });
  }),
);
router.delete(
  "/admin/vehicles/:id/images/:imageId",
  authenticate,
  allow("inventory"),
  wrap(async (req, res) => {
    await transaction(async (db) => {
      const v = await lockInventory(req, db);
      const result = await query(
        "DELETE FROM nw_images WHERE id=? AND vehicle_id=?",
        [id.parse(req.params.imageId), id.parse(req.params.id)],
        db,
      );
      if (!result.affectedRows) fail(404, "Image not found");
      await invalidateApproval(v, db);
      await audit(
        req.user.id,
        "inventory.image_remove",
        "vehicle",
        req.params.id,
        {},
        db,
      );
    });
    res.json({ ok: true });
  }),
);
module.exports = { router, normaliseImage };
