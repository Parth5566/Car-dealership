# Deployment security and operating notes

This document describes the supplied application and decisions needed before a public launch. It does not certify production readiness.

## Production topology

Run Next.js and Express behind an HTTPS reverse proxy, keeping browser API calls same-origin under `/api/v1`. Set `APP_ORIGIN` and `NEXT_PUBLIC_SITE_URL` to the exact public HTTPS origin and server-only `API_URL` to the API’s private address. Secure cookies require HTTPS. The supplied Express entry binds to `127.0.0.1`; expose it through a local controlled proxy or deliberately adapt the bind address for containers. Do not expose MySQL publicly.

Use a supported Node runtime, an InnoDB-capable MySQL 8+ instance, a persistent private storage volume and a process supervisor. Configure the proxy’s upload limit slightly above 10 MB plus multipart overhead. Keep the root `.env`, the API’s environment and private storage out of web roots and source control. Maintain a strong, environment-specific JWT secret.

The reused local root DB login is suitable only for this owner-controlled development setup. Give the production runtime only the minimum SELECT/INSERT/UPDATE/DELETE access to the application tables. Use a separate migration principal for DDL and a separate isolated test principal for CREATE/DROP DATABASE. Disable development fixture commands in production. Never import old data without a reviewed field mapping and explicit owner decision.

## Backups and restoration

Before deployment or future migrations, back up the selected database, including application migration records, and the private media volume. Use encrypted backup storage, restricted service identities, independent retention and a tested restore procedure. Keep database and file backups consistent so document/image references can be restored together.

A typical database backup can use the operator’s configured `mysql_config_editor` login path to avoid putting the password into shell history:

```bash
mysqldump --login-path=ncr-wheelz --single-transaction --routines --triggers car_dealership > /secure-backup-path/car_dealership.sql
```

The path and login configuration are examples to be supplied by the operator. Restore first into a new staging database and isolated storage volume; run migration checks and representative private/public access tests there. This project intentionally supplies no destructive “reset production database” command.

## Documents and images

Private files use random names and restrictive local file permissions. Image inputs are decoded and re-encoded with bounded pixel/file limits, with resized WebP delivery and thumbnails. PDFs are accepted by MIME/header checks and returned as downloads with restrictive CSP; this is not malware scanning or authenticity verification. Do not upload real sensitive seller documents to an unreviewed public deployment.

For launch, select managed storage that supports private ACLs and short-lived authorised downloads or a protected streaming service. Keep documents private and separate from publicly approved listing photos. Add malware scanning/quarantine before staff download where available. Preserve existing review and document-access audit events in any storage adapter.

Removing a photo removes its database reference, making it inaccessible through application routes; replaced documents no longer expose their old storage key. Unreferenced file bytes may remain in storage. If a commit acknowledgement is lost, upload files are deliberately retained because the database may already reference them. The request returns an error and logs transaction_commit_outcome_unknown; inspect database references before retrying or cleaning files. A rollback failure destroys the connection rather than returning it to the pool. No file-retention cleanup runs automatically until the business defines retention, legal holds, recovery and deletion rules. Backups need the same policy. Do not improvise a cleanup job that could delete owner data.

The initial document requirements are configurable assumptions, not legal conclusions. Business/legal advisers must review them for passenger/commercial vehicle circumstances and applicable state rules. Aadhaar is not a supported type. No OCR, authenticity checking, official lookup or external verification service is connected.

## Authentication and abuse controls

JWTs are short-lived and bound to active database sessions; every protected API call checks active account/session/version. Refresh tokens are hashed, rotated and revoked by family on replay. Browser writes require the custom protection header and reject unexpected origins. SameSite cookies, restricted CORS, parameterised SQL, validation and React escaping add protection.

Credential attempts and refresh use separate limits. Missing refresh cookies do not consume a refresh allowance; anonymous session checks stop at AUTH_REQUIRED. Credential attempt keys combine the normalized account identity with the client IP so different accounts do not share a login bucket merely because they share a proxy.

By default forwarded identity is not trusted. Set `TRUST_PROXY` to explicit trusted addresses/CIDRs (for example `127.0.0.1/32,::1/128` only when those are the actual controlled proxies). Hop counts and `true` are rejected. Every trusted forwarding layer, including any Next.js ingress, must strip/overwrite user-supplied `X-Forwarded-For` and supply the verified client chain; otherwise leave forwarding untrusted. For precise per-visitor limits, route `/api/v1` directly from a controlled edge to Express or verify the complete edge → Next → Express chain. Check real client identities with multiple browsers in staging; no deployment proxy was configured by this task.

Current rate limits are in-process and reset when the API restarts. Replace them with a shared store for multiple replicas and use the correct trusted reverse-proxy configuration. Add monitoring for repeated login/reset attempts, upload abuse, 5xx errors and review/permission changes. Do not log passwords, tokens, document content, personal request bodies or connection strings. Errors identify a request ID and safe code.

The first admin bootstrap is a trusted local operator command. Staff creation/access changes are restricted to admins, audited and revoke sessions. An admin cannot remove their own access or the last active admin. Email/phone verification and stronger staff authentication/MFA remain production security decisions.

Refresh calls within one tab are deduplicated. Across tabs, Web Locks serialize rotation; browsers without Web Locks use an atomic IndexedDB lease. A waiting tab rechecks authentication before attempting rotation. No tokens enter browser storage. If coordination is unavailable, automatic refresh fails closed and the user must sign in again. Server replay revocation remains strict. Unit regressions cover both coordination paths, and the optional browser suite covers two tabs with shared cookies.

## Password reset delivery

By default every forgot-password request returns the same delivery-unavailable response; no account enumeration occurs through differing success/error messages. Reset tokens expire in 30 minutes, are stored as hashes, are single use and revoke sessions after use. Trusted operator recovery must independently verify the requester and deliver its generated link privately.

The optional HTTPS webhook passes an account email and a private reset URL to a configured delivery provider. Configure it only after reviewing that provider, access, consent and secret handling. It is a best-effort adapter without durable queues or retries; add a reliable delivery queue, verify timing/abuse controls and delivery observability before activating it in production. Form notifications have a separate Gmail SMTP outbox and worker; see [EMAIL.md](EMAIL.md) for activation and monitoring. `RESET_DELIVERY=email` reuses those SMTP settings to send reset links directly (not via the outbox, so raw tokens are never stored); see the password reset section of EMAIL.md.

## Operational data and privacy

Saved seller drafts appear in **Overview → Seller drafts to contact** and **Seller reviews → Drafts to contact** for staff with review permission. The admin notice refreshes every 30 seconds while visible, on return to the tab and after a contact action. Open a draft for the seller's contact details; use **Mark contacted** only after contacting them. This records a history/audit event and clears the pending notice while leaving the vehicle editable and private. Completed submissions leave this queue automatically. Editing the same draft does not create duplicate first-contact notices. Existing uncontacted drafts also appear; no migration or email setup is required for in-panel notices.

Only a customer’s own account records are returned by customer routes. Sales staff see inventory, leads and limited customer information; reviewers access seller documents and submissions; publication is separate from review approval. Audited customer lookup supplies activity counts rather than exporting private files. Aggregate CSV exports contain status counts, not contact details, and are audited.

Reports filter by record creation date and display current outcome/status. Listing views count detail HTTP requests, including bots and metadata/QA traffic; they are not consented unique-visitor analytics or a defensible conversion KPI. Select and review an analytics provider before introducing cookies, behavioural tracking or visitor funnels. No non-essential tracker is enabled now.

Define a privacy contact, account export/erasure procedure, document retention, staff access review schedule, incident-response contacts and complaint handling before launch. The draft policies explicitly identify unfinished business details. Do not present them as approved legal advice.

## Owner decisions before launch

| Decision                                     | Current implementation assumption                                                                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business identity/contact/location           | Owner-supplied contact/location defaults are retained; explicit admin saves activate database overrides. Full legal identity still needs approval. |
| Hosting, domains, TLS, DB and storage        | Local-only processes and disk storage. No external deployment has been performed.                                                                  |
| Customer verification and staff MFA          | Password sign in; email/phone verification disabled; no MFA provider.                                                                              |
| Documents by vehicle circumstance            | Preliminary configurable checklist; manual review only.                                                                                            |
| Approval versus publication                  | Separate deliberate actions, with distinct reviewer and inventory permissions.                                                                     |
| Test-drive payments                          | Free requests only, no confirmed booking until staff act, no payments.                                                                             |
| Email/WhatsApp/maps/analytics/image provider | Owner-supplied Google Map is embedded; notification, analytics and managed media providers remain unconfigured.                                    |
| Legal policies, warranties, dispute terms    | Drafts only, awaiting business/legal review.                                                                                                       |
| Retention, rights and backups                | Procedures described; provider jobs/schedules/restore drills still to be configured and exercised.                                                 |
| AI recommendations and valuations            | Deferred; no estimates, fabricated confidence or prediction output.                                                                                |

## Release checks

Run the unit, isolated MySQL integration, HTTP end-to-end, TypeScript, formatting, build and dependency-audit commands in the README. Check real target devices, keyboard use, contrast, screen readers, upload failures, invalid/expired sessions, sold URLs, empty queues, sitemap exclusions, canonical URLs and accessibility of error messages. Run mobile performance/Core Web Vitals measurements on the deployment target. Confirm monitored health checks do not disclose credentials or user data.

Exercise backup restoration and role/access tests in staging before owner acceptance. Configure the reverse proxy to cache only public assets; never cache authenticated JSON or private file downloads. Review dependency/security updates and keep lockfiles reproducible.
