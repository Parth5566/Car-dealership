const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
// Replace the database query before the module captures it; no MySQL is used.
const db = require("../src/config/db");
const rows = new Map([
  [7, { id: 7, slug: "2019-kia-sonet", data: "{}" }],
  [9, { id: 9, slug: "sample-car", data: '{"is_sample":true}' }],
]);
db.query = async (sql, [id]) => (rows.has(id) ? [rows.get(id)] : []);
const { submit, notifyListing, listingUrl } = require("../src/lib/indexnow");
const enabled = {
  enabled: true,
  key: "ncr-wheelz-key-2026",
  endpoint: "https://indexnow.test/indexnow",
};
function captureFetch(status = 200) {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return new Response(null, { status });
  };
  return calls;
}
test("IndexNow submits canonical listing URLs with a verifiable key location", async () => {
  const calls = captureFetch(202);
  assert.equal(await notifyListing(7, enabled), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, enabled.endpoint);
  assert.deepEqual(calls[0].body, {
    host: "ncrwheelz.com",
    key: enabled.key,
    keyLocation: "https://ncrwheelz.com/indexnow-key.txt",
    urlList: ["https://ncrwheelz.com/vehicles/7/2019-kia-sonet"],
  });
  assert.equal(
    listingUrl({ id: 3, slug: "x" }),
    "https://ncrwheelz.com/vehicles/3/x",
  );
});
test("IndexNow stays silent when disabled and skips samples or missing rows", async () => {
  const calls = captureFetch();
  assert.equal(await notifyListing(7, { ...enabled, enabled: false }), false);
  assert.equal(await notifyListing(9, enabled), false);
  assert.equal(await notifyListing(404, enabled), false);
  assert.equal(await submit([], enabled), false);
  assert.equal(calls.length, 0);
});
test("IndexNow failures never break the staff action and are logged without secrets", async () => {
  captureFetch(403);
  await assert.rejects(submit(["https://ncrwheelz.com/x"], enabled), {
    code: "INDEXNOW_403",
  });
  const logged = [];
  const original = console.error;
  console.error = (line) => logged.push(line);
  try {
    assert.equal(await notifyListing(7, enabled), false);
  } finally {
    console.error = original;
  }
  assert.deepEqual(JSON.parse(logged[0]), {
    event: "indexnow_failed",
    vehicle_id: 7,
    code: "INDEXNOW_403",
  });
  assert.doesNotMatch(logged[0], new RegExp(enabled.key));
});
test("IndexNow is enabled only in production with a valid key", () => {
  const load = (extra) =>
    spawnSync(
      process.execPath,
      [
        "-e",
        "console.log(JSON.stringify(require('./src/config/env').indexNow))",
      ],
      {
        cwd: path.resolve(__dirname, ".."),
        env: {
          ...process.env,
          JWT_SECRET: "x".repeat(64),
          NODE_ENV: "",
          INDEXNOW_KEY: "",
          ...extra,
        },
        encoding: "utf8",
      },
    );
  const parse = (r) => JSON.parse(r.stdout);
  assert.equal(parse(load({ INDEXNOW_KEY: "valid-key-123" })).enabled, false);
  assert.equal(
    parse(load({ INDEXNOW_KEY: "valid-key-123", NODE_ENV: "production" }))
      .enabled,
    true,
  );
  assert.equal(parse(load({ NODE_ENV: "production" })).enabled, false);
  const bad = load({ INDEXNOW_KEY: "short" });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /INDEXNOW_KEY must contain/);
});
