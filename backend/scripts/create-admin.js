const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const bcrypt = require("bcryptjs");
const { pool, query, transaction } = require("../src/config/db");
const { email, text } = require("../src/lib/core");
const { audit } = require("../src/lib/store");
const crypto = require("node:crypto");
(async () => {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const name = text(100).parse(await rl.question("Admin name: "));
    const address = email.parse(await rl.question("Admin email: "));
    const password = crypto.randomBytes(20).toString("base64url");
    const digest = await bcrypt.hash(password, 12);
    await transaction(async (db) => {
      const [count] = await query(
        "SELECT COUNT(*) AS total FROM nw_users WHERE role='admin' AND active=TRUE",
        [],
        db,
      );
      if (count.total)
        throw new Error(
          "An admin already exists. Create additional staff through the protected admin portal.",
        );
      const r = await query(
        "INSERT INTO nw_users(name,email,password_hash,role,consent_at) VALUES (?,?,?,'admin',UTC_TIMESTAMP())",
        [name, address, digest],
        db,
      );
      await audit(
        r.insertId,
        "user.bootstrap_admin",
        "user",
        r.insertId,
        {},
        db,
      );
    });
    console.log(
      "Admin created. Save this generated password in your password manager:\n" +
        password,
    );
  } catch (e) {
    console.error("Admin creation failed:", e.code || e.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
})();
