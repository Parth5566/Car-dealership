# Implementation milestones and acceptance coverage

The supplied PRD is retained as `NCR_Wheelz_PRD.docx`. AI recommendations and price estimates are explicitly deferred by the owner. No PRD text is treated as permission to delete existing database data or to enable external services.

## Initial inspection and migration decision

The starting project had an Express server, a MySQL pool, two read-only `cars` endpoints, three Next.js pages, a navbar, and a legacy `cars` schema. The frontend environment was empty and one inventory fetch hard-coded port 5001. MySQL connection details were found in `backend/.env`; the connection succeeded using the configured host, user, database, password and default port 3306. Only the original `cars` table existed, with three rows.

The chosen migration preserves the Next/Express/MySQL stack and the private environment settings, replaces the test scaffold, and adds namespaced `nw_` tables without touching `cars`. The weak JWT test secret was regenerated. The old schema is retained under `database/legacy/` and is never automatically executed. No inventory or customer data is imported implicitly.

## Phase 1 Foundation

Files: root scripts/configuration, `backend/src/config`, `backend/src/lib`, `backend/src/middleware`, `backend/src/routes/auth.js`, `database/migrations/001_foundation.sql`, admin/recovery scripts, and environment examples.

Implemented: additive checksum migrations with a lock, MySQL pool/transactions, explicit Zod schemas, consistent safe error responses, request IDs, security headers, request limits, origin/header CSRF protection, bcrypt work factor 12, 15-minute JWT access cookies, rotating hashed refresh tokens, session-family replay revocation, role checks, audit logging, profile updates, reset expiry/single use, and session revocation on access changes.

Validation: `npm run db:migrate`, `npm test`, and `npm run test:integration`. Unit and integration checks passed. The migration was applied only to new namespaced tables. Automated reset delivery remains disabled; the local operator recovery flow is implemented and the token reset flow is covered by integration tests.

## Phase 2 Public marketplace

Files: `frontend/app`, `frontend/components/inventory.tsx`, `gallery.tsx`, `ui.tsx`, `shell.tsx`, theme CSS, public illustration, Next configuration/proxy, and `backend/src/routes/public.js`/media routes.

Implemented: premium responsive branding, home/category/featured/recent sections, dynamic available makes, separate passenger/commercial inventories, structured filters, keyword search, allowlisted sorting, pagination, canonical slugs, galleries, factual specification availability, similar vehicles, SEO metadata, structured data, robots and public-only sitemap. Empty/error/loading states are present; unavailable detail URLs return a graceful not-found page. No stock photograph is misrepresented as real inventory.

Validation: production build and strict TypeScript checks passed. Browser QA confirmed home rendering, passenger filtering, shareable query strings and empty results using a disposable database. Public API tests verify access controls independently of client filters and exclude private submissions.

## Phase 3 Customer actions

Files: customer/auth pages, account navigation, providers/API wrapper, saved/comparison/EMI components, enquiry form, finance/contact/about pages, policy drafts, and account/public API routes.

Implemented: registration/login/logout/profile/recovery UI, account activity, account-linked favourites, unavailable saved vehicles, browser-local comparison capped at three, enquiries, authenticated test-drive requests, indicative EMI and total interest/repayment, finance information, conditional configured contact links, and essential-only storage preferences.

Validation: integration tests confirm registration, account isolation, favourites, enquiry persistence, drive requests, password reset and refresh replay. Interactive browser checks confirmed sign in, saving, populated comparison and zero-interest EMI (`₹120,000 / 12 = ₹10,000`, no interest). HTTP end-to-end coverage additionally exercises browser-facing proxy cookies and protected page redirects. Email verification is not enabled; that launch decision remains open.

## Phase 4 Seller workflow

Files: sell page, vehicle editor, seller dashboard/detail, `backend/src/routes/account.js`, `media.js`, review/publication routes, private storage and audit/history tables.

Implemented: passenger/commercial private drafts, seller contact separation, private uploads, preliminary configurable document checklists, additional loan/challan files, correction/resubmission within the same record, a full status timeline, manual document decisions, feedback and rejection reasons, review approval, and a separate inventory-permission publication action. Live listing edits invalidate inventory approval. Seller documents never enter public static folders, public APIs or sitemaps.

Validation: unit/integration regressions cover missing files, invalid image bytes, other-owner access, sales-role document/photo restrictions, more-information/resubmission, required-document acceptance, no automatic publication, reviewer inability to publish, and fresh approval after edits. Interactive browser QA inspected the guided seller form and draft progression. Production cloud storage, malware scanning and retention/deletion automation await provider and business decisions.

## Phase 5 Administration

Files: `frontend/app/admin`, `admin-frame`, `admin-collection`, `admin-inventory`, submission detail, and `backend/src/routes/admin.js`.

Implemented: permission-dependent live metrics/queues, activity feed, inventory create/edit/archive/reserve/sold/publication, image ordering/alt text, seller/document reviews, lead status/assignment/notes/history, drive confirmation/rescheduling/cancellation, customer access status, staff creation/role changes, self/last-admin protections, basic home/about/contact content, listing SEO, searchable audit records, date-filtered outcome reports and aggregate CSV exports. Table listings have filtering/search/pagination and useful empty states.

Validation: role/API regressions and live browser staff dashboard checks. HTTP end-to-end tests check that enquiry and drive requests affect staff metrics and that confirming a drive updates only the owning customer’s view. Metrics are stored-data counts; listing views count HTTP detail requests, not unique people. External traffic/conversion analytics are not configured.

## Phases 6 and 7 Deferred integrations and advanced features

Email/WhatsApp workflow notifications, external analytics, managed cloud media and authorised document-verification providers are not connected. The Contact page now embeds the owner-supplied Google Map. The optional reset-email HTTPS webhook is an adapter only and is disabled. No provider activity is claimed without configuration.

AI recommendations and vehicle price estimates have no placeholder prediction endpoint or fabricated output. Similar vehicles use actual published inventory of the same vehicle category. A future AI feature must preserve this approval/visibility gate.

## Phase 8 Launch work remains

Owner acceptance, final mobile/accessibility/performance audits, approved business/legal copy, provider setup, retention and privacy-request procedures, production database permissions, storage durability, encrypted backups/restore drills, HTTPS/domain deployment and monitoring are not declared complete. See `OPERATIONS.md`.

## Test scope

The current automated suite includes 33 database-free unit/regression tests and a MySQL integration parent containing 22 workflow/security scenarios (23 reported tests including the parent). The HTTP end-to-end suite has nine scenarios plus its parent and verifies server/page/network behaviour without executing client JavaScript. Five optional Playwright workflows execute customer/seller/staff journeys, shared-cookie two-tab refresh, mobile navigation, comparison and EMI. Final accessibility and Core Web Vitals measurement remain launch work. See `FIXES.md` for the current verification results and environmental limits; historical validation notes below describe earlier revisions.

The production build uses Next.js’s supported webpack mode. Turbopack compiled the development preview, but its production build-time subprocess was denied a local port by this environment. The webpack production bundle and route compilation passed. Development previews were also switched to webpack for consistent local behaviour. Both dependency audit results were clear after the framework/build dependency updates.

## Passenger and commercial separation update

Passenger cars and commercial vehicles now have explicit navigation labels, separate homepage inventory sections and category switches on their own inventory pages. Homepage search opens the selected category. Featured/recent listings and available makes are scoped to that category, with no invented inventory. Existing `/cars` and `/commercial` URLs remain intact.

The HTTP end-to-end suite checks that each page enforces its category even when a conflicting `type` is supplied in the URL, and verifies category-specific make counts. The disposable QA server now runs a temporary source snapshot so its generated Next.js/TypeScript files cannot rewrite the developer's working project. Production launch requirements listed above remain open.

## Usability redesign

The owner requested larger text throughout, an engaging dropdown navbar with Contact, EMI calculator and Discounts, an easier two/three-vehicle comparison, a redesigned EMI calculator, story/testimonial-led About, a contact form with real details/map and FAQs on relevant public pages. These are implemented locally. Base text is 17px on desktop and 16px on mobile, with larger labels/buttons and responsive layouts. Shared contact information is owner-supplied; it is held in `frontend/lib/business.ts` without overwriting existing database settings.

Comparison now has toggleable card choices, a floating shortlist, three slots, published-inventory search, removal/replacement and a differences-only specification table. The EMI calculator uses a numerically stable reducing-balance formula, direct inputs/sliders, tenure presets, a principal/interest chart, repayment totals and an annual schedule. Invalid inputs, zero interest and a full down payment are handled explicitly.

The owner requested fictional Indian-name testimonials and example discounts. These are visibly labelled samples, without fabricated verified ratings or redeemable savings. Actual quotes and dated offers can replace them in `frontend/lib/site-content.ts`; active offers are filtered by validity timestamps.

Customer signup/reset now accepts six characters and presents plain password guidance with a show/hide control. Staff creation retains a twelve-character minimum. Bcrypt byte limits remain enforced internally. The stopped backend was restarted; the frontend health route confirms MySQL connectivity. Contact enquiry success now includes an `NCR-<id>` reference; enquiries remain stored staff leads rather than email notifications.

Verification for this update includes 8 backend and 5 frontend unit tests, 18 reported MySQL workflow/security regression tests, and 10 reported HTTP end-to-end tests. HTTP tests cover six-character registration/login, short-password rejection, session cookies, public routes, category separation, stored enquiries, staff access and logout. Browser checks confirmed the desktop/mobile Vehicles dropdown, three-card selection, differences-only comparison, removal and persistence after refresh, password visibility, FAQ expansion and a zero-interest EMI of ₹10,000 for ₹120,000 over 12 months. Existing database rows were not reset or overwritten; automated test records live in disposable databases.

## Approved review fixes — 20 October 2026

Commit ordering, photo/approval invariants, staff reset rules, appointment editing/timezones, cross-tab session refresh, settings consistency, lead-reference search and upload failure cleanup were corrected. Reviewer inventory approvals and sales publication now have dedicated permitted screens. CI and optional browser workflows were added. Full details, test evidence and remaining provider/launch dependencies are recorded in `FIXES.md`.

## Admin offers studio — 25 October 2026

Discounts are now managed in `/admin/offers` using the existing administrator settings permission. Transactional, audited API routes support draft creation, editing, publication/scheduling, unpublishing and permanent removal with stale-version checks. Migration 004 adds the standalone `nw_offers` table. The public Discounts page now reads only active published records from MySQL, with distinct empty/error states.

The editor includes starter templates, four themes, four decorative styles, icons, custom badges/buttons, featured placement, reference codes, display ordering, schedule presets and a shared live card preview with narrow/wide modes. Duplication opens an unsaved private copy. Contact CTAs prefill the enquiry with the offer title. Offers remain promotional information; inventory prices are unchanged. See `OFFERS.md` for setup, workflow and current verification limits; earlier source-file sample-offer instructions above describe the superseded implementation.
