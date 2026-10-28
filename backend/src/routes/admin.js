const express = require("express");
const bcrypt = require("bcryptjs");
const { query, transaction } = require("../config/db");
const {
  z,
  wrap,
  fail,
  id,
  text,
  email,
  phone,
  password,
  vehicleSchema,
  transition,
  submissionTransitions,
  vehicleTransitions,
  requirements,
  slug,
} = require("../lib/core");
const { authenticate, allow, permissions } = require("../middleware/auth");
const { audit, history, parse } = require("../lib/store");
const {
  inventoryVersion,
  submissionVersion,
} = require("../lib/inventory-version");
const { submissionView } = require("./account");
const { notifyListing } = require("../lib/indexnow");
const {
  draftContactedAt,
  pendingDraftWhere,
  sellerDraftQueue,
  markDraftContacted,
} = require("../lib/seller-drafts");
const router = express.Router();
router.use(authenticate);
router.use((req, res, next) =>
  req.user.role === "customer"
    ? res.status(403).json({
        error: { code: "FORBIDDEN", message: "Staff access required" },
      })
    : next(),
);
router.use("/offers", require("./offers").router);
router.use("/blog", require("./blog").adminRouter);
const paging = (req) =>
  z
    .object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      q: z.string().max(100).default(""),
      status: z.string().max(40).default(""),
    })
    .parse(req.query);
function bounds(req) {
  const d = z
    .object({
      from: z.iso.date().default("2000-01-01"),
      to: z.iso.date().default("2099-12-31"),
    })
    .parse(req.query);
  if (d.from > d.to) fail(422, "Start date must precede end date");
  return [d.from, d.to + " 23:59:59"];
}
async function inventoryData(v, db) {
  const out = parse(v);
  const photos = await query(
    "SELECT id,storage_key,alt_text,sort_order FROM nw_images WHERE vehicle_id=? ORDER BY sort_order,id",
    [v.id],
    db,
  );
  return {
    ...out,
    expected_version: inventoryVersion(v, photos),
    images: photos.map(({ storage_key, ...i }) => ({
      ...i,
      url: `/api/v1/private-images/${i.id}`,
    })),
  };
}
async function lockedInventory(value, db) {
  const vehicleId = id.parse(value);
  const [reference] = await query(
    "SELECT * FROM nw_vehicles WHERE id=?",
    [vehicleId],
    db,
  );
  if (!reference) fail(404, "Vehicle not found");
  let submission;
  // Publication locks the seller submission before its inventory record.
  // Editing, approval and status changes must use that same order.
  if (reference.submission_id) {
    [submission] = await query(
      "SELECT * FROM nw_submissions WHERE id=? FOR UPDATE",
      [reference.submission_id],
      db,
    );
    if (!submission) fail(409, "The seller submission is no longer available");
  }
  const [vehicle] = await query(
    "SELECT * FROM nw_vehicles WHERE id=? FOR UPDATE",
    [vehicleId],
    db,
  );
  if (!vehicle) fail(404, "Vehicle not found");
  return { vehicle, submission };
}
async function saveVehicle(data, db, vehicleId = null, submission = null) {
  const values = [
    data.type,
    data.make,
    data.model,
    data.year,
    data.price,
    data.mileage,
    data.fuel,
    data.transmission,
    data.location,
    data.body_type,
    data.payload_kg ?? null,
    slug(data),
    data.featured,
    JSON.stringify(data),
  ];
  if (vehicleId) {
    await query(
      "UPDATE nw_vehicles SET type=?,make=?,model=?,year=?,price=?,mileage=?,fuel=?,transmission=?,location=?,body_type=?,payload_kg=?,slug=?,featured=?,data=? WHERE id=?",
      [...values, vehicleId],
      db,
    );
    return vehicleId;
  }
  const r = await query(
    "INSERT INTO nw_vehicles(type,make,model,year,price,mileage,fuel,transmission,location,body_type,payload_kg,slug,featured,data,submission_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [...values, submission],
    db,
  );
  return r.insertId;
}
function editNote(before, after) {
  const price = (value) => "₹" + Number(value).toLocaleString("en-IN");
  return Number(before.price) !== Number(after.price)
    ? `Staff updated vehicle details. Asking price changed from ${price(before.price)} to ${price(after.price)}.`
    : "Staff updated vehicle details.";
}
router.get(
  "/dashboard",
  wrap(async (req, res) => {
    const result = { permissions: permissions[req.user.role] || [] };
    if (permissions[req.user.role]?.includes("inventory")) {
      const [r] = await query(
        "SELECT COUNT(*) AS total,COALESCE(SUM(status='published' AND approved=TRUE),0) AS available,COALESCE(SUM(status='reserved'),0) AS reserved,COALESCE(SUM(status='sold'),0) AS sold,COALESCE(SUM(status='draft'),0) AS drafts FROM nw_vehicles",
      );
      result.inventory = r;
    }
    if (permissions[req.user.role]?.includes("leads")) {
      const [r] = await query(
        "SELECT COUNT(*) AS total,COALESCE(SUM(status='new'),0) AS new_leads FROM nw_leads",
      );
      result.leads = r;
      const [t] = await query(
        "SELECT COUNT(*) AS open FROM nw_test_drives WHERE status IN ('requested','rescheduled')",
      );
      result.test_drives = t;
      result.lead_queue = await query(
        "SELECT id,name,status,created_at FROM nw_leads WHERE status='new' ORDER BY id DESC LIMIT 5",
      );
      result.drive_queue = await query(
        "SELECT id,name,preferred_at,status FROM nw_test_drives WHERE status IN ('requested','rescheduled') ORDER BY preferred_at LIMIT 5",
      );
    }
    if (permissions[req.user.role]?.includes("reviews")) {
      const [r] = await query(
        "SELECT COUNT(*) AS awaiting FROM nw_submissions WHERE status IN ('submitted','under_review')",
      );
      const [d] = await query(
        "SELECT COUNT(*) AS pending FROM nw_documents d JOIN nw_submissions s ON s.id=d.submission_id WHERE d.status='pending' AND s.status IN ('submitted','under_review')",
      );
      result.submissions = { ...r, ...d };
      result.seller_drafts = await sellerDraftQueue();
      result.review_queue = await query(
        "SELECT id,type,status,submitted_at,JSON_UNQUOTE(JSON_EXTRACT(data,'$.make')) AS make,JSON_UNQUOTE(JSON_EXTRACT(data,'$.model')) AS model FROM nw_submissions WHERE status IN ('submitted','under_review') ORDER BY submitted_at LIMIT 5",
      );
    }
    if (permissions[req.user.role]?.includes("audit"))
      result.activity = await query(
        "SELECT a.id,a.action,a.target_type,a.target_id,a.created_at,u.name AS actor FROM nw_audit a LEFT JOIN nw_users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 10",
      );
    res.json(result);
  }),
);
router.get(
  "/inventory-reviews",
  allow("reviews"),
  wrap(async (req, res) => {
    const p = paging(req);
    const values = [];
    let where = "status='draft' AND approved=FALSE";
    if (p.q) {
      where += " AND CONCAT(make,' ',model) LIKE ?";
      values.push("%" + p.q + "%");
    }
    const [count] = await query(
      "SELECT COUNT(*) AS total FROM nw_vehicles WHERE " + where,
      values,
    );
    const rows = await query(
      `SELECT * FROM nw_vehicles WHERE ${where} ORDER BY id DESC LIMIT 20 OFFSET ${(p.page - 1) * 20}`,
      values,
    );
    res.json({
      items: await Promise.all(rows.map((v) => inventoryData(v))),
      total: count.total,
      page: p.page,
    });
  }),
);
router.get(
  "/publishing",
  allow("inventory"),
  wrap(async (req, res) => {
    const p = paging(req);
    const values = [];
    let where = "s.status='approved'";
    if (p.q) {
      where +=
        " AND CONCAT(JSON_UNQUOTE(JSON_EXTRACT(COALESCE(v.data,s.data),'$.make')),' ',JSON_UNQUOTE(JSON_EXTRACT(COALESCE(v.data,s.data),'$.model'))) LIKE ?";
      values.push("%" + p.q + "%");
    }
    const tables =
      "nw_submissions s LEFT JOIN nw_vehicles v ON v.submission_id=s.id";
    const [count] = await query(
      `SELECT COUNT(*) AS total FROM ${tables} WHERE ${where}`,
      values,
    );
    const rows = await query(
      `SELECT s.id,s.type,s.status,s.updated_at,COALESCE(v.data,s.data) AS data,v.id AS vehicle_id,v.approved AS inventory_approved FROM ${tables} WHERE ${where} ORDER BY s.id DESC LIMIT 20 OFFSET ${(p.page - 1) * 20}`,
      values,
    );
    const items = await Promise.all(
      rows.map(async (row) => ({
        ...parse(row),
        images: (
          await query(
            "SELECT id,alt_text,sort_order FROM nw_images WHERE " +
              (row.vehicle_id ? "vehicle_id=?" : "submission_id=?") +
              " ORDER BY sort_order,id",
            [row.vehicle_id || row.id],
          )
        ).map((image) => ({
          ...image,
          url: `/api/v1/private-images/${image.id}`,
        })),
      })),
    );
    res.json({ items, total: count.total, page: p.page });
  }),
);
router.get(
  "/vehicles",
  allow("inventory"),
  wrap(async (req, res) => {
    const p = paging(req),
      where = ["1=1"],
      values = [];
    if (p.status) {
      where.push("status=?");
      values.push(p.status);
    }
    if (p.q) {
      where.push("CONCAT(make,' ',model) LIKE ?");
      values.push("%" + p.q + "%");
    }
    if (req.query.type) {
      where.push("type=?");
      values.push(z.enum(["passenger", "commercial"]).parse(req.query.type));
    }
    const [n] = await query(
      "SELECT COUNT(*) AS total FROM nw_vehicles WHERE " + where.join(" AND "),
      values,
    );
    const rows = await query(
      `SELECT * FROM nw_vehicles WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT 20 OFFSET ${(p.page - 1) * 20}`,
      values,
    );
    res.json({
      items: await Promise.all(rows.map((v) => inventoryData(v))),
      total: n.total,
      page: p.page,
    });
  }),
);
router.get(
  "/vehicles/:id",
  allow("inventory"),
  wrap(async (req, res) => {
    const [v] = await query("SELECT * FROM nw_vehicles WHERE id=?", [
      id.parse(req.params.id),
    ]);
    if (!v) fail(404, "Vehicle not found");
    res.json(await inventoryData(v));
  }),
);
router.post(
  "/vehicles",
  allow("inventory"),
  wrap(async (req, res) => {
    const d = vehicleSchema.parse(req.body);
    const vehicleId = await transaction(async (db) => {
      const v = await saveVehicle(d, db);
      await audit(req.user.id, "inventory.create", "vehicle", v, {}, db);
      return v;
    });
    res.status(201).json({ id: vehicleId });
  }),
);
router.patch(
  "/vehicles/:id",
  allow("inventory"),
  wrap(async (req, res) => {
    const d = vehicleSchema.parse(req.body);
    const { expected_version } = z
      .object({
        expected_version: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      })
      .parse(req.body);
    await transaction(async (db) => {
      const { vehicle: v, submission: linkedSubmission } =
        await lockedInventory(req.params.id, db);
      if (["published", "reserved"].includes(v.status))
        fail(409, "Unpublish the vehicle before editing its details");
      if (expected_version) {
        const photos = await query(
          "SELECT id,storage_key,alt_text,sort_order FROM nw_images WHERE vehicle_id=? ORDER BY sort_order,id",
          [v.id],
          db,
        );
        if (inventoryVersion(v, photos) !== expected_version)
          fail(
            409,
            "This listing changed. Reload it before saving your edits.",
            "STALE_VEHICLE",
          );
      }
      const current = parse(v).data;
      await saveVehicle(
        current.is_sample
          ? { ...d, is_sample: true, sample_key: current.sample_key }
          : d,
        db,
        v.id,
      );
      await query(
        "UPDATE nw_vehicles SET approved=FALSE WHERE id=?",
        [v.id],
        db,
      );
      if (v.submission_id) {
        const s = linkedSubmission;
        const categoryChanged = s.type !== d.type;
        await query(
          "UPDATE nw_submissions SET type=?,data=?,status=?,approved_by=? WHERE id=?",
          [
            d.type,
            JSON.stringify(d),
            categoryChanged ? "under_review" : s.status,
            categoryChanged ? null : s.approved_by,
            s.id,
          ],
          db,
        );
        await history(
          "submission",
          s.id,
          categoryChanged ? "under_review" : s.status,
          req.user.id,
          editNote(current, d) +
            (categoryChanged
              ? " Vehicle category changed; a fresh document review is required."
              : " The listing needs fresh inventory approval."),
          db,
        );
      }
      await history(
        "vehicle",
        v.id,
        v.status,
        req.user.id,
        editNote(current, d),
        db,
      );
      await audit(
        req.user.id,
        "inventory.update",
        "vehicle",
        v.id,
        { before: current, after: d },
        db,
      );
    });
    res.json({ ok: true });
  }),
);
router.post(
  "/vehicles/:id/approve",
  allow("reviews"),
  wrap(async (req, res) => {
    const { expected_version } = z
      .object({ expected_version: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(req.body);
    await transaction(async (db) => {
      const { vehicle: v, submission: s } = await lockedInventory(
        req.params.id,
        db,
      );
      if (v.status !== "draft")
        fail(409, "Only draft listings can be approved");
      if (v.submission_id) {
        if (!["approved", "published"].includes(s?.status))
          fail(409, "Seller submission must be approved first");
      }
      vehicleSchema.parse(parse(v).data);
      const photos = await query(
        "SELECT id,storage_key,alt_text,sort_order FROM nw_images WHERE vehicle_id=? ORDER BY sort_order,id",
        [v.id],
        db,
      );
      if (inventoryVersion(v, photos) !== expected_version)
        fail(
          409,
          "This listing changed after you opened it. Reload and inspect its details and photos before approving.",
          "STALE_REVIEW",
        );
      if (!photos.length) fail(422, "Add a vehicle photo before approval");
      await query(
        "UPDATE nw_vehicles SET approved=TRUE WHERE id=?",
        [v.id],
        db,
      );
      await audit(req.user.id, "inventory.approve", "vehicle", v.id, {}, db);
    });
    res.json({ ok: true });
  }),
);
router.post(
  "/vehicles/:id/status",
  allow("inventory"),
  wrap(async (req, res) => {
    const d = z
      .object({
        status: z.enum(["draft", "published", "reserved", "sold", "archived"]),
      })
      .parse(req.body);
    const changed = await transaction(async (db) => {
      const { vehicle: v, submission: s } = await lockedInventory(
        req.params.id,
        db,
      );
      transition(vehicleTransitions, v.status, d.status);
      if (d.status === "published") {
        if (!v.approved) fail(409, "Approve the vehicle before publication");
        const [n] = await query(
          "SELECT COUNT(*) AS total FROM nw_images WHERE vehicle_id=?",
          [v.id],
          db,
        );
        if (!n.total) fail(422, "Add a vehicle photo before publication");
        if (v.submission_id) {
          if (!["approved", "published"].includes(s?.status))
            fail(409, "Seller submission must be approved before publication");
        }
      }
      await query(
        "UPDATE nw_vehicles SET status=? WHERE id=?",
        [d.status, v.id],
        db,
      );
      if (v.submission_id) {
        const newStatus =
          d.status === "draft"
            ? "approved"
            : d.status === "reserved"
              ? "published"
              : d.status;
        await query(
          "UPDATE nw_submissions SET status=? WHERE id=?",
          [newStatus, v.submission_id],
          db,
        );
        await history(
          "submission",
          v.submission_id,
          newStatus,
          req.user.id,
          d.status === "draft" ? "Listing unpublished" : "Listing " + d.status,
          db,
        );
      }
      await history(
        "vehicle",
        v.id,
        d.status,
        req.user.id,
        "Listing status changed",
        db,
      );
      await audit(
        req.user.id,
        "inventory.status",
        "vehicle",
        v.id,
        { from: v.status, to: d.status },
        db,
      );
      const listed = ["published", "reserved"];
      return v.approved &&
        (listed.includes(v.status) || listed.includes(d.status))
        ? v.id
        : null;
    });
    // Listing added, removed or changed availability: its public URL changed state.
    if (changed) notifyListing(changed);
    res.json({ ok: true });
  }),
);
router.get(
  "/seller-drafts",
  allow("reviews"),
  wrap(async (req, res) => res.json(await sellerDraftQueue())),
);
router.post(
  "/submissions/:id/contacted",
  allow("reviews"),
  wrap(async (req, res) => {
    res.json(await markDraftContacted(id.parse(req.params.id), req.user.id));
  }),
);
router.get(
  "/submissions",
  allow("reviews"),
  wrap(async (req, res) => {
    const p = paging(req);
    let where = p.status ? "s.status=?" : "1=1";
    const followUp = z.enum(["pending"]).optional().parse(req.query.follow_up);
    if (followUp === "pending") where += ` AND ${pendingDraftWhere}`;
    const values = p.status ? [p.status] : [];
    const search = p.q
      ? " AND (u.name LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(s.data,'$.make')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(s.data,'$.model')) LIKE ?)"
      : "";
    if (p.q) values.push(...Array(3).fill("%" + p.q + "%"));
    const [n] = await query(
      `SELECT COUNT(*) AS total FROM nw_submissions s JOIN nw_users u ON u.id=s.seller_id WHERE ${where}${search}`,
      values,
    );
    const rows = await query(
      `SELECT s.*,u.name AS seller_name,${draftContactedAt} AS draft_contacted_at FROM nw_submissions s JOIN nw_users u ON u.id=s.seller_id WHERE ${where}${search} ORDER BY s.id ${followUp === "pending" ? "ASC" : "DESC"} LIMIT 20 OFFSET ${(p.page - 1) * 20}`,
      values,
    );
    res.json({
      items: rows.map((s) => parse(s, ["data", "seller_contact"])),
      total: n.total,
      page: p.page,
    });
  }),
);
router.get(
  "/submissions/:id",
  allow("reviews"),
  wrap(async (req, res) => {
    const [s] = await query("SELECT * FROM nw_submissions WHERE id=?", [
      id.parse(req.params.id),
    ]);
    if (!s) fail(404, "Submission not found");
    res.json(await submissionView(parse(s, ["data", "seller_contact"])));
  }),
);
router.patch(
  "/submissions/:id",
  allow("inventory"),
  allow("reviews"),
  wrap(async (req, res) => {
    const { vehicle, expected_version } = z
      .object({
        vehicle: vehicleSchema,
        expected_version: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(req.body);
    await transaction(async (db) => {
      const [raw] = await query(
        "SELECT * FROM nw_submissions WHERE id=? FOR UPDATE",
        [id.parse(req.params.id)],
        db,
      );
      if (!raw) fail(404, "Submission not found");
      const s = parse(raw);
      if (
        ![
          "draft",
          "submitted",
          "under_review",
          "information_required",
          "approved",
        ].includes(s.status)
      )
        fail(409, "This submission cannot be edited in its current status");
      if (expected_version !== submissionVersion(s))
        fail(
          409,
          "These vehicle details changed. Reload them before saving your edits.",
          "STALE_VEHICLE",
        );
      const [listing] = await query(
        "SELECT id FROM nw_vehicles WHERE submission_id=?",
        [s.id],
        db,
      );
      if (listing)
        fail(
          409,
          "Edit this vehicle from its inventory listing",
          "EDIT_INVENTORY",
        );
      const status = ["draft", "information_required"].includes(s.status)
        ? s.status
        : "under_review";
      const note =
        editNote(s.data, vehicle) +
        " Any previous review approval has been cleared.";
      await query(
        "UPDATE nw_submissions SET type=?,data=?,status=?,approved_by=NULL,review_note=? WHERE id=?",
        [vehicle.type, JSON.stringify(vehicle), status, note, s.id],
        db,
      );
      await history("submission", s.id, status, req.user.id, note, db);
      await audit(
        req.user.id,
        "submission.edit",
        "submission",
        s.id,
        { before: s.data, after: vehicle },
        db,
      );
    });
    res.json({ ok: true });
  }),
);
router.post(
  "/submissions/:id/review",
  allow("reviews"),
  wrap(async (req, res) => {
    const d = z
      .object({
        status: z.enum([
          "under_review",
          "information_required",
          "approved",
          "rejected",
        ]),
        note: z.string().trim().max(3000).default(""),
        expected_version: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(req.body);
    if (["information_required", "rejected"].includes(d.status) && !d.note)
      fail(422, "Explain the requested information or rejection");
    await transaction(async (db) => {
      const [raw] = await query(
        "SELECT * FROM nw_submissions WHERE id=? FOR UPDATE",
        [id.parse(req.params.id)],
        db,
      );
      if (!raw) fail(404, "Submission not found");
      const s = parse(raw);
      if (d.expected_version !== submissionVersion(s))
        fail(
          409,
          "These vehicle details changed. Reload and review them before deciding.",
          "STALE_REVIEW",
        );
      transition(submissionTransitions, s.status, d.status);
      if (d.status === "approved") {
        const docs = await query(
          "SELECT type FROM nw_documents WHERE submission_id=? AND status='accepted'",
          [s.id],
          db,
        );
        const missing = requirements(s.type).filter(
          (t) => !docs.some((v) => v.type === t),
        );
        if (missing.length)
          fail(
            409,
            "Accept all required documents before approval: " +
              missing.join(", "),
          );
        vehicleSchema.parse(s.data);
        const [listing] = await query(
          "SELECT id FROM nw_vehicles WHERE submission_id=?",
          [s.id],
          db,
        );
        const [n] = await query(
          "SELECT COUNT(*) AS total FROM nw_images WHERE " +
            (listing ? "vehicle_id=?" : "submission_id=?"),
          [listing?.id || s.id],
          db,
        );
        if (!n.total) fail(422, "At least one vehicle photo is required");
      }
      await query(
        "UPDATE nw_submissions SET status=?,review_note=?,approved_by=? WHERE id=?",
        [d.status, d.note, d.status === "approved" ? req.user.id : null, s.id],
        db,
      );
      await history("submission", s.id, d.status, req.user.id, d.note, db);
      await audit(
        req.user.id,
        "submission.review",
        "submission",
        s.id,
        { from: s.status, to: d.status },
        db,
      );
    });
    res.json({ ok: true });
  }),
);
router.post(
  "/submissions/:id/publish",
  allow("inventory"),
  wrap(async (req, res) => {
    const vehicleId = await transaction(async (db) => {
      const [raw] = await query(
        "SELECT * FROM nw_submissions WHERE id=? FOR UPDATE",
        [id.parse(req.params.id)],
        db,
      );
      if (!raw) fail(404, "Submission not found");
      const s = parse(raw);
      transition(submissionTransitions, s.status, "published");
      const d = vehicleSchema.parse(s.data);
      const docs = await query(
        "SELECT type FROM nw_documents WHERE submission_id=? AND status='accepted'",
        [s.id],
        db,
      );
      if (requirements(s.type).some((t) => !docs.some((v) => v.type === t)))
        fail(409, "Required documents have not been accepted");
      const [existing] = await query(
        "SELECT id,approved FROM nw_vehicles WHERE submission_id=? FOR UPDATE",
        [s.id],
        db,
      );
      const [n] = await query(
        "SELECT COUNT(*) AS total FROM nw_images WHERE " +
          (existing ? "vehicle_id=?" : "submission_id=?"),
        [existing?.id || s.id],
        db,
      );
      if (!n.total) fail(422, "At least one photo is required");
      if (existing && !existing.approved)
        fail(
          409,
          "The edited inventory listing needs separate approval before publication",
        );
      const v = existing?.id || (await saveVehicle(d, db, null, s.id));
      await query(
        "UPDATE nw_vehicles SET approved=TRUE,status='published' WHERE id=?",
        [v],
        db,
      );
      await query(
        "UPDATE nw_images SET vehicle_id=? WHERE submission_id=?",
        [v, s.id],
        db,
      );
      await query(
        "UPDATE nw_submissions SET status='published' WHERE id=?",
        [s.id],
        db,
      );
      await history(
        "submission",
        s.id,
        "published",
        req.user.id,
        "Listing published following approval",
        db,
      );
      await audit(
        req.user.id,
        "submission.publish",
        "submission",
        s.id,
        { vehicle_id: v },
        db,
      );
      return v;
    });
    notifyListing(vehicleId);
    res.json({ id: vehicleId });
  }),
);
router.post(
  "/documents/:id/review",
  allow("reviews"),
  wrap(async (req, res) => {
    const d = z
      .object({ status: z.enum(["accepted", "rejected"]), note: text(3000) })
      .parse(req.body);
    await transaction(async (db) => {
      const [doc] = await query(
        "SELECT * FROM nw_documents WHERE id=?",
        [id.parse(req.params.id)],
        db,
      );
      if (!doc) fail(404, "Document not found");
      const [s] = await query(
        "SELECT status FROM nw_submissions WHERE id=? FOR UPDATE",
        [doc.submission_id],
        db,
      );
      if (!["submitted", "under_review"].includes(s.status))
        fail(409, "Documents can be reviewed only during submission review");
      await query(
        "UPDATE nw_documents SET status=?,review_note=?,reviewed_by=? WHERE id=?",
        [d.status, d.note, req.user.id, doc.id],
        db,
      );
      await history(
        "submission",
        doc.submission_id,
        s.status,
        req.user.id,
        `${doc.type}: ${d.status}. ${d.note}`,
        db,
      );
      await audit(
        req.user.id,
        "document.review",
        "document",
        doc.id,
        { status: d.status },
        db,
      );
    });
    res.json({ ok: true });
  }),
);
for (const [route, table, permission, fields, searchColumn] of [
  ["leads", "nw_leads", "leads", "*", "name"],
  ["test-drives", "nw_test_drives", "leads", "*", "name"],
  [
    "customers",
    "nw_users",
    "customers",
    "id,name,email,phone,role,active,created_at",
    "name",
  ],
  [
    "users",
    "nw_users",
    "users",
    "id,name,email,phone,role,active,created_at",
    "name",
  ],
  ["audit", "nw_audit", "audit", "*", "action"],
]) {
  router.get(
    "/" + route,
    allow(permission),
    wrap(async (req, res) => {
      const p = paging(req),
        clauses = ["1=1"],
        values = [];
      if (route === "customers") clauses.push("role='customer'");
      if (route === "users") clauses.push("role<>'customer'");
      if (p.q) {
        const reference =
          route === "leads" && /^(?:NCR-)?([1-9][0-9]*)$/i.exec(p.q.trim());
        if (reference) {
          clauses.push("id=?");
          values.push(reference[1]);
        } else {
          clauses.push(searchColumn + " LIKE ?");
          values.push("%" + p.q + "%");
        }
      }
      if (p.status && ["leads", "test-drives"].includes(route)) {
        clauses.push("status=?");
        values.push(p.status);
      }
      const where = clauses.join(" AND ");
      const [n] = await query(
        `SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`,
        values,
      );
      const rows = await query(
        `SELECT ${fields} FROM ${table} WHERE ${where} ORDER BY id DESC LIMIT 20 OFFSET ${(p.page - 1) * 20}`,
        values,
      );
      res.json({
        items: rows.map((r) => parse(r)),
        total: n.total,
        page: p.page,
      });
    }),
  );
}
router.patch(
  "/leads/:id",
  allow("leads"),
  wrap(async (req, res) => {
    const d = z
      .object({
        status: z.enum([
          "new",
          "contacted",
          "test_drive",
          "negotiation",
          "sold",
          "lost",
        ]),
        internal_note: z.string().trim().max(3000),
        assigned_to: id.nullable().optional(),
      })
      .parse(req.body);
    await transaction(async (db) => {
      const [lead] = await query(
        "SELECT id FROM nw_leads WHERE id=? FOR UPDATE",
        [id.parse(req.params.id)],
        db,
      );
      if (!lead) fail(404, "Lead not found");
      if (d.assigned_to) {
        const [u] = await query(
          "SELECT id FROM nw_users WHERE id=? AND active=TRUE AND role IN ('admin','sales')",
          [d.assigned_to],
          db,
        );
        if (!u) fail(422, "Choose an active sales or admin owner");
      }
      await query(
        "UPDATE nw_leads SET status=?,internal_note=?,assigned_to=? WHERE id=?",
        [d.status, d.internal_note, d.assigned_to || null, lead.id],
        db,
      );
      await history(
        "lead",
        lead.id,
        d.status,
        req.user.id,
        d.internal_note,
        db,
      );
      await audit(
        req.user.id,
        "lead.update",
        "lead",
        lead.id,
        { status: d.status },
        db,
      );
    });
    res.json({ ok: true });
  }),
);
router.patch(
  "/test-drives/:id",
  allow("leads"),
  wrap(async (req, res) => {
    const d = z
      .object({
        status: z.enum([
          "requested",
          "confirmed",
          "rescheduled",
          "completed",
          "cancelled",
        ]),
        internal_note: z.string().trim().max(3000),
        confirmed_at: z.iso.datetime().nullable().optional(),
      })
      .parse(req.body);
    await transaction(async (db) => {
      const [t] = await query(
        "SELECT * FROM nw_test_drives WHERE id=? FOR UPDATE",
        [id.parse(req.params.id)],
        db,
      );
      if (!t) fail(404, "Test drive not found");
      const changingAppointment =
        t.status !== d.status ||
        (d.confirmed_at &&
          d.confirmed_at.slice(0, 19).replace("T", " ") !== t.confirmed_at);
      if (
        ["confirmed", "rescheduled"].includes(d.status) &&
        ((changingAppointment &&
          (!d.confirmed_at || new Date(d.confirmed_at) <= new Date())) ||
          (!d.confirmed_at && !t.confirmed_at))
      )
        fail(422, "Choose a future confirmed appointment time");
      if (t.status !== d.status)
        transition(
          {
            requested: ["confirmed", "rescheduled", "cancelled"],
            confirmed: ["rescheduled", "completed", "cancelled"],
            rescheduled: ["confirmed", "completed", "cancelled"],
            completed: [],
            cancelled: [],
          },
          t.status,
          d.status,
        );
      await query(
        "UPDATE nw_test_drives SET status=?,internal_note=?,confirmed_at=? WHERE id=?",
        [
          d.status,
          d.internal_note,
          d.confirmed_at?.slice(0, 19).replace("T", " ") ||
            t.confirmed_at ||
            null,
          t.id,
        ],
        db,
      );
      await history(
        "test_drive",
        t.id,
        d.status,
        req.user.id,
        d.internal_note,
        db,
      );
      await audit(
        req.user.id,
        "test_drive.update",
        "test_drive",
        t.id,
        { status: d.status },
        db,
      );
    });
    res.json({ ok: true });
  }),
);
router.get(
  "/history/:type/:id",
  allow("leads"),
  wrap(async (req, res) => {
    const type = z.enum(["lead", "test_drive"]).parse(req.params.type);
    res.json({
      items: await query(
        "SELECT h.*,u.name AS actor FROM nw_history h LEFT JOIN nw_users u ON u.id=h.actor_id WHERE h.entity_type=? AND h.entity_id=? ORDER BY h.id",
        [type, id.parse(req.params.id)],
      ),
    });
  }),
);
async function changeUser(req, staff) {
  const d = z
    .object({
      active: z.boolean(),
      role: staff
        ? z.enum(["admin", "reviewer", "sales"])
        : z.literal("customer"),
    })
    .parse(req.body);
  await transaction(async (db) => {
    const [u] = await query(
      "SELECT * FROM nw_users WHERE id=? FOR UPDATE",
      [id.parse(req.params.id)],
      db,
    );
    if (!u || (staff ? u.role === "customer" : u.role !== "customer"))
      fail(404, "Account not found");
    if (u.id === req.user.id)
      fail(409, "You cannot change your own access here");
    if (u.role === "admin" && (!d.active || d.role !== "admin")) {
      const rows = await query(
        "SELECT id FROM nw_users WHERE role='admin' AND active=TRUE FOR UPDATE",
        [],
        db,
      );
      if (rows.length <= 1) fail(409, "At least one active admin must remain");
    }
    await query(
      "UPDATE nw_users SET active=?,role=?,token_version=token_version+1 WHERE id=?",
      [d.active, d.role, u.id],
      db,
    );
    await query(
      "UPDATE nw_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL",
      [u.id],
      db,
    );
    await audit(
      req.user.id,
      "user.access_change",
      "user",
      u.id,
      { role: d.role, active: d.active },
      db,
    );
  });
}
router.patch(
  "/customers/:id",
  allow("customers"),
  wrap(async (req, res) => {
    await changeUser(req, false);
    res.json({ ok: true });
  }),
);
router.patch(
  "/users/:id",
  allow("users"),
  wrap(async (req, res) => {
    await changeUser(req, true);
    res.json({ ok: true });
  }),
);
router.post(
  "/users",
  allow("users"),
  wrap(async (req, res) => {
    const d = z
      .object({
        name: text(100),
        email,
        phone,
        password,
        role: z.enum(["admin", "reviewer", "sales"]),
      })
      .parse(req.body);
    const digest = await bcrypt.hash(d.password, 12);
    await transaction(async (db) => {
      let r;
      try {
        r = await query(
          "INSERT INTO nw_users(name,email,phone,password_hash,role,consent_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP())",
          [d.name, d.email, d.phone, digest, d.role],
          db,
        );
      } catch (e) {
        if (e.code === "ER_DUP_ENTRY")
          fail(409, "An account with this email already exists");
        throw e;
      }
      await audit(
        req.user.id,
        "user.staff_create",
        "user",
        r.insertId,
        { role: d.role },
        db,
      );
    });
    res.status(201).json({ ok: true });
  }),
);
const settingsSchema = z
  .object({
    business_name: text(100),
    email: z.union([email, z.literal("")]),
    phone: z.union([phone, z.literal("")]),
    whatsapp: z.union([z.string().regex(/^[1-9][0-9]{7,14}$/), z.literal("")]),
    address: z.string().trim().max(500),
    about: text(5000),
    home_headline: text(200),
    contact_customized: z.boolean().optional(),
    phone_secondary: z.union([phone, z.literal("")]).default(""),
    hours: z.string().trim().max(200).default(""),
    maps_url: z
      .union([
        z.url().refine((value) => {
          if (!URL.canParse(value)) return false;
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            ["www.google.com", "google.com", "maps.google.com"].includes(
              url.hostname,
            ) &&
            url.pathname.startsWith("/maps")
          );
        }, "Use an HTTPS Google Maps URL"),
        z.literal(""),
      ])
      .default(""),
    map_embed: z
      .union([
        z.url().refine((value) => {
          if (!URL.canParse(value)) return false;
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            ["www.google.com", "google.com"].includes(url.hostname) &&
            url.pathname.startsWith("/maps/embed")
          );
        }, "Use an HTTPS Google Maps embed URL"),
        z.literal(""),
      ])
      .default(""),
  })
  .strict();
router.get(
  "/settings",
  allow("settings"),
  wrap(async (req, res) => {
    const [r] = await query("SELECT data FROM nw_settings WHERE id=1");
    res.json(parse(r).data);
  }),
);
router.put(
  "/settings",
  allow("settings"),
  wrap(async (req, res) => {
    const d = { ...settingsSchema.parse(req.body), contact_customized: true };
    await transaction(async (db) => {
      await query(
        "UPDATE nw_settings SET data=? WHERE id=1",
        [JSON.stringify(d)],
        db,
      );
      await audit(req.user.id, "settings.update", "settings", 1, {}, db);
    });
    res.json({ ok: true });
  }),
);
router.get(
  "/reports",
  allow("reports"),
  wrap(async (req, res) => {
    const range = bounds(req);
    const group = async (table, column) =>
      query(
        `SELECT ${column} AS label,COUNT(*) AS count FROM ${table} WHERE created_at BETWEEN ? AND ? GROUP BY ${column}`,
        range,
      );
    const [inventory, leads, test_drives, submissions, performance] =
      await Promise.all([
        group("nw_vehicles", "type"),
        group("nw_leads", "status"),
        group("nw_test_drives", "status"),
        group("nw_submissions", "status"),
        query(
          "SELECT id,make,model,status,views,(SELECT COUNT(*) FROM nw_leads l WHERE l.vehicle_id=v.id AND l.created_at BETWEEN ? AND ?) AS enquiries FROM nw_vehicles v WHERE v.created_at BETWEEN ? AND ? ORDER BY views DESC LIMIT 20",
          [...range, ...range],
        ),
      ]);
    res.json({
      inventory,
      leads,
      test_drives,
      submissions,
      performance,
      note: "Listing views are request counts, not unique visitors. External traffic analytics are not configured.",
    });
  }),
);
router.get(
  "/reports/export",
  allow("reports"),
  wrap(async (req, res) => {
    const range = bounds(req);
    const rows = await query(
      "SELECT status,COUNT(*) AS count FROM nw_leads WHERE created_at BETWEEN ? AND ? GROUP BY status",
      range,
    );
    await audit(req.user.id, "reports.export", "report", "lead_status", {
      from: range[0],
      to: range[1],
    });
    res
      .type("csv")
      .attachment("ncr-wheelz-lead-status.csv")
      .send(
        "status,count\n" + rows.map((r) => `${r.status},${r.count}`).join("\n"),
      );
  }),
);
for (const [route, table] of [
  ["leads", "nw_leads"],
  ["test-drives", "nw_test_drives"],
])
  router.get(
    "/" + route + "/:id",
    allow("leads"),
    wrap(async (req, res) => {
      const [row] = await query(`SELECT * FROM ${table} WHERE id=?`, [
        id.parse(req.params.id),
      ]);
      if (!row) fail(404, "Record not found");
      res.json(row);
    }),
  );
router.get(
  "/customers/:id",
  allow("customers"),
  wrap(async (req, res) => {
    const [u] = await query(
      "SELECT id,name,email,phone,role,active,created_at FROM nw_users WHERE id=? AND role='customer'",
      [id.parse(req.params.id)],
    );
    if (!u) fail(404, "Customer not found");
    const [activity] = await query(
      "SELECT (SELECT COUNT(*) FROM nw_leads WHERE user_id=?) AS enquiries,(SELECT COUNT(*) FROM nw_test_drives WHERE user_id=?) AS test_drives,(SELECT COUNT(*) FROM nw_submissions WHERE seller_id=?) AS submissions",
      [u.id, u.id, u.id],
    );
    await audit(req.user.id, "customer.view", "user", u.id);
    res.json({ ...u, activity });
  }),
);
module.exports = { router, saveVehicle };
