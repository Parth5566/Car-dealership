# Car valuation and asking-price check

Implemented 25 October 2026 at `/car-valuation`. Find it in Vehicles → Car valuation, the homepage price-check section and the footer. The public page works without a phone number, registration number or login. It covers passenger cars in this release.

## Experience

- Buyer and seller modes, with a shared factual pricing basis and different next steps.
- Compact single-page calculator: Buyer/Seller radios, manufacturing year, city, a combined car selector, kilometres driven and ownership choices.
- A keyboard-accessible dialog uses native brand → model → Variant dropdowns. Brand/model changes clear dependent choices; local known fuel/Transmission combinations can be selected automatically. Market mode keeps fuel/Transmission choices open because local stock is incomplete. Multiple fuel choices require an explicit selection. Applying the car closes the dialog without submitting the calculator.
- Ownership choices include first, second, third and four-or-more owners. The last group prefers four-or-more owner comparisons; other valid owner counts remain eligible for broad comparisons.
- With Scrappa enabled, brand/model dropdowns use its CarDekho market catalog, augmented with local stock. The observed response contains 46 brands and 484 models, including discontinued models; coverage can change. Variant dropdowns load observed names from used-car listings for the selected model/year and merge local choices. A manual option covers missing Variants. Without Scrappa, dropdowns use eligible local inventory. “Car not listed? Enter details” switches to manual entry for a match check or review. City is a native dropdown with an Other city entry option. Safari selects have consistent height and a visible arrow.
- Sparse results show the actual match count, required minimum and selected source. Provider failures preserve the inputs and offer a price-review link.
- Range card with estimated or observed endpoints, median/reference asking price, listing count. Individual comparable listings and their links are not displayed. The expandable calculation section is removed; a short approximation explanation remains visible where needed.
- Sparse matches show a staff-review option, not a made-up amount. The contact action prefills the existing enquiry form; sending the enquiry still requires the normal contact fields and consent.
- Mobile layout, keyboard-labelled controls, loading/error states, duplicate-submit prevention, preserved fields after failure and removal of stale results after edits.

## Pricing basis and limitations

With a saved `SCRAPPA_API_KEY` and `SCRAPPA_ENABLED` not set to `false`, this is a **price guide based on CarDekho asking prices retrieved through Scrappa**. Synthetic endpoints are explicitly labelled approximate. It is not an independent predictive appraisal, completed-sales estimate or guaranteed offer. When the provider is disabled/unconfigured, it uses eligible NCR Wheelz stock and labels that local basis explicitly. Provider outages do not silently switch to local prices.

Before the broad-match update, the owner-host live verification on 25 October 2026 returned 46 brands/484 models and three qualifying Swift LXI listings, with a range of ₹3,98,079–₹5,11,139 and median ₹5,00,000. This confirms that example, not coverage of every car or city. See [Scrappa setup, budgets and verification](SCRAPPA.md).

The two modes do not add fictional dealer margins or negotiation discounts. A buyer sees buying guidance; a seller can start a private seller draft or ask staff for help.

## Broad comparisons and range policy

Both modes now require **one usable listing**. Compare the same brand/model, fuel and Transmission in the same area (Delhi NCR aliases are grouped), within two years and ±max(30,000 km, 50%) of the entered distance. Variant and owner count may differ. Year/distance proximity and preferred Variant/ownership determine which comparable cards appear first; no price adjustment for those differences is claimed.

- With one or two advertisements, apply a site-defined ±10% allowance around the median/reference price, rounded outwards. Include observed prices if they fall outside that band.
- With three or more differing advertisements, use the actual minimum/maximum and median.
- When all asking prices are identical, apply the same approximate band at any count.
- With no usable advertisements, show a price-review option without a number.

For typical prices, approximate endpoints round outwards to ₹1,000. The API identifies `range_method: estimated_band | observed_prices` and `approximation_percent: 10 | null`. The UI shows “Approximate price range” and a visible allowance explanation for synthetic endpoints; it shows the count, source and method. These are site estimates based on asking prices, not guaranteed values, completed sales or provider-generated valuation ranges. Condition and features still need individual review.

**Local-stock mode:** only real approved published passenger vehicles updated within 90 days qualify. Samples, reserved/sold/archived/private/unapproved records are excluded. SQL filters select the broader year/distance/area window using bound parameters. Up to 200 candidates are considered.

**Scrappa mode:** actual brand/model search slugs come from the provider catalog. Query the broader year/distance window with fuel/Transmission; apply compatibility checks locally. Inspect at most two pages/200 rows, deduplicate source listing IDs, and reject invalid required values or non-INR prices. Listing years may be registration years. Catalog data is cached for seven days and market searches for six hours. An ad ID cannot establish a unique physical car.

The owner’s cached 2019 Swift VXi response now yields six broad comparisons from nine returned ads, giving ₹3,50,000–₹5,11,139 (median ₹4,62,500) on offline replay. A fresh broader API search may return different results. Commercial valuation remains outside this release.

## API

`GET /api/v1/valuation/options` returns up to 500 distinct brand/model/variant/location/fuel/transmission combinations from eligible public inventory. It contains no seller identity or private documents. It also reports `market_enabled`.

`GET /api/v1/valuation/catalog` returns public `{makes:[{name,models:string[]}],source,as_of}` from Scrappa. Provider slugs stay on the server. Disabled providers return an empty catalog with `source: unconfigured`.

`GET /api/v1/valuation/variants?make=...&model=...&year=...` returns `{items:[{variant,fuel?,transmission?}],source,as_of}` from an on-demand single-page used-car search. Year is optional and bounds the search to ±2 years. No new-car Variant names are substituted for old generations; the observed list can be incomplete.

`POST /api/v1/valuation` accepts:

```json
{
  "purpose": "sell",
  "make": "Maruti Suzuki",
  "model": "Swift",
  "variant": "VXi",
  "year": 2020,
  "mileage": 40000,
  "fuel": "Petrol",
  "transmission": "Manual",
  "owners": 1,
  "location": "New Delhi"
}
```

`mileage` is the existing API name for total kilometres driven. There is no fuel-economy field in this request. Numeric fields must be JSON numbers. `year` is bounded from 1950 to the current UTC year; distance is 0–5,000,000 km; owners is 1–20. Text fields are trimmed and bounded; unknown fields are rejected. Optional `owners_at_least: true` is accepted only with `owners: 4`, matching the four-or-more UI preference. Ownership is now used for ranking, not as a hard exclusion. No database migration is required for this additive request field.

The response has `status: available | insufficient_data`, `basis: ncr_wheelz_asking_prices | scrappa_cardekho_asking_prices`, UTC `as_of`, match `count`, `minimum_comparables: 1`, matching bounds, `range` and safe public `comparables`. `range` is null and comparable links are empty when there are no usable candidates. Available ranges have `low`, `high` and `median` in INR.

All four endpoints send `Cache-Control: no-store` and share a scoped 30-request-per-minute limit. Scrappa responses have a separate private server cache and persistent upstream-attempt caps. Market reports include `source_label` and collection/location limits; comparable links use only actual HTTPS CarDekho URLs, never invented local vehicle URLs. POST follows the existing request-header/origin protection. Queries use bound parameters and return only allowlisted public fields. No valuation history, contact data or inventory is written. Provider caches and usage counters are written under ignored `backend/storage/scrappa-cache`. No migration is required.

## Verification

Automated tests disable the live provider so they never spend API credits. Source regressions cover grouped catalog parsing, provider slugs, cache persistence, concurrent request coalescing, daily/monthly budgets, safe error mapping, paging/deduplication, broad comparable matching, one/two/three-listing and identical-price ranges, route selection/validation and dropdown reopening. UI checks also cover catalog loading, stale responses, failure preservation and the separate distance/fuel-economy meanings.

`npm run valuation:verify` is the explicit live check using the saved backend key and production cache. The owner ran it successfully for both catalog and pricing. It saves only public normalized listing diagnostics, never seller contact details or the key. The previous owner-host 30-test integration pass and valuation browser pass predate the Scrappa change. The SQL/browser suites remain isolated local-stock checks; live-provider verification is separate. Current source/build results are recorded in FIXES.md.

After restarting the development server, open `/car-valuation` to review the expanded catalog and actual market-price display. `npm run test:browser -- --grep "car valuation"` and `npm run test:integration` check the existing local-stock path without consuming credits.

## Design reference

Revisited [CarWale's current valuation calculator](https://www.carwale.com/used/carvaluation/) on 25 October 2026. The revised structure follows its compact Buyer/Seller, year, city, car, kilometres, ownership and price-check flow. The earlier oversized decorative hero and two-step form have been removed. NCR Wheelz retains its own branding, styling and copy. CarWale's AccuPrice model and data are not connected or reproduced. Scrappa supplies the broader brand/model catalog and market listings. Complete Variant/year catalogs and condition-adjusted values are not supplied by this implementation.
