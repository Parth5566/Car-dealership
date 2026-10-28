const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
process.env.JWT_SECRET = "isolated-database-regression-secret-".repeat(3);
const db = require("../src/config/db");
const { migrate } = require("../scripts/database");

test("a failed commit acknowledgement stays identifiable even when rollback also fails", async (t) => {
  const failure = new Error("Lost commit acknowledgement");
  let destroyed = false;
  t.mock.method(console, "error", () => {});
  t.mock.method(db.pool, "getConnection", async () => ({
    async beginTransaction() {},
    async commit() {
      throw failure;
    },
    async rollback() {
      throw new Error("Connection already lost");
    },
    release() {
      assert.fail(
        "An uncertain connection must not return to the pool after rollback failure",
      );
    },
    destroy() {
      destroyed = true;
    },
  }));
  await assert.rejects(
    db.transaction(async () => 42),
    (error) => error === failure && error.commitOutcomeUnknown === true,
  );
  assert.equal(destroyed, true);
});
test("work failures remain the original error and are not marked as uncertain commits", async (t) => {
  const failure = new Error("Insert failed");
  t.mock.method(console, "error", () => {});
  t.mock.method(db.pool, "getConnection", async () => ({
    async beginTransaction() {},
    async rollback() {
      throw new Error("Rollback also failed");
    },
    release() {
      assert.fail("A connection with failed rollback must be discarded");
    },
    destroy() {},
  }));
  await assert.rejects(
    db.transaction(async () => {
      throw failure;
    }),
    (error) => error === failure && !error.commitOutcomeUnknown,
  );
});

async function migrationConnection() {
  const columns = new Map(),
    applied = new Map();
  const foundation = await fs.readFile(
    path.resolve(__dirname, "../../database/migrations/001_foundation.sql"),
    "utf8",
  );
  applied.set(
    "001_foundation.sql",
    crypto.createHash("sha256").update(foundation).digest("hex"),
  );
  let failTestDrive = true,
    failRelease = false;
  const calls = [],
    release = [];
  const connection = {
    async execute(sql, values) {
      if (sql.startsWith("SELECT checksum"))
        return [
          applied.has(values[0]) ? [{ checksum: applied.get(values[0]) }] : [],
        ];
      if (sql.startsWith("INSERT INTO nw_migrations")) {
        applied.set(values[0], values[1]);
        return [{}];
      }
      if (sql.includes("information_schema.COLUMNS"))
        return [
          [...columns.entries()]
            .filter(([key]) => key.startsWith(values[0] + "."))
            .map(([key, value]) => ({
              COLUMN_NAME: key.split(".")[1],
              ...value,
            })),
        ];
      throw new Error("Unexpected execute: " + sql);
    },
    async query(sql) {
      calls.push(sql);
      if (sql.includes("GET_LOCK")) return [[{ locked: 1 }]];
      if (sql.includes("RELEASE_LOCK") && failRelease)
        throw new Error("Lost lock connection");
      if (sql.startsWith("ALTER TABLE")) {
        const table = sql.match(/^ALTER TABLE (\w+)/)[1];
        if (table === "nw_test_drives" && failTestDrive) {
          failTestDrive = false;
          throw new Error("Interrupted between ALTER statements");
        }
        const definitions = [
          ...sql.matchAll(/ADD COLUMN (\w+) (DATETIME|VARCHAR\(\d+\)) NULL/gi),
        ];
        for (const [, name, type] of definitions) {
          if (columns.has(table + "." + name))
            throw Object.assign(new Error("Duplicate column"), {
              code: "ER_DUP_FIELDNAME",
            });
          columns.set(table + "." + name, {
            COLUMN_TYPE: type.toLowerCase(),
            IS_NULLABLE: "YES",
            COLUMN_DEFAULT: null,
            EXTRA: "",
          });
        }
      }
      return [[]];
    },
    release() {
      release.push("release");
    },
    destroy() {
      release.push("destroy");
    },
  };
  return {
    connection,
    columns,
    applied,
    calls,
    release,
    failRelease() {
      failRelease = true;
    },
  };
}
test("an interrupted additive migration resumes without duplicate-column failures", async (t) => {
  const state = await migrationConnection();
  t.mock.method(console, "log", () => {});
  t.mock.method(db.pool, "getConnection", async () => state.connection);
  await assert.rejects(migrate(), /Interrupted between ALTER/);
  assert.ok(state.columns.has("nw_leads.consent_at"));
  assert.equal(state.applied.has("002_request_consent.sql"), false);
  await migrate();
  assert.ok(state.columns.has("nw_test_drives.consent_version"));
  assert.ok(state.columns.has("nw_documents.uploaded_at"));
  const migrations = (
    await fs.readdir(path.resolve(__dirname, "../../database/migrations"))
  )
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.deepEqual([...state.applied.keys()].sort(), migrations);
  const changes = state.calls.filter((sql) =>
    sql.startsWith("ALTER TABLE"),
  ).length;
  await migrate();
  assert.equal(
    state.calls.filter((sql) => sql.startsWith("ALTER TABLE")).length,
    changes,
  );
});
test("migration retries reject incompatible existing columns and always dispose of the connection", async (t) => {
  const state = await migrationConnection();
  state.columns.set("nw_leads.consent_at", {
    COLUMN_TYPE: "varchar(20)",
    IS_NULLABLE: "YES",
    COLUMN_DEFAULT: null,
    EXTRA: "",
  });
  state.failRelease();
  t.mock.method(console, "error", () => {});
  t.mock.method(db.pool, "getConnection", async () => state.connection);
  await assert.rejects(migrate(), /incompatible column/i);
  assert.deepEqual(state.release, ["destroy"]);
});
after(async () => {
  await db.pool.end();
});
