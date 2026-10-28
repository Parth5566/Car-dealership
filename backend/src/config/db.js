const mysql = require("mysql2/promise");
const env = require("./env");
const pool = mysql.createPool(env.db);
// Pin server-side DATETIME defaults and comparisons to UTC on every connection.
pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});
const query = async (sql, values = [], db = pool) =>
  (await db.execute(sql, values))[0];
async function transaction(work) {
  const conn = await pool.getConnection();
  let commitAttempted = false;
  let discardConnection = false;
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    commitAttempted = true;
    await conn.commit();
    return result;
  } catch (error) {
    if (commitAttempted) {
      error.commitOutcomeUnknown = true;
      console.error(
        JSON.stringify({
          event: "transaction_commit_outcome_unknown",
          code: error.code || error.name,
        }),
      );
    }
    try {
      await conn.rollback();
    } catch (rollbackError) {
      discardConnection = true;
      console.error(
        JSON.stringify({
          event: "transaction_rollback_failed",
          code: rollbackError.code || rollbackError.name,
        }),
      );
    }
    throw error;
  } finally {
    if (discardConnection) conn.destroy();
    else conn.release();
  }
}
module.exports = { pool, query, transaction };
