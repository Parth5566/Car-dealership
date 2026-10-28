# Sample inventory for local website testing

The user explicitly requested sample cars in the configured database and on the website. This importer is separate from the older private development seed. It does not create accounts, replace inventory, reset data, change credentials or run migrations. It deliberately approves and publishes only its labelled sample batch for local testing.

**Current status:** code and database-free tests are complete. The actual import was attempted here, but MySQL access was denied with `EPERM` by the execution sandbox. No actual rows were added. Run the following commands from your own local terminal, where MySQL is accessible:

```bash
cd /Users/parth/car-dealership
npm run samples:plan
npm run samples:add
npm run dev
```

The importer uses the existing `backend/.env` database/storage configuration. If tables are missing, use the documented normal `npm run db:migrate` workflow first; the importer never changes the schema automatically. It prints the selected database name and the IDs actually added. No credentials are printed.

After a successful import, use [passenger cars](http://localhost:3000/cars), [commercial cabs](http://localhost:3000/commercial), and the homepage. Vehicle cards carry “SAMPLE ONLY · Not for sale”; details show a test-data notice. Normal saved/compare/enquiry/test-drive paths use the real inserted IDs. Contact requests are still stored as ordinary test leads; use test-only contact information when exercising them.

| Sample                      | Category   | Illustrative price | Initial status |
| --------------------------- | ---------- | ------------------ | -------------- |
| Maruti Suzuki Swift         | Passenger  | ₹4,75,000          | Published      |
| Hyundai i20                 | Passenger  | ₹7,25,000          | Published      |
| Tata Nexon                  | Passenger  | ₹9,50,000          | Reserved       |
| Honda City                  | Passenger  | ₹8,75,000          | Published      |
| Maruti Suzuki Tour S        | Commercial | ₹4,25,000          | Published      |
| Maruti Suzuki Ertiga Tour M | Commercial | ₹6,50,000          | Published      |

All prices, specifications, mileage, features and capacities are fictional test values, not assertions about any actual vehicle or model configuration. Each listing receives two generated generic illustrations plus thumbnails; these are not photographs of the named model. No stock-photo service or external API is used.

## Repeatability and removal from public inventory

The importer uses a database-scoped advisory lock and stable `sample_key` markers, adds only missing marked samples, and commits its vehicle/image/audit/history rows as one transaction. Normal inventory with the same make/model is untouched. A failure before commit rolls back rows and removes generated files. If the commit acknowledgement is lost, it reports failure and retains files because rows may already reference them; inspect the batch or rerun the idempotent importer before any cleanup.

To remove this batch from public inventory without deleting records or files:

```bash
npm run samples:archive
```

This archives the six current sample identities and the two legacy truck sample identities (`ace` and `bolero`), leaving existing customer activity and media bytes intact. Running `samples:add` again skips already-existing samples, including archived ones. Restore an archived sample through the normal admin Draft → approval → publication workflow if needed.

Sample labels survive normal staff edits. Sample imports/archival refuse `NODE_ENV=production`. Production public inventory excludes marked samples; samples are excluded from sitemap listing data in every environment, their detail pages use noindex, and they do not emit vehicle-offer structured data.

## Verification

Database-free tests cover six inserts, two illustrations per listing, WebP decoding, repeat-import deduplication, preservation of existing inventory, sample-only archival, rollback/file cleanup, production refusal/exclusion, and preservation of sample identity during editing. An isolated MySQL integration scenario also covers public API/media visibility, sitemap exclusion and archival, but could not execute in this sandbox.

The test doubles verify importer behavior and generated files, not MySQL compatibility or the live site's final state. The new database integration scenario must pass on a host with MySQL access before treating the import as verified end to end.

The commercial samples now represent yellow-plate passenger cabs, with car illustrations and no goods payload. Existing imported truck rows are not rewritten automatically; the explicit archive action can retire those marked legacy samples without touching real stock.
