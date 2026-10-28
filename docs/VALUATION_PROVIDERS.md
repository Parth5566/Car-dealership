# Indian car valuation providers

Researched 25 October 2026 for NCR Wheelz. Recommendation: evaluate **Droom OBV / Droom Cloud Services first**, with **Indian Blue Book as a second commercial lead**. This initial shortlist predates the owner-authorized Scrappa integration described below. No shortlist provider has been purchased or contacted. No current quote, sandbox response or public-display licence has been verified.

## Shortlist

| Option                           | Evidence and fit                                                                                                                                                                                                                                                                                             | What remains unverified                                                                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Droom OBV / Droom Cloud Services | Droom markets OBV-powered Pricing as a Service. Its published case study describes a pricing API integration. Droom's enterprise app describes Indian used-vehicle pricing from brand, model, year, trim and distance, including buying and selling use cases. This is the strongest integration lead found. | Current API documentation, catalog access, Delhi NCR coverage, low/high ranges, condition inputs, meaning of buyer/seller prices, website redistribution rights and commercial quote. An enterprise app subscription alone does not establish website API rights. |
| Indian Blue Book (IBB)           | Tata Capital's official retail API catalogue explicitly includes IBB used-car valuation and market-value determination under its used-car-loan APIs. This supports an institutional partnership route.                                                                                                       | Direct dealer access to IBB, consumer website display rights, manual vehicle selection without RC, returned ranges, catalog licence, authentication, costs and sandbox. Tata Capital's listing is not evidence of a self-service IBB developer account.           |

Primary sources: [Droom product description](https://cloud.droom.in/about-dcs), [Droom pricing API case study](https://cloud.droom.in/Case_Study_DCS_PricingStrategies.pdf), [Droom-published enterprise app listing](https://play.google.com/store/apps/details?hl=en&id=in.droom.obv_enterprise_app), [Tata Capital API catalogue](https://www.tatacapital.com/tata-capital-api/retail-api.html).

The OBV enterprise listing supplies enterprise@droom.in as an onboarding contact. Its website and the IBB website restricted some automated page reads; those inaccessible pages were not treated as verified documentation. The shortlist is a recommendation for product evaluation, not a claim that either service can be enabled immediately.

## Requirements to send providers

1. Indian passenger-car catalog: stable IDs for brand, model, manufacturing year and Variant, with fuel and Transmission, including discontinued models. Specify licensed use in a public searchable picker and catalog refresh rules.
2. Delhi NCR city coverage and spelling/alias mapping. Confirm exact supported model years and what an unsupported request returns.
3. INR lower and upper values, valuation date, pricing basis and meaning of the range. Specify whether results are advertised retail prices, completed sales, dealer purchase offers or another measure.
4. Whether Buyer and Seller have distinct pricing models. Do not invent discounts between them. Confirm kilometre, owner-count and condition adjustments, including four-or-more owners.
5. Public website display permission for anonymous visitors, required attribution, caching/storage rights, expiry, permitted comparison display and restrictions on exporting reports.
6. Sandbox credentials, documented request/response examples, authentication and token rules, rate limits, response times, uptime/support terms and outage behavior.
7. Written pricing: setup fee, minimum monthly commitment, catalog fees, per-check credits, whether failed/unsupported checks are charged, overages and taxes. No reliable current API price was established during this research.

Prefer a manual vehicle-details flow that does not require a registration number or contact details merely to obtain a price range. A registration lookup, insurance IDV or single historical sale amount is not automatically an equivalent valuation product.

## Ready-to-send enquiry

Subject: Indian used-car valuation API and catalog for NCR Wheelz

Hello,

We are evaluating a pricing integration for NCR Wheelz, a car dealership website serving Delhi NCR. Visitors should select Buyer or Seller, manufacturing year, city, brand/model/Variant, fuel, Transmission, kilometres driven and ownership, then receive an indicative INR price range.

Please share your current API/catalog documentation, sandbox access process, supported vehicles and cities, sample low/high-range responses, pricing methodology and commercial quote. Please also confirm whether the licence permits anonymous public website display, searchable catalog use, attribution and caching, and explain any difference between buyer and seller values. We prefer a flow without mandatory RC, phone number or lead collection before the result.

Please include minimum commitments, request limits and charges for unsuccessful or unsupported checks.

Thank you.

This is a draft only; it has not been sent.

## Integration plan once documentation and rights are available

1. Validate sandbox examples for common Delhi NCR cars, multiple model years, kilometre/owner groups and unsupported cars. Establish what the range actually means before choosing result labels.
2. Add a server-only provider client with timeouts, schema validation and credentials outside browser bundles. Keep catalog IDs separate from free-text dealership fields.
3. Replace inventory-only suggestions with licensed year/city/car/Variant choices. Handle unavailable combinations and stale choices explicitly.
4. Display provider, valuation date and permitted methodology alongside the range. An outage or unsupported car must show a review option; do not quietly substitute local stock prices under the provider's name.
5. Test catalog dependencies, both user intents, range semantics, error handling, rate limits, mobile/keyboard use and prevention of duplicate billable requests. Deploy after reviewing the sandbox evidence and costs.

## What works today

The owner selected Scrappa and saved its key locally. The server now uses CarDekho filters for the market catalog and CarDekho used-car listings for comparable advertised prices. The live verification returned 46 brands, 484 models and a three-listing Swift range. This is a comparable-advertisement calculation, not Scrappa supplying a predictive valuation engine. Exact Variant/year coverage, sufficient local comparables and complete city support are not guaranteed. See [SCRAPPA.md](SCRAPPA.md) and [VALUATION.md](VALUATION.md).
