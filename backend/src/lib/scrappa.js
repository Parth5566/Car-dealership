const path = require("node:path");
const env = require("../config/env");
const { createScrappaClient, unavailable } = require("./scrappa-client");
const { buildMarketValuation } = require("./market-valuation");
const { comparisonWindow } = require("./valuation-policy");

const normalise = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const canonical = (value) => normalise(value).replace(/[^a-z0-9]/g, "");
const brandKey = (value) =>
  canonical(value).replace(/^marutisuzuki$/, "maruti");
const slug = (value) =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);
const label = (value) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 160;
function modelName(value, make) {
  const names =
    brandKey(make) === "maruti" ? ["Maruti Suzuki", "Maruti"] : [make];
  for (const name of names) {
    if (normalise(value).startsWith(normalise(name) + " "))
      return value.slice(name.length).trim();
  }
  return value.trim();
}

// The filters endpoint publishes the actual slugs accepted by used-car search.
// Never guess source slugs from display names or silently accept a changed shape.
function decodeCatalog(data) {
  const group = data.filters?.brand;
  function invalid() {
    const error = unavailable();
    error.code = "MARKET_SCHEMA";
    error.diagnostics = {
      data_fields: Object.keys(data),
      filter_fields: Object.keys(data.filters || {}),
      brand_fields: Object.keys(group || {}),
      brand_option_fields: Object.keys(group?.options?.[0] || {}),
      options_type: Array.isArray(group?.options)
        ? "array"
        : typeof group?.options,
      options_count:
        group?.options && typeof group.options === "object"
          ? Object.keys(group.options).length
          : 0,
    };
    error.catalogDiagnostic = group;
    return error;
  }
  const options = group?.options;
  const groups = Array.isArray(options)
    ? [options]
    : options && typeof options === "object"
      ? Object.values(options)
      : [];
  if (!groups.length || groups.some((items) => !Array.isArray(items)))
    throw invalid();
  const unique = new Map();
  for (const item of groups.flat()) {
    if (!item || typeof item !== "object") continue;
    if (!label(item.label) || !slug(item.value)) continue;
    const sourceModels = item.models?.options || item.models;
    if (!Array.isArray(sourceModels)) continue;
    const models = sourceModels
      .filter((model) => model && label(model.label) && slug(model.value))
      .map((model) => ({
        name: modelName(model.label, item.label),
        slug: model.value,
      }));
    const make = unique.get(item.value) || {
      name:
        brandKey(item.label) === "maruti" ? "Maruti Suzuki" : item.label.trim(),
      slug: item.value,
      models: [],
    };
    const merged = new Map(
      [...make.models, ...models].map((model) => [model.slug, model]),
    );
    make.models = [...merged.values()];
    unique.set(item.value, make);
  }
  const makes = [...unique.values()];
  if (!makes.length) throw invalid();
  return { makes };
}
function decodeListings(data) {
  if (!Array.isArray(data.listings)) {
    const error = unavailable();
    error.code = "MARKET_SCHEMA";
    error.diagnostics = {
      data_fields: Object.keys(data),
      listings_type: typeof data.listings,
    };
    throw error;
  }
  return {
    listings: data.listings
      .slice(0, 100)
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: item.used_car_sku_id,
        title: item.title,
        make: item.make,
        model: item.model,
        variant: item.variant,
        year: item.year,
        price: item.price?.value,
        currency: item.price?.currency,
        mileage: item.km?.value,
        fuel: item.fuel,
        transmission: item.transmission,
        owners: item.owner?.count,
        location: item.location?.city,
        url: item.url || item.listing_url,
      })),
    has_more: data.pagination?.has_more === true,
  };
}
function createMarketProvider(client) {
  const catalog = () =>
    client.get(
      "/api/cardekho/v1/used-cars/filters",
      {},
      7 * 86400000,
      decodeCatalog,
    );
  async function variants(input) {
    const reference = await catalog();
    const make = reference.data.makes.find(
      (item) => brandKey(item.name) === brandKey(input.make),
    );
    const model = make?.models.find(
      (item) =>
        canonical(item.name) === canonical(modelName(input.model, make.name)),
    );
    if (!make || !model)
      return {
        items: [],
        as_of: new Date(reference.collected_at).toISOString(),
      };
    // Used listings retain older/discontinued trims. New-car trims can belong to
    // a different generation, so do not use them for a historical car picker.
    const params = { make: make.slug, model: model.slug, page: "1" };
    if (input.year) {
      params.year_min = String(Math.max(1950, input.year - 2));
      params.year_max = String(
        Math.min(new Date().getUTCFullYear(), input.year + 2),
      );
    }
    const response = await client.get(
      "/api/cardekho/v1/used-cars",
      params,
      6 * 3600000,
      decodeListings,
    );
    const unique = new Map();
    for (const row of response.data.listings) {
      if (!label(row.variant) || row.variant.length > 120 || !label(row.model))
        continue;
      if (row.make && brandKey(row.make) !== brandKey(make.name)) continue;
      if (canonical(modelName(row.model, make.name)) !== canonical(model.name))
        continue;
      if (
        input.year &&
        (!Number.isInteger(row.year) || Math.abs(row.year - input.year) > 2)
      )
        continue;
      const variant = row.variant.trim();
      const fuel = label(row.fuel) ? row.fuel.trim() : undefined;
      const transmission = label(row.transmission)
        ? row.transmission.trim()
        : undefined;
      const key = [variant, fuel, transmission].map(normalise).join("|");
      if (!unique.has(key)) unique.set(key, { variant, fuel, transmission });
    }
    return {
      items: [...unique.values()],
      as_of: new Date(response.collected_at).toISOString(),
    };
  }
  async function value(input, { inspect } = {}) {
    const reference = await catalog();
    const make = reference.data.makes.find(
      (item) => brandKey(item.name) === brandKey(input.make),
    );
    const model = make?.models.find(
      (item) =>
        canonical(item.name) === canonical(modelName(input.model, make.name)),
    );
    if (!make || !model)
      return buildMarketValuation(input, [], {
        asOf: new Date(reference.collected_at),
        reason: "not_in_catalog",
      });
    const window = comparisonWindow(input);
    const city = marketCity(input.location);
    const params = {
      make: make.slug,
      model: model.slug,
      city: city.slug,
      year_min: String(window.year_from),
      year_max: String(window.year_to),
      km_max: String(window.kilometres_to),
      fuel: normalise(input.fuel),
      transmission: normalise(input.transmission),
      page: "1",
    };
    const first = await client.get(
      "/api/cardekho/v1/used-cars",
      params,
      6 * 3600000,
      decodeListings,
    );
    const rows = [...first.data.listings];
    let collected = first.collected_at;
    if (first.data.has_more) {
      const second = await client.get(
        "/api/cardekho/v1/used-cars",
        { ...params, page: "2" },
        6 * 3600000,
        decodeListings,
      );
      rows.push(...second.data.listings);
      collected = Math.min(collected, second.collected_at);
    }
    if (inspect) await inspect({ listings: rows, collected_at: collected });
    return buildMarketValuation(
      { ...input, make: make.name, model: model.name },
      rows,
      {
        asOf: new Date(collected),
        locationScope: city.name,
      },
    );
  }
  return { catalog, variants, value };
}
const ncr = new Set([
  "delhi",
  "newdelhi",
  "delhincr",
  "gurgaon",
  "gurugram",
  "noida",
  "greaternoida",
  "ghaziabad",
  "faridabad",
]);
function marketCity(value) {
  return ncr.has(canonical(value))
    ? { slug: "new-delhi", name: "Delhi NCR" }
    : {
        slug: normalise(value)
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
        name: value.trim(),
      };
}
const enabled = Boolean(env.scrappa.key) && env.scrappa.enabled;
const client = createScrappaClient({
  apiKey: env.scrappa.key,
  directory: path.join(env.storage, "scrappa-cache"),
  dailyLimit: env.scrappa.dailyLimit,
  monthlyLimit: env.scrappa.monthlyLimit,
});
const provider = createMarketProvider(client);
module.exports = {
  ...provider,
  enabled,
  createMarketProvider,
  decodeCatalog,
  decodeListings,
  marketCity,
  canonical,
  brandKey,
};
