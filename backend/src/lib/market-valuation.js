const {
  canonical,
  comparisonWindow,
  sameArea,
  similarityScore,
  priceSummary,
} = require("./valuation-policy");
const makeKey = (value) => canonical(value).replace(/^marutisuzuki$/, "maruti");
function buildMarketValuation(
  input,
  rows,
  { asOf = new Date(), locationScope = input.location, reason } = {},
) {
  const window = comparisonWindow(input);
  const fuel = (value) =>
    ({ gasoline: "petrol", gas: "petrol" })[canonical(value)] ||
    canonical(value);
  const transmission = (value) =>
    ({
      amt: "automatic",
      cvt: "automatic",
      dct: "automatic",
      at: "automatic",
      mt: "manual",
    })[canonical(value)] || canonical(value);
  const seen = new Set();
  const comparable = rows
    .filter((row) => {
      const title = canonical(row.title);
      const names = [
        ...new Set(
          [canonical(input.make), makeKey(input.make), "marutisuzuki"].filter(
            (item) =>
              item !== "marutisuzuki" || makeKey(input.make) === "maruti",
          ),
        ),
      ];
      const modelMatches = row.model
        ? [
            canonical(input.model),
            ...names.map((name) => name + canonical(input.model)),
          ].includes(canonical(row.model))
        : [
            String(row.year) + canonical(input.model) + canonical(row.variant),
            ...names.map(
              (name) =>
                String(row.year) +
                name +
                canonical(input.model) +
                canonical(row.variant),
            ),
          ].includes(title);
      const valid =
        typeof row.id === "string" &&
        row.id.length > 0 &&
        row.id.length <= 160 &&
        !seen.has(row.id) &&
        row.currency === "INR" &&
        Number.isFinite(row.price) &&
        row.price > 0 &&
        row.price <= 1000000000 &&
        (!row.make || makeKey(row.make) === makeKey(input.make)) &&
        modelMatches &&
        Number.isInteger(row.year) &&
        row.year >= window.year_from &&
        row.year <= window.year_to &&
        Number.isInteger(row.mileage) &&
        row.mileage >= window.kilometres_from &&
        row.mileage <= window.kilometres_to &&
        Number.isInteger(row.owners) &&
        row.owners >= 1 &&
        row.owners <= 20 &&
        fuel(row.fuel) === fuel(input.fuel) &&
        transmission(row.transmission) === transmission(input.transmission) &&
        sameArea(input.location, row.location);
      if (valid) seen.add(row.id);
      return valid;
    })
    .sort((a, b) => similarityScore(input, a) - similarityScore(input, b));
  const summary = priceSummary(comparable.map((row) => row.price));
  return {
    ...summary,
    basis: "scrappa_cardekho_asking_prices",
    source_label: "CarDekho listings via Scrappa",
    as_of: asOf.toISOString(),
    count: comparable.length,
    reason,
    matching: {
      ...window,
      broad_matches: true,
      collected_within_hours: 6,
      location_scope: locationScope,
      inspected_limit: 200,
    },
    comparables: summary.range
      ? comparable.slice(0, 3).map((row) => {
          let href;
          try {
            const url = new URL(row.url);
            if (
              url.protocol === "https:" &&
              ["www.cardekho.com", "cardekho.com"].includes(url.hostname) &&
              !url.username &&
              !url.password
            )
              href = url.href;
          } catch {
            /* A missing source URL is displayed without a link. */
          }
          return {
            id: row.id,
            year: row.year,
            mileage: row.mileage,
            price: row.price,
            variant: row.variant,
            owners: row.owners,
            href,
          };
        })
      : [],
  };
}
module.exports = { buildMarketValuation };
