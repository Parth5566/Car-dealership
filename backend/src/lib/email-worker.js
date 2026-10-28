const crypto = require("node:crypto");
const { pool, query } = require("../config/db");
const env = require("../config/env");
const { createMailTransport } = require("./mail-transport");

// Never persist/log SMTP responses, message contents or credentials.
function errorCode(error) {
  return [
    "EAUTH",
    "ECONNECTION",
    "ETIMEDOUT",
    "EDNS",
    "ESOCKET",
    "ETLS",
    "EENVELOPE",
    "EMESSAGE",
    "EREJECTED",
    "ER_NO_SUCH_TABLE",
    "ER_ACCESS_DENIED_ERROR",
    "EPERM",
    "ENOTFOUND",
    "ECONNREFUSED",
    "EMAIL_NOT_CONFIGURED",
    "EMAIL_DEPENDENCY_MISSING",
  ].includes(error?.code)
    ? error.code
    : "EMAIL_DELIVERY_FAILED";
}
const retrySeconds = (attempt) =>
  Math.min(21600, 60 * 5 ** Math.max(0, attempt - 1));
function createEmailWorker({
  database = pool,
  execute = query,
  config = env.email,
  makeTransport = () => createMailTransport(config),
  log = (event) => console.error(JSON.stringify(event)),
} = {}) {
  let transport,
    stopped = false,
    running = null,
    timer,
    cooldown = 0,
    lastError = "";
  function report(error) {
    const code = errorCode(error);
    if (code !== lastError) log({ event: "email_delivery_paused", code });
    lastError = code;
  }
  async function batch() {
    if (!config.enabled || stopped || Date.now() < cooldown)
      return { sent: 0, failed: 0 };
    let db,
      held = false;
    const result = { sent: 0, failed: 0 };
    try {
      transport ||= makeTransport();
      db = await database.getConnection();
      const [lock] = await execute(
        "SELECT GET_LOCK(CONCAT(DATABASE(), ':nw_email_delivery'),0) AS acquired",
        [],
        db,
      );
      if (Number(lock.acquired) !== 1) return result;
      held = true;
      const [count] = await execute(
        "SELECT COUNT(*) AS total FROM nw_email_outbox WHERE sent_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)",
        [],
        db,
      );
      let allowance = Math.max(0, config.dailyLimit - Number(count.total));
      // One lock-owning connection serializes senders across API/CLI processes.
      // A ten-minute lease recovers an interrupted send after process failure.
      for (let index = 0; index < 10 && allowance > 0 && !stopped; index++) {
        const [job] = await execute(
          "SELECT * FROM nw_email_outbox WHERE attempts<6 AND ((status='pending' AND available_at<=UTC_TIMESTAMP()) OR (status='sending' AND locked_at<DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))) ORDER BY id LIMIT 1",
          [],
          db,
        );
        if (!job) break;
        const lockToken = crypto.randomUUID();
        await execute(
          "UPDATE nw_email_outbox SET status='sending',locked_at=UTC_TIMESTAMP(),lock_token=?,attempts=attempts+1 WHERE id=?",
          [lockToken, job.id],
          db,
        );
        let deliveryError;
        try {
          const data =
            typeof job.data === "string" ? JSON.parse(job.data) : job.data;
          const info = await transport.sendMail({
            from: { name: "NCR Wheelz", address: config.from },
            to: { address: job.recipient },
            replyTo: { address: data.replyTo },
            subject: data.subject,
            text: data.text,
            html: data.html,
            messageId: `<${job.event_key}@${new URL(env.siteUrl).hostname}>`,
            disableFileAccess: true,
            disableUrlAccess: true,
          });
          if (
            !info.accepted?.some(
              (recipient) =>
                String(recipient).toLowerCase() === job.recipient.toLowerCase(),
            )
          )
            throw Object.assign(new Error("Recipient not accepted"), {
              code: "EREJECTED",
            });
        } catch (error) {
          deliveryError = error;
        }
        if (!deliveryError) {
          // A database failure after SMTP acceptance leaves the lease in place.
          // It must not immediately resend a message whose outcome is uncertain.
          await execute(
            "UPDATE nw_email_outbox SET status='sent',sent_at=UTC_TIMESTAMP(),locked_at=NULL,lock_token=NULL,last_error=NULL WHERE id=? AND lock_token=?",
            [job.id, lockToken],
            db,
          );
          result.sent++;
          allowance--;
          lastError = "";
          continue;
        }
        const code = errorCode(deliveryError);
        const auth = code === "EAUTH";
        const attempts = Number(job.attempts) + 1;
        const status = !auth && attempts >= 6 ? "failed" : "pending";
        await execute(
          "UPDATE nw_email_outbox SET status=?,available_at=TIMESTAMPADD(SECOND,?,UTC_TIMESTAMP()),locked_at=NULL,lock_token=NULL,last_error=?,attempts=attempts-? WHERE id=? AND lock_token=?",
          [
            status,
            auth ? 900 : retrySeconds(attempts),
            code,
            auth ? 1 : 0,
            job.id,
            lockToken,
          ],
          db,
        );
        result.failed++;
        log({
          event: "email_delivery_retry",
          id: job.id,
          kind: job.kind,
          status,
          code,
        });
        if (auth) {
          cooldown = Date.now() + 900000;
          break;
        }
      }
      // Recover jobs interrupted during their final permitted attempt.
      await execute(
        "UPDATE nw_email_outbox SET status='failed',locked_at=NULL,lock_token=NULL,last_error='EMAIL_DELIVERY_UNCERTAIN' WHERE status='sending' AND attempts>=6 AND locked_at<DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)",
        [],
        db,
      );
      return result;
    } catch (error) {
      report(error);
      result.paused = errorCode(error);
      return result;
    } finally {
      let discard = false;
      if (held) {
        try {
          await execute(
            "SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':nw_email_delivery'))",
            [],
            db,
          );
        } catch {
          discard = true;
        }
      }
      if (db) {
        if (discard) db.destroy();
        else db.release();
      }
    }
  }
  function runOnce() {
    if (!running)
      running = batch().finally(() => {
        running = null;
      });
    return running;
  }
  async function poll() {
    await runOnce();
    if (!stopped) {
      timer = setTimeout(poll, 15000);
      timer.unref();
    }
  }
  return {
    runOnce,
    start() {
      if (config.enabled && !timer && !stopped) {
        timer = setTimeout(poll, 1000);
        timer.unref();
      }
    },
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await running;
      transport?.close?.();
    },
  };
}
module.exports = { createEmailWorker, errorCode, retrySeconds };
