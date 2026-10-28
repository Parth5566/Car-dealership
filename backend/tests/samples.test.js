const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { execFileSync } = require("node:child_process");
const { samples, manageSamples } = require("../src/lib/sample-inventory");
const { pool } = require("../src/config/db");
function database({ failImage = false, failCommit = false } = {}) {
  let vehicles = new Map([
      [
        999,
        {
          id: 999,
          status: "published",
          data: { make: "Existing real inventory" },
        },
      ],
    ]),
    images = [],
    snapshot;
  let nextId = 1;
  const connection = {
    async beginTransaction() {
      snapshot = structuredClone({ vehicles, images });
    },
    async commit() {
      snapshot = undefined;
      if (failCommit) throw new Error("Commit acknowledgement lost");
    },
    async rollback() {
      if (snapshot) {
        vehicles = snapshot.vehicles;
        images = snapshot.images;
      }
    },
    async execute(sql, values = []) {
      if (sql.startsWith("SELECT DATABASE"))
        return [[{ database_name: "sample_test_database" }]];
      if (sql.startsWith("SELECT GET_LOCK")) return [[{ acquired: 1 }]];
      if (sql.startsWith("SELECT RELEASE_LOCK")) return [[{ released: 1 }]];
      if (sql.startsWith("SELECT id,status"))
        return [
          [...vehicles.values()]
            .filter(
              (row) => row.data.sample_key === values[0] && row.data.is_sample,
            )
            .map(({ id, status }) => ({ id, status })),
        ];
      if (sql.startsWith("INSERT INTO nw_vehicles")) {
        const id = nextId++;
        const data = JSON.parse(values[13]);
        vehicles.set(id, { id, data, status: "draft" });
        return [{ insertId: id }];
      }
      if (sql.startsWith("INSERT INTO nw_images")) {
        if (failImage) throw new Error("Simulated image database failure");
        images.push({ vehicle_id: values[0], key: values[1] });
        return [{ insertId: images.length }];
      }
      if (sql.startsWith("UPDATE nw_vehicles SET approved")) {
        vehicles.get(values[1]).status = values[0];
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("UPDATE nw_vehicles SET status='archived'")) {
        vehicles.get(values[0]).status = "archived";
        return [{ affectedRows: 1 }];
      }
      if (
        sql.startsWith("INSERT INTO nw_audit") ||
        sql.startsWith("INSERT INTO nw_history")
      )
        return [{ insertId: 1 }];
      throw new Error("Unexpected sample test query: " + sql);
    },
  };
  return {
    connection,
    get vehicles() {
      return vehicles;
    },
    get images() {
      return images;
    },
  };
}
test("sample importer creates six marked listings with real WebP files, is idempotent and archives only samples", async () => {
  const storage = await fs.mkdtemp(path.join(os.tmpdir(), "ncr-sample-unit-"));
  const state = database();
  try {
    const added = await manageSamples(state.connection, {
      action: "add",
      storage,
    });
    assert.equal(added.added.length, 6);
    assert.equal(
      added.added.filter((row) => row.type === "passenger").length,
      4,
    );
    assert.equal(
      added.added.filter((row) => row.type === "commercial").length,
      2,
    );
    for (const sample of samples.filter(
      (sample) => sample.vehicle.type === "commercial",
    )) {
      assert.ok(["Sedan", "MUV"].includes(sample.vehicle.body_type));
      assert.ok(sample.vehicle.seats >= 5);
      assert.equal(sample.vehicle.payload_kg, undefined);
    }
    assert.equal(state.images.length, 12);
    assert.equal((await fs.readdir(storage)).length, 24);
    assert.ok(
      samples.every(
        (sample) =>
          sample.vehicle.is_sample &&
          sample.vehicle.description.startsWith(
            "SAMPLE VEHICLE FOR WEBSITE TESTING ONLY.",
          ),
      ),
    );
    for (const image of state.images) {
      assert.equal(
        (await sharp(path.join(storage, image.key)).metadata()).format,
        "webp",
      );
    }
    const rerun = await manageSamples(state.connection, {
      action: "add",
      storage,
    });
    assert.equal(rerun.added.length, 0);
    assert.equal(rerun.existing.length, 6);
    assert.equal(state.vehicles.size, 7);
    const archived = await manageSamples(state.connection, {
      action: "archive",
      storage,
    });
    assert.equal(archived.archived.length, 6);
    assert.equal(state.vehicles.get(999).status, "published");
    assert.equal((await fs.readdir(storage)).length, 24);
  } finally {
    await fs.rm(storage, { recursive: true, force: true });
  }
});
test("archival still recognizes legacy truck sample markers without changing real inventory", async () => {
  const state = database();
  state.vehicles.set(1000, {
    id: 1000,
    status: "published",
    data: { is_sample: true, sample_key: "ncr-wheelz-sample-v1-ace" },
  });
  state.vehicles.set(1001, {
    id: 1001,
    status: "published",
    data: { is_sample: true, sample_key: "ncr-wheelz-sample-v1-bolero" },
  });
  const result = await manageSamples(state.connection, {
    action: "archive",
    storage: "unused",
  });
  assert.deepEqual(result.archived, [1000, 1001]);
  assert.equal(state.vehicles.get(999).status, "published");
});
test("sample import failure rolls back its rows and cleans generated original/thumbnail files", async () => {
  const storage = await fs.mkdtemp(
    path.join(os.tmpdir(), "ncr-sample-failure-"),
  );
  const state = database({ failImage: true });
  try {
    await assert.rejects(
      manageSamples(state.connection, { action: "add", storage }),
      /Simulated image database failure/,
    );
    assert.equal(state.vehicles.size, 1);
    assert.deepEqual(await fs.readdir(storage), []);
  } finally {
    await fs.rm(storage, { recursive: true, force: true });
  }
});
test("sample mutations refuse production before accessing the database", async () => {
  await assert.rejects(
    manageSamples({}, { action: "add", storage: "unused", production: true }),
    /disabled in production/,
  );
});
test("an uncertain commit never deletes files that may already be referenced by committed rows", async (t) => {
  const storage = await fs.mkdtemp(
    path.join(os.tmpdir(), "ncr-sample-commit-"),
  );
  const state = database({ failCommit: true });
  const logs = [];
  t.mock.method(console, "error", (message) => logs.push(message));
  try {
    await assert.rejects(
      manageSamples(state.connection, { action: "add", storage }),
      /Commit acknowledgement lost/,
    );
    assert.equal(state.vehicles.size, 7);
    assert.equal((await fs.readdir(storage)).length, 24);
    assert.ok(
      logs.some((message) => message.includes("sample_commit_outcome_unknown")),
    );
  } finally {
    await fs.rm(storage, { recursive: true, force: true });
  }
});
test("production public inventory excludes sample rows", () => {
  const output = execFileSync(
    process.execPath,
    [
      "-e",
      "const {search}=require('./src/routes/public'); console.log(search({}).where); require('./src/config/db').pool.end();",
    ],
    {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        NODE_ENV: "production",
        JWT_SECRET: "sample-test-secret-".repeat(4),
      },
      encoding: "utf8",
    },
  );
  assert.match(output, /JSON_EXTRACT\(data,'\$\.is_sample'\)/);
  assert.match(output, /JSON_UNQUOTE/);
  assert.match(output, /'false'\)='false'/);
});
after(() => pool.end());
