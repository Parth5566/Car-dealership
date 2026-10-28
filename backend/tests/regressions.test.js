const { test, beforeEach, after } = require("node:test");
process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const storage = require("node:fs").mkdtempSync(
  path.join(os.tmpdir(), "ncr-regressions-"),
);
process.env.STORAGE_DIR = storage;
process.env.JWT_SECRET = "isolated-regression-test-secret-".repeat(3);
const db = require("../src/config/db");
let execute, commitError;
db.query = (...args) => execute(...args);
db.transaction = async (work) => {
  const result = await work({});
  if (commitError) throw commitError;
  return result;
};
const publicRouter = require("../src/routes/public").router;
const accountRouter = require("../src/routes/account").router;
const adminRouter = require("../src/routes/admin").router;
const authRouter = require("../src/routes/auth").router;
const mediaRouter = require("../src/routes/media").router;
const vehicle = {
  id: 1,
  status: "draft",
  approved: true,
  type: "passenger",
  make: "Test",
  model: "Fixture",
  data: {
    type: "passenger",
    make: "Test",
    model: "Fixture",
    year: 2024,
    price: 100000,
    mileage: 100,
    fuel: "Petrol",
    transmission: "Manual",
    location: "Delhi",
    body_type: "Hatchback",
    owners: 1,
    description: "Test fixture",
    features: [],
  },
};
beforeEach(() => {
  commitError = null;
  execute = async (sql) => {
    if (sql.startsWith("SELECT * FROM nw_vehicles")) return [vehicle];
    if (sql.startsWith("SELECT id FROM nw_vehicles")) return [{ id: 1 }];
    if (sql.startsWith("SELECT COUNT")) return [{ total: 1 }];
    if (sql.startsWith("SELECT *,expires_at"))
      return [{ valid: 1, user_id: 1 }];
    if (sql.startsWith("SELECT role,active"))
      return [{ role: "customer", active: 1 }];
    return { insertId: 42, affectedRows: 1 };
  };
});
async function invoke(router, routePath, method, req = {}) {
  const route = router.stack.find(
    (layer) => layer.route?.path === routePath && layer.route.methods[method],
  ).route;
  let error,
    body,
    status = 200;
  const cookies = [];
  const res = {
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
    cookie(...value) {
      cookies.push(value);
      return this;
    },
    clearCookie() {
      return this;
    },
  };
  await route.stack.at(-1).handle(
    {
      params: { id: "1", imageId: "1" },
      user: { id: 1, role: "sales" },
      query: {},
      ...req,
    },
    res,
    (value) => {
      error = value;
    },
  );
  return { error, body, status: error?.status || status, cookies };
}
const contact = {
  name: "Fixture",
  email: "fixture@example.test",
  phone: "9999999999",
  message: "Test enquiry",
  consent: true,
  consent_version: "contact-2026-10-21",
};
test("seller draft creation records staff follow-up in its transaction and returns the next steps", async () => {
  const writes = [];
  execute = async (sql, values, connection) => {
    writes.push({ sql, values, connection });
    return { insertId: 42, affectedRows: 1 };
  };
  const result = await invoke(accountRouter, "/submissions", "post", {
    body: { vehicle: vehicle.data, contact },
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.id, 42);
  assert.match(result.body.message, /Complete your car listing now, or wait/);
  assert.ok(writes.every((write) => write.connection));
  assert.ok(
    writes.some(
      (write) =>
        write.sql.startsWith("INSERT INTO nw_audit") &&
        write.values[1] === "submission.draft_created",
    ),
  );
  assert.ok(writes.every((write) => !write.sql.includes("nw_email_outbox")));
  commitError = new Error("Commit failed");
  assert.equal(
    (
      await invoke(accountRouter, "/submissions", "post", {
        body: { vehicle: vehicle.data, contact },
      })
    ).error.message,
    "Commit failed",
  );
});
test("draft follow-ups are restricted to reviewing staff", () => {
  for (const [path, method] of [
    ["/seller-drafts", "get"],
    ["/submissions/:id/contacted", "post"],
  ]) {
    const route = adminRouter.stack.find(
      (layer) => layer.route?.path === path && layer.route.methods[method],
    ).route;
    for (const role of ["admin", "reviewer", "sales", "customer"]) {
      let error;
      route.stack[0].handle({ user: { role } }, {}, (value) => {
        error = value;
      });
      assert.equal(
        error?.status,
        ["admin", "reviewer"].includes(role) ? undefined : 403,
        role,
      );
    }
  }
});
test("marking a draft contacted is idempotent and never changes publication or sends email", async () => {
  let marked = false;
  const writes = [];
  execute = async (sql, values, connection) => {
    assert.ok(connection, "contact follow-up uses one transaction");
    if (sql.startsWith("SELECT id,status")) {
      assert.match(sql, /FOR UPDATE$/);
      return [{ id: 1, status: "draft" }];
    }
    if (sql.startsWith("SELECT id FROM nw_history"))
      return marked ? [{ id: 9 }] : [];
    writes.push({ sql, values });
    if (sql.startsWith("INSERT INTO nw_history")) marked = true;
    return { insertId: 9, affectedRows: 1 };
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await invoke(
      adminRouter,
      "/submissions/:id/contacted",
      "post",
    );
    assert.equal(result.status, 200);
    assert.match(result.body.message, /remains a private draft/);
  }
  assert.equal(
    writes.length,
    2,
    "one history event and one audit event across duplicate requests",
  );
  assert.equal(writes[0].values[2], "draft_contacted");
  assert.equal(writes[1].values[1], "submission.draft_contacted");
  assert.ok(writes.every((write) => !/UPDATE|nw_email_outbox/.test(write.sql)));
});
test("a draft follow-up cannot be recorded on a missing or submitted vehicle", async () => {
  for (const status of [null, "submitted", "approved", "published"]) {
    execute = async (sql) => {
      assert.match(sql, /^SELECT id,status/);
      return status ? [{ id: 1, status }] : [];
    };
    const result = await invoke(
      adminRouter,
      "/submissions/:id/contacted",
      "post",
    );
    assert.equal(result.status, status ? 409 : 404);
  }
});
test("admin edits seller details with version checks, seller history and fresh approval", async () => {
  const { submissionVersion } = require("../src/lib/inventory-version");
  const original = {
    id: 13,
    type: "passenger",
    status: "approved",
    approved_by: 9,
    seller_contact: {
      name: "Owner",
      email: "owner@example.test",
      phone: "9999999999",
    },
    data: { ...vehicle.data, price: 500000 },
  };
  let current = structuredClone(original),
    linked = false;
  const writes = [],
    notes = [],
    audits = [];
  execute = async (sql, values) => {
    if (sql.startsWith("SELECT * FROM nw_submissions")) return [current];
    if (sql.startsWith("SELECT id FROM nw_vehicles"))
      return linked ? [{ id: 42 }] : [];
    if (sql.startsWith("UPDATE nw_submissions")) {
      writes.push(sql);
      const [type, data, status, note] = values;
      current = {
        ...current,
        type,
        data: JSON.parse(data),
        status,
        review_note: note,
        approved_by: null,
      };
    }
    if (sql.startsWith("INSERT INTO nw_history")) notes.push(values[4]);
    if (sql.startsWith("INSERT INTO nw_audit"))
      audits.push(JSON.parse(values[4]));
    return { affectedRows: 1 };
  };
  const expected_version = submissionVersion(original);
  const body = {
    vehicle: {
      ...original.data,
      price: 450000,
      description: "Price adjusted after condition inspection",
      fuel_economy: 18.5,
    },
    expected_version,
  };
  const result = await invoke(adminRouter, "/submissions/:id", "patch", {
    body,
    user: { id: 1, role: "admin" },
  });
  assert.ifError(result.error);
  assert.equal(current.data.price, 450000);
  assert.equal(current.data.fuel_economy, 18.5);
  assert.equal(current.status, "under_review");
  assert.equal(current.approved_by, null);
  assert.deepEqual(current.seller_contact, original.seller_contact);
  assert.match(notes[0], /₹5,00,000.*₹4,50,000/);
  assert.equal(audits[0].before.price, 500000);
  assert.equal(audits[0].after.price, 450000);
  const stale = await invoke(adminRouter, "/submissions/:id", "patch", {
    body,
  });
  assert.equal(stale.error.code, "STALE_VEHICLE");
  assert.equal(writes.length, 1);
  const staleReview = await invoke(
    adminRouter,
    "/submissions/:id/review",
    "post",
    {
      body: { status: "approved", expected_version, note: "Old review" },
    },
  );
  assert.equal(staleReview.error.code, "STALE_REVIEW");
  current = structuredClone(original);
  linked = true;
  assert.equal(
    (await invoke(adminRouter, "/submissions/:id", "patch", { body })).error
      .code,
    "EDIT_INVENTORY",
  );
  linked = false;
  current.status = "draft";
  const oldSellerVersion = submissionVersion(current);
  const category = await invoke(adminRouter, "/submissions/:id", "patch", {
    body: {
      vehicle: { ...body.vehicle, type: "commercial", payload_kg: 1000 },
      expected_version: oldSellerVersion,
    },
  });
  assert.ifError(category.error);
  assert.equal(current.type, "commercial");
  assert.equal(current.status, "draft");
  const seller = await invoke(accountRouter, "/submissions/:id", "patch", {
    body: {
      vehicle: original.data,
      contact,
      expected_version: oldSellerVersion,
    },
  });
  assert.equal(seller.error.code, "STALE_VEHICLE");
  const route = adminRouter.stack.find(
    (layer) =>
      layer.route?.path === "/submissions/:id" && layer.route.methods.patch,
  ).route;
  for (const role of ["customer", "sales", "reviewer", "admin"]) {
    let denied;
    for (const layer of route.stack.slice(0, -1)) {
      layer.handle({ user: { role } }, {}, (error) => {
        denied = error;
      });
      if (denied) break;
    }
    assert.equal(denied?.status, role === "admin" ? undefined : 403);
  }
});
test("linked inventory edits synchronize seller details and category changes require document review", async () => {
  const { inventoryVersion } = require("../src/lib/inventory-version");
  let inventory = {
    ...vehicle,
    submission_id: 13,
    price: 500000,
    data: { ...vehicle.data, price: 500000 },
  };
  let submission = {
    id: 13,
    type: "passenger",
    status: "approved",
    approved_by: 9,
    data: inventory.data,
  };
  const notes = [],
    locks = [];
  let writes = 0;
  execute = async (sql, values) => {
    if (sql.endsWith("FOR UPDATE")) locks.push(sql);
    if (sql.startsWith("SELECT * FROM nw_vehicles")) return [inventory];
    if (sql.startsWith("SELECT * FROM nw_submissions")) return [submission];
    if (sql.startsWith("SELECT id,storage_key")) return [];
    if (sql.startsWith("UPDATE nw_vehicles SET type=")) {
      writes++;
      inventory = {
        ...inventory,
        type: values[0],
        price: Number(values[4]),
        data: JSON.parse(values[13]),
      };
    }
    if (sql.startsWith("UPDATE nw_vehicles SET approved=FALSE"))
      inventory.approved = false;
    if (sql.startsWith("UPDATE nw_submissions SET type=")) {
      const [type, data, status, approved_by] = values;
      submission = {
        ...submission,
        type,
        data: JSON.parse(data),
        status,
        approved_by,
      };
    }
    if (sql.startsWith("INSERT INTO nw_history")) notes.push(values[4]);
    return { affectedRows: 1 };
  };
  const initialVersion = inventoryVersion(inventory, []);
  const result = await invoke(adminRouter, "/vehicles/:id", "patch", {
    body: {
      ...inventory.data,
      price: 450000,
      expected_version: initialVersion,
    },
  });
  assert.ifError(result.error);
  assert.equal(inventory.data.price, 450000);
  assert.equal(submission.data.price, 450000);
  assert.equal(submission.status, "approved");
  assert.equal(inventory.approved, false);
  assert.match(notes[0], /₹5,00,000.*₹4,50,000/);
  assert.match(locks[0], /nw_submissions/);
  assert.match(locks[1], /nw_vehicles/);
  const stale = await invoke(adminRouter, "/vehicles/:id", "patch", {
    body: {
      ...inventory.data,
      price: 499999,
      expected_version: initialVersion,
    },
  });
  assert.equal(stale.error.code, "STALE_VEHICLE");
  assert.equal(writes, 1);
  const category = await invoke(adminRouter, "/vehicles/:id", "patch", {
    body: {
      ...inventory.data,
      type: "commercial",
      payload_kg: 1000,
      expected_version: inventoryVersion(inventory, []),
    },
  });
  assert.ifError(category.error);
  assert.equal(submission.type, "commercial");
  assert.equal(submission.status, "under_review");
  assert.equal(submission.approved_by, null);
  inventory.status = "published";
  const live = await invoke(adminRouter, "/vehicles/:id", "patch", {
    body: inventory.data,
  });
  assert.equal(live.status, 409);
  assert.equal(writes, 2);
});
test("vehicle creation stores and publicly returns fuel economy separately from distance", async () => {
  let stored;
  execute = async (sql, values) => {
    if (sql.startsWith("INSERT INTO nw_vehicles(")) {
      stored = JSON.parse(values[13]);
      return { insertId: 42 };
    }
    if (sql.startsWith("SELECT * FROM nw_vehicles"))
      return [
        {
          ...vehicle,
          id: 42,
          status: "published",
          data: JSON.stringify(stored),
        },
      ];
    if (sql.startsWith("SELECT id,alt_text")) return [];
    return { affectedRows: 1 };
  };
  const created = await invoke(adminRouter, "/vehicles", "post", {
    body: { ...vehicle.data, mileage: 42000, fuel_economy: "18.75" },
  });
  assert.ifError(created.error);
  assert.equal(created.status, 201);
  assert.equal(stored.mileage, 42000);
  assert.equal(stored.fuel_economy, 18.75);
  const listing = await invoke(publicRouter, "/vehicles/:id", "get", {
    params: { id: "42" },
  });
  assert.ifError(listing.error);
  assert.equal(listing.body.mileage, 42000);
  assert.equal(listing.body.fuel_economy, 18.75);
  let sellerData;
  execute = async (sql, values) => {
    if (sql.startsWith("INSERT INTO nw_submissions"))
      sellerData = JSON.parse(values[2]);
    return { insertId: 43, affectedRows: 1 };
  };
  const submission = await invoke(accountRouter, "/submissions", "post", {
    body: {
      vehicle: { ...vehicle.data, mileage: 42000, fuel_economy: 18.75 },
      contact,
    },
  });
  assert.ifError(submission.error);
  assert.equal(sellerData.mileage, 42000);
  assert.equal(sellerData.fuel_economy, 18.75);
});
test("enquiries and appointments never report success after a failed commit", async () => {
  commitError = new Error("Commit failed");
  for (const [router, routePath, body] of [
    [publicRouter, "/enquiries", contact],
    [
      accountRouter,
      "/test-drives",
      {
        ...contact,
        vehicle_id: 1,
        preferred_at: new Date(Date.now() + 86400000).toISOString(),
      },
    ],
  ]) {
    const result = await invoke(router, routePath, "post", { body });
    assert.equal(result.body, undefined);
    assert.equal(result.error, commitError);
  }
});
test("a committed enquiry returns its persisted reference", async () => {
  const result = await invoke(publicRouter, "/enquiries", "post", {
    body: contact,
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.id, 42);
});
test("a failed email queue insert cannot report a successful enquiry", async () => {
  const failure = new Error("Email queue unavailable");
  const previous = execute;
  execute = async (sql, ...args) => {
    if (sql.startsWith("INSERT INTO nw_email_outbox")) throw failure;
    return previous(sql, ...args);
  };
  const result = await invoke(publicRouter, "/enquiries", "post", {
    body: contact,
  });
  assert.equal(result.error, failure);
  assert.equal(result.body, undefined);
});
test("registration cannot emit session cookies if commit fails", async () => {
  const fallback = execute;
  execute = async (sql) =>
    sql.startsWith("SELECT * FROM nw_users")
      ? [{ id: 42, role: "customer", token_version: 0 }]
      : fallback(sql);
  commitError = new Error("Commit failed");
  const result = await invoke(authRouter, "/register", "post", {
    body: { ...contact, password: "six123", consent: true },
  });
  assert.equal(result.error, commitError);
  assert.equal(result.cookies.length, 0);
  assert.equal(result.body, undefined);
});
test("staff and customers can both recover with six-character passwords, but not five", async () => {
  let role = "admin";
  const fallback = execute;
  execute = async (sql) =>
    sql.startsWith("SELECT role,active")
      ? [{ role, active: 1 }]
      : fallback(sql);
  const req = { body: { token: "a".repeat(64), password: "six123" } };
  const staff = await invoke(authRouter, "/reset-password", "post", req);
  assert.equal(staff.error, undefined);
  assert.match(staff.body.message, /Password updated/);
  role = "customer";
  const customer = await invoke(authRouter, "/reset-password", "post", req);
  assert.equal(customer.error, undefined);
  const short = await invoke(authRouter, "/reset-password", "post", {
    body: { token: "a".repeat(64), password: "five5" },
  });
  assert.equal(short.error.name, "ZodError");
});
test("appointment notes preserve existing times, including appointments in the past", async () => {
  const writes = [];
  execute = async (sql, values) => {
    if (sql.startsWith("SELECT * FROM nw_test_drives"))
      return [
        { id: 1, status: "confirmed", confirmed_at: "2020-01-01 10:00:00" },
      ];
    writes.push({ sql, values });
    return { affectedRows: 1 };
  };
  const result = await invoke(adminRouter, "/test-drives/:id", "patch", {
    body: {
      status: "confirmed",
      confirmed_at: null,
      internal_note: "Follow-up note",
    },
  });
  assert.equal(result.error, undefined);
  const update = writes.find((write) =>
    write.sql.startsWith("UPDATE nw_test_drives"),
  );
  assert.equal(update.values[2], "2020-01-01 10:00:00");
  const invalid = await invoke(adminRouter, "/test-drives/:id", "patch", {
    body: {
      status: "rescheduled",
      confirmed_at: null,
      internal_note: "New schedule",
    },
  });
  assert.equal(invalid.status, 422);
});
test("live photo edits and deletion are rejected before any database mutation", async () => {
  let writes = 0;
  execute = async (sql) => {
    if (sql.startsWith("SELECT * FROM nw_vehicles"))
      return [{ ...vehicle, status: "published" }];
    writes++;
    return { affectedRows: 1 };
  };
  for (const [method, body] of [
    ["delete", undefined],
    ["patch", { alt_text: "Changed", sort_order: 0 }],
  ]) {
    const result = await invoke(
      mediaRouter,
      "/admin/vehicles/:id/images/:imageId",
      method,
      { body },
    );
    assert.equal(result.status, 409);
  }
  assert.equal(writes, 0);
});
test("deleting a draft photo invalidates approval and missing photos return 404", async () => {
  const writes = [];
  let affectedRows = 1;
  const fallback = execute;
  execute = async (sql, values) => {
    writes.push(sql);
    return sql.startsWith("DELETE FROM nw_images")
      ? { affectedRows }
      : fallback(sql, values);
  };
  assert.equal(
    (await invoke(mediaRouter, "/admin/vehicles/:id/images/:imageId", "delete"))
      .error,
    undefined,
  );
  assert.ok(
    writes.some((sql) =>
      sql.startsWith("UPDATE nw_vehicles SET approved=FALSE"),
    ),
  );
  affectedRows = 0;
  assert.equal(
    (await invoke(mediaRouter, "/admin/vehicles/:id/images/:imageId", "delete"))
      .status,
    404,
  );
});
test("rejected seller/admin uploads remove both the original and thumbnail", async () => {
  const picture = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#244d70" },
  })
    .jpeg()
    .toBuffer();
  const fallback = execute;
  execute = async (sql, values) => {
    if (sql.startsWith("SELECT COUNT")) return [{ total: 20 }];
    if (sql.startsWith("SELECT * FROM nw_submissions"))
      return [{ id: 1, seller_id: 1, status: "draft", data: vehicle.data }];
    return fallback(sql, values);
  };
  for (const routePath of [
    "/admin/vehicles/:id/images",
    "/account/submissions/:id/images",
  ]) {
    const result = await invoke(mediaRouter, routePath, "post", {
      file: { buffer: picture, mimetype: "image/jpeg" },
    });
    assert.equal(result.status, 422);
    assert.deepEqual(await fs.readdir(storage), []);
  }
});
test("unknown commit outcomes retain seller/admin images and documents that may already be committed", async () => {
  const picture = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#244d70" },
  })
    .jpeg()
    .toBuffer();
  const fallback = execute;
  execute = async (sql, values) => {
    if (sql.startsWith("SELECT * FROM nw_submissions"))
      return [{ id: 1, status: "draft", data: vehicle.data }];
    if (sql.startsWith("SELECT COUNT")) return [{ total: 1, next_order: 2 }];
    return fallback(sql, values);
  };
  commitError = Object.assign(
    new Error("Commit acknowledgement lost after saving rows"),
    { commitOutcomeUnknown: true },
  );
  for (const [route, file, body, count] of [
    [
      "/admin/vehicles/:id/images",
      { buffer: picture, mimetype: "image/jpeg" },
      {},
      2,
    ],
    [
      "/account/submissions/:id/images",
      { buffer: picture, mimetype: "image/jpeg" },
      {},
      2,
    ],
    [
      "/account/submissions/:id/documents",
      {
        buffer: Buffer.from("%PDF-1.4\nTest only"),
        mimetype: "application/pdf",
      },
      { type: "rc" },
      1,
    ],
  ]) {
    const result = await invoke(mediaRouter, route, "post", { file, body });
    assert.equal(result.error, commitError);
    assert.equal(result.body, undefined);
    const retained = await fs.readdir(storage);
    assert.equal(retained.length, count);
    for (const filename of retained) await fs.rm(path.join(storage, filename));
  }
});
test("a pre-commit document insertion failure still cleans its unreferenced file", async () => {
  execute = async (sql) => {
    if (sql.startsWith("SELECT * FROM nw_submissions"))
      return [{ id: 1, status: "draft", data: vehicle.data }];
    throw new Error("Insert failed before commit");
  };
  const result = await invoke(
    mediaRouter,
    "/account/submissions/:id/documents",
    "post",
    {
      file: {
        buffer: Buffer.from("%PDF-1.4\nTest only"),
        mimetype: "application/pdf",
      },
      body: { type: "rc" },
    },
  );
  assert.match(result.error.message, /Insert failed before commit/);
  assert.deepEqual(await fs.readdir(storage), []);
});
test("seller/admin uploads append after gaps and compact orders at the edit limit", async () => {
  const picture = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#244d70" },
  })
    .jpeg()
    .toBuffer();
  const inserts = [],
    reordered = [];
  let nextOrder = 6;
  const fallback = execute;
  execute = async (sql, values) => {
    if (sql.startsWith("SELECT * FROM nw_submissions"))
      return [{ id: 1, status: "draft", data: vehicle.data }];
    if (sql.startsWith("SELECT COUNT")) {
      assert.match(sql, /MAX\(sort_order\)/);
      return [{ total: 2, next_order: nextOrder }];
    }
    if (sql.startsWith("SELECT id FROM nw_images"))
      return [{ id: 7 }, { id: 8 }];
    if (sql.startsWith("UPDATE nw_images SET sort_order"))
      reordered.push(values);
    if (sql.startsWith("INSERT INTO nw_images")) inserts.push(values.at(-1));
    return fallback(sql, values);
  };
  for (nextOrder of [6, 101]) {
    for (const route of [
      "/admin/vehicles/:id/images",
      "/account/submissions/:id/images",
    ]) {
      const result = await invoke(mediaRouter, route, "post", {
        file: { buffer: picture, mimetype: "image/jpeg" },
      });
      assert.equal(result.status, 201);
    }
  }
  assert.deepEqual(inserts, [6, 6, 2, 2]);
  assert.deepEqual(reordered, [
    [0, 7, 1],
    [1, 8, 1],
    [0, 7, 1],
    [1, 8, 1],
  ]);
  for (const filename of await fs.readdir(storage))
    await fs.rm(path.join(storage, filename));
});
test("a thumbnail write failure cleans up the partially saved photo", async (t) => {
  const picture = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#244d70" },
  })
    .jpeg()
    .toBuffer();
  const writeFile = fs.writeFile;
  t.mock.method(fs, "writeFile", async (filename, ...args) => {
    if (filename.endsWith(".thumb.webp"))
      throw new Error("Simulated disk failure");
    return writeFile(filename, ...args);
  });
  const result = await invoke(
    mediaRouter,
    "/admin/vehicles/:id/images",
    "post",
    { file: { buffer: picture, mimetype: "image/jpeg" } },
  );
  assert.match(result.error.message, /disk failure/);
  assert.deepEqual(await fs.readdir(storage), []);
});
test("lead references select by numeric ID without interpolating user input", async () => {
  const queries = [];
  execute = async (sql, values) => {
    queries.push({ sql, values });
    return sql.startsWith("SELECT COUNT") ? [{ total: 0 }] : [];
  };
  await invoke(adminRouter, "/leads", "get", { query: { q: "NCR-42" } });
  assert.ok(
    queries.every((q) => q.sql.includes("id=?") && q.values[0] === "42"),
  );
  assert.ok(queries.every((q) => !q.sql.includes("NCR-42")));
});
test("publishing queue exposes specifications and photos without seller identity or documents", async () => {
  execute = async (sql) => {
    if (sql.startsWith("SELECT COUNT")) return [{ total: 1 }];
    if (sql.startsWith("SELECT s.id"))
      return [
        {
          id: 1,
          type: "passenger",
          status: "approved",
          data: vehicle.data,
          vehicle_id: null,
          inventory_approved: null,
        },
      ];
    if (sql.startsWith("SELECT id,alt_text"))
      return [{ id: 2, alt_text: "Photo", sort_order: 0 }];
    throw new Error("Unexpected query");
  };
  const result = await invoke(adminRouter, "/publishing", "get");
  assert.equal(result.error, undefined);
  assert.equal(result.body.items[0].data.make, "Test");
  assert.equal(result.body.items[0].images[0].url, "/api/v1/private-images/2");
  assert.doesNotMatch(
    JSON.stringify(result.body),
    /seller_contact|seller_id|documents|storage_key/,
  );
});
test("republishing seller inventory checks its current photos after staff replacement", async () => {
  execute = async (sql, values) => {
    if (sql.startsWith("SELECT * FROM nw_submissions"))
      return [{ ...vehicle, status: "approved" }];
    if (sql.startsWith("SELECT type FROM nw_documents"))
      return ["rc", "ownership_authority", "insurance", "puc"].map((type) => ({
        type,
      }));
    if (sql.startsWith("SELECT id,approved")) return [{ id: 7, approved: 1 }];
    if (sql.startsWith("SELECT COUNT")) {
      assert.ok(sql.includes("vehicle_id=?"));
      assert.equal(values[0], 7);
      return [{ total: 1 }];
    }
    return { affectedRows: 1 };
  };
  const result = await invoke(adminRouter, "/submissions/:id/publish", "post");
  assert.equal(result.error, undefined);
  assert.equal(result.body.id, 7);
});
test("editing sample specifications cannot remove their test-data identity", async () => {
  let saved;
  execute = async (sql, values) => {
    if (sql.startsWith("SELECT * FROM nw_vehicles"))
      return [
        {
          ...vehicle,
          data: {
            ...vehicle.data,
            is_sample: true,
            sample_key: "ncr-wheelz-sample-v1-swift",
          },
        },
      ];
    if (sql.startsWith("UPDATE nw_vehicles SET type"))
      saved = JSON.parse(values[13]);
    return { affectedRows: 1 };
  };
  const result = await invoke(adminRouter, "/vehicles/:id", "patch", {
    body: { ...vehicle.data, price: 500000 },
  });
  assert.equal(result.error, undefined);
  assert.equal(saved.is_sample, true);
  assert.equal(saved.sample_key, "ncr-wheelz-sample-v1-swift");
  assert.equal(saved.price, 500000);
});
test("invalid maps URLs return validation errors rather than server exceptions", async () => {
  const result = await invoke(adminRouter, "/settings", "put", {
    body: {
      business_name: "Test",
      email: "",
      phone: "",
      whatsapp: "",
      address: "",
      about: "Test",
      home_headline: "Test",
      map_embed: "javascript:alert(1)",
    },
  });
  assert.equal(result.error.name, "ZodError");
});
test("anonymous refresh attempts do not exhaust credential limits or another account's allowance", async () => {
  const limiter = (path) =>
    authRouter.stack.find((layer) => layer.route?.path === path).route.stack[0]
      .handle;
  async function check(middleware, email, cookies = {}) {
    let status = 200,
      error;
    const req = {
      ip: "192.0.2.33",
      headers: {},
      app: { get: () => false },
      body: { email },
      cookies,
    };
    const res = {
      setHeader() {},
      append() {},
      status(code) {
        status = code;
        return this;
      },
      send() {},
    };
    await middleware(req, res, (err) => {
      error = err;
    });
    assert.equal(error, undefined);
    return { status, used: req.rateLimit?.used };
  }
  for (let i = 0; i < 25; i++)
    assert.equal((await check(limiter("/refresh"), "", {})).used, undefined);
  assert.equal((await check(limiter("/login"), "first@example.test")).used, 1);
  for (let i = 0; i < 20; i++)
    await check(limiter("/login"), "first@example.test");
  assert.equal(
    (await check(limiter("/login"), "first@example.test")).status,
    429,
  );
  assert.equal(
    (await check(limiter("/login"), "second@example.test")).status,
    200,
  );
  assert.equal(
    (await check(limiter("/refresh"), "", { nw_refresh: "test" })).used,
    1,
  );
});
test("phone validation rejects punctuation and bad digit counts while allowing formatted numbers", () => {
  const { phone } = require("../src/lib/core");
  for (const value of [
    "(())----",
    "1234567-",
    "+1234567890123456",
    "letters123456789",
  ])
    assert.equal(phone.safeParse(value).success, false, value);
  for (const value of ["9999999999", "+91 (99999) 99999", "12345678"])
    assert.equal(phone.safeParse(value).success, true, value);
});
test("optional auth distinguishes visitors from refreshable sessions before persisting an enquiry", async () => {
  const { optional } = require("../src/middleware/auth");
  let error,
    calls = 0;
  await optional({ cookies: {} }, {}, (err) => {
    error = err;
    calls++;
  });
  assert.equal(calls, 1);
  assert.equal(error, undefined);
  await optional({ cookies: { nw_refresh: "existing-session" } }, {}, (err) => {
    error = err;
  });
  assert.equal(error.status, 401);
  assert.equal(error.code, "SESSION_EXPIRED");
});
test("enquiries and appointments require explicit current consent and persist its revision", async () => {
  for (const [router, path, body] of [
    [publicRouter, "/enquiries", contact],
    [
      accountRouter,
      "/test-drives",
      {
        ...contact,
        vehicle_id: 1,
        preferred_at: new Date(Date.now() + 86400000).toISOString(),
      },
    ],
  ]) {
    let writes = [];
    const fallback = execute;
    execute = async (sql, values) => {
      if (
        sql.startsWith("INSERT INTO nw_leads") ||
        sql.startsWith("INSERT INTO nw_test_drives")
      )
        writes.push({ sql, values });
      return fallback(sql, values);
    };
    for (const invalid of [
      { ...body, consent: false },
      { ...body, consent: undefined },
      { ...body, consent_version: "old-policy" },
    ]) {
      const result = await invoke(router, path, "post", { body: invalid });
      assert.equal(result.error.name, "ZodError");
    }
    assert.equal(writes.length, 0);
    const result = await invoke(router, path, "post", { body });
    assert.equal(result.status, 201);
    assert.match(writes[0].sql, /consent_at,consent_version/);
    assert.match(writes[0].sql, /UTC_TIMESTAMP\(\)/);
    assert.equal(writes[0].values.at(-1), "contact-2026-10-21");
    execute = fallback;
  }
});
test("inventory approval requires the inspected specification and photo version", async () => {
  const { inventoryVersion } = require("../src/lib/inventory-version");
  const photos = [
    { id: 8, storage_key: "original.webp", alt_text: "Side", sort_order: 0 },
  ];
  const expected_version = inventoryVersion(vehicle, photos);
  let current = vehicle,
    currentPhotos = photos,
    approvals = 0;
  execute = async (sql) => {
    if (sql.startsWith("SELECT * FROM nw_vehicles")) return [current];
    if (sql.startsWith("SELECT id,storage_key")) return currentPhotos;
    if (sql.startsWith("UPDATE nw_vehicles SET approved=TRUE")) approvals++;
    return { affectedRows: 1 };
  };
  assert.equal(
    (await invoke(adminRouter, "/vehicles/:id/approve", "post", { body: {} }))
      .error.name,
    "ZodError",
  );
  current = { ...vehicle, data: { ...vehicle.data, price: 123456 } };
  assert.equal(
    (
      await invoke(adminRouter, "/vehicles/:id/approve", "post", {
        body: { expected_version },
      })
    ).status,
    409,
  );
  current = vehicle;
  currentPhotos = [{ ...photos[0], storage_key: "replacement.webp" }];
  assert.equal(
    (
      await invoke(adminRouter, "/vehicles/:id/approve", "post", {
        body: { expected_version },
      })
    ).status,
    409,
  );
  currentPhotos = [{ ...photos[0], sort_order: 1 }];
  assert.equal(
    (
      await invoke(adminRouter, "/vehicles/:id/approve", "post", {
        body: { expected_version },
      })
    ).status,
    409,
  );
  assert.equal(approvals, 0);
  currentPhotos = photos;
  assert.equal(
    (
      await invoke(adminRouter, "/vehicles/:id/approve", "post", {
        body: { expected_version },
      })
    ).status,
    200,
  );
  assert.equal(approvals, 1);
});
test("seller photo reorder normalizes gaps and rejects stale or foreign photo sets", async () => {
  const photos = [
    { id: 10, sort_order: 0 },
    { id: 11, sort_order: 3 },
    { id: 12, sort_order: 4 },
    { id: 13, sort_order: 5 },
  ];
  const writes = [];
  execute = async (sql, values) => {
    if (sql.startsWith("SELECT * FROM nw_submissions")) {
      assert.match(sql, /FOR UPDATE/);
      return [{ id: 1, status: "draft" }];
    }
    if (sql.startsWith("SELECT id FROM nw_images")) return photos;
    if (sql.startsWith("UPDATE nw_images")) writes.push(values);
    return { affectedRows: 1 };
  };
  const path = "/account/submissions/:id/images/reorder";
  for (const image_ids of [
    [10, 11, 13],
    [10, 11, 13, 99],
    [10, 11, 13, 13],
  ]) {
    const result = await invoke(mediaRouter, path, "patch", {
      body: { image_ids },
    });
    assert.ok(result.error);
    assert.equal(writes.length, 0);
  }
  const result = await invoke(mediaRouter, path, "patch", {
    body: { image_ids: [10, 11, 13, 12] },
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(writes, [
    [0, 10, 1],
    [1, 11, 1],
    [2, 13, 1],
    [3, 12, 1],
  ]);
  commitError = new Error("Simulated rollback");
  const failure = await invoke(mediaRouter, path, "patch", {
    body: { image_ids: [10, 11, 13, 12] },
  });
  assert.equal(failure.body, undefined);
  assert.equal(failure.error, commitError);
});
test("seller submission views use current inventory photos and safe document upload metadata", async () => {
  const { submissionView } = require("../src/routes/account");
  execute = async (sql, values) => {
    if (sql.startsWith("SELECT id,type")) {
      assert.match(sql, /mime,created_at,uploaded_at/);
      return [
        {
          id: 4,
          type: "rc",
          created_at: "2020-01-01",
          uploaded_at: "2026-10-21",
          mime: "application/pdf",
        },
      ];
    }
    if (sql.startsWith("SELECT id,slug"))
      return [{ id: 7, status: "published" }];
    if (sql.startsWith("SELECT id,alt_text")) {
      assert.match(sql, /vehicle_id=\?/);
      assert.equal(values[0], 7);
      return [{ id: 9, alt_text: "Replacement photo", sort_order: 0 }];
    }
    return [];
  };
  const result = await submissionView({ id: 1, type: "passenger" });
  assert.equal(result.images[0].url, "/api/v1/private-images/9");
  assert.equal(result.documents[0].uploaded_at, "2026-10-21");
  assert.doesNotMatch(JSON.stringify(result), /storage_key/);
});
after(async () => {
  await db.pool.end();
  await fs.rm(storage, { recursive: true, force: true });
});
test("only the website's own server-side reads skip the shared API rate limit", () => {
  const { internalRead } = require("../src/app");
  const request = (method, address, forwarded) => ({
    method,
    socket: { remoteAddress: address },
    headers: forwarded ? { "x-forwarded-for": forwarded } : {},
  });
  // Server-side rendering reads the API directly over loopback.
  assert.equal(internalRead(request("GET", "127.0.0.1")), true);
  assert.equal(internalRead(request("HEAD", "::1")), true);
  assert.equal(internalRead(request("GET", "::ffff:127.0.0.1")), true);
  // Browser calls arrive through the Next.js rewrite with a forwarded address.
  assert.equal(internalRead(request("GET", "127.0.0.1", "203.0.113.9")), false);
  // Writes and non-loopback sockets are always counted.
  assert.equal(internalRead(request("POST", "127.0.0.1")), false);
  assert.equal(internalRead(request("GET", "203.0.113.9")), false);
});
