const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
process.env.JWT_SECRET = "isolated-offer-test-secret-".repeat(4);
const db = require("../src/config/db");
let rows, nextId, writes, commitError;
db.query = async (sql, values = []) => {
  if (sql.startsWith("SELECT * FROM nw_offers WHERE id="))
    return rows.filter((r) => r.id === Number(values[0]));
  if (sql.startsWith("INSERT INTO nw_offers")) {
    const [status, starts_at, expires_at, featured, sort_order, data] = values;
    const row = {
      id: nextId++,
      status,
      starts_at,
      expires_at,
      featured,
      sort_order,
      data,
      version: 1,
      updated_at: "2026-10-25 00:00:00",
    };
    rows.push(row);
    writes.push(sql);
    return { insertId: row.id };
  }
  if (sql.startsWith("UPDATE nw_offers")) {
    const row = rows.find((r) => r.id === values.at(-1));
    if (sql.includes("data=?")) {
      const [status, starts_at, expires_at, featured, sort_order, data] =
        values;
      Object.assign(row, {
        status,
        starts_at,
        expires_at,
        featured,
        sort_order,
        data,
      });
    } else row.status = values[0];
    row.version++;
    writes.push(sql);
    return { affectedRows: 1 };
  }
  if (sql.startsWith("DELETE FROM nw_offers")) {
    rows = rows.filter((r) => r.id !== values[0]);
    writes.push(sql);
    return { affectedRows: 1 };
  }
  if (sql.startsWith("INSERT INTO nw_audit")) {
    writes.push({ audit: values });
    return { insertId: 1 };
  }
  throw new Error("Unexpected SQL: " + sql);
};
db.transaction = async (work) => {
  const snapshot = structuredClone(rows);
  try {
    const result = await work({});
    if (commitError) throw commitError;
    return result;
  } catch (e) {
    rows = snapshot;
    throw e;
  }
};
const { router } = require("../src/routes/offers");
const { offerSchema, offerView } = require("../src/lib/offers");
const { allow } = require("../src/middleware/auth");
const offer = {
  title: "Fixture campaign",
  benefit: "₹10,000 off",
  description: "Temporary campaign",
  eligibility: "Selected test vehicles",
  terms: "Test terms only",
  starts_at: "2090-01-01T10:00:00+05:30",
  expires_at: "2090-01-08T10:00:00+05:30",
};
beforeEach(() => {
  rows = [];
  nextId = 1;
  writes = [];
  commitError = null;
});
async function invoke(path, method, body = {}, identifier = "1") {
  const route = router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
  ).route;
  let result,
    error,
    status = 200;
  await route.stack.at(-1).handle(
    { body, params: { id: identifier }, user: { id: 1, role: "admin" } },
    {
      status(value) {
        status = value;
        return this;
      },
      json(value) {
        result = value;
        return this;
      },
    },
    (e) => {
      error = e;
    },
  );
  return { body: result, error, status: error?.status || status };
}
test("offers remain drafts until an explicit publish, preserve design and normalize scheduled times", async () => {
  const created = await invoke("/", "post", {
    ...offer,
    theme: "midnight",
    pattern: "rings",
    featured: true,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.status, "draft");
  assert.equal(created.body.starts_at, "2090-01-01T04:30:00.000Z");
  assert.equal(created.body.theme, "midnight");
  const published = await invoke("/:id/status", "patch", {
    version: 1,
    status: "published",
  });
  assert.equal(published.error, undefined);
  assert.equal(published.body.status, "published");
  assert.equal(published.body.version, 2);
  assert.equal(published.body.featured, true);
  const publicData = offerView(rows[0]);
  for (const key of ["status", "version", "updated_at", "data"])
    assert.equal(key in publicData, false);
  assert.equal(publicData.pattern, "rings");
  const paused = await invoke("/:id/status", "patch", {
    version: 2,
    status: "draft",
  });
  assert.equal(paused.body.status, "draft");
  assert.ok(writes.some((w) => w.audit?.[1] === "offer.publish"));
  assert.ok(writes.some((w) => w.audit?.[1] === "offer.unpublish"));
});
test("incomplete drafts can be saved but cannot be published; invalid schedules and styling are rejected", async () => {
  assert.equal((await invoke("/:id", "put", null)).error?.name, "ZodError");
  const draft = await invoke("/", "post", { title: "Work in progress" });
  assert.equal(draft.status, 201);
  const publish = await invoke("/:id/status", "patch", {
    version: 1,
    status: "published",
  });
  assert.equal(publish.error?.name, "ZodError");
  assert.equal(rows[0].status, "draft");
  for (const body of [
    { ...offer, expires_at: offer.starts_at },
    { ...offer, starts_at: "2090-01-01T10:00:00" },
    { ...offer, theme: "custom-css" },
    { ...offer, cta_href: "https://example.test" },
    { ...offer, coupon_code: "<script>" },
    { ...offer, unexpected: "field" },
  ])
    assert.equal(offerSchema.safeParse(body).success, false);
  const expired = await invoke("/", "post", {
    ...offer,
    status: "published",
    starts_at: "2020-01-01T00:00:00Z",
    expires_at: "2020-01-02T00:00:00Z",
  });
  assert.equal(expired.status, 422);
});
test("stale updates, publication and removal cannot overwrite a newer offer", async () => {
  await invoke("/", "post", offer);
  const updated = await invoke("/:id", "put", {
    ...offer,
    version: 1,
    title: "Updated campaign",
  });
  assert.equal(updated.body.version, 2);
  const before = writes.length;
  for (const [path, method, body] of [
    ["/:id", "put", { ...offer, version: 1 }],
    ["/:id/status", "patch", { version: 1, status: "published" }],
    ["/:id", "delete", { version: 1 }],
  ]) {
    const result = await invoke(path, method, body);
    assert.equal(result.status, 409);
    assert.equal(result.error.code, "STALE_OFFER");
  }
  assert.equal(writes.length, before);
  assert.equal(rows[0].version, 2);
  assert.equal((await invoke("/:id", "delete", { version: 2 })).status, 200);
  assert.equal(rows.length, 0);
  assert.ok(writes.some((w) => w.audit?.[1] === "offer.delete"));
  assert.equal((await invoke("/:id", "delete", { version: 2 })).status, 404);
});
test("offer mutations do not report success when the transaction fails to commit", async () => {
  commitError = new Error("Commit failed");
  const result = await invoke("/", "post", offer);
  assert.equal(result.error, commitError);
  assert.equal(result.body, undefined);
  assert.equal(rows.length, 0);
});
test("offer management uses the admin settings permission", () => {
  for (const role of ["customer", "sales", "reviewer", "admin"]) {
    let error;
    allow("settings")({ user: { role } }, {}, (e) => {
      error = e;
    });
    assert.equal(error?.status, role === "admin" ? undefined : 403);
  }
});
after(async () => {
  await db.pool.end();
});
