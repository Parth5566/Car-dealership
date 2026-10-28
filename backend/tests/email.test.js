const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
process.env.SMTP_PASS = "test-only-password";
process.env.SMTP_USER = "ncrwheelz@gmail.com";
process.env.SMTP_FROM = "ncrwheelz@gmail.com";
process.env.EMAIL_RECIPIENTS =
  "ncrwheelz@gmail.com,shivamchaudhary2667@gmail.com";
const db = require("../src/config/db");
const env = require("../src/config/env");
const { emailConfig } = require("../src/lib/email-config");
const { createMailTransport } = require("../src/lib/mail-transport");
const { createEmailWorker, errorCode } = require("../src/lib/email-worker");
const queued = [];
db.query = async (...args) => {
  queued.push(args);
  return { affectedRows: 1 };
};
const {
  messages,
  enqueueNotification,
  acknowledgement,
} = require("../src/lib/notifications");
const event = {
  kind: "contact",
  id: 42,
  contact: {
    name: '<img src=x onerror="alert(1)">',
    email: "customer@example.test",
    phone: "9999999999",
  },
  message: "<script>alert('unsafe')</script>",
  source: "/contact",
};

test("email configuration uses Gmail TLS, deduplicates recipients and normalizes App Password spacing", () => {
  const config = emailConfig({
    EMAIL_NOTIFICATIONS_ENABLED: "true",
    SMTP_PASS: " abcd efgh ijkl mnop ",
    EMAIL_RECIPIENTS:
      "ncrwheelz@gmail.com,NCRWHEELZ@gmail.com,shivamchaudhary2667@gmail.com",
  });
  assert.equal(config.pass, "abcdefghijklmnop");
  assert.equal(config.secure, true);
  assert.equal(config.port, 465);
  assert.deepEqual(config.recipients, [
    "ncrwheelz@gmail.com",
    "shivamchaudhary2667@gmail.com",
  ]);
  assert.throws(
    () =>
      emailConfig({
        EMAIL_NOTIFICATIONS_ENABLED: "true",
        EMAIL_RECIPIENTS: "bad\r\nBcc: victim@example.test",
      }),
    /Invalid email settings/,
  );
  let options;
  createMailTransport(config, (value) => {
    options = value;
    return {};
  });
  assert.equal(options.tls.rejectUnauthorized, true);
  assert.equal(options.disableFileAccess, true);
  assert.equal(options.disableUrlAccess, true);
  assert.equal(options.debug, false);
  assert.equal(options.socketTimeout, 20000);
  assert.equal(
    errorCode(new Error("password should never be logged")),
    "EMAIL_DELIVERY_FAILED",
  );
});

test("all four event types notify each staff inbox separately and acknowledge only the customer", () => {
  for (const kind of [
    "contact",
    "enquiry",
    "test_drive",
    "seller_submission",
  ]) {
    const emails = messages({
      ...event,
      kind,
      vehicleId: 17,
      preferredAt: "2026-11-01T04:30:00Z",
      vehicle: {
        year: 2022,
        make: "Maruti Suzuki",
        model: "Dzire",
        variant: "VXi",
        price: 500000,
        mileage: 40000,
        type: "commercial",
      },
    });
    assert.equal(emails.length, 3);
    assert.deepEqual(
      emails.map((mail) => mail.to),
      [...env.email.recipients, event.contact.email],
    );
    for (const mail of emails) {
      assert.ok(!mail.html.includes("<script>"));
      assert.ok(!mail.html.includes("<img src=x"));
      assert.ok(!mail.subject.includes("\n"));
      assert.equal(mail.attachments, undefined);
      assert.ok(!JSON.stringify(mail).includes(process.env.SMTP_PASS));
    }
    assert.equal(emails[0].replyTo, event.contact.email);
    assert.equal(emails[2].replyTo, env.email.from);
    assert.ok(emails[2].text.includes(acknowledgement));
    assert.ok(!emails[2].text.includes(event.message));
    assert.ok(!emails[2].text.includes("shivamchaudhary2667@gmail.com"));
    if (kind === "test_drive") assert.match(emails[0].text, /10:00/);
    if (kind === "seller_submission")
      assert.match(emails[0].text, /Commercial cab \(yellow plate\)/);
  }
});

test("queue entries use the business transaction, stable event keys and a new revision for seller resubmissions", async () => {
  queued.length = 0;
  const connection = {};
  await enqueueNotification(event, connection);
  assert.equal(queued.length, 3);
  assert.ok(
    queued.every(
      ([sql, , passed]) =>
        sql.includes("ON DUPLICATE KEY") && passed === connection,
    ),
  );
  const keys = queued.map(([, values]) => values[0]);
  await enqueueNotification(event, connection);
  assert.deepEqual(
    queued.slice(3).map(([, values]) => values[0]),
    keys,
  );
  await enqueueNotification({ ...event, revision: "new-review" }, connection);
  assert.ok(queued.slice(6).every(([, values], i) => values[0] !== keys[i]));
  await assert.rejects(enqueueNotification(event), /transaction/);
  const enabled = env.email.enabled;
  env.email.enabled = false;
  try {
    await enqueueNotification(event);
  } finally {
    env.email.enabled = enabled;
  }
});

function setup({
  send,
  locked = false,
  sentCount = 0,
  ackFailure = false,
} = {}) {
  const jobs = messages(event).map(({ to, audience, ...data }, index) => ({
    id: index + 1,
    kind: "contact",
    event_key: String(index + 1).repeat(64),
    recipient: to,
    data: JSON.stringify(data),
    attempts: 0,
    status: "pending",
    available: 0,
  }));
  const sends = [],
    logs = [],
    calls = [];
  let released = false;
  const execute = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith("SELECT GET_LOCK"))
      return [{ acquired: locked ? 0 : 1 }];
    if (sql.startsWith("SELECT RELEASE_LOCK")) return [{ released: 1 }];
    if (sql.startsWith("SELECT COUNT")) return [{ total: sentCount }];
    if (sql.startsWith("SELECT *"))
      return jobs
        .filter(
          (job) =>
            job.attempts < 6 &&
            ((job.status === "pending" && job.available <= Date.now()) ||
              (job.status === "sending" && job.stale)),
        )
        .slice(0, 1)
        .map((job) => ({ ...job }));
    if (sql.includes("attempts=attempts+1")) {
      const job = jobs.find((job) => job.id === values[1]);
      Object.assign(job, {
        status: "sending",
        lock_token: values[0],
        attempts: job.attempts + 1,
        stale: false,
      });
    } else if (sql.includes("status='sent'")) {
      if (ackFailure) throw new Error("Database acknowledgement lost");
      const job = jobs.find(
        (job) => job.id === values[0] && job.lock_token === values[1],
      );
      job.status = "sent";
    } else if (sql.startsWith("UPDATE") && sql.includes("status=?")) {
      const [status, seconds, code, decrement, id, token] = values;
      const job = jobs.find((job) => job.id === id && job.lock_token === token);
      Object.assign(job, {
        status,
        available: Date.now() + seconds * 1000,
        last_error: code,
        attempts: job.attempts - decrement,
      });
    } else if (sql.includes("EMAIL_DELIVERY_UNCERTAIN")) {
      for (const job of jobs.filter(
        (job) => job.status === "sending" && job.attempts >= 6 && job.stale,
      ))
        job.status = "failed";
    } else assert.fail("Unexpected SQL: " + sql);
    return { affectedRows: 1 };
  };
  const worker = createEmailWorker({
    config: env.email,
    execute,
    database: {
      getConnection: async () => ({
        release() {
          released = true;
        },
        destroy() {
          released = true;
        },
      }),
    },
    makeTransport: () => ({
      async sendMail(mail) {
        sends.push(mail);
        if (send) return send(mail);
        return { accepted: [mail.to.address] };
      },
    }),
    log: (value) => logs.push(value),
  });
  return { worker, jobs, sends, logs, calls, released: () => released };
}

test("worker serializes concurrent ticks, sends three separate messages and never resends completed jobs", async () => {
  const state = setup();
  await Promise.all([state.worker.runOnce(), state.worker.runOnce()]);
  assert.equal(state.sends.length, 3);
  assert.ok(state.jobs.every((job) => job.status === "sent"));
  await state.worker.runOnce();
  assert.equal(state.sends.length, 3);
  assert.ok(state.released());
  assert.ok(
    state.sends.every(
      (mail) =>
        mail.messageId && mail.disableFileAccess && mail.disableUrlAccess,
    ),
  );
  await state.worker.stop();
});

test("real Nodemailer composes isolated staff and customer envelopes without network delivery", async () => {
  const transport = require("nodemailer").createTransport({
    streamTransport: true,
    buffer: true,
  });
  const envelopes = [];
  const state = setup({
    send: async (mail) => {
      const composed = await transport.sendMail(mail);
      envelopes.push(composed.envelope);
      assert.ok(Buffer.isBuffer(composed.message));
      assert.match(composed.message.toString(), /MIME-Version: 1.0/);
      return { accepted: composed.envelope.to };
    },
  });
  await state.worker.runOnce();
  assert.equal(state.sends.length, 3);
  assert.deepEqual(
    envelopes.map((envelope) => envelope.to),
    [...env.email.recipients, event.contact.email].map((address) => [address]),
  );
  assert.ok(
    envelopes.every((envelope) => envelope.from === "ncrwheelz@gmail.com"),
  );
  await state.worker.stop();
  transport.close?.();
});

test("one failing recipient retries independently while the other inbox and acknowledgement succeed", async () => {
  let failing = true;
  const state = setup({
    send: async (mail) => {
      if (failing && mail.to.address === env.email.recipients[0])
        throw Object.assign(new Error("private SMTP response"), {
          code: "EENVELOPE",
        });
      return { accepted: [mail.to.address] };
    },
  });
  await state.worker.runOnce();
  assert.deepEqual(
    state.jobs.map((job) => job.status),
    ["pending", "sent", "sent"],
  );
  assert.ok(state.jobs[0].available > Date.now());
  assert.equal(state.jobs[0].last_error, "EENVELOPE");
  assert.ok(!JSON.stringify(state.logs).includes("private SMTP response"));
  failing = false;
  state.jobs[0].available = 0;
  await state.worker.runOnce();
  assert.equal(state.sends.length, 4);
  assert.ok(state.jobs.every((job) => job.status === "sent"));
  await state.worker.stop();
});

test("a competing worker and the sliding daily cap prevent dispatch", async () => {
  for (const options of [
    { locked: true },
    { sentCount: env.email.dailyLimit },
  ]) {
    const state = setup(options);
    await state.worker.runOnce();
    assert.equal(state.sends.length, 0);
    assert.ok(state.jobs.every((job) => job.attempts === 0));
    assert.ok(state.released());
    await state.worker.stop();
  }
});

test("authentication failures pause delivery without exhausting retries or exposing credentials", async () => {
  const state = setup({
    send: async () => {
      throw Object.assign(new Error(process.env.SMTP_PASS), { code: "EAUTH" });
    },
  });
  await state.worker.runOnce();
  await state.worker.runOnce();
  assert.equal(state.sends.length, 1);
  assert.equal(state.jobs[0].status, "pending");
  assert.equal(state.jobs[0].attempts, 0);
  assert.ok(!JSON.stringify(state.logs).includes(process.env.SMTP_PASS));
  await state.worker.stop();
});

test("uncertain post-send database errors keep the lease and stale leases recover after restart", async () => {
  const state = setup({ ackFailure: true });
  await state.worker.runOnce();
  assert.equal(state.sends.length, 1);
  assert.equal(state.jobs[0].status, "sending");
  assert.equal(state.jobs[0].attempts, 1);
  assert.ok(!state.calls.some(({ sql }) => sql.includes("status=?")));
  await state.worker.stop();
  const recovered = setup();
  recovered.jobs[0].status = "sending";
  recovered.jobs[0].stale = true;
  await recovered.worker.runOnce();
  assert.ok(recovered.jobs.every((job) => job.status === "sent"));
  await recovered.worker.stop();
});

test("unaccepted recipients eventually remain failed for explicit retry", async () => {
  const state = setup({ send: async () => ({ accepted: [] }) });
  state.jobs.forEach((job) => {
    job.attempts = 5;
  });
  await state.worker.runOnce();
  assert.ok(
    state.jobs.every(
      (job) => job.status === "failed" && job.last_error === "EREJECTED",
    ),
  );
  await state.worker.runOnce();
  assert.equal(state.sends.length, 3);
  await state.worker.stop();
});

test("setup activates only after SMTP and migration succeed, preserving private environment settings", async () => {
  const { setupNotifications } = require("../src/lib/email-setup");
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "ncr-email-setup-"));
  const file = path.join(folder, ".env");
  const original =
    "SMTP_PASS=private-test-fixture\nJWT_SECRET=keep-this-fixture\nEMAIL_NOTIFICATIONS_ENABLED=false\n";
  const calls = [];
  try {
    await fs.writeFile(file, original);
    await assert.rejects(
      setupNotifications({
        file,
        transport: {
          verify: async () => {
            throw new Error("Authentication failed");
          },
        },
        migrate: async () => calls.push("migrate"),
      }),
      /Authentication failed/,
    );
    assert.deepEqual(calls, []);
    assert.equal(await fs.readFile(file, "utf8"), original);
    await assert.rejects(
      setupNotifications({
        file,
        transport: { verify: async () => calls.push("verify") },
        migrate: async () => {
          throw new Error("Migration failed");
        },
      }),
      /Migration failed/,
    );
    assert.equal(await fs.readFile(file, "utf8"), original);
    calls.length = 0;
    await setupNotifications({
      file,
      transport: { verify: async () => calls.push("verify") },
      migrate: async () => calls.push("migrate"),
    });
    assert.deepEqual(calls, ["verify", "migrate"]);
    assert.equal(
      await fs.readFile(file, "utf8"),
      original.replace("ENABLED=false", "ENABLED=true"),
    );
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    assert.deepEqual(await fs.readdir(folder), [".env"]);
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
});
after(() => db.pool.end());

test("password reset email carries the link, escapes the name and is sent from NCR Wheelz", async () => {
  const { resetEmail, sendResetEmail } = require("../src/lib/reset-email");
  const link = "https://ncrwheelz.com/reset-password?token=" + "a".repeat(64);
  const message = resetEmail({ name: '<img src=x onerror="alert(1)">', link });
  assert.equal(message.subject, "Reset your NCR Wheelz password");
  assert.ok(message.text.includes(link));
  assert.ok(message.text.includes("30 minutes"));
  assert.ok(message.html.includes(`href="${link}"`));
  assert.ok(!message.html.includes("<img src=x"));
  assert.ok(message.html.includes("&lt;img src=x"));
  const sent = [];
  await sendResetEmail({ name: "Riya", email: "riya@example.test" }, link, {
    sendMail: async (mail) => sent.push(mail),
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "riya@example.test");
  assert.equal(sent[0].from.name, "NCR Wheelz");
  assert.ok(sent[0].text.startsWith("Hi Riya,"));
});
