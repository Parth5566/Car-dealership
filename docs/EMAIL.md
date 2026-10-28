# Form notification emails

Contact messages, vehicle enquiries, requested test drives and seller submissions notify **ncrwheelz@gmail.com** and **shivamchaudhary2667@gmail.com**. Each inbox receives its own message. The customer receives a separate acknowledgement from **NCR Wheelz <ncrwheelz@gmail.com>**:

> Thank you for contacting NCR Wheelz. We’ve received your request. Our team will review the details and get back to you shortly.

Staff messages include the request reference, contact details, message, originating page/listing ID when applicable and an admin link. Seller messages include the submitted car details and expected price. Requested test-drive times are labelled in India time and explicitly await staff confirmation. Staff can reply directly to the customer; customer replies go to the sender mailbox. Customer acknowledgements do not include the other receiving address or echo untrusted message content.

## Activate on the owner’s Mac

The existing `backend/.env` contains the owner’s saved `SMTP_PASS`. Do not replace the file or print the password. Non-secret Gmail/sender/recipient settings have been added. Notifications remain disabled until setup succeeds, keeping existing forms usable before the migration/dependency are available.

Stop the running development servers with Ctrl+C, then run from the project root:

```bash
npm --prefix backend install
npm run email:setup
npm run dev
```

Setup verifies SMTP authentication without sending any test message, applies pending additive migrations (including `005_email_outbox.sql`), and then saves `EMAIL_NOTIFICATIONS_ENABLED=true`. Restart the production API process instead of `npm run dev` when deploying. An already running API must restart to read changed environment settings. This is a backend worker; hosting the frontend alone does not deliver queued mail.

Settings:

```dotenv
EMAIL_NOTIFICATIONS_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=ncrwheelz@gmail.com
SMTP_FROM=ncrwheelz@gmail.com
SMTP_PASS=your_saved_gmail_app_password
EMAIL_RECIPIENTS=ncrwheelz@gmail.com,shivamchaudhary2667@gmail.com
EMAIL_DAILY_LIMIT=400
```

The placeholder above is documentation, not the owner’s credential. Gmail App Password spacing is normalized server-side. TLS certificate verification remains enabled. SMTP credentials never enter frontend configuration, queue rows or application diagnostics. Nodemailer file/URL access is disabled and user text is escaped in HTML. [Nodemailer SMTP documentation](https://nodemailer.com/smtp) describes the TLS transport options; the dependency is pinned to the official [10.2.1 release](https://github.com/nodemailer/nodemailer/releases/tag/v10.2.1).

## Request lifecycle and delivery

- Contact and vehicle enquiries queue mail through `POST /api/v1/enquiries`, including contact messages prefilled by offer/valuation tools.
- Test-drive requests queue through `POST /api/v1/account/test-drives`.
- Seller emails queue only on a successful `POST /api/v1/account/submissions/:id/submit`, including a legitimate resubmission after an information request. Saving a draft creates an in-panel staff follow-up notice; draft creation, editing and document/photo uploads do not email anyone. Uploaded files are not attached or linked publicly.
- Business records, history and three outbox rows commit in the same MySQL transaction. A failed transaction leaves no sendable notification. A queue insertion failure prevents a misleading successful request response.
- The API worker polls every 15 seconds, dispatching at most ten due messages per batch. SMTP errors happen after request persistence, so they do not discard the request or ask the customer to submit again. Original records remain in the existing admin panels.
- Each recipient has independent status/retries. A MySQL advisory lock serializes API/CLI senders. Interrupted sends have a ten-minute recovery lease; completed jobs are not selected again. Each job reuses its stable Message-ID. SMTP cannot guarantee exactly-once delivery: an acknowledgement lost after acceptance can cause a duplicate when a lease is recovered.
- Ordinary failures back off from one minute to a maximum six hours; six unsuccessful attempts leave the job failed for an explicit operator retry. Authentication errors pause the sender for fifteen minutes without exhausting job attempts. Inspect and correct credentials before retrying.
- A sliding 24-hour cap of 400 recorded successful messages leaves excess mail queued. This site cap is separate from Gmail’s own account limits, which may also include other mail sent from the account. Gmail accepting a message does not prove inbox placement.
- Queue rows include private contact/message snapshots. Protect the database/backups with the same access controls and business retention policy as the original requests; no automatic deletion policy was invented.

Only new events after activation are queued. Existing historical enquiries are not automatically emailed in bulk. Password reset emails are enabled separately with `RESET_DELIVERY=email` (see below).

## Operator commands

```bash
npm run email:verify        # Authenticate only; sends no messages
npm run email:status        # Counts and recent error codes, no message bodies
npm run email:drain         # Deliver up to ten currently due messages
npm run email:retry -- 123  # Requeue only failed outbox ID 123
```

The API retries automatically while running. `email:drain` is optional and uses the same cross-process lock. `email:status` identifies failed IDs; sent messages cannot be requeued with the retry command. Logs store safe error codes, not raw SMTP responses or credentials.

After activation, submit one contact message with your own customer email. Check both receiving inboxes, that customer’s acknowledgement and the normal admin lead record, then inspect `email:status`. Repeat with a vehicle enquiry, a requested test drive and a completed seller submission. Check spam folders if SMTP reports acceptance but a message is not visible.

## Verification in this agent session

Source tests use an injected mail transport and isolated queue fixtures, never Gmail. MySQL integration tests queue messages only in a disposable database and never start the sender. Browser QA explicitly disables email notifications. Tests cover all four templates, both staff recipients, customer isolation, escaping, transaction-scoped inserts, draft/resubmission behavior, recipient-specific retries, auth cooldown, concurrent workers, daily caps and interrupted-send recovery.

The initial dependency installation failed because npm registry DNS resolution is unavailable in this session; the dependency subsequently became available locally and its real MIME composer is covered by a no-network test. Database migration was attempted and denied with `EPERM`; Gmail verification returned `EDNS`. SMTP authentication and live inbox delivery have therefore not been verified here; owner-host setup and checks above are still required.

## Password reset emails

`RESET_DELIVERY=email` sends **Reset your NCR Wheelz password** from NCR Wheelz <ncrwheelz@gmail.com> to the account's own address, using the same SMTP settings (`EMAIL_NOTIFICATIONS_ENABLED=true` and `SMTP_PASS` are required). The message links to `APP_ORIGIN/reset-password?token=…`; the link expires in 30 minutes and works once.

Unlike form notifications, reset mail is sent directly, not through the outbox: the database stores only a hash of each reset token, and an outbox row would have stored the usable link. Every request gets the same "If an eligible account exists…" reply, and only existing, active accounts are emailed, so the form does not reveal which addresses have accounts. If sending fails, the unused token is cancelled and `auth.reset_delivery_failed` is written to the audit log; the visitor can request again. Requests share the login rate limit.

Before launch, set `APP_ORIGIN` to the real HTTPS domain so links in the email point to the live site, and restart the API after changing `backend/.env`. Integration tests force `RESET_DELIVERY=disabled`; browser/E2E QA disables email entirely, so test runs never send reset mail.
