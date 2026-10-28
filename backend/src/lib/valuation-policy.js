// Site-defined comparison rules, not a provider appraisal or confidence model.
const canonical = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const ncr = [
  "delhi",
  "newdelhi",
  "delhincr",
  "gurgaon",
  "gurugram",
  "noida",
  "greaternoida",
  "ghaziabad",
  "faridabad",
];
function comparisonWindow(input) {
  const distance = Math.max(30000, Math.round(input.mileage * 0.5));
  return {
    year_from: Math.max(1950, input.year - 2),
    year_to: Math.min(new Date().getUTCFullYear(), input.year + 2),
    kilometres_from: Math.max(0, input.mileage - distance),
    kilometres_to: Math.min(5000000, input.mileage + distance),
  };
}
function locationKeys(value) {
  return ncr.includes(canonical(value)) ? ncr : [canonical(value)];
}
function sameArea(a, b) {
  return locationKeys(a).includes(canonical(b));
}
function similarityScore(input, row) {
  const ownerMatch = input.owners_at_least
    ? row.owners >= input.owners
    : row.owners === input.owners;
  return (
    Math.abs(row.year - input.year) * 2 +
    Math.abs(row.mileage - input.mileage) /
      Math.max(30000, input.mileage * 0.5) +
    (canonical(row.variant) === canonical(input.variant) ? 0 : 1) +
    (ownerMatch ? 0 : 0.5)
  );
}
function priceSummary(values) {
  const prices = [...values].sort((a, b) => a - b);
  if (!prices.length)
    return {
      status: "insufficient_data",
      minimum_comparables: 1,
      range: null,
      range_method: null,
      approximation_percent: null,
    };
  const middle = Math.floor(prices.length / 2);
  const median =
    prices.length % 2
      ? prices[middle]
      : (prices[middle - 1] + prices[middle]) / 2;
  const estimated = prices.length < 3 || prices[0] === prices.at(-1);
  // Sparse data: a disclosed +/-10% site allowance, including the observed ads.
  // Three or more differing prices: use their actual minimum/maximum.
  const unit = median >= 10000 ? 1000 : median >= 1000 ? 100 : 0.01;
  const low = estimated
    ? Math.max(
        0.01,
        Math.floor(Math.min(prices[0], median * 0.9) / unit + 1e-8) * unit,
      )
    : prices[0];
  const high = estimated
    ? Math.ceil(Math.max(prices.at(-1), median * 1.1) / unit - 1e-8) * unit
    : prices.at(-1);
  return {
    status: "available",
    minimum_comparables: 1,
    range: {
      low: Number(low.toFixed(2)),
      high: Number(high.toFixed(2)),
      median,
    },
    range_method: estimated ? "estimated_band" : "observed_prices",
    approximation_percent: estimated ? 10 : null,
  };
}
module.exports = {
  canonical,
  comparisonWindow,
  locationKeys,
  sameArea,
  similarityScore,
  priceSummary,
};
