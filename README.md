# NCR Wheelz

A used passenger and commercial vehicle marketplace for Delhi NCR, implemented from the supplied product requirements document. The repository contains a Next.js/React/TypeScript frontend, an Express REST API, and additive MySQL migrations.

The core marketplace, customer accounts, seller review workflow and admin operations are implemented. This is a local development application; production launch still requires approved business/legal content, provider configuration, operational safeguards, and owner acceptance. AI recommendations and nationwide predictive valuations remain deferred. The public [car valuation page](http://localhost:3000/car-valuation) provides a price guide from broad CarDekho comparisons via Scrappa when configured, or real dealership listings otherwise. One listing is sufficient; sparse ranges use an explicitly labelled ±10% approximation; see [VALUATION.md](docs/VALUATION.md) for its data requirements and limits, and [provider research](docs/VALUATION_PROVIDERS.md) for broader coverage.

## Run locally

Prerequisites: Node.js 22 or newer, npm, and MySQL 8.0+ with InnoDB and JSON support. Node.js 26.8.2 was used during implementation.

```bash
cd /Users/parth/car-dealership
npm ci
npm run install:all
```

The existing local database settings have already been retained in `backend/.env`, with restrictive file permissions. Its password must remain private. The frontend environment has been configured to reach the API. **Do not replace these existing files with examples.** For a fresh checkout only:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
```

Fill the backend example with your database credentials and the generated `JWT_SECRET`. Create the configured database separately if it does not exist. Do not use a public `NEXT_PUBLIC_` variable for any secret.

```bash
npm run db:inspect
npm run db:migrate
npm run admin:create
npm run dev
```

Open [the application](http://localhost:3000) and [staff sign in](http://localhost:3000/admin/login). The API listens at `http://localhost:5001/api/v1`. `Ctrl+C` stops both development services.

The launcher checks that port 3000 and the configured backend port (5001 by default) are free before starting either service. If a port is occupied, stop the earlier server in its terminal. Use `lsof -nP -iTCP:5001 -sTCP:LISTEN` to identify an API process. On macOS/Linux, shutdown signals go to each service's whole process group so npm's watchers and server children stop together.

`admin:create` asks for the first administrator’s name and email, generates a strong password, and prints it once. Save it in a password manager. It refuses to bootstrap another administrator after one exists; create subsequent staff in **Admin → Staff & permissions**. There are no default production accounts or passwords. Customers can create accounts at `/signup`.

Form notification emails use the saved server-side Gmail App Password and a durable database queue. After backend dependency installation, `npm run email:setup` verifies SMTP, applies migrations and enables delivery; restart the API afterward. Contact messages, vehicle enquiries, test-drive requests and completed seller submissions notify both configured inboxes and acknowledge the customer. See [EMAIL.md](docs/EMAIL.md) for activation, testing and retry commands.

The public inventory starts empty unless test inventory is explicitly imported. Contact details and the map use the owner's supplied information. About contains clearly labelled fictional customer stories requested by the owner; these are not verified reviews. Discounts now displays only admin-published offers during their validity dates, with an empty state when none are active. The owner-requested sample inventory command adds six clearly labelled test vehicles without creating accounts or replacing existing inventory; see below.

## Public pages and content

- Passenger and commercial inventory use compact filters: search, maximum budget presets/custom amount and fuel. Other criteria sit under More filters, which opens when an extra criterion is already applied. Applied filters can be removed individually or cleared together. Sorting beside the results submits the same filter form and retains its current choices.

The navbar includes a Vehicles dropdown (Passenger cars, Commercial vehicles, Compare vehicles), Sell a vehicle, EMI calculator, Discounts, About us and Contact us. FAQs are available on Home, both inventory pages, Compare, About, Contact, Finance, EMI calculator and Discounts.

- Manage public contact details in **Admin → Content & settings**, including both phone numbers, email, hours, address and Google Maps URLs. `frontend/lib/business.ts` preserves the owner-supplied defaults until an admin explicitly saves settings; legacy database contact values are not automatically activated or overwritten. A successful save sets `contact_customized=true`. Header, footer, Contact and contact FAQs share one resolver. Clear the map embed to hide the map.
- Manage discounts in **Admin → Discounts & offers** (`/admin/offers`). Create drafts, edit, duplicate, publish/schedule, unpublish or permanently remove offers. Customize four color themes, four background styles, icons, badges, featured placement, reference codes, button text/destination and display order with a live preview. Public cards read from MySQL and appear only during their published schedule. Apply migration **004** before use; see [offers setup and workflow](docs/OFFERS.md). Offers are promotional information and do not automatically change vehicle prices. Testimonials remain editable in `frontend/lib/site-content.ts`.
- Manage articles in **Admin → Blog posts** (`/admin/blog`). Write with content blocks, upload a cover, preview privately, then publish to `/blog`. Edit, unpublish or archive posts later. SEO fields, article schemas and sitemap inclusion follow publication automatically. Apply migration **006** before use; see [blog setup and workflow](docs/BLOG.md).
- Vehicle cards support toggling up to three comparison choices. The floating shortlist bar opens a comparison table after two selections. The Compare page also searches published inventory, supports removing/replacing choices and can show only differing specifications. Its selection is stored in this browser; no account is required.
- The EMI calculator has editable amounts, sliders, tenure presets, principal/interest visualisation and an expandable annual repayment schedule. It handles zero interest and a full down payment. These are illustrative calculations, not loan approvals.
- Customer and staff passwords accept at least six characters (staff minimum lowered from twelve on 27 October 2026 at the owner's request). Password storage and session protections are retained; technical encoding limits are not shown as signup guidance.
- Contact enquiries persist in Admin → Leads. A successful form submission displays an `NCR-<id>` reference. Sending an enquiry does not send email/SMS; provider notifications remain a separate integration.

If signup reports a connection problem, run `npm run dev` from the project root so **both** frontend and backend start, and confirm MySQL is running. Check `http://localhost:3000/api/v1/health`; it should report `status: ok` and `database: connected`. Use `http://localhost:3000` for the local application so its configured browser origin matches.

## Existing database protection

The inspected connection is `127.0.0.1:3306`, database `car_dealership`, user `root`. The existing password is reused only from the ignored backend environment file. The original `cars` table contained three rows and is **not altered, deleted, imported or publicly exposed** by this application.

Apply all migrations before starting the updated API. Migrations 002 and 003 add enquiry/test-drive consent time/revision and separate document upload time; legacy rows keep null values for unknown history. Migration 004 creates the new `nw_offers` table without changing existing inventory or settings. These migrations were authored but could not be applied from the restricted execution environment.

New tables use the `nw_` prefix. The migration runner records a checksum and uses a MySQL advisory lock. Simple nullable-column additions resume after interruption by verifying existing column definitions and adding only missing columns; incompatible columns stop the migration. Other DDL keeps its authored behavior. It never drops the existing database or tables. MySQL DDL is not transactionally reversible: take a backup before applying future migrations. The original test schema is retained at `database/legacy/schema.sql` for reference, not as the application’s migration entry point. Any migration of old inventory into the marketplace needs a deliberate data review.

## Project structure

```text
backend/
  server.js                 Local API entry point
  src/app.js                Middleware, versioned routes, safe errors
  src/config/               Environment validation and MySQL pool
  src/lib/                  Schemas, workflow rules, audit/history helpers
  src/middleware/           Authentication and role permissions
  src/routes/               Auth, public, account, admin, private media
  scripts/                  Migrations, admin bootstrap, recovery and fixtures
  tests/                    Unit and isolated MySQL integration tests
  storage/                  Ignored private local media storage
frontend/
  app/                      Server pages, metadata, account/admin routes
  components/               Responsive UI, forms and management screens
  lib/                      Shared frontend types, API and server fetch helpers
  proxy.ts                  Server-side protected-page checks
  public/hero.svg           Labelled decorative vehicle illustration
  tests/                    HTTP end-to-end tests through Next.js and Express
scripts/                    Development and isolated end-to-end runners
database/migrations/        Versioned additive application schema
docs/                       Original PRD, milestones, API and launch notes
```

See [milestones and acceptance coverage](docs/IMPLEMENTATION.md), [API reference](docs/API.md), and [deployment and security operations](docs/OPERATIONS.md). The retained `docs/NCR_Wheelz_PRD.docx` is the functional source of truth. AI recommendations remain deferred. The owner subsequently requested car valuation: local and Scrappa/CarDekho asking-price comparisons are implemented; predictive/condition-adjusted nationwide pricing remains outside the current engine. See [Scrappa setup](docs/SCRAPPA.md).

## What is implemented

- Public home, separate passenger/commercial inventory, query-preserving filters, sort, pagination, image galleries, similar vehicles, canonical listing URLs, sitemap, robots, metadata and factual structured data.
- Registration, customer/staff sign in, logout, profile editing, bcrypt password hashing, short JWT access sessions, rotating refresh cookies, replay detection, password-reset token expiry/single use, account disabling and session revocation.
- Saved vehicles, unavailable-listing handling, comparison of up to three browser-local selections, enquiries, test-drive requests and account activity.
- EMI calculator including zero-interest scenarios, total repayment/interest, finance information, contact enquiry form, about page and clearly labelled draft policies.
- Private seller drafts, contact details, up to 20 photos, document uploads, a dedicated status dashboard, feedback, correction/resubmission, and a status timeline.
- Role-restricted document review, information requests, rejection, approval, **separate deliberate publication**, and a fresh-approval requirement after inventory edits.
- Admin inventory CRUD/lifecycle and media ordering, lead assignment/notes/history, test-drive scheduling/history, customer status, staff roles, public content/settings, aggregate reports/CSV and audit logs.

No payment collection, booking deposits, official document-verification integration, external analytics, email/WhatsApp notifications, cloud storage, AI recommendations or external market valuations are active by default. The Contact page embeds the owner-supplied Google Map.

## Environment variables

| Variable                                                  | Purpose                                                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Backend MySQL settings. Existing port resolved to 3306.                                                                              |
| `JWT_SECRET`                                              | At least 48 random characters. Generate independently for every environment.                                                         |
| `PORT`                                                    | Backend port, default 5001.                                                                                                          |
| `APP_ORIGIN`                                              | Exact browser origin for CORS and CSRF checks, default `http://localhost:3000`.                                                      |
| `STORAGE_DIR`                                             | Private media directory, relative to `backend/` or absolute. Never a public/static directory.                                        |
| `NODE_ENV=production`                                     | Enables secure-cookie defaults. Requires HTTPS.                                                                                      |
| `COOKIE_SECURE=true`                                      | Forces Secure cookies outside production as needed.                                                                                  |
| `TRUST_PROXY`                                             | Set the exact trusted proxy hop count only behind a controlled reverse proxy.                                                        |
| `RESET_DELIVERY`                                          | `disabled` by default. `email` sends reset links through the Gmail/SMTP settings (see EMAIL.md); `webhook` uses the variables below. |
| `RESET_WEBHOOK_URL`, `RESET_WEBHOOK_TOKEN`                | Optional trusted HTTPS password-reset email delivery adapter. Server only; no other event notifications are wired.                   |
| `DOCUMENT_REQUIREMENTS_JSON`                              | Optional document checklist override; see below.                                                                                     |
| `API_URL`                                                 | Frontend server-only API origin, default `http://127.0.0.1:5001`. Next rewrites browser `/api/v1/*` to it.                           |
| `NEXT_PUBLIC_SITE_URL`                                    | Public canonical origin. Set to the real HTTPS domain before launch.                                                                 |
| `NEXT_DIST_DIR`                                           | Optional custom Next build cache directory.                                                                                          |
| `SITE_URL`                                                | Backend copy of the canonical public origin for search-engine notifications. Match `NEXT_PUBLIC_SITE_URL`.                           |
| `INDEXNOW_KEY`                                            | Optional, set identically in backend and frontend. Production publish/unpublish pings IndexNow; see SEO.md.                          |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`      | Optional frontend Search Console / Bing Webmaster ownership meta tags.                                                               |

The original weak test JWT secret was replaced with a generated value. Credentials never belong in committed source, public settings, screenshots, or frontend bundles. `PUBLIC_API_URL` retained in the local backend environment is not used by the application and may be removed.

## Authentication and password recovery

Passwords use bcrypt with work factor 12 and a 72-byte UTF-8 limit. Access JWTs expire after 15 minutes; hashed refresh tokens expire after 14 days and rotate on use. Both cookies are HttpOnly, SameSite=Lax, and Secure in production. Cookies use the same-origin root path so protected page requests can be checked on the server. Long-lived tokens are not stored in localStorage.

Writes require `X-NCR-Request: 1` and reject unexpected browser origins. The frontend wrapper sends this header, deduplicates refresh within a tab and serializes it across tabs using Web Locks (with an atomic IndexedDB lease fallback), rechecks shared cookies after acquiring the lock, and retries once. Tokens remain in HttpOnly cookies. If both coordination mechanisms are unavailable, session restoration shows a retryable service error rather than racing token rotation or assuming the user signed out. Logout, account access changes and password resets revoke the relevant sessions. Customer and staff passwords require at least six characters. Role permissions and record ownership are checked again in the API for every protected action.

Automated reset delivery is disabled until configured and returns the same delivery-unavailable response for every email. With `RESET_DELIVERY=email` (enabled on the owner's machine on 27 October 2026) the site emails the link from the configured Gmail account. A trusted local operator can recover an independently verified account during development:

```bash
npm --prefix backend run password:reset-link
```

This prints a private, single-use link valid for 30 minutes. Deliver it securely to the verified owner; do not put it into logs, tickets or chat. No reset token is exposed in the public API. The optional webhook must accept `POST {event:"password_reset", email, reset_url}` with a bearer token and deliver the message; it is a provider adapter, not a configured email service or durable notification queue.

## Seller document and publication workflow

1. Sign in, create a passenger/commercial draft, and save the vehicle and seller details.
2. Upload vehicle photos and required private supporting files. JPEG/PNG/WebP images are decoded, metadata-stripped, re-encoded and resized, with smaller thumbnails. Documents accept those image types or a PDF header. Limits: 10 MB per file, 40 megapixels for images, and 20 vehicle photos.
3. Accept the seller declarations and submit. Required documents and at least one photo are checked on the server.
4. A reviewer/admin downloads files through an authenticated, audited route and accepts/rejects each document with a note. They can request more information or reject the submission with feedback.
5. The seller corrects the same submission while it is Draft or Additional Information Required and resubmits. Accepted/rejected file replacements go back to pending review.
6. All required documents must be accepted before approval. **Approval keeps the submission private.** A staff member with inventory permission must then explicitly publish it.
7. Specifications and photos must be changed while unpublished. Photo upload, removal, order or alternative-text changes require Draft status and invalidate inventory approval. Reserved listings can move directly to Draft. Review decisions require the content version inspected; changed specifications/photos return a conflict and must be inspected again. Review staff approve drafts with photos through **Admin → Inventory approvals**. Inventory staff publish approved seller submissions through **Admin → Ready to publish**, without access to seller contact details or documents.

Initial passenger requirements: `rc`, `ownership_authority`, `insurance`, `puc`. Commercial adds `fitness`, `permit`, `tax`. `loan_status` and `challans` can be supplied as additional evidence. The checklist is a preliminary product assumption, not a determination of legal requirements. Confirm it by vehicle circumstance and state before launch. **Aadhaar is not requested or accepted as a document type.**

Example server-side override (both categories must be present):

```dotenv
DOCUMENT_REQUIREMENTS_JSON={"passenger":["rc","ownership_authority","insurance","puc"],"commercial":["rc","ownership_authority","insurance","puc","fitness","permit","tax"]}
```

Documents have random storage keys, live outside the frontend/public tree, and are returned only as authenticated downloads with restrictive headers. No private storage key or document URL is returned by public inventory APIs. Document review is manual and is not represented as authenticity, ownership, title, liability, or mechanical verification. Production malware scanning, cloud storage and retention automation still need configuration.

## Roles

Admins can change a seller-listed vehicle's price and specifications through **Seller reviews → open vehicle → Edit details** before publication. For a linked inventory vehicle, choose **Edit listing details**, or use **Inventory → Edit vehicle**. Live listings offer **Unpublish & edit vehicle**. Saves are recorded in the seller's history and require fresh approval: an inventory edit clears inventory approval, while pre-publication seller edits or category changes require a fresh seller review. Changing the passenger/commercial category updates its required document checklist. Seller contact details and documents remain separate from car specifications.

| Role     | Access                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------- |
| Customer | Own profile, favourites, enquiries, test drives, seller submissions and files.                                             |
| Sales    | Inventory, leads/test drives, permitted customer data, reports. Cannot approve inventory or read private review documents. |
| Reviewer | Private seller submissions/documents and review decisions. Cannot publish.                                                 |
| Admin    | All operational areas, approval, publication, staff access and settings.                                                   |

Staff can also use their own customer workflows. Publication of an approved seller submission is a deliberate inventory permission action. Only an admin can create/change staff. Customer status changes are audited and revoke sessions; no customer data is deleted. Public settings have an explicit allowlist and cannot contain arbitrary integration configuration or secrets.

## Tests and checks

```bash
npm test                     # 89 unit/regression tests; no database server required
npm run test:integration     # real MySQL auth/ownership/upload/workflow regressions
npm run test:e2e             # isolated HTTP journey through Next.js, Express and MySQL
npm run typecheck
npm run build                # supported webpack production build
npm run format:check
npm --prefix backend audit
npm --prefix frontend audit
```

Integration tests create a randomly named `ncrwheelz_test_*` database and remove **only that database** and its temporary files in teardown. The HTTP end-to-end runner similarly owns a `ncrwheelz_e2e_*` database, starts separate services on ports 3100/5101, and cleans them up. The test database login needs CREATE/DROP DATABASE privileges; use a separate test-only MySQL login in CI. Never grant these privileges to the production runtime user. Production `car_dealership` tables are not used for test writes. Keep ports 3100/5101 free before running end-to-end tests.

The HTTP suite tests server rendering, redirects, cookies, CSRF forwarding, registration, account ownership, favourites, enquiries, staff metrics, test-drive confirmation and logout. It does not execute browser JavaScript. An optional Playwright suite executes signup, test-drive requests, two-tab refresh, reviewer inventory approval, seller uploads/document review/sales publication, mobile navigation, comparison persistence, EMI, photo navigation/full-screen viewing and responsive specifications. Install the pinned optional tooling without changing manifests or lockfiles:

```bash
npm install --no-save --package-lock=false @playwright/test@1.64.1
node node_modules/@playwright/test/cli.js install chromium --no-shell
npm run test:browser
```

The CLI, config and browser specs share the root-resolved Playwright instance through `scripts/playwright.mjs`, even if Next.js installs a different peer copy under `frontend/node_modules`. Tests use the full Chromium browser's headless mode (`channel: "chromium"`), so a separate headless-shell download is unnecessary. `npm run test:browser:list` checks discovery without creating a database or starting servers. The full browser command checks both discovery and actual browser startup before QA setup.

Automated browser tests build the temporary frontend with `next build --webpack` and serve it with `next start`. This keeps development Fast Refresh and cold route compilation from interrupting navigation between the seller and staff tabs. The isolated build has a five-minute startup budget before individual tests begin. No manual build, migration or change to `npm run dev` is needed.

If Chromium is missing or partially installed (for example, the macOS launcher exists but its Frameworks directory is missing), update the optional tooling and force a fresh download before rerunning the tests:

```bash
npm install --no-save --package-lock=false @playwright/test@1.64.1
node node_modules/@playwright/test/cli.js install --force chromium --no-shell
```

Wait for the installer to finish successfully. If it fails, diagnose the installer output first; rerunning the test suite cannot repair an incomplete browser download.

If an older installer remains at 100% without returning to the prompt, stop it with Ctrl+C before upgrading. Older Playwright versions have a [known ZIP extraction hang on Node 26 and Node 24.16+](https://github.com/microsoft/playwright/issues/40724). The download can be valid while the extracted browser is incomplete; forcing another download with the same older tooling repeats the problem. The optional tooling and CI now use 1.64.1, above the affected versions.

To rerun just the seller lifecycle and connection-reset recovery checks:

```bash
npm run test:browser -- --grep "seller uploads|reset during a session"
```

The long seller workflow has a three-minute budget for its user contexts and uploads; its individual assertions retain their normal time limits. Test stages distinguish publication from later admin edits. No automatic test retries are enabled.

The browser runner owns the same disposable environment as HTTP E2E; do not run both simultaneously. `.github/workflows/ci.yml` provisions MySQL and runs unit tests, type checks, formatting, integration, HTTP E2E, build and browser tests. CI has not been executed from this local workspace. Final accessibility and performance acceptance audits remain launch work. See [review fixes and verification](docs/FIXES.md).

For interactive browser testing with disposable fixtures:

```bash
npm run qa:browser
```

Open `http://localhost:3100`. Disposable staff accounts are `admin@example.test`, `reviewer@example.test`, and `sales@example.test`, with password `browser-qa-password-123`. These are clearly labelled test fixtures and exist only in this randomly named QA database. Interactive QA keeps development mode; add `-- --production` to `npm run qa:browser` to use a production build. The QA app runs from a temporary source snapshot with its own generated TypeScript files and build cache. Restart QA to pick up later source edits. Stop the command with `Ctrl+C` to remove its app snapshot, database and files. Never use these credentials or sample listings in production.

An additional optional private development fixture seed is available only when `DB_NAME` starts with `ncrwheelz_dev_*`, `ncrwheelz_test_*` or `ncrwheelz_e2e_*` and `ALLOW_DEVELOPMENT_FIXTURES=true`:

```bash
npm --prefix backend run db:seed
```

Seeding is intentionally refused against `car_dealership`. There is no automatic real-data import or seeding on application startup.

For the owner's explicitly requested visible test inventory, a separate command targets the configured local database:

```bash
npm run samples:plan          # preview the six fictional vehicles without connecting
npm run samples:add           # add missing labelled samples and illustrations
npm run samples:archive       # archive this sample batch; retain records and files
```

This command refuses production, preserves existing inventory, skips duplicate sample identities, and generates two illustrations per listing. Cards/details label the entries as samples; production public inventory and sitemap/offer SEO exclude them. The actual import was attempted by the assistant but blocked by sandbox MySQL permissions; run it locally to populate `/cars` and `/commercial`. See [sample inventory instructions](docs/SAMPLE_INVENTORY.md) and the [follow-up bug list](docs/BUGS.md).

## Production run

```bash
npm run build
NODE_ENV=production npm --prefix backend start
NODE_ENV=production npm --prefix frontend start
```

Use a process supervisor, an HTTPS reverse proxy, a private MySQL network, a least-privilege runtime DB account, persistent private file storage and backups. Keep browser API requests same-origin under `/api/v1`. The API binds to loopback for the supplied single-host setup; adapt the bind address and network policy deliberately for containers or a split-host deployment. The Next frontend must be able to reach `API_URL` during runtime. See `docs/OPERATIONS.md` before launch.

The production build uses webpack because this environment blocked Turbopack’s build-time subprocess port. The development server also uses webpack for consistent local behaviour. No external web fonts or runtime stock-image services are required.

## SEO

Canonical domain: `https://ncrwheelz.com`. `/sitemap.xml` is generated on every request: a vehicle appears (with its photos as image entries) as soon as it is approved and published, and disappears when sold, archived or unpublished. With `INDEXNOW_KEY` configured in production, those changes are also pushed to IndexNow search engines immediately. Run `npm run test:seo` for heading, metadata, schema, crawler-file and image checks. See the [SEO audit and launch checklist](docs/SEO.md) for page coverage, indexing exclusions and deployment verification.
