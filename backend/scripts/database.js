const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pool, query } = require("../src/config/db");
const { applyStatement } = require("../src/lib/migrations");
async function migrate() {
  const conn = await pool.getConnection();
  let heldLock = false,
    migrationError;
  try {
    const [[lock]] = await conn.query(
      "SELECT GET_LOCK(CONCAT(DATABASE(), ':nw_migrate'), 10) AS locked",
    );
    if (!lock.locked) throw new Error("Another migration is running");
    heldLock = true;
    await conn.query(
      "CREATE TABLE IF NOT EXISTS nw_migrations (name VARCHAR(100) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB",
    );
    const dir = path.resolve(__dirname, "../../database/migrations");
    for (const name of (await fs.readdir(dir))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = await fs.readFile(path.join(dir, name), "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const [rows] = await conn.execute(
        "SELECT checksum FROM nw_migrations WHERE name=?",
        [name],
      );
      if (rows.length) {
        if (rows[0].checksum !== checksum)
          throw new Error("Applied migration checksum mismatch: " + name);
        continue;
      }
      for (const stmt of sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean))
        await applyStatement(conn, stmt);
      await conn.execute(
        "INSERT INTO nw_migrations(name,checksum) VALUES (?,?)",
        [name, checksum],
      );
      console.log("Applied " + name);
    }
  } catch (error) {
    migrationError = error;
    throw error;
  } finally {
    let destroyed = false;
    try {
      if (heldLock)
        await conn.query(
          "SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':nw_migrate'))",
        );
    } catch (error) {
      destroyed = true;
      conn.destroy();
      console.error(
        JSON.stringify({
          event: "migration_lock_release_failed",
          code: error.code || error.name,
        }),
      );
      if (!migrationError) throw error;
    } finally {
      if (!destroyed) conn.release();
    }
  }
}
if (require.main === module)
  (async () => {
    try {
      if (process.argv[2] === "inspect") {
        console.table(
          await query(
            "SELECT TABLE_NAME,TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()",
          ),
        );
      } else await migrate();
    } catch (e) {
      console.error("Database operation failed:", e.code || e.message);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  })();
module.exports = { migrate };
