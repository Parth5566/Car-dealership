# Review fixes — 20 October 2026

## Final acceptance run — 27 October 2026

Run after the other agent's blog/SEO work finished. All suites used disposable databases; the owner's data was not touched.

| Suite                                                                                                                                                                                                                                    | Result                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| TypeScript, Prettier                                                                                                                                                                                                                     | Pass                                                   |
| Unit/regression (`npm test`)                                                                                                                                                                                                             | 197 pass (102 backend, 95 frontend)                    |
| MySQL integration (`npm run test:integration`)                                                                                                                                                                                           | 34/34 pass                                             |
| HTTP end-to-end (`npm run test:e2e`)                                                                                                                                                                                                     | 10/10 pass                                             |
| Browser workflows (`npm run test:browser`, Chromium, production build)                                                                                                                                                                   | 17/17 pass (3.6 min)                                   |
| Form sweep in WebKit (Safari engine): contact and vehicle enquiries, signup, profile, test drive, save, compare, EMI, valuation, sign out/in, forgot password, admin lead update, test-drive confirmation, staff creation, settings save | All submitted successfully                             |
| Main pages on phone and desktop (WebKit, local site)                                                                                                                                                                                     | HTTP 200, one H1, no sideways scroll, no broken images |

Fixed during the run:

1. **Sitewide API throttling.** The global API limiter (300 requests/minute per IP) counted the website's own server-side page renders, which all reach the loopback-only API from `127.0.0.1`. Every visitor therefore shared one allowance; the browser suite exhausted it ("Too many requests" on the test-drive form and a refused seller publication). Internal reads (GET/HEAD from loopback without `X-Forwarded-For`) now skip that limiter (`internalRead` in `backend/src/app.js`). Browser calls through the Next rewrite carry the visitor address and are still counted; writes and the dedicated login/enquiry limiters are unchanged. Per-visitor limits for browser traffic still depend on `TRUST_PROXY` (see OPERATIONS.md).
2. **Unknown policy pages returned 200 in production builds.** `proxy.ts` now rewrites unknown `/policies/:slug` addresses to a 404 before the page streams.
3. **Tests updated for intended changes:** the filters browser test opens the phone filter sheet; the component test harness provides `URL` and `@/lib/site` (used by the blog editor's search preview); the proxy harness provides `lib/policies`. New regression tests cover the limiter exemption and the policy 404.

Not verified here: real email/SMS delivery (not configured), live Scrappa valuation data, and production hosting (HTTPS, reverse proxy, `TRUST_PROXY`).

## Visual blog editor and article metadata — 26 October 2026

Upgraded the existing blog CMS with a Tiptap writing canvas, selection-aware formatting, H1–H4, accessible link dialogs/internal search, lists, tables, alignment, restrained colours and text sizes. Inline images support independent alt text, captions, alignment and proportional widths. Upload, article-scoped library, paste/drop, Word import, replacement and cover-image workflows require an alt-text review before committing an image. Cancelling a review leaves the body unchanged; unused uploads remain private rather than deleting assets that may still be referenced.

The existing article-specific author field remains the single source for bylines and author schema. Original publication dates survive later edits; UTC storage and IST controls support planned publication. Scheduled posts and their media stay private until due. Reading time and word counts come from actual content, including visible captions, and update after edits/import/retrieval. Rich content uses validated JSON, closed React rendering and transactional media references. Existing block articles remain readable. Draft auto-save is opt-in, versioned, serialized and paused on errors; unsaved-change warnings protect normal navigation.

Migration `007_blog_rich_media.sql` adds the nullable scheduling field and media-reference table. Tiptap packages are aligned at 3.32.0, with Mammoth 1.13.0 for worker-based DOCX conversion. The owner's dependency installation reported zero vulnerabilities. Styling is isolated to blog modules; shared layouts and global/mobile styles were left to the other agent. See [BLOG.md](BLOG.md) for setup, workflows and supported import limits.

Latest local verification: **191 source checks passed (100 backend, 91 frontend)**; TypeScript and an isolated production build passed. There is no configured lint command; scoped Prettier checking is used for formatting. Agent-side MySQL integration was blocked at setup by `EPERM` on localhost:3306. The owner subsequently confirmed that `npm run test:integration` passed on their host; no count was supplied. The suite includes a rich-document/media/scheduling case alongside the existing legacy-blog lifecycle case.

The owner's browser rerun passed **both rich-editor scenarios (2 passed, zero failures)** against the isolated production build and disposable database. It verified selection formatting, links, individual image alt text, publication metadata, Word import, pasted Docs content, image review and scheduling. The preceding failures were repaired: the schema assertion now parses JSON-LD directly, and paste/drop/image insertion preserve a selected image while retaining normal text-selection replacement. The production build, TypeScript and migration 007 also passed in that QA run. With the owner's subsequent integration-suite pass, the pending automated blog verification is complete. Migration of the website's actual database is not established by disposable QA setup.

Deliberate limits: media libraries are scoped to each article; unsupported remote image links require a normal upload; legacy `.doc`, original Word page layout and collaborative editing are not supported. Staged unused assets are retained privately with no automatic deletion. These limits do not bypass image alt-text review or content validation.

## Illustrated homepage confidence cards — 25 October 2026

Replaced the older three-icon reassurance row with four illustrated cards headed “Good journeys start with confidence,” between the car-valuation banner and sell-your-vehicle banner. The owner’s screenshot and [Spinny homepage](https://www.spinny.com/) supplied the reference for the illustrated row, rounded cards and framed heading. NCR Wheelz uses original inline vector artwork, its own teal/gold palette and its existing features: comparison of up to three cars, free indicative valuation, test-drive requests and contact with the team. No unsupported ratings, customer percentages or testimonial identities were added.

Four cards appear across wide screens, two columns on tablets and a native swipe/scroll-snap row on mobile. The links are keyboard accessible, artwork is decorative to assistive technology, and reduced-motion preferences disable hover movement. No additional client JavaScript or third-party image requests are required. TypeScript and production compilation pass; a server-render smoke check verifies four cards and all four destinations, and the original SVG artwork was rendered and visually inspected. Full-page browser preview could not run because the native computer-use service failed to start; owner Safari visual acceptance remains pending.

## Valuation comparable listings hidden — 25 October 2026

Removed the “Comparable asking prices” section and individual vehicle links from the result card at the owner's request. The estimate, source information and review/list-car actions remain. Updated existing browser assertions to expect no comparable-listing section. Pricing calculations and data-source behavior are unchanged.

## Variant dropdown and result simplification — 25 October 2026

Removed the expandable calculation/matching explanation from valuation results at the owner's request. Kept source attribution and the concise explanation for approximate endpoints.

The missing Variant dropdown came from using the brand/model-only filter catalog without fetching market Variant names. Added an on-demand, validated `/valuation/variants` read endpoint backed by one page of used-car listings for the selected model and nearby year. It uses known provider slugs, filters unrelated models/brands/years, returns only Variant/fuel/Transmission choices and shares the private cache and request budget. No new-car-generation trims or invented national Variant lists are substituted.

The native dropdown merges remote/local choices and keeps “Enter another Variant” available. Model/year changes abort previous lookups, ignore stale completions and clear dependent selections on model changes. Failures preserve local/current custom choices; a typed Variant reopens as a selected dropdown option. Targeted backend and component checks pass, including year bounds, duplicates, unrelated cars, safe fields, route validation, stale requests, failure fallback and derived fuel/Transmission. Public saved-response replay returns real Swift Variant choices without spending another credit. Live browser visual acceptance remains pending in the restricted agent environment.

## Broad valuation matches and single-listing estimates — 25 October 2026

At the owner's request, both Scrappa and local-stock valuation now accept one usable listing. Shared policy widens the year window to ±2 and distance to ±max(30,000 km, 50%), with lower/upper input-domain bounds. Variant and owner count no longer exclude otherwise compatible cars. They influence comparable display order with year/distance proximity. Brand/model, fuel/Transmission and area remain compatible; invalid/missing required values, duplicates, private/sample/stale local stock remain excluded. Local SQL uses bound area/year/distance values without exact Variant/owner predicates; the upstream market query uses the wider bounds too.

One/two-listing or identical-price results receive a disclosed site-defined ±10% band around the median/reference asking price, rounded outwards and extended to include observed prices. Three or more differing prices use their actual minimum/maximum and median. No usable candidates still produce no numeric range. The UI labels synthetic endpoints “Approximate price range,” explains the allowance visibly and shows comparable Variants/owner counts. No fitted model or condition/age/Variant adjustment is claimed.

Replaying the owner's nine-ad cached response for the screenshot's 2019 Swift VXi now yields six broad comparisons, ₹3,50,000–₹5,11,139 and median ₹4,62,500, without another upstream call. A fresh wider search can yield different results. Source tests and production build pass; targeted tests cover one/two/three listings, identical/small prices, rounding, missing values, broad compatibility, owner ranking, SQL bindings and UI explanations. The browser workflow now exercises three, two, one and zero eligible records, with preserved mobile/keyboard/contact assertions. Its discovery/syntax checks pass, but execution remains blocked by Chromium startup. SQL integration still cannot connect from this agent (`EPERM 127.0.0.1:3306`); no new live browser/SQL pass is claimed. No customer records or environment credentials changed.

## Scrappa catalog and market comparisons — 25 October 2026

Connected the owner-authorized backend key to Scrappa’s CarDekho filters/search. The live grouped taxonomy parser now reads all three categories, deduplicates entries and keeps actual provider slugs. The page receives 46 brands/484 models from the verified response instead of being limited to showroom stock. Variant entry remains explicit where no known local Variant exists; this source is not a complete year/Variant catalog.

Price checks use strict comparable advertisements, with public attribution, retrieval time and real source links. Three matching distinct INR ads are required. The owner-host live verification succeeded for a 2020 Swift LXI: 3 matches, ₹3,98,079–₹5,11,139, median ₹5,00,000. Public normalized diagnostics were inspected locally. No fabricated depreciation, condition adjustment or buyer/seller spread is applied. Sparse/unsupported results and provider errors offer a price review.

Added a server-only client with seven-day catalog/six-hour price caches, persistent UTC attempt caps (15/day, 450/month by default), nine-second upstream timeouts, no billable retries and error cooldowns. Automated tests disable live requests. The market picker retains its dropdowns after a typed Variant is reopened, and incomplete local stock cannot restrict market fuel/Transmission options. Credentials and seller contact details are excluded from frontend responses/cache allowlists.

Verification: `npm test`, TypeScript and production build pass. All 81 generated browser assets were scanned for the saved key; none contained it. Live verification was performed by the owner because agent DNS cannot resolve scrappa.co. Updated agent integration/browser attempts failed before application workflows: MySQL returned `connect EPERM 127.0.0.1:3306`, and Chromium exited during startup. No new browser/SQL pass is claimed. The owner’s earlier 30-test SQL pass predates this integration. Browser visual acceptance remains pending after restarting the development server. See [SCRAPPA.md](SCRAPPA.md) for configuration, data coverage, request use and diagnostics.

## Native valuation dropdowns and sparse-result explanation — 25 October 2026

Replaced browser-dependent text suggestions with native brand, model and Variant dropdowns, plus a City dropdown and Other city entry. Dependent selections reset as the car changes. The public options API now includes fuel and Transmission, allowing the picker to filter those combinations and select an unambiguous value without defaulting every car to Petrol/Manual. Unknown cars have a separate manual-entry path. Select sizing and arrows are styled consistently for Safari.

The result now states the number of matching listings and the required minimum. A range still needs three eligible real listings. The calculator cannot supply wider market estimates until a pricing provider is connected; sample inventory is excluded. The form and result explain that limitation before implying that an arbitrary car will receive a price. The range threshold and valuation mathematics were not changed.

All **106 source checks** pass (56 backend, 50 frontend), with TypeScript and production build passing. Regressions cover chained choices, fuel ambiguity, stale resets, manual/custom-city entry, sparse-result counts and submission propagation. Updated browser discovery succeeds, but Chromium exits at agent startup; targeted MySQL integration is blocked by EPERM. The owner's earlier valuation browser pass and 30-test integration pass predate these latest dropdown/projection edits.

## Integration test setup repairs — 25 October 2026

The owner confirmed the redesigned valuation browser test passed, then supplied an integration run with 25 passes and five failures. Three failures and their parent lifecycle failure came from Supertest closing an agent's temporary server during a nested version-read request. The suite now owns an explicitly listening HTTP server for its entire run, shares it across separate authenticated agents and anonymous clients, and closes it in cleanup.

The valuation fixture bypassed `vehicleSchema`, so `saveVehicle` received an undefined featured flag. Parsing the fixture first applies the normal defaults and validation. Existing assertions are retained; no production endpoint or dependency was changed. See B31 in BUGS.md.

All 105 source checks and the integration file's syntax/format checks pass. A focused schema/saveVehicle check confirms defined SQL values and the featured default. The integration rerun is blocked at setup by agent MySQL EPERM; a direct HTTP listener probe is also denied. The owner subsequently reran the full integration suite: **30 passed, zero failed** in approximately 37 seconds. The redesigned valuation browser workflow also passed. A manual-page “Endpoint not found” screenshot is being checked separately against the running development API.

## Valuation calculator redesign and provider research — 25 October 2026

Replaced the oversized illustrated two-step page with a compact Buyer/Seller calculator, manufacturing year and city fields, a combined car-selection dialog, kilometres driven and first/second/third/four-or-more ownership choices. The dialog resets dependent selections, validates nonblank details, restores focus and prevents its submit from bubbling into the outer price-check form. Ownership grouping is implemented in both SQL and the comparison engine; existing exact-owner requests retain their behavior.

Results appear beneath the form with a lower/upper asking-price range, median marker, comparable evidence and review action. Sparse stock still produces no invented amount. The engine remains limited to eligible local inventory. [Provider research](VALUATION_PROVIDERS.md) recommends evaluating Droom OBV first and IBB as a second partnership lead; it includes licensing questions, an unsent enquiry draft and the integration plan. No provider subscription or credentials were created.

All **105 source checks** pass (56 backend, 49 frontend), as do TypeScript and the production build. The owner subsequently confirmed the updated valuation browser test passed, covering mobile/keyboard/portal assertions. The owner also confirmed all 30 MySQL integration tests passed after the setup repairs above, including four-or-more ownership matching. The owner's full eleven-workflow pass predates this redesign. No real inventory or database schema changed.

## Transient session failures — 25 October 2026

The owner ten-workflow browser run passed nine, including car valuation, but timed out in the seller lifecycle after a proxied session read reset. The snapshot shows Published; the exact halted action is unknown because the trace archive was unavailable. Fixed the confirmed error handling that treated temporary session-service failures as sign-out. Safe reads retry once within their deadline; writes/token rotations do not. The proxy returns an uncached 503/retry page on service failure. The auth provider preserves identity while blocking protected content during outages; real authentication rejection still clears identity. Session restoration/sign-in handle service errors, and obsolete checks cannot overwrite a newer identity.

Added six source regressions, deliberate browser connection-reset coverage, named seller test stages and a scoped three-minute seller lifecycle budget. The runner now forwards Playwright filters. All 103 source checks and the production build pass; targeted discovery works, but Chromium still exits during agent startup. The owner subsequently confirmed all eleven browser workflows passed. See B30 in BUGS.md. No database or credentials changed.

## Car valuation page — 25 October 2026

Added `/car-valuation`, linked from Home, the Vehicles menu, the footer and sitemap. The first version included buyer/seller modes, two-step details and a decorative illustration; the redesign below replaces that form and layout while retaining the observed asking-price range, median, comparable links and enquiry handoff. Enquiries carry the submitted car details into the existing contact form; no contact details or login are needed for the price check itself.

The API uses current approved published passenger-car inventory. It excludes sample listings in every environment, matches exact car/owner/location details with stated age/distance windows, and requires three distinct listings before showing a range. Sparse stock receives a staff-review option. No nationwide provider, condition-adjusted model, promised offer or transaction-price database is represented as connected. No migration, real inventory change or credential change was made. Full contract and limitations: [VALUATION.md](VALUATION.md).

All **97 source-level checks** pass (55 backend, 42 frontend), TypeScript and production build pass. The expanded browser suite discovers ten workflows. New MySQL integration and browser scenarios were attempted but blocked by agent MySQL `EPERM` and Chromium startup failure. The owner later confirmed all eleven browser workflows passed before requesting the redesign.

## Latest browser repairs — 25 October 2026

The owner's expanded suite ran nine browser workflows: four passed and five failed. The shared Field component now applies labels and hints to actual controls inside wrappers. Session restoration uses a fresh document navigation after checking identity to bypass a cached protected-route redirect. The photo viewer explicitly cycles keyboard focus in both directions. An additional Chromium console error was repaired by escaping the hyphen in the offer reference-code pattern.

The seller workflow now selects form controls without matching description metadata. The offers workflow compiles public routes before editing and reloads/reopens its saved draft before publishing, verifying persistence after a reload. Its previous trace showed a development reload discarding the editor after a successful save.

All 41 frontend checks, TypeScript and the production build pass, including new nested-label and forward/reverse dialog-focus regressions. The owner subsequently reran the suite successfully: **9 passed in 4.2 minutes, zero failures**, followed by **Removed isolated browser QA data**. This confirms the five previously failing browser workflows now pass on the owner's Mac; the agent browser startup restriction remains separate. No database, customer inventory or credentials were changed. See B26–B29 and T04–T05 in `BUGS.md`.

The approved review fixes preserve the Next.js/Express/MySQL architecture and existing business data. No migrations, real account changes, storage deletions or provider activations were applied to the owner's database. No credentials were changed.

## Changes

- Enquiry/test-drive confirmations wait for commit. Registration/login/refresh cookies also wait for commit, preventing sessions from escaping a rolled-back transaction.
- Inventory photos can change only in Draft; upload/edit/removal clears approval. Draft approval requires a photo. Reserved inventory can be unpublished directly. Rejected uploads remove original and thumbnail files; a partial disk failure also triggers cleanup. Existing unreferenced files remain subject to the owner's retention policy.
- Reviewers have an inventory approval queue. Inventory staff have a separate approved-seller publication queue exposing vehicle specifications/photos while keeping seller identity and documents restricted.
- Staff recovery enforces the same twelve-character minimum as staff creation. Customers retain the approved six-character minimum.
- Appointment notes retain the existing schedule; genuine confirmation/rescheduling requires a future time. Datetime inputs use local fields, including DST handling. The admin form initializes the stored appointment and offers valid next statuses.
- Refresh is serialized across tabs using Web Locks or an IndexedDB lease. Waiting tabs recheck shared cookies. Server replay protection remains unchanged; no refresh tokens are persisted in JavaScript storage.
- One contact resolver supplies header/footer/Contact/FAQs. Existing owner defaults remain active until an admin explicitly saves public settings. Phone, second phone, email, hours, address and map changes then take effect together. Map URLs are validated; an empty embed hides the map.
- Lead search accepts displayed `NCR-<id>` references. Navigation uses path boundaries, and admin pagination retains a Previous link when a queue shrinks below the current page.
- Regression tests, disposable-database tests, optional Playwright workflows and GitHub Actions configuration were added. Test-environment setup failures and signalled test processes now produce nonzero exit codes.

## Verification

- `npm test`: 33 tests passed (21 backend; 12 frontend).
- `npm run typecheck`: passed.
- `npm run build`: webpack production build passed, including both new admin pages.
- `npm run format:check`: passed.
- MySQL integration was attempted but the execution sandbox denied `127.0.0.1:3306` with `EPERM`. HTTP E2E was blocked by denied port binding on 3100. Neither result is represented as a passing application test.
- Optional Playwright installation was attempted but npm registry DNS was unavailable. Browser tests were authored and syntax-checked, but were not executed here. CI installs pinned optional tooling and runs them against a disposable MySQL database.

Run `npm run test:integration`, `npm run test:e2e`, and the documented optional `npm run test:browser` on a host allowing local MySQL/HTTP connections before accepting the workflows for launch. The newly added CI configuration has not run in this workspace.

## Launch dependencies remain

Email/WhatsApp delivery, cloud media, malware scanning, retention policy and cleanup, verification/MFA decisions, approved legal/business content, deployment credentials, monitoring and backup/restore acceptance still require provider or owner input. No fabricated configuration or legal approval was introduced. AI/valuation and payments remain deferred.

## Follow-up repairs — 21 October 2026

All 17 follow-up findings have implemented repairs; see [BUGS.md](BUGS.md) for individual changes, evidence, and acceptance limits. This includes approval versions, refresh-aware enquiry ownership, separate rate limits, explicit request consent, digit-count phone validation, atomic seller photo ordering, replacement-photo ownership, refreshed downloads, guarded admin detail responses, accurate API errors, browser storage failure handling, saved-list removal feedback, valid review choices, and separate document upload timestamps.

The expanded suite has 56 passing checks (34 backend, 22 frontend). TypeScript, formatting and production build checks pass. New component checks exercise actual handlers using controlled hooks and deferred requests; they do not replace browser testing. Database integration and HTTP E2E are blocked by sandbox EPERM. Migrations 002/003 must be applied locally before starting this API against existing tables, following the backup procedure. No owner database rows or sample inventory were inserted in this repair pass. CI/browser acceptance remains pending.

## Second verification review — 21 October 2026

Four more issues were reproduced and repaired (B18–B21 in BUGS.md): uploaded files could be deleted after an uncertain commit; interrupted additive migrations could fail on retry; new photos could appear in the middle of a gallery after deletions; older admin filter/report responses could replace newer results. The repairs preserve original transaction failures, discard unusable connections, retain files after uncertain commits, verify existing migration column definitions, append photos safely, and guard obsolete async results.

Latest automated result: 65 passing checks (41 backend, 24 frontend), plus passing TypeScript, formatting and production build checks. MySQL integration and HTTP E2E were attempted again and remain blocked by EPERM before test setup. The code is ready for controlled sample testing once pending migrations are applied; live form/browser acceptance is still outstanding. No sample cars or owner database changes were made in this pass.

## Owner-run MySQL feedback — sample SEO filter

The owner’s integration run passed 25 child cases and exposed a sample-vehicle leak into the SEO listing feed (B22); the parent test failure is a consequence of that same child failure. The shared sitemap/production predicate now unquotes the JSON sample marker before comparing native strings. Importer lookup uses an explicit true string comparison as well. The original failing assertion is retained and strengthened with real MySQL flag cases and an ordinary published control row, ensuring the repair does not simply remove all listings.

The 65-check local suite passes. The owner subsequently reran the complete MySQL integration suite successfully: 27 reported tests passed, zero failures. Agent-host database access remains denied, but the owner-host run verifies the B22 repair. The owner’s Applied 001/002/003 messages belong to the isolated test database and do not establish that migrations were applied to the website database. No owner inventory was inserted or altered by this repair.

## Latest owner verification

The owner supplied a successful `npm run test:integration` rerun: 27 reported tests passed with zero failures. This includes the previously failing sample SEO/production predicate and sample archival case. ER_SIGNAL_EXCEPTION is intentionally generated by the rollback test; DELIVERY_UNAVAILABLE is expected while reset delivery is disabled. The owner subsequently supplied a successful HTTP E2E run: 10 reported tests passed with zero failures, followed by isolated QA cleanup. Interactive browser acceptance and confirmation of the actual website database migration remain the next steps.

The HTTP suite verifies rendered public/SEO pages, category separation, protected-page redirects, HttpOnly signup sessions, customer/staff access, saved vehicles, request persistence, appointment confirmation, logout and six-character customer login through Next.js and Express. It does not execute browser JavaScript. The next automated step is the optional Playwright suite documented in README.md; the pinned root dependency is now installed, but its Chromium installation needs repair.

## Browser runner discovery repair

The owner’s browser run stopped before executing tests because the root CLI and frontend specs loaded two Playwright versions (1.56.1 and 1.64.1). A shared root resolver now supplies the CLI, defineConfig, test and expect. The failure was reproduced locally, then discovery passed with all five tests and both installations retained. Browser runs now check discovery before database/server setup; `npm run test:browser:list` also performs that check alone. Full browser workflow execution remains pending on the owner’s host.

## Browser installation diagnosis

The next owner runs discovered all five tests, but none could launch because the separate headless shell was missing. The installed full Chromium was also incomplete: its executable existed without the required macOS Frameworks directory. Tests now explicitly use the full Chromium channel, and the runner checks actual browser startup before creating the isolated database. The README includes a forced installation command for repairing partial downloads. A clean temporary installation was attempted here and failed with DNS ENOTFOUND on Playwright's download hosts. Verification of the updated runner discovered all five tests and stopped at the browser startup check before QA database setup. Browser workflow results remain unverified until the installation is repaired and the five tests execute successfully.

## Admin editing of seller-listed vehicles — 25 October 2026

Admins can edit a seller's vehicle details before publication from Seller reviews → Edit details. A new version-checked PATCH route requires both inventory and review permissions; seller contact details stay separate. Changing an active reviewed submission clears its approval and returns it to Under review. Owner-editable drafts remain drafts, with stale-owner saves rejected when they carry the inspected version.

Existing listings open the inventory editor, with an Unpublish & edit vehicle action for published/reserved cars. All schema-supported vehicle fields can be changed, including price, brand/model, variant, distance, fuel economy, transmission, passenger/commercial category, location, owner count, seats, load capacity, description, features and search metadata. Inventory edits synchronize the seller's displayed vehicle details and invalidate inventory approval. A category change also clears seller review approval so the new document checklist must be satisfied. Document approval counts the current linked inventory photos.

History records staff edits and previous/new asking prices; audit records retain before/after car data. Detail saves reject stale inspected versions, and seller review decisions now require an inspected version, preventing an older review from approving newly edited details. Editing, approval and status changes lock linked submissions before inventory records to match publication's lock order. The existing database tables support these changes; no migration is needed.

Verification for admin vehicle editing: the complete local suite passes (50 backend and 39 frontend checks), along with the production build and TypeScript. Integration now checks admin-only seller price correction, stale edit/review rejection, owner-visible values and publication with the revised price. The browser seller lifecycle now includes admin editing before publication and unpublishing/editing a live listing. The attempted live runs remain blocked at setup: MySQL returns EPERM and Chromium exits at startup. Their added assertions have not executed here. Browser discovery loads all nine workflows.

## Development startup port conflict — 25 October 2026

The owner's next startup exposed EADDRINUSE on 127.0.0.1:5001. Inspection confirmed an earlier project backend process, PID 84852, was still listening. Terminating that identified process was attempted but denied by the execution environment. It still needs to be stopped from the owner's Terminal before restarting the stack.

The development launcher now checks both ports before launching either service, pins the frontend to port 3000, and reports a specific occupied-port instruction. On macOS/Linux, both npm services run in their own process groups; Ctrl+C and service failures stop the watchers and server descendants as well as npm. Controlled execution verified that an occupied port prevents both launches, SIGINT reaches both process groups exactly once, and a service failure stops its sibling. Live startup remains pending while the earlier API process owns port 5001.

## Sign-in connectivity and session restoration — 25 October 2026

The owner reported a sign-in network error. Both local processes were listening, so an offline API was not established as the cause. Frontend server requests used localhost while Express binds only to IPv4 loopback; the local API_URL, fallback origins and QA upstream now explicitly use 127.0.0.1. The browser continues to use localhost:3000 and same-origin API requests.

Development logs also contained Safari history.replaceState rate-limit errors. Source review found that the session-restoration page reused cached auth context without refreshing an expired access cookie. Sign-in could likewise immediately redirect using a cached user after the server sent it back. Both pages now await a fresh identity check; Providers.reload returns that result, and late checks cannot navigate after unmount. Controlled tests cover expired, valid and unmounted cases, and a browser case covers navigation with cached user context after access-cookie removal. These repairs do not establish the exact cause of the screenshot's failed fetch; live connectivity and the latest owner-host terminal error still need verification.

## Installer extraction hang — 22 October 2026

The owner's screenshot showed the forced reinstall remaining at 100%. The retained Chromium ZIP contains 641 entries, includes the missing framework, and passes CRC verification for every entry. Running the installed Playwright 1.56.1 extractor against that ZIP in a fresh temporary directory on Node 26.8.2 stalled for 15 seconds without producing the Frameworks directory. This matches the [upstream Node 26 extraction bug](https://github.com/microsoft/playwright/issues/40724) and the [older-version regression report](https://github.com/microsoft/playwright/issues/40998). A repeated download with the same tooling does not resolve the extraction incompatibility.

The README, runner repair message and CI optional-tooling command now specify Playwright 1.64.1. The shared root resolver and full Chromium channel remain in use. Stop the stuck installer before upgrading the root tooling, then force the browser installation and rerun the suite. Installing the updated root tooling here failed with registry DNS ENOTFOUND; the updated installer and interactive workflows have not been verified. No website database changes were made.

## Owner browser run and locator repairs — 22 October 2026

The owner subsequently completed Chromium installation and ran all five browser tests. Signup/test-drive, two-tab refresh and mobile navigation/comparison/EMI passed. Inventory publication timed out looking for an exact label; seller upload verification counted links instead of the rendered private-download buttons.

Trace evidence shows successful inventory approval (200), successful seller photo/document uploads (201), the Change status combobox with Published available, and the Download privately button. The publication label wraps the select and includes its option text, preventing the exact label-text match. Both that select and the later seller-review Decision select now use combobox roles with exact accessible names. Private-download assertions now count buttons, retaining the original per-upload counts and subsequent authorization/publication assertions. See T03 in BUGS.md.

An agent-side minimal Chromium launch was attempted but exited with SIGABRT in this restricted environment. No customer inventory, permissions or application behavior changed in this locator repair.

## Successful owner browser rerun — 22 October 2026

The owner's latest `npm run test:browser` completed with **5 passed (2.2m)** and reported **Removed isolated browser QA data**. All five workflows passed: customer signup/test-drive with local appointment times; two-tab expired-session restoration; reviewer inventory approval and sales publication; seller uploads/document review/sales publication with private-document access checks; and mobile navigation/comparison/EMI. This verifies the Chromium installation and T03 locator repairs on the owner's Mac.

Recorded verification now includes 65 source-level checks, 27 owner-run MySQL integration tests, 10 owner-run HTTP E2E tests and five owner-run browser workflows. The browser migration messages apply to its disposable QA database; they do not establish that the website database was migrated. Website sample inventory/manual acceptance and CI execution remain separate pending work.

## Currency hydration repair — 24 October 2026

The owner reported a homepage hydration mismatch: Node rendered ₹7,25,000 and the browser rendered ₹ 7,25,000. The shared INR formatter now normalizes whitespace from runtime currency output, retaining grouping, whole-rupee rounding and negative signs. Existing consumers receive consistent prices across vehicle cards, comparison, seller/admin screens and EMI. See B23 in BUGS.md.

The new regression test failed with the original formatter and the exact reported spacing difference, then passed after the repair. It simulates ordinary, non-breaking and narrow non-breaking currency separators. `npm test` passes all 67 checks (41 backend, 26 frontend); TypeScript and changed-file formatting checks also pass. The owner's previous five browser workflows passed before this change. The owner subsequently reloaded the homepage from origin in Safari (Option–Command–R) and confirmed no new errors, verifying that the reported hydration error no longer appeared on that refresh. No database or media changes were made.

## Seller listing layout and photo viewer — 24 October 2026

The owner identified grey specification space when optional fields were omitted, and missing next/previous and full-view photo controls. Filled specification cells now wrap and stretch across each row using the existing responsive column counts. The gallery shows complete images, previous/next arrows, counters and selected thumbnails. Clicking the main image opens a viewport-sized native modal with arrow buttons, keyboard navigation, Escape/close, focus containment and scroll/focus restoration.

All 69 source-level checks pass (41 backend, 28 frontend), including two new component regressions; TypeScript also passes. The expanded browser suite discovers six tests, with a new workflow covering the gallery, modal focus behavior and responsive specification geometry. Full browser execution was attempted but stopped at Chromium startup in the restricted agent environment; native UI automation was unavailable as well. The new visual behavior still requires owner-host browser confirmation. No database, account or media changes were made. See B24/B25 in BUGS.md.

## Listing description and test-drive emphasis — 24 October 2026

Following the owner's updated listing screenshot, the description now uses a compact About this vehicle card with a smaller heading, readable body text and preserved seller line breaks. Features remain in a separate subsection when supplied. Request a test drive is now the full-width gold action above enquiry/save/compare, with calendar and arrow icons. On narrow screens the enquiry action also occupies its own row. The existing test-drive URL and enquiry behavior are retained.

TypeScript and changed-file formatting checks pass. This presentation-only change was not verified in a live browser from the restricted agent environment; owner refresh/visual acceptance remains pending. No listing content or database values were changed.

## Vehicle-page typography and description layout — 24 October 2026

The owner requested a more cohesive vehicle-page design after reviewing the previous layout. Inventory and detail pages now share a native system font and a smaller heading/price scale. Detail-page top spacing is reduced, the gallery is slightly wider than the white vehicle summary, specifications are more compact, and the gold test-drive action remains first. The summary groups the vehicle type, location, title, variant and asking price; its responsive layout becomes one column below 950px. Inventory card text and prices use the same type scale.

A description of at most 180 characters without features appears as a compact inline Seller’s note beneath the gallery. Longer descriptions or listings with features use a Seller’s description section with preserved line breaks. Seller text is unchanged; no vehicle condition, service history or features are fabricated to fill space.

TypeScript and formatting pass. A server-render smoke check exercised short text, long text and short text with features, confirming the appropriate presentation and the unchanged vehicle-specific test-drive URL. Safari preview was attempted but the native UI service failed to start, so owner visual acceptance remains pending. No data or credentials changed.

## Compact passenger and commercial filters — 24 October 2026

Both inventory pages now share a compact filter component. Search, maximum budget and fuel remain visible; budget offers lakh-based presets and a custom amount. Additional criteria are under native More filters, automatically expanded when those criteria are applied. Applied-filter tags allow removing one criterion while preserving the rest and resetting pagination. Clear all returns to the same category. Commercial load capacity remains available under More filters. Sorting now sits beside the result count and submits the same filter form, including current choices. The main action is labelled Show vehicles.

Custom budget drafts survive switching to a preset and back, with exactly one canonical max_price field submitted. Query-dependent component keys refresh inputs when navigation changes the applied criteria. Category-specific GET endpoints and the existing backend filter contract are retained. Tablet/mobile layouts group common fields and enlarge input/tap targets.

`npm test` passes 72 checks (41 backend, 31 frontend); TypeScript and changed-file formatting pass. Three component regressions cover sorting through the shared form, custom/preset budget transitions, category-specific fields, zero-valued criteria, per-filter clearing and pagination reset. A seventh browser workflow covers desktop passenger and mobile commercial filtering, custom budgets, sorting and removable criteria; all seven workflows are discovered. The new workflow has not executed here because the agent browser remains unavailable; owner-host browser verification remains pending. No database, inventory or credentials changed.

## Admin discounts and offer customization — 25 October 2026

Added **Admin → Discounts & offers** at `/admin/offers`, restricted by the existing administrator settings permission. Administrators can create/edit drafts, publish immediately or schedule, unpublish, duplicate and permanently remove offers with explicit removal confirmation. Search, state filters, live/scheduled/draft/expired counts and pagination organize the library. The editor includes reusable starter templates, four color themes, four background patterns, icons, badges, featured placement, custom button labels/destinations, reference codes, display order and schedule shortcuts. A shared card component provides the public rendering and narrow/wide live preview.

The public Discounts page now fetches active published offers from MySQL instead of source-file examples. Drafts, future and expired offers are excluded at the API. Contact offer buttons prefill the enquiry message with the offer title. Offers do not automatically adjust inventory prices or EMI. Failed saves preserve editor content; writes use row locks and version checks to reject stale edits, status changes and removal. All mutations are transactional and audited, and success follows commit.

Migration `004_offers.sql` creates only `nw_offers`. Agent-side database inspection and the expanded isolated integration suite were attempted but denied by `EPERM` before setup. No website migration, campaign insertion/publication, inventory change or credential change was performed. Back up the website database/storage and run `npm run db:migrate` locally, then restart the application. See `OFFERS.md` for the full workflow.

`npm test` passes **80 checks (46 backend, 34 frontend)**. TypeScript and the webpack production build pass, including `/admin/offers`. The new browser lifecycle workflow brings discovery to **eight workflows**. Full browser execution stops at Chromium startup before provisioning QA data; native UI initialization also fails in this environment. The new MySQL/browser scenarios and visual acceptance remain pending on the owner host. Historical owner test passes above predate this feature.

## Comparison table label overflow — 25 October 2026

The owner's Safari screenshot showed **Kilometres driven** painting past the specification column into the first vehicle value. The shared global `th` rule used `white-space: nowrap`; the comparison table's existing `overflow-wrap: anywhere` could not wrap text while that rule remained active. Comparison header and value cells now explicitly use `white-space: normal`, allowing long specification labels, vehicle names and variants to wrap within their assigned columns. Existing column widths, sticky specification labels and horizontal mobile scrolling are retained.

Changed-file formatting passes. Browser verification was attempted, but Chromium again exited during startup before any workflow ran. Owner refresh/visual acceptance remains pending; no database or comparison selections were changed.

## Comparison table typography and spacing — 25 October 2026

The owner's follow-up screenshot confirmed that the wrapping repair contained the text but left **Specification** split before its final letter, with oversized uppercase labels and excessive table spacing. The comparison table now uses compact system typography, sentence-case labels, a wider 220px desktop/170px mobile specification column, natural word wrapping for labels, smaller vehicle headings/variants and tighter rows. Subtle row separators replace the uninterrupted tinted label strip. Two-vehicle tables retain at least 720px of width; three-vehicle tables retain 900px so vehicle columns stay readable within the existing horizontal scroll container. Value cells still break long unspaced content when necessary.

Changed-file formatting passes. Native browser preview was checked again, but its service still fails to initialize, so visual acceptance remains pending on the owner's Safari. No vehicle data, database records or saved comparison choices changed.

## Original brand visuals and public-page guidance — 25 October 2026

Added photo-led homepage benefits with accessible Buy/Sell tabs and original three-step SVG illustrations. Each mode links to the actual buying or private seller workflow. Four generated brand photographs are stored locally as optimized WebP assets and labelled illustrative. Existing illustrated journey cards remain, with new buying/selling/finance reading cards. About no longer renders fictional customer testimonials.

Passenger/commercial inventory, About, Contact, Finance, EMI, comparison, valuation and vehicle detail pages now have relevant preparation guidance. A new public `/selling-guide` explains drafts, photos, documents, manual review and transfer preparation, with discovery from home, footer, the seller form and sitemap. Account protection and all transaction workflows remain unchanged. Previously removed comparable asking prices and range-calculation sections remain absent. No warranty, refund guarantee, real customer endorsement or unsupported business metric was introduced.

All 120 source checks pass (65 backend and 55 frontend); TypeScript and production build pass. New tab regression checks state, keyboard focus and ARIA relationships. A browser scenario covers desktop/mobile tabs, loaded photos and selling-guide navigation; all 12 browser workflows are discoverable. Execution was attempted but Chromium exits before startup, and local HTTP listener binding is denied with EPERM. Photos and SVG contact sheets were visually inspected; final rendered-page visual acceptance remains for the owner host. No database records, credentials or provider credits were used. See [BRAND_CONTENT.md](BRAND_CONTENT.md) for page coverage, source references, asset paths and exact generation prompts.

## Shared policy document design and expanded wording — 25 October 2026

Replaced the narrow policy placeholder presentation with a shared teal-header document layout, summary, numbered sections, desktop contents sidebar, mobile collapsible contents, related-policy navigation and configured contact details. Nine existing routes now contain 93 sections covering the actual website services. Privacy wording now acknowledges Scrappa/CarDekho pricing requests and the Google Maps embed. Cookie controls remain functional, unknown/prototype-property slugs safely return 404, and existing no-index/draft status is retained. No transaction, payment, consent-version or data-access behaviour changed.

The requested Websnexa URLs could not be loaded. The owner's Desktop recording was located but could not be decoded by the available tools, so this is a project-consistent provisional layout pending an accessible visual reference. It is not a claimed match to unviewed pages. TypeScript, production build, 55 frontend source checks and server-render checks for all nine policy documents pass. Browser coverage was added and execution attempted, but Chromium exits before startup. See [POLICY_PAGES.md](POLICY_PAGES.md) for coverage, primary sources, review gaps and reference-access limitations.

## Footer redesign and Home navigation — 25 October 2026

Added Home as the first link in the shared desktop/mobile main navigation. Its active state matches only `/`, and clicking it uses the existing menu-closing behaviour. A focused desktop rule keeps the extra link compact at 1251–1350px widths.

The footer now has scoped CSS with a dark teal surface, gold accents, a compact browse/contact invitation, clear Explore / Tools & selling / Policies & guidance groups, business address and opening hours, directions, configured phone/email/WhatsApp contacts and a separate legal/support row. All nine policy routes are discoverable. Missing optional contact channels are omitted and admin contact overrides are respected. Tablet/mobile layouts reorganise the groups and contact strip. No social accounts, business statistics or service guarantees were invented.

Reference structure reviewed: [Spinny](https://www.spinny.com/) groups company, offerings, tools, contact and policy destinations; [Cars24](https://www.cars24.com/) separates company, discovery and support; [CarWale](https://www.carwale.com/) provides compact company and legal destinations. The footer uses original NCR Wheelz styling and copy.

Production build, TypeScript and formatting pass. All 55 frontend source checks pass. Server-render smoke checks cover default/custom/removed contact data and 78 internal footer links across three cases. Header smoke checks confirm Home is first and active only on the homepage. Existing browser scenarios now cover the Home link, desktop navbar width and mobile menu closure. Browser execution was attempted but Chromium exits at startup, so rendered visual acceptance remains on the owner host. No backend, database or credentials changed.

## Contact page styling and navbar emphasis — 25 October 2026

Contact us is now a persistent teal navbar action with white text and a darker/gold-inset hover/current-page state. This applies to the shared desktop/mobile navigation.

The Contact page now uses scoped styles: sage/cream hero with original code-native conversation/car artwork, quick links to the form and visit section, compact contact-method cards, optional WhatsApp contact, a clear enquiry panel, a visit reminder and an address/map card. Form controls have consistent spacing and restrained typography; the email field occupies a full row. Mobile layouts stack the form and map, while unavailable business contact channels and an intentionally removed map are omitted. Existing enquiry handling, consent, offer/valuation prefills, request length limits and FAQ data remain intact. No response-time, warranty or new service guarantee was introduced.

Production build (including TypeScript), formatting and 55 frontend source checks pass. Contact-page server-render checks cover anchor targets, offer-over-valuation precedence, invalid array parameters, default/custom/removed contact settings, optional WhatsApp and optional map. Browser execution of the existing offer/contact workflow was attempted but Chromium exits during startup; rendered visual acceptance remains pending on the owner host. No API, database, credentials or external provider settings changed.

## Technical SEO audit — 25 October 2026

Configured the owner-selected canonical domain `https://ncrwheelz.com`; added shared page metadata, social PNG previews/icons, business/website/page/tool/breadcrumb/FAQ schemas and enriched real vehicle Product/Car/Vehicle markup. Samples remain excluded. The homepage raster asset is WebP and every served public asset is now WebP or PNG. Gallery/admin/seller image alternatives have blank-value fallbacks. Added headings to the empty test-drive and unavailable listing states.

Fixed robots prefix collisions: `/sell` no longer blocks `/selling-guide`, and public vehicle media is explicitly allowed through the API exclusion. Improved sitemap date handling and failure behavior, and added `/llms.txt`. Private routes and draft policies retain their noindex/sitemap exclusions. No email implementation, database data or customer files were changed.

All 129 source checks (65 backend + 64 frontend) and the production build including TypeScript pass. Nine SEO checks include real React SSR of 21 page scenarios with deterministic API fixtures, plus decoded image-format checks and crawler-rule tests. Extended HTTP QA coverage could not run because port 3100 binding is denied with EPERM in this session. Live indexing, rich-result and Core Web Vitals validation remains pending deployment; see [SEO.md](SEO.md).

## Seller dropdowns with manual entry — 26 October 2026

The seller editor now links brand, model, manufacturing year and variant dropdowns using the existing market catalog/variant APIs and public inventory suggestions. Vehicle style, city, owners and seats also offer dropdowns. Each supports “Not listed? Enter manually…” so missing cars and details can still be saved. Brand/model/year changes clear dependent selections; late or failed suggestion requests do not replace entered values or prevent manual entry. Existing draft details are retained. Manual values stay in the private submission and follow the normal review workflow; they do not modify the external catalog. Fuel and transmission retain their supported choices.

The new category-specific `/vehicle-options` endpoint exposes only brand/model/year/variant from approved public, non-sample stock. Commercial forms do not query the passenger-car provider. No database migration or real inventory change was required. See [SCRAPPA.md](SCRAPPA.md) for behavior and [API.md](API.md) for the endpoint.

All **140 source checks (69 backend + 71 frontend)** and the production build passed. After the final draft-preservation adjustment, all 33 form regression tests and TypeScript passed again. Browser discovery finds 13 workflows, including the enhanced seller lifecycle scenario. Database integration execution was attempted but blocked by `connect EPERM 127.0.0.1:3306`; targeted browser execution was blocked at Chromium startup. Neither is recorded as passing. A duplicate variable in the existing integration test was also renamed so the file parses successfully.

## Seller catalog loading and commercial cab scope — 26 October 2026

Removed the dependency between seller stock suggestions and the market catalog request. Both requests start independently, and either can populate dropdowns before the other finishes. Missing/failed/empty stock suggestions or a stale capability flag no longer suppress available catalog brands. Manual details survive failures and retries; unavailable suggestions show a retry action and guidance beside the brand field. Existing cancellation and dependent-selection resets remain in place.

The owner clarified that commercial means yellow-plate passenger cabs. Both categories now use car catalog/model/variant suggestions. Updated category labels, car icons, metadata, FAQs and buying guidance; removed truck/body presets and goods-load inputs, filters and specification rows. The stored category key and route remain `commercial` and `/commercial`. Legacy payload storage remains compatible; vehicle forms send null. Future sample fixtures use two passenger cabs; explicit archival still recognizes earlier truck sample identities. No real inventory was changed.

Validation: `npm test` passes all 142 source checks (70 backend, 72 frontend), and the production build including TypeScript passes. Regression coverage includes missing/malformed/empty/slow stock suggestions, stale capability flags, both cab/personal-car catalogs, variants, outage retry and manual-value preservation. All 13 browser workflows are discovered; targeted seller execution was attempted but Chromium closed at startup, so no browser assertions executed. Live local endpoint inspection was denied with `EPERM` in this session. Restart the development servers together before checking the updated form.

## Form notification emails — 26 October 2026

Added server-side Gmail SMTP notifications for contact messages, vehicle enquiries, test-drive requests and completed seller submissions. Both owner-selected receiving addresses receive separate staff messages; customers receive the approved acknowledgement and their request reference. Seller drafts/uploads do not trigger notifications, while a valid resubmission after requested information creates a fresh notification event. Private documents are not attached. Staff replies target the customer's submitted email; customer replies target the sender mailbox.

Migration `005_email_outbox.sql` persists each recipient's notification in the same transaction as the request/history. The API worker sends after commit, with independent retries, exponential backoff, an authentication cooldown, a shared database sender lock, recovery leases and a sliding 24-hour cap. Existing admin records remain the source for enquiries and follow-up. Added setup/authentication verification, queue status, one-batch dispatch and failed-ID retry commands. Templates escape user text, credentials remain server-side and SMTP diagnostics use safe codes. Privacy text now describes the enabled email workflow.

All 154 source checks (82 backend, 72 frontend) and the production build including TypeScript pass. The eleven email tests cover all four events, both inboxes, separate customer envelopes, exact acknowledgement text, escaping, durable inserts, retry isolation, duplicate completed-job prevention, auth failures, daily caps, competing workers, interrupted send recovery and activation only after successful SMTP/database setup. Integration coverage now asserts queue rows for the normal form lifecycle, silent draft saves, seller resubmissions and rollback atomicity. Integration execution and migration were attempted but blocked by MySQL `EPERM`. SMTP authentication verification returned `EDNS` in this agent session. No real email was sent here.

The mail package is installed locally; its cached official 10.2.1 tarball was verified and its SHA-512 integrity recorded in the lockfile. The saved App Password is present. Sender, receiving addresses and Gmail transport settings were configured without displaying the secret. Notifications remain disabled until `npm run email:setup` succeeds on the owner host, creates the queue table and saves the activation flag; the API must then restart. See [EMAIL.md](EMAIL.md).

## Backend dependency security patches — 26 October 2026

The owner’s post-install audit identified two high-severity denial-of-service findings. Raised the Multer dependency minimum and lockfile to **2.5.0**, addressing [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m). Updated Express 4’s compatible transitive body-parser lockfile entry to **1.20.9**, addressing [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828). Both package tarball URLs and integrity hashes came from the cached npm registry metadata. Express remains on 4.22.3; no forced major upgrade or middleware behavior change was introduced.

The agent’s package downloads and live audit request were blocked by npm registry DNS resolution. The owner installed the two patched packages and reported **zero vulnerabilities** from the live npm audit. Agent inspection confirms installed and locked versions match. All 82 backend tests pass against the patched packages; additional socket-free smoke checks passed for compressed JSON parsing and multipart file data. Restart the API to replace modules already loaded by a running process.

The owner also confirmed that `email:setup` authenticated Gmail, applied `005_email_outbox.sql`, enabled notifications and restarted both services successfully. This confirms setup and API startup; delivery to both staff inboxes and the customer's acknowledgement still need an actual form submission check.

## Seller draft follow-up notifications — 26 October 2026

Saving the initial seller vehicle/contact form now adds the private draft to a staff follow-up queue. The seller sees “Your draft is submitted to our team” with options to complete photos/documents or wait for staff contact. The save button explains that it notifies the team. Existing uncontacted drafts are included too.

Review-authorised staff see the pending total in an admin notice and a dashboard queue, with a **Drafts to contact** filter under Seller reviews. The notice refreshes every 30 seconds while visible, on tab return/navigation and after a contact action. Staff can open the draft, view the private contact details and select **Mark contacted** after contacting the seller. One history/audit event clears the notification; repeated requests do not duplicate the event. The vehicle stays a private, editable draft and still needs the existing documents, photos, approval and publication steps. Editing the draft does not re-notify as a new first-contact request. Draft saving does not send email.

No migration is required: the draft and its existing history/audit tables provide durable follow-up state. The two new endpoints require review permission. Tests cover transactional draft persistence, failed commits, role restrictions, duplicate contact recording, missing/non-draft rejection, seller next-step links, background refresh, late responses after permissions change and retry after a failed contact action. All 160 source checks (86 backend and 74 frontend) and TypeScript pass. The integration scenario now covers concurrent staff contact actions, queue removal and continued seller editing; the existing browser seller workflow now covers the confirmation, staff follow-up and completion link. Live execution was attempted but MySQL access was blocked by `connect EPERM 127.0.0.1:3306` and Chromium exited before test startup.

## Admin-managed blog — 26 October 2026

Added a public journal at `/blog`, article pages at `/blog/[slug]` and an authoring area under **Admin → Blog posts**. Staff with the existing content/settings permission can save drafts, write with paragraph/heading/list/quote blocks, upload a cover with alt text, preview privately, publish, update a live article, unpublish or archive. Drafts and staged covers remain private. Publication updates public cards, the homepage journal section and the dynamic sitemap without a frontend rebuild. The Vehicles menu and footer link to the blog. Categories/search/pagination, author bylines, reading time, canonical/sharing metadata and BlogPosting/breadcrumb schemas are included.

Migration `006_blog.sql` creates only the new post/media tables. Writes and audit events use transactions; optimistic versions prevent stale overwrites. Published addresses remain stable. Uploads are decoded and converted to WebP with size/pixel limits; photos only become publicly accessible when selected by a published post. Raw article text is escaped during rendering. Archived posts and unused uploads are retained rather than permanently deleted. No example posts were added to the real website.

All **173 source checks (93 backend and 80 frontend)**, TypeScript, the isolated production build and repository formatting check pass. New checks cover private drafts and photos, publication requirements, content permissions, stale writes, duplicate addresses, failed transactions, upload cleanup, editor preview/failure handling, escaped rendering and article metadata/sitemap output. The migration regression now checks the actual migration list rather than assuming five files. Integration and browser scenarios cover the full blog lifecycle; their execution was attempted but blocked before business assertions by MySQL `EPERM` and Chromium startup failure respectively.

The live migration was attempted and denied with `EPERM`, so owner-host activation still requires `npm run db:migrate`, followed by a restart of the existing API/development process. No new package, CMS account or API key is needed. See [BLOG.md](BLOG.md).

## Seller draft detail navigation — 26 October 2026

The owner's failing browser traces showed that the pending draft queue and its APIs loaded successfully. Clicking **View draft / contact seller** requested `/admin/submissions/1`, but development refresh during cold route compilation reloaded the previous queue URL in both open browser contexts. This also interrupted document navigation, so changing the link alone did not resolve the failure. No contact request was sent.

Automated browser QA now builds its temporary frontend snapshot with `next build --webpack` and serves it with `next start`, removing development refresh and cold compilation from the test run. The launcher allows five minutes for environment startup/build before per-test budgets begin. The active build/server child remains tracked for teardown; a failed or interrupted build cannot start a server. Interactive `qa:browser` keeps development mode unless `--production` is requested. The project's normal development server is unchanged. Submission links use the usual Next Link navigation, and the browser scenario still verifies the destination URL and follow-up heading before recording contact. No migration is required.

All **176 source tests (96 backend and 80 frontend)**, TypeScript and a real production build of the same isolated frontend snapshot pass. Checks cover build/start ordering, failed/interrupted builds, interactive development mode and server failure/shutdown handling. The targeted browser command discovers the scenario, but Chromium closes during its startup check in this agent session, before any browser assertions execute. The complete seller lifecycle therefore still needs an owner-host browser rerun.
