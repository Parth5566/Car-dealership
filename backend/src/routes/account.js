const express = require("express");
const crypto = require("node:crypto");
const { query, transaction } = require("../config/db");
const {
  z,
  wrap,
  fail,
  id,
  contact,
  requestConsent,
  text,
  vehicleSchema,
  transition,
  submissionTransitions,
  requirements,
} = require("../lib/core");
const { authenticate } = require("../middleware/auth");
const { publicWhere, isPublicVehicle, submitLimit } = require("./public");
const { parse, publicVehicle, history, audit } = require("../lib/store");
const { submissionVersion } = require("../lib/inventory-version");
const { enqueueNotification } = require("../lib/notifications");
const router = express.Router();
router.use(authenticate);
async function ownSubmission(idValue, user, db, lock = false) {
  const [s] = await query(
    "SELECT * FROM nw_submissions WHERE id=? AND seller_id=?" +
      (lock ? " FOR UPDATE" : ""),
    [id.parse(idValue), user.id],
    db,
  );
  if (!s) fail(404, "Submission not found");
  return parse(s, ["data", "seller_contact"]);
}
function editable(s) {
  if (!["draft", "information_required"].includes(s.status))
    fail(409, "This submission cannot be edited in its current status");
}
async function submissionView(s) {
  const docs = await query(
    "SELECT id,type,status,review_note,size_bytes,mime,created_at,uploaded_at,updated_at FROM nw_documents WHERE submission_id=?",
    [s.id],
  );
  const timeline = await query(
    "SELECT status,note,created_at FROM nw_history WHERE entity_type='submission' AND entity_id=? ORDER BY id",
    [s.id],
  );
  const [v] = await query(
    "SELECT id,slug,status FROM nw_vehicles WHERE submission_id=?",
    [s.id],
  );
  const photos = await query(
    "SELECT id,alt_text,sort_order FROM nw_images WHERE " +
      (v ? "vehicle_id=?" : "submission_id=?") +
      " ORDER BY sort_order,id",
    [v ? v.id : s.id],
  );
  return {
    ...s,
    expected_version: submissionVersion(s),
    documents: docs,
    images: photos.map((i) => ({
      ...i,
      url: `/api/v1/private-images/${i.id}`,
    })),
    history: timeline,
    draft_contacted_at:
      timeline.find((event) => event.status === "draft_contacted")
        ?.created_at || null,
    required_documents: requirements(s.type),
    listing: v || null,
  };
}
router.get(
  "/favourites",
  wrap(async (req, res) => {
    const rows = await query(
      "SELECT v.* FROM nw_favourites f JOIN nw_vehicles v ON v.id=f.vehicle_id WHERE f.user_id=? ORDER BY f.created_at DESC",
      [req.user.id],
    );
    res.json({
      items: await Promise.all(
        rows.map((v) =>
          isPublicVehicle(v)
            ? publicVehicle(v)
            : { id: v.id, status: "unavailable", unavailable: true },
        ),
      ),
    });
  }),
);
router.put(
  "/favourites/:id",
  wrap(async (req, res) => {
    const vehicle = id.parse(req.params.id);
    const [v] = await query(
      "SELECT id FROM nw_vehicles WHERE id=? AND " + publicWhere,
      [vehicle],
    );
    if (!v) fail(404, "Vehicle is no longer available");
    await query(
      "INSERT IGNORE INTO nw_favourites(user_id,vehicle_id) VALUES (?,?)",
      [req.user.id, vehicle],
    );
    res.json({ ok: true });
  }),
);
router.delete(
  "/favourites/:id",
  wrap(async (req, res) => {
    await query("DELETE FROM nw_favourites WHERE user_id=? AND vehicle_id=?", [
      req.user.id,
      id.parse(req.params.id),
    ]);
    res.json({ ok: true });
  }),
);
router.get(
  "/enquiries",
  wrap(async (req, res) => {
    const rows = await query(
      "SELECT l.id,l.vehicle_id,l.message,l.status,l.created_at,v.make,v.model FROM nw_leads l LEFT JOIN nw_vehicles v ON v.id=l.vehicle_id WHERE l.user_id=? ORDER BY l.id DESC",
      [req.user.id],
    );
    res.json({ items: rows });
  }),
);
router.get(
  "/test-drives",
  wrap(async (req, res) => {
    res.json({
      items: await query(
        "SELECT t.id,t.vehicle_id,t.preferred_at,t.confirmed_at,t.status,t.notes,t.created_at,v.make,v.model FROM nw_test_drives t JOIN nw_vehicles v ON v.id=t.vehicle_id WHERE t.user_id=? ORDER BY t.id DESC",
        [req.user.id],
      ),
    });
  }),
);
router.post(
  "/test-drives",
  submitLimit,
  wrap(async (req, res) => {
    const d = contact
      .omit({ message: true })
      .extend({
        ...requestConsent,
        vehicle_id: id,
        preferred_at: z.iso
          .datetime()
          .refine(
            (v) => new Date(v) > new Date(),
            "Choose a future date and time",
          ),
        notes: z.string().trim().max(3000).default(""),
      })
      .parse(req.body);
    const appointmentId = await transaction(async (db) => {
      const [v] = await query(
        "SELECT id FROM nw_vehicles WHERE id=? AND " + publicWhere,
        [d.vehicle_id],
        db,
      );
      if (!v) fail(404, "Vehicle is no longer available");
      const r = await query(
        "INSERT INTO nw_test_drives(vehicle_id,user_id,name,email,phone,preferred_at,notes,consent_at,consent_version) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(),?)",
        [
          d.vehicle_id,
          req.user.id,
          d.name,
          d.email,
          d.phone,
          d.preferred_at.slice(0, 19).replace("T", " "),
          d.notes,
          d.consent_version,
        ],
        db,
      );
      await history(
        "test_drive",
        r.insertId,
        "requested",
        req.user.id,
        "Request received; awaiting staff confirmation",
        db,
      );
      await enqueueNotification(
        {
          kind: "test_drive",
          id: r.insertId,
          contact: d,
          vehicleId: d.vehicle_id,
          preferredAt: d.preferred_at,
          message: d.notes,
        },
        db,
      );
      return r.insertId;
    });
    res.status(201).json({
      id: appointmentId,
      message: "Test drive requested. Staff will contact you to confirm.",
    });
  }),
);
router.get(
  "/submissions",
  wrap(async (req, res) => {
    const rows = await query(
      "SELECT * FROM nw_submissions WHERE seller_id=? ORDER BY id DESC",
      [req.user.id],
    );
    res.json({
      items: await Promise.all(
        rows.map((s) => submissionView(parse(s, ["data", "seller_contact"]))),
      ),
    });
  }),
);
router.get(
  "/submissions/:id",
  wrap(async (req, res) =>
    res.json(
      await submissionView(await ownSubmission(req.params.id, req.user)),
    ),
  ),
);
const sellerSchema = z.object({
  vehicle: vehicleSchema,
  contact: contact.omit({ message: true }),
  expected_version: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
router.post(
  "/submissions",
  wrap(async (req, res) => {
    const d = sellerSchema.parse(req.body);
    const result = await transaction(async (db) => {
      const r = await query(
        "INSERT INTO nw_submissions(seller_id,type,data,seller_contact) VALUES (?,?,?,?)",
        [
          req.user.id,
          d.vehicle.type,
          JSON.stringify(d.vehicle),
          JSON.stringify(d.contact),
        ],
        db,
      );
      await history(
        "submission",
        r.insertId,
        "draft",
        req.user.id,
        "Draft saved and added to the staff follow-up queue",
        db,
      );
      await audit(
        req.user.id,
        "submission.draft_created",
        "submission",
        r.insertId,
        {},
        db,
      );
      return r;
    });
    res.status(201).json({
      id: result.insertId,
      message:
        "Your draft is submitted to our team. Complete your car listing now, or wait for our team to contact you.",
    });
  }),
);
router.patch(
  "/submissions/:id",
  wrap(async (req, res) => {
    const d = sellerSchema.parse(req.body);
    await transaction(async (db) => {
      const s = await ownSubmission(req.params.id, req.user, db, true);
      editable(s);
      if (d.expected_version && d.expected_version !== submissionVersion(s))
        fail(
          409,
          "These vehicle details changed. Reload them before saving your edits.",
          "STALE_VEHICLE",
        );
      if (s.type !== d.vehicle.type)
        fail(422, "Vehicle type cannot be changed after draft creation");
      await query(
        "UPDATE nw_submissions SET data=?,seller_contact=? WHERE id=?",
        [JSON.stringify(d.vehicle), JSON.stringify(d.contact), s.id],
        db,
      );
      await history(
        "submission",
        s.id,
        s.status,
        req.user.id,
        "Seller updated vehicle details",
        db,
      );
    });
    res.json({ ok: true });
  }),
);
router.post(
  "/submissions/:id/submit",
  wrap(async (req, res) => {
    z.object({ consent: z.literal(true) }).parse(req.body);
    await transaction(async (db) => {
      const s = await ownSubmission(req.params.id, req.user, db, true);
      transition(submissionTransitions, s.status, "submitted");
      vehicleSchema.parse(s.data);
      const docs = await query(
        "SELECT type FROM nw_documents WHERE submission_id=?",
        [s.id],
        db,
      );
      const missing = requirements(s.type).filter(
        (t) => !docs.some((d) => d.type === t),
      );
      if (missing.length)
        fail(422, "Upload required documents: " + missing.join(", "));
      const [count] = await query(
        "SELECT COUNT(*) AS total FROM nw_images WHERE submission_id=?",
        [s.id],
        db,
      );
      if (!count.total) fail(422, "Upload at least one vehicle photo");
      await query(
        "UPDATE nw_submissions SET status='submitted',consent_at=UTC_TIMESTAMP(),submitted_at=COALESCE(submitted_at,UTC_TIMESTAMP()) WHERE id=?",
        [s.id],
        db,
      );
      await history(
        "submission",
        s.id,
        "submitted",
        req.user.id,
        "Submitted for manual review",
        db,
      );
      await audit(req.user.id, "submission.submit", "submission", s.id, {}, db);
      await enqueueNotification(
        {
          kind: "seller_submission",
          id: Number(s.id),
          revision: crypto.randomUUID(),
          contact: contact.omit({ message: true }).parse(s.seller_contact),
          vehicle: s.data,
          message: s.data.description,
        },
        db,
      );
    });
    res.json({
      message: "Submitted for review. Your vehicle remains private.",
    });
  }),
);
module.exports = { router, ownSubmission, editable, submissionView };
