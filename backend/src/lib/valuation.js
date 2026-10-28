const { z, text } = require("./core");
const {
  comparisonWindow,
  sameArea,
  similarityScore,
  priceSummary,
} = require("./valuation-policy");

const valuationSchema = z
  .object({
    purpose: z.enum(["buy", "sell"]),
    make: text(80),
    model: text(100),
    variant: text(120),
    year: z.number().int().min(1950).max(new Date().getUTCFullYear()),
    mileage: z.number().int().min(0).max(5000000),
    fuel: z.enum(["Petrol", "Diesel", "CNG", "Electric", "Hybrid"]),
    transmission: z.enum(["Manual", "Automatic"]),
    owners: z.number().int().min(1).max(20),
    owners_at_least: z.boolean().optional(),
    location: text(120),
  })
  .strict()
  .refine((input) => !input.owners_at_least || input.owners === 4, {
    path: ["owners_at_least"],
    message: "The four-or-more group starts at four owners",
  });

// Always exclude demonstration data, including on development installations.
const valuationWhere =
  "type='passenger' AND approved=TRUE AND status='published' AND price>0 AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data,'$.is_sample')),'false')='false' AND updated_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 90 DAY)";
const normalise = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();
function dataOf(row) {
  try {
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}
function buildValuation(input, rows, now = new Date()) {
  const window = comparisonWindow(input);
  const seen = new Set();
  const comparable = rows.filter((row) => {
    const data = dataOf(row);
    const updated =
      row.updated_at instanceof Date
        ? row.updated_at
        : new Date(
            String(row.updated_at).replace(" ", "T") +
              (/Z$|[+-]\d\d:\d\d$/.test(String(row.updated_at)) ? "" : "Z"),
          );
    const valid =
      Number.isSafeInteger(Number(row.id)) &&
      Number(row.id) > 0 &&
      !seen.has(Number(row.id)) &&
      row.type === "passenger" &&
      Number(row.approved) === 1 &&
      row.status === "published" &&
      [undefined, false, "false"].includes(data.is_sample) &&
      ["make", "model", "fuel", "transmission"].every(
        (key) => normalise(row[key]) === normalise(input[key]),
      ) &&
      sameArea(input.location, row.location) &&
      Number.isInteger(Number(data.owners)) &&
      Number(data.owners) >= 1 &&
      Number(data.owners) <= 20 &&
      Number.isInteger(Number(row.year)) &&
      Number(row.year) >= window.year_from &&
      Number(row.year) <= window.year_to &&
      row.mileage !== null &&
      row.mileage !== undefined &&
      String(row.mileage).trim() !== "" &&
      Number.isInteger(Number(row.mileage)) &&
      Number(row.mileage) >= window.kilometres_from &&
      Number(row.mileage) <= window.kilometres_to &&
      Number.isFinite(Number(row.price)) &&
      Number(row.price) > 0 &&
      Number(row.price) <= 1000000000 &&
      Number.isFinite(updated.getTime()) &&
      updated <= now &&
      now - updated <= 90 * 86400000;
    if (valid) seen.add(Number(row.id));
    return valid;
  });
  const score = (row) =>
    similarityScore(input, {
      year: Number(row.year),
      mileage: Number(row.mileage),
      variant: dataOf(row).variant,
      owners: Number(dataOf(row).owners),
    });
  comparable.sort((a, b) => score(a) - score(b));
  const summary = priceSummary(comparable.map((row) => Number(row.price)));
  return {
    ...summary,
    basis: "ncr_wheelz_asking_prices",
    as_of: now.toISOString(),
    count: comparable.length,
    matching: {
      ...window,
      broad_matches: true,
      updated_within_days: 90,
    },
    // No internal records, private seller information or uploaded documents.
    comparables: summary.range
      ? comparable.slice(0, 3).map((row) => ({
          id: Number(row.id),
          slug: row.slug,
          year: Number(row.year),
          mileage: Number(row.mileage),
          price: Number(row.price),
          variant: dataOf(row).variant,
          owners: Number(dataOf(row).owners),
        }))
      : [],
  };
}
module.exports = { valuationSchema, valuationWhere, buildValuation };
