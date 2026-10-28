const env = require("../src/config/env");
const { pool, query } = require("../src/config/db");
const { createMailTransport } = require("../src/lib/mail-transport");
const { createEmailWorker, errorCode } = require("../src/lib/email-worker");
const path = require("node:path");

async function main() {
  const action = process.argv[2];
  if (action === "verify" || action === "setup") {
    const config = require("../src/lib/email-config").emailConfig({
      ...process.env,
      EMAIL_NOTIFICATIONS_ENABLED: "true",
    });
    const transport = createMailTransport(config);
    try {
      if (action === "setup") {
        await require("../src/lib/email-setup").setupNotifications({
          file: path.resolve(__dirname, "../.env"),
          transport,
          migrate: require("./database").migrate,
        });
        console.log(
          "Email queue is ready and notifications are enabled. Restart npm run dev (or the production API process).",
        );
      } else await transport.verify();
      console.log(
        JSON.stringify(
          {
            smtp: "authenticated",
            from: env.email.from,
            recipients: env.email.recipients,
            test_message_sent: false,
          },
          null,
          2,
        ),
      );
    } finally {
      transport.close?.();
    }
  } else if (action === "status") {
    console.table(
      await query(
        "SELECT status,COUNT(*) AS total FROM nw_email_outbox GROUP BY status",
      ),
    );
    console.table(
      await query(
        "SELECT id,kind,entity_id,attempts,last_error FROM nw_email_outbox WHERE status='failed' OR last_error IS NOT NULL ORDER BY id DESC LIMIT 20",
      ),
    );
  } else if (action === "retry") {
    const id = Number(process.argv[3]);
    if (!Number.isSafeInteger(id) || id < 1)
      throw Object.assign(
        new Error("Pass a failed queue ID: npm run email:retry -- 123"),
        { code: "EMAIL_QUEUE_ID_REQUIRED" },
      );
    const result = await query(
      "UPDATE nw_email_outbox SET status='pending',attempts=0,available_at=UTC_TIMESTAMP(),locked_at=NULL,lock_token=NULL,last_error=NULL WHERE id=? AND status='failed'",
      [id],
    );
    console.log(JSON.stringify({ requeued: result.affectedRows, id }));
  } else if (action === "drain") {
    if (!env.email.enabled)
      throw Object.assign(new Error("Set EMAIL_NOTIFICATIONS_ENABLED=true"), {
        code: "EMAIL_DISABLED",
      });
    const worker = createEmailWorker();
    try {
      const result = await worker.runOnce();
      console.log(JSON.stringify(result));
      if (result.paused || result.failed) process.exitCode = 1;
    } finally {
      await worker.stop();
    }
  } else
    throw Object.assign(
      new Error("Choose setup, verify, status, retry or drain"),
      { code: "EMAIL_ACTION_REQUIRED" },
    );
}
main()
  .catch((error) => {
    // Error text from SMTP may contain recipient addresses or provider diagnostics.
    const code = [
      "EMAIL_QUEUE_ID_REQUIRED",
      "EMAIL_DISABLED",
      "EMAIL_ACTION_REQUIRED",
    ].includes(error.code)
      ? error.code
      : errorCode(error);
    console.error(JSON.stringify({ email: "failed", code }));
    if (code === "EMAIL_DEPENDENCY_MISSING")
      console.error("Run npm --prefix backend install");
    if (code === "EMAIL_NOT_CONFIGURED")
      console.error("Save SMTP_PASS in backend/.env");
    if (code === "ER_NO_SUCH_TABLE") console.error("Run npm run db:migrate");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
