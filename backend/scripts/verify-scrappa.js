// Uses the production client/cache and prints only allowlisted public summaries.
const provider = require("../src/lib/scrappa");
const fs = require("node:fs/promises"),
  path = require("node:path");
const env = require("../src/config/env");
async function saveDiagnostic(name, data) {
  const file = path.join(env.storage, name);
  await fs.mkdir(env.storage, { recursive: true });
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(
    file,
    env.scrappa.key ? json.replaceAll(env.scrappa.key, "[redacted]") : json,
    { mode: 0o600 },
  );
  return file;
}
async function main() {
  if (!provider.enabled)
    throw new Error(
      "Save SCRAPPA_API_KEY in backend/.env and ensure SCRAPPA_ENABLED is not false.",
    );
  const catalog = await provider.catalog();
  console.log(
    JSON.stringify(
      {
        catalog: "ok",
        brands: catalog.data.makes.length,
        models: catalog.data.makes.reduce(
          (sum, make) => sum + make.models.length,
          0,
        ),
        sample_brands: catalog.data.makes.slice(0, 5).map((make) => make.name),
        retrieved_at: new Date(catalog.collected_at).toISOString(),
      },
      null,
      2,
    ),
  );
  let diagnosticFile;
  const result = await provider.value(
    {
      purpose: "sell",
      make: "Maruti Suzuki",
      model: "Swift",
      variant: "LXI",
      year: 2020,
      mileage: 30000,
      owners: 1,
      fuel: "Petrol",
      transmission: "Manual",
      location: "Delhi",
    },
    {
      inspect: async (data) => {
        // Only the adapter's public listing allowlist, never seller/contact details.
        diagnosticFile = await saveDiagnostic(
          "scrappa-pricing-diagnostic.json",
          data,
        );
      },
    },
  );
  console.log(
    JSON.stringify(
      {
        pricing: "ok",
        status: result.status,
        source: result.source_label,
        matches: result.count,
        range: result.range,
        range_method: result.range_method,
        approximation_percent: result.approximation_percent,
        as_of: result.as_of,
        ...(diagnosticFile ? { diagnostic_file: diagnosticFile } : {}),
      },
      null,
      2,
    ),
  );
}
main().catch(async (error) => {
  let diagnosticFile;
  if (error.catalogDiagnostic) {
    diagnosticFile = await saveDiagnostic(
      "scrappa-catalog-diagnostic.json",
      error.catalogDiagnostic,
    );
  }
  console.error(
    JSON.stringify(
      {
        verification: "failed",
        code: error.code || "MARKET_UNAVAILABLE",
        message: error.status
          ? error.message
          : "The verification could not reach or read the market data service.",
        ...(error.diagnostics ? { diagnostics: error.diagnostics } : {}),
        ...(diagnosticFile ? { diagnostic_file: diagnosticFile } : {}),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
