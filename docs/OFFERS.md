# Admin discounts and offers — 25 October 2026

The admin offer studio is available at `/admin/offers`, under **Discounts & offers**. Access uses the existing `settings` permission, currently held by administrators. Customers, reviewers and sales staff cannot manage offers. The public `/discounts` page reads active campaigns from MySQL; it no longer uses the source-code sample offers.

## Local setup

Back up the configured website database and private storage using the existing operations procedure, then run from the project root:

```bash
npm run db:migrate
npm run dev
```

Migration `004_offers.sql` adds only `nw_offers`; it does not alter existing inventory, accounts or public settings. Restart existing development services before testing. Agent-side MySQL inspection failed with `EPERM`, so the migration has not been applied to the owner's website database by this task. No example discounts were inserted or published.

## Workflow

1. Choose **Create offer**. Start from scratch or use First car, Seasonal special or Business boost. Starter amounts and wording are editable suggestions, requiring confirmation by the administrator.
2. Fill the headline, benefit, description, eligibility and action button. **Save draft** keeps work private; incomplete content is allowed in drafts.
3. Under **Look & feel**, choose Champagne, Midnight, Evergreen or Rose; soft glow, orbit rings, fine grid or minimal background; an icon; badge wording; and optional Showroom pick styling. The shared offer-card component supplies both the preview and public rendering. Preview width can be switched.
4. Under **Timing & rules**, set start/end times, required terms, optional reference code and display order. Seven-, fourteen- and thirty-day shortcuts calculate the end time from the selected start. Input times use the device timezone; stored times are UTC; published cards display IST.
5. **Publish offer** saves and publishes the current editor content. A future start produces a scheduled offer. Publication requires complete content, valid dates and a future expiry. Published edits use **Save changes** and update the public card.
6. **Unpublish** returns an offer to Draft. **Duplicate** opens a private copy with a fresh seven-day schedule; it does not save or publish until the administrator acts. **Remove** requires an inline confirmation and permanently deletes the record; its audit history remains.

Public requests include only published offers whose start has arrived and whose expiry has not. Schedules need no cron job, but a page already open must be refreshed to receive changes. Featured offers appear first, followed by ascending display order and newest start time. Empty and service-error states are distinct; no sample offer replaces missing live offers.

Reference codes are identifiers customers can mention to staff, not checkout coupons. Offers do not recalculate inventory prices or EMI. Contact buttons prefill the enquiry message with the offer title; normal consent and lead persistence remain in effect.

All writes are transactional and audited. Updates, status changes and removal require the inspected numeric version. Concurrent changes return `409 STALE_OFFER`; the editor preserves unsaved work and provides **Reload saved version**. Failed saves do not clear the draft; failed removal keeps the record visible.

## Verification

- `npm test`: 80 passing checks (46 backend, 34 frontend). New tests exercise offer validation, draft/publication transitions, design persistence, timezone conversion, stale writes/removal, transaction failure, permission checks, exact schedule-boundary labels, failed editor saves, duplicate-submit protection and removal confirmation/failure.
- TypeScript and production build results are recorded in `FIXES.md`.
- Browser discovery finds eight workflows, including a new offer creation/customization/publication/edit/duplicate/unpublish/removal journey, public enquiry-prefill checks and a narrow-screen overflow check.
- Actual MySQL integration and browser execution were attempted but stopped during setup: MySQL denied connections with `EPERM`, Chromium exited at startup, and native UI service initialization failed. These are environmental blockers, not passing end-to-end or visual acceptance results.

After setup, run `npm run test:integration` and `npm run test:browser` on the owner host. Their fixtures and migrations use disposable QA databases; website migration remains a separate step.
