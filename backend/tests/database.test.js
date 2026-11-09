const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
process.env.JWT_SECRET = "isolated-database-regression-secret-".repeat(3);
const db = require("../src/config/db");
const { migrate } = require("../scripts/database");
const { databaseOptions } = require("../src/config/database-options");
const {
  databaseDnsDiagnostic,
  proxyDiagnostic,
} = require("../src/lib/deployment-diagnostics");

test("deployment DNS diagnostics identify the configured host without logging secrets", async () => {
  const logs = [];
  const options = {
    host: "mysql.example.com",
    port: 19826,
    database: "defaultdb",
    user: "private-user",
    password: "private-password",
    ssl: { ca: "private-ca" },
  };
  const log = (line) => logs.push(JSON.parse(line));
  await databaseDnsDiagnostic(options, log, async (host, settings) => {
    assert.equal(host, options.host);
    assert.deepEqual(settings, { all: true });
    return [{ address: "192.0.2.1", family: 4 }];
  });
  await databaseDnsDiagnostic(options, log, async () => {
    throw Object.assign(new Error("private-error-message"), {
      code: "ENOTFOUND",
    });
  });
  assert.equal(logs[0].status, "resolved");
  assert.equal(logs[0].address_count, 1);
  assert.equal(logs[1].code, "ENOTFOUND");
  assert.equal(logs[1].host, options.host);
  assert.equal(JSON.stringify(logs).includes("private-"), false);
});

test("proxy diagnostics log only one forwarded connection and do not change trust", () => {
  const logs = [];
  let nextCount = 0;
  const middleware = proxyDiagnostic(
    (ip) => ip === "127.0.0.1",
    (line) => logs.push(JSON.parse(line)),
  );
  const next = () => nextCount++;
  middleware({ headers: {}, socket: { remoteAddress: "127.0.0.1" } }, {}, next);
  const request = {
    headers: {
      "x-forwarded-for": "198.51.100.1, 192.0.2.2",
      cookie: "private-cookie",
    },
    socket: { remoteAddress: "10.0.0.4" },
  };
  middleware(request, {}, next);
  middleware(request, {}, next);
  assert.equal(nextCount, 3);
  assert.deepEqual(logs, [
    {
      event: "proxy_diagnostic",
      peer: "10.0.0.4",
      peer_trusted: false,
      forwarded_entries: 2,
    },
  ]);
  assert.equal(request.headers.cookie, "private-cookie");
});

test("database options normalize copied connection fields without changing passwords", () => {
  const options = databaseOptions({
    DB_HOST: " mysql.example.com\n",
    DB_PORT: " 19826 ",
    DB_USER: " avnadmin ",
    DB_NAME: " car_dealership ",
    DB_PASSWORD: " keep password spaces ",
  });
  assert.equal(options.host, "mysql.example.com");
  assert.equal(options.port, 19826);
  assert.equal(options.user, "avnadmin");
  assert.equal(options.database, "car_dealership");
  assert.equal(options.password, " keep password spaces ");
  assert.equal(options.ssl, undefined);
  assert.equal(databaseOptions({}).host, "127.0.0.1");
  for (const host of [
    "https://mysql.example.com",
    "mysql.example.com:19826",
    "mysql. example.com",
    "mysql.example.com/defaultdb",
  ])
    assert.throws(() => databaseOptions({ DB_HOST: host }), /DB_HOST/);
  assert.throws(() => databaseOptions({ DB_PORT: "wrong" }), /DB_PORT/);
});

test("hosted database TLS validates certificates and hostnames with either CA input", async () => {
  const ca = require("node:tls").rootCertificates[0];
  const directory = await fs.mkdtemp(
    path.join(require("node:os").tmpdir(), "ncr-db-ca-"),
  );
  try {
    const filename = path.join(directory, "ca.pem");
    await fs.writeFile(filename, ca);
    for (const input of [
      { DB_SSL_CA: ca },
      { DB_SSL_CA: ca.replaceAll("\n", "\\n") },
      { DB_SSL_CA_FILE: filename },
    ]) {
      const options = databaseOptions({ DB_SSL: "true", ...input });
      assert.equal(options.ssl.ca.trim(), ca.trim());
      assert.equal(options.ssl.rejectUnauthorized, true);
      assert.equal(options.ssl.verifyIdentity, true);
      assert.equal(options.ssl.minVersion, "TLSv1.2");
    }
    assert.equal(
      databaseOptions({ DB_SSL: "true" }).ssl.rejectUnauthorized,
      true,
    );
    assert.throws(() => databaseOptions({ DB_SSL: "disabled" }), /DB_SSL/);
    assert.throws(() => databaseOptions({ DB_SSL_CA: ca }), /DB_SSL=true/);
    assert.throws(
      () =>
        databaseOptions({
          DB_SSL: "true",
          DB_SSL_CA: ca,
          DB_SSL_CA_FILE: filename,
        }),
      /not both/,
    );
    assert.throws(
      () => databaseOptions({ DB_SSL: "true", DB_SSL_CA: "not a certificate" }),
      /certificate is invalid/,
    );
    assert.throws(
      () =>
        databaseOptions({
          DB_SSL: "true",
          DB_SSL_CA_FILE: path.join(directory, "missing"),
        }),
      /Cannot read DB_SSL_CA_FILE/,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

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
