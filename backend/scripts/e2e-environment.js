// Isolated local browser QA server. Creates and cleans up ONLY its own random database.
const mysql = require("mysql2/promise");
process.env.SCRAPPA_ENABLED = "false";
process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
const net = require("node:net");
async function assertFreePort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { startQaWeb } = require("./qa-web");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const dbName = "ncrwheelz_e2e_" + crypto.randomBytes(8).toString("hex");
const credentials = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};
process.env.DB_NAME = dbName;
process.env.STORAGE_DIR = path.join(os.tmpdir(), dbName);
process.env.PORT = "5101";
process.env.APP_ORIGIN = "http://localhost:3100";
process.env.JWT_SECRET = crypto.randomBytes(64).toString("hex");
let root, server, web, pool, webRoot;
let databaseCreated = false;
let stopping = false;
async function cleanup(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (web?.pid && web.exitCode === null && web.signalCode === null) {
    const exited = new Promise((resolve) => web.once("exit", resolve));
    web.kill("SIGTERM");
    await exited;
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  if (root && databaseCreated) {
    if (!/^ncrwheelz_e2e_[a-f0-9]{16}$/.test(dbName))
      throw new Error("Unsafe database name");
    await root.query("DROP DATABASE `" + dbName + "`");
    await root.end();
  }
  if (root && !databaseCreated) await root.end();
  await fs.rm(process.env.STORAGE_DIR, { recursive: true, force: true });
  if (webRoot) await fs.rm(webRoot, { recursive: true, force: true });
  console.log("Removed isolated browser QA data.");
  process.exit(typeof exitCode === "number" ? exitCode : 0);
}
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, cleanup);
(async () => {
  await assertFreePort(3100);
  await assertFreePort(5101);
  root = await mysql.createConnection(credentials);
  await root.query("CREATE DATABASE `" + dbName + "` CHARACTER SET utf8mb4");
  databaseCreated = true;
  ({ pool } = require("../src/config/db"));
  await require("./database").migrate();
  const { query } = require("../src/config/db");
  const bcrypt = require("bcryptjs");
  for (const role of ["admin", "reviewer", "sales"])
    await query(
      "INSERT INTO nw_users(name,email,phone,password_hash,role,consent_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP())",
      [
        "QA " + role,
        role + "@example.test",
        "9999999999",
        await bcrypt.hash("browser-qa-password-123", 12),
        role,
      ],
    );
  const sharp = require("sharp");
  const { saveVehicle } = require("../src/routes/admin");
  const v = {
    type: "passenger",
    make: "QA FIXTURE",
    model: "Passenger",
    variant: "Test only",
    year: 2024,
    price: 600000,
    mileage: 12000,
    fuel: "Petrol",
    transmission: "Manual",
    location: "Delhi NCR (test)",
    body_type: "Hatchback",
    owners: 1,
    description:
      "Clearly labelled browser QA fixture. This is not a real listing.",
    features: ["QA sample feature"],
    featured: true,
    seo_title: "",
    seo_description: "",
  };
  await fs.mkdir(process.env.STORAGE_DIR, { recursive: true, mode: 0o700 });
  for (const [index, type] of [
    "passenger",
    "commercial",
    "passenger",
    "passenger",
  ].entries()) {
    const data = {
      ...v,
      type,
      model:
        type === "commercial"
          ? "Commercial"
          : index === 0
            ? "Passenger"
            : `Passenger ${index}`,
      price: v.price + index * 100000,
      year: v.year - index,
      body_type: type === "passenger" ? "Hatchback" : "Sedan",
      payload_kg: null,
    };
    const id = await saveVehicle(data);
    await query(
      "UPDATE nw_vehicles SET approved=TRUE,status='published' WHERE id=?",
      [id],
    );
    const key = crypto.randomUUID() + ".webp";
    await sharp({
      create: {
        width: 800,
        height: 500,
        channels: 3,
        background: type === "passenger" ? "#244d70" : "#d6a85a",
      },
    })
      .webp()
      .toFile(path.join(process.env.STORAGE_DIR, key));
    await query(
      "INSERT INTO nw_images(vehicle_id,storage_key,alt_text) VALUES (?,?,?)",
      [id, key, "QA fixture colour panel; not a vehicle photo"],
    );
  }
  const { app } = require("../src/app");
  server = app.listen(5101, "127.0.0.1");
  // Next writes next-env.d.ts and generated route types during startup. Give QA
  // its own source snapshot so it cannot rewrite the developer's project files.
  const frontendRoot = path.resolve(__dirname, "../../frontend");
  webRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ncrwheelz-qa-web-"));
  for (const entry of [
    "app",
    "components",
    "lib",
    "public",
    "package.json",
    "tsconfig.json",
    "next.config.mjs",
    "postcss.config.mjs",
    "proxy.ts",
  ]) {
    await fs.cp(path.join(frontendRoot, entry), path.join(webRoot, entry), {
      recursive: true,
    });
  }
  await fs.symlink(
    path.join(frontendRoot, "node_modules"),
    path.join(webRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await startQaWeb({
    cwd: webRoot,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !/^(DB_|JWT_|RESET_|STORAGE_DIR|DOCUMENT_)/.test(key),
        ),
      ),
      API_URL: "http://127.0.0.1:5101",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
      NEXT_DIST_DIR: ".next",
    },
    production: process.argv.includes("--production"),
    onChild(child) {
      web = child;
    },
    isStopping: () => stopping,
    onFailure(error) {
      if (!stopping) {
        console.error(error.code || error.message);
        void cleanup(1);
      }
    },
  });
  console.log(
    "ISOLATED QA: http://localhost:3100; fixture staff admin@example.test / browser-qa-password-123. Never production credentials.",
  );
})().catch(async (e) => {
  console.error(e.code || e.message);
  await cleanup(1);
});
