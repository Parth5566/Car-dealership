# Scrappa market-data integration

The server uses Scrappa’s CarDekho catalog and used-car search. The API key belongs only in `backend/.env` as `SCRAPPA_API_KEY`; it is never placed in frontend variables or browser requests. The saved key has been verified by an owner-host request. No database migration or inventory import is required.

## Enable and check

Save the backend environment file, then restart the existing development server with Ctrl+C followed by `npm run dev`. Do not start a second copy on port 5001. Open `/car-valuation`.

Run `npm run valuation:verify` for an explicit live service check. It uses the same production cache and allowances as the website. The command prints public counts and an example price range, never the key. It also saves allowlisted public listing fields to ignored `backend/storage/scrappa-pricing-diagnostic.json` for troubleshooting. If catalog parsing fails, it saves only the public taxonomy in `scrappa-catalog-diagnostic.json`.

Owner-host verification on 25 October 2026, before the broad-match/single-listing update:

- Catalog: **46 brands and 484 models**, including discontinued cars such as Ritz, Zen and Maruti 800.
- Sample: 2020 Maruti Suzuki Swift LXI, Petrol, Manual, first owner, 30,000 km, Delhi.
- Qualifying listings: **3**; observed INR range **398,079–511,139**, median **500,000**.
- Price data collected at `2026-10-25T12:01:31.363Z`.

These are dated verification results, not permanent prices or proof that every car has a result. The source may change. This agent session could not resolve scrappa.co, so the owner ran the live command and the agent inspected its saved public response locally.

## Configuration and request use

Defaults, shown in `backend/.env.example`:

```dotenv
SCRAPPA_API_KEY=
SCRAPPA_ENABLED=true
SCRAPPA_DAILY_LIMIT=15
SCRAPPA_MONTHLY_LIMIT=450
```

The limits count **attempts from this application**, including failed/uncertain requests, in UTC calendar periods. They do not know about account usage from other apps or guarantee a particular provider billing balance. No purchase or subscription upgrade is triggered. Keep the limits appropriate to the account’s actual allowance.

- Brand/model filters: cached privately for seven days.
- Used-car search: cached privately for six hours per exact query/page.
- One cold catalog request, then one search request and at most one additional page per price check. Opening a model’s Variant selector can make one additional used-car search, cached by model/year for six hours. Cached requests consume no upstream attempt.
- Identical concurrent calls coalesce in one API process. Persistent counters are locked across client instances. Cache files/counters survive normal server restarts and are separated by a hash of the account key.
- Nine-second upstream timeout, no automatic billable retries and a 60-second cooldown after a provider error. Browser valuation checks have a 35-second deadline for the sequential catalog/search requests.
- A separate 30-per-minute/IP endpoint limit applies to public catalog/options/price requests.

Cache/counter files are under ignored `backend/storage/scrappa-cache`. Do not delete them to work around a limit: that loses the local usage history. If a crash leaves a `usage.lock`, stop every API process before removing that lock only; preserve `usage.json` and the cache. A changed key creates a separate cache/counter directory.

Set `SCRAPPA_ENABLED=false` and restart to intentionally return to local-stock comparisons. A temporary provider failure never silently substitutes local stock beneath a market-data label.

## Catalog and pricing behavior

The parser reads the live `popular`, `luxury` and `others` brand groups, combines duplicate brands/models and preserves source search slugs. It also accepts a flat options array. Display names have repeated brand prefixes removed from model names. The browser receives only public display names, not the credential.

Brand and model are linked dropdowns. Variant choices load on demand through `GET /valuation/variants?make=...&model=...&year=...` from one page of nationwide used listings for that model, within two years of the selected year (or without a year filter if none is selected). They merge with known local choices and deduplicate case variants. The provider search uses the actual catalog slugs and shares the normal server-only key, six-hour cache and attempt budget. These are observed Variant names, not a complete historical catalog. “Enter another Variant” remains available. Fuel and Transmission remain selectable for market cars even when a local listing has a different combination. Dropdown coverage depends on the source.

Pricing now needs only **one usable listing**. Comparisons keep the same brand/model, fuel and Transmission, with year ±2 and odometer distance ±max(30,000 km, 50%). Variant and owner count can differ; they influence the display order along with year/distance proximity. Delhi NCR aliases are grouped and searched through New Delhi; other cities must match their normalized area. At most two pages/200 rows are inspected. Duplicate listing IDs and invalid required values are excluded; unrelated models and incompatible powertrains are excluded. Different ad IDs may still describe one physical car.

Range policy shared by market and local-stock modes:

- **One or two prices:** show a site-defined ±10% approximate band around the median, rounded outwards to ₹1,000 for typical car prices, and extended to include the observed prices.
- **Three or more differing prices:** show the actual minimum/maximum, with the median alongside.
- **Identical prices at any count:** use the same approximate ±10% band so the range has width.
- **No usable listings:** show no numeric range and offer a price review.

The UI labels synthetic endpoints “Approximate price range” and explains the allowance. It also discloses broad comparisons, shows comparable Variants/owner counts and does not claim a condition-adjusted appraisal. No learned depreciation or separate buyer/seller spread is applied. Results show the source and collection time; only actual HTTPS CarDekho URLs are linked. Source years may be registration years.

Offline replay of the owner’s cached 2019 Swift VXi search (nine returned ads, collected at `2026-10-25T12:11:28.636Z`) now finds six usable broad comparisons and returns an observed ₹3,50,000–₹5,11,139 range, median ₹4,62,500. No extra upstream request was used. A fresh broader search can return a different set and range.

## Testing

`npm test` uses fixture responses, temporary caches and mocked UI/API calls. SQL integration and isolated browser environments set `SCRAPPA_ENABLED=false` before loading the app so they cannot spend live credits. Only the explicit verification command or normal enabled website requests use the key.

The source tests cover the grouped live taxonomy, actual query slugs, paging/deduplication, broad matching, single-listing bands, cache persistence, budgets, safe errors, validated routing and picker state. The live catalog/pricing verification above is separate from fixture tests. Browser visual acceptance of the new market catalog/result remains a manual check after restarting.

Provider references: [used-car filters](https://scrappa.co/docs/cardekho-api/cardekho_used_filters), [used-car search](https://scrappa.co/docs/cardekho-api/cardekho_used_search). The integration uses advertised listings; Scrappa does not supply the valuation calculation implemented here.

## Result presentation update

The expandable “How is this range calculated?” / “What counts as a matching car?” section was removed at the owner's request. Source attribution and the short approximate-range explanation remain visible. Variant names now have a native dropdown instead of immediately falling back to a text input when local stock has no choices. Model/year changes cancel earlier lookups; a late response cannot replace the latest choices. A failed lookup preserves local/custom entries and offers manual entry. Closing/reopening a custom Variant keeps its value in the dropdown.

## Seller form dropdowns — 26 October 2026

Seller drafts and seller-side edits now use brand → model → manufacturing year → optional Variant dropdowns. `GET /vehicle-options?type=...` provides category-scoped suggestions from published/reserved, approved, non-sample stock; private submissions never enter these suggestions. The existing `/valuation/catalog` loads independently of stock suggestions for both personal cars and yellow-plate passenger cabs. A missing, empty, slow or failed stock-suggestions endpoint cannot suppress a working catalog. Selecting a known catalog model and a valid historical year loads `/valuation/variants`, using the existing backend cache and request budget. Unknown brands/models and next-year vehicles do not trigger provider Variant searches.

Every identity dropdown offers “Not listed? Enter manually…”. Selecting this option renders a labelled text/number field with the same submission name and validation limits. The UI marker is not saved. Late responses never overwrite typed details; parent changes clear dependent choices and cancel obsolete lookups. Suggestions failing or returning no choices does not block manual draft creation. Dropdowns for vehicle style, city/area, owner count and seat count also have manual entry; price, odometer distance and condition remain directly editable. Fuel/transmission keep the supported choices required by the existing API.

New manual details are saved in the seller's existing private submission. They do not modify Scrappa's catalog or create a public listing before staff review/publication. The commercial category means yellow-plate passenger cabs, so both categories use the provider’s car catalog/Variant suggestions. Truck/load-capacity choices are not part of the seller UI. Failed suggestion loading offers a retry while retaining manual entries.
