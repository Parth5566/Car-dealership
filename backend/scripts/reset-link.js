// Trusted local operator recovery only. Never expose this script as an HTTP endpoint.
const readline = require("node:readline/promises");
const { pool, query, transaction } = require("../src/config/db");
const { email } = require("../src/lib/core");
const { audit } = require("../src/lib/store");
const { createReset } = require("../src/routes/auth");
(async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const address = email.parse(
      await rl.question(
        "Account email (verify the requester independently first): ",
      ),
    );
    const [user] = await query(
      "SELECT * FROM nw_users WHERE email=? AND active=TRUE",
      [address],
    );
    if (!user) throw new Error("Eligible account not found");
    const link = await transaction(async (db) => {
      const url = await createReset(user, db);
      await audit(null, "auth.operator_reset", "user", user.id, {}, db);
      return url;
    });
    console.log(
      "Private single-use link, valid 30 minutes. Deliver securely to the verified account owner:\n" +
        link,
    );
  } catch (e) {
    console.error(e.code || e.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
})();
