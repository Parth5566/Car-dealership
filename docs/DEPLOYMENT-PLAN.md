# NCR Wheelz deployment plan

## Existing application

The site consists of a Next.js frontend, an Express API, MySQL 8+ and a private filesystem for seller documents and vehicle/blog images. Browser API calls use `/api/v1` on the website's origin, with Next.js forwarding to the server-only `API_URL`. The API currently binds only to `127.0.0.1`; separate containers cannot reach it until a configurable bind address and its network access are reviewed and tested. Its email worker runs inside the API process.

## Candidate hosting arrangement

A platform supporting Node services, MySQL and persistent private storage can run the application. Railway is one candidate: a public Next.js service, a private API service, a MySQL service and a private persistent volume attached to the API. Its custom-domain service provisions HTTPS certificates. Provider selection, billing, database backup and the API's binding/proxy settings must be settled and tested before treating this as a deployable configuration. References: https://docs.railway.com/databases/mysql, https://docs.railway.com/volumes/reference and https://docs.railway.com/networking/domains/working-with-domains.

A private API service must not be made publicly accessible simply to work around its localhost bind. Validate TLS and access between services, the exact Next-to-API address, upload limits, forwarded client IPs and authentication cookies on the selected platform. Keep the database and uploaded files private. If the database provider or platform does not supply a dependable restore method, arrange independent backups; test a restore of both database and matching files.

## Prepare a staging environment

1. Confirm the hosting account, budget, domain ownership and whether `ncrwheelz.com` is already serving another site. Preserve any existing site and DNS while staging is prepared.
2. Create separate staging MySQL, private media storage and a public staging hostname. Use test records and test documents only. Never copy `.env`, app passwords or database credentials into a repository or chat.
3. Configure a fresh strong JWT secret and server-side secrets through the provider's environment settings. Set `APP_ORIGIN`, `SITE_URL` and `NEXT_PUBLIC_SITE_URL` to the staging HTTPS origin; set `API_URL` to the private API address, database values to staging, and `STORAGE_DIR` to the private persistent volume. Configure SMTP and Scrappa privately when ready. Set production mode and secure cookies as appropriate.
4. Apply existing migrations using a migration account and verify application tables before bootstrapping a new admin. Choose explicitly whether to start with a clean database or migrate reviewed data; the local sample article and local uploads do not transfer automatically. Back up data before migrations.
5. Verify homepage, login and refresh, permissions, seller drafts, uploads and private documents, inventory publication, blog publication and images, valuation, email delivery, password-reset delivery, sitemap and all crawler files. Confirm a redeploy preserves uploads and verify a restore.

## Launch only after staging verification

- Confirm the final website address, legal/business content, email recipients, privacy/retention procedures and ownership of the hosting account. The current password-reset webhook is separate from the enquiry email worker and needs its own working delivery setup.
- Enable backups and monitoring. Provision production with separate secrets, database and storage. Do not expose database or documents publicly.
- Connect the approved domain and configure HTTPS and the preferred-domain redirects. Coordinate DNS changes so any existing site is not accidentally replaced. Confirm certificate issuance and renewal, same-origin API requests, cookies, upload persistence and email delivery on the live host.
- Submit the live sitemap to Search Console after access is available. Check real mobile performance and published SEO metadata.

See `OPERATIONS.md`, `EMAIL.md`, `BLOG.md` and `SEO-REVIEW-2026-10-27.md` for existing details. This is an implementation plan, not evidence of a completed deployment.
