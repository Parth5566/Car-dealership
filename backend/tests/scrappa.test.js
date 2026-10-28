const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
process.env.SCRAPPA_ENABLED = "false";
const { createScrappaClient } = require("../src/lib/scrappa-client");
const {
  decodeCatalog,
  decodeListings,
  createMarketProvider,
} = require("../src/lib/scrappa");
const { buildMarketValuation } = require("../src/lib/market-valuation");
const db = require("../src/config/db");
const instant = Date.parse("2026-10-25T09:00:00Z");
const input = {
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
};
const car = (id, price, extra = {}) => ({
  id,
  title: "2020 Maruti Suzuki Swift LXI",
  make: "Maruti Suzuki",
  variant: "LXI",
  year: 2020,
  price,
  currency: "INR",
  mileage: 30000,
  fuel: "Petrol",
  transmission: "Manual",
  owners: 1,
  location: "New Delhi",
  ...extra,
});
// Grouped taxonomy reproduced from the saved live response; listing fixtures follow the provider docs.
const maruti = {
  label: "Maruti Suzuki",
  value: "maruti",
  models: [{ label: "Maruti Suzuki Swift", value: "maruti-swift" }],
};
const catalogData = {
  filters: {
    brand: {
      options: {
        popular: [maruti],
        luxury: [],
        others: [
          {
            label: "Honda",
            value: "honda",
            models: [{ label: "Honda City", value: "honda-city" }],
          },
          {
            ...maruti,
            models: [
              ...maruti.models,
              { label: "Maruti Suzuki Ritz", value: "maruti-ritz" },
            ],
          },
        ],
      },
    },
  },
};
const endpoint = "/api/cardekho/v1/models";
const respond = (data) =>
  new Response(JSON.stringify({ success: true, data }), {
    headers: { "Content-Type": "application/json" },
  });
async function temporary(t) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "ncr-scrappa-test-"),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
test("Scrappa caches across restarts, coalesces identical calls and never persists the credential", async (t) => {
  const directory = await temporary(t);
  let calls = 0,
    now = instant,
    release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const fetchImpl = async (url, options) => {
    calls++;
    assert.equal(new URL(url).origin, "https://scrappa.co");
    assert.equal(options.headers["x-api-key"], "test-secret-never-persist");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    await wait;
    return respond({ models: ["Swift"], seller: "not saved" });
  };
  const settings = {
    apiKey: "test-secret-never-persist",
    directory,
    now: () => now,
    fetchImpl,
  };
  const first = createScrappaClient(settings);
  const requests = [
    first.get(endpoint, { make: "maruti", page: "1" }, 1000, (data) => ({
      models: data.models,
    })),
    first.get(endpoint, { page: "1", make: "maruti" }, 1000, (data) => ({
      models: data.models,
    })),
  ];
  release();
  const [a, b] = await Promise.all(requests);
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
  const restarted = createScrappaClient(settings);
  assert.deepEqual(
    await restarted.get(
      endpoint,
      { make: "maruti", page: "1" },
      1000,
      (data) => data,
    ),
    a,
  );
  assert.equal(calls, 1);
  now += 1001;
  await restarted.get(
    endpoint,
    { make: "maruti", page: "1" },
    1000,
    (data) => ({ models: data.models }),
  );
  assert.equal(calls, 2);
  const account = (await fs.readdir(directory))[0];
  for (const file of await fs.readdir(path.join(directory, account))) {
    const contents = await fs.readFile(
      path.join(directory, account, file),
      "utf8",
    );
    assert.doesNotMatch(contents, /test-secret-never-persist|not saved/);
  }
});
test("Scrappa reserves persistent daily/monthly attempt budgets before requests, including across client instances", async (t) => {
  const directory = await temporary(t);
  let calls = 0,
    now = instant;
  const settings = {
    directory,
    apiKey: "quota-fixture",
    now: () => now,
    dailyLimit: 2,
    monthlyLimit: 3,
    fetchImpl: async () => {
      calls++;
      return respond({ ok: true });
    },
  };
  const first = createScrappaClient(settings),
    second = createScrappaClient(settings);
  await Promise.all([
    first.get(endpoint, { make: "one" }, 2 * 86400000, (data) => data),
    second.get(endpoint, { make: "two" }, 2 * 86400000, (data) => data),
  ]);
  await assert.rejects(
    second.get(endpoint, { make: "three" }, 1000, (data) => data),
    (error) => error.code === "MARKET_BUDGET",
  );
  assert.equal(calls, 2);
  await first.get(endpoint, { make: "one" }, 1000, (data) => data);
  assert.equal(
    calls,
    2,
    "cache hits remain available after exhausting the budget",
  );
  now += 86400000;
  await first.get(endpoint, { make: "three" }, 1000, (data) => data);
  await assert.rejects(
    second.get(endpoint, { make: "four" }, 1000, (data) => data),
    (error) => error.code === "MARKET_BUDGET",
  );
  assert.equal(calls, 3);
  assert.throws(
    () => createScrappaClient({ ...settings, dailyLimit: NaN }),
    /positive whole/,
  );
});
test("Scrappa failures use safe errors, do not replay billable requests and impose a cooldown", async (t) => {
  for (const status of [401, 403, 429, 500, 200]) {
    const directory = await temporary(t);
    let calls = 0;
    const client = createScrappaClient({
      directory,
      apiKey: "private-test-key",
      now: () => instant,
      fetchImpl: async () => {
        calls++;
        return new Response(
          status === 200
            ? "not json private-test-key"
            : JSON.stringify({ error: { message: "private-test-key" } }),
          { status },
        );
      },
    });
    await assert.rejects(
      client.get(endpoint, { make: "one" }, 1000, (data) => data),
      (error) => {
        assert.doesNotMatch(error.message, /private-test-key/);
        return error.status === 503 && /^MARKET_/.test(error.code);
      },
    );
    await assert.rejects(
      client.get(endpoint, { make: "two" }, 1000, (data) => data),
    );
    assert.equal(calls, 1);
    await assert.rejects(
      client.get("/api/other-service", {}, 1000, (data) => data),
    );
    assert.equal(calls, 1);
  }
});
test("Scrappa catalog uses provider slugs, normalizes display names and rejects unrecognized taxonomy", () => {
  const result = decodeCatalog(catalogData);
  assert.equal(result.makes[0].name, "Maruti Suzuki");
  assert.equal(result.makes[0].models[0].name, "Swift");
  assert.equal(result.makes[1].models[0].slug, "honda-city");
  assert.equal(result.makes.length, 2);
  assert.equal(result.makes[0].models.length, 2);
  assert.equal(result.makes[0].models[1].name, "Ritz");
  assert.equal(result.makes[0].models[0].slug, "maruti-swift");
  assert.equal(
    decodeCatalog({ filters: { brand: { options: [maruti] } } }).makes.length,
    1,
  );
  assert.throws(
    () => decodeCatalog({ filters: { renamed_brand: {} } }),
    (error) =>
      error.code === "MARKET_SCHEMA" &&
      error.diagnostics.filter_fields[0] === "renamed_brand",
  );
  assert.throws(
    () => decodeListings({ cars: [] }),
    (error) => error.code === "MARKET_SCHEMA",
  );
});
test("market ranges use broad model comparisons, retain compatible powertrains and deduplicate real INR ads", () => {
  const good = [
    car("1", 400000),
    car("2", 450000, {
      year: 2019,
      title: "2019 Maruti Suzuki Swift LXI",
      mileage: 55000,
      variant: "VXI",
      owners: 2,
      model: "Maruti Suzuki Swift",
      location: "Gurugram",
    }),
    car("3", 500000, {
      model: "Maruti Suzuki Swift",
      mileage: 40000,
      url: "https://www.cardekho.com/used-car-details/test",
    }),
  ];
  const invalid = [
    { currency: "USD" },
    { price: "400000" },
    { price: 0 },
    { price: NaN },
    { title: "2020 Maruti Suzuki Swift Dzire LXI" },
    { model: "Dzire" },
    { make: "Honda" },
    { year: 2017 },
    { mileage: 60001 },
    { mileage: null },
    { owners: null },
    { fuel: "Diesel" },
    { transmission: "Automatic" },
    { location: "Mumbai" },
  ];
  const report = buildMarketValuation(
    input,
    [
      ...good,
      ...invalid.map((change, i) => car(String(i + 10), 1, change)),
      car("1", 1),
    ],
    { asOf: new Date(instant), locationScope: "Delhi NCR" },
  );
  assert.equal(report.count, 3);
  assert.deepEqual(report.range, { low: 400000, high: 500000, median: 450000 });
  assert.equal(report.basis, "scrappa_cardekho_asking_prices");
  assert.equal(report.as_of, new Date(instant).toISOString());
  assert.equal(
    report.comparables.find((car) => car.id === "3").href,
    "https://www.cardekho.com/used-car-details/test",
  );
  assert.equal(report.comparables[0].slug, undefined);
  assert.deepEqual(
    buildMarketValuation({ ...input, purpose: "buy" }, good, {
      asOf: new Date(instant),
      locationScope: "Delhi NCR",
    }),
    report,
  );
  const sparse = buildMarketValuation(input, good.slice(0, 2));
  assert.equal(sparse.status, "available");
  assert.equal(sparse.range_method, "estimated_band");
  assert.deepEqual(sparse.range, { low: 382000, high: 468000, median: 425000 });
  assert.equal(sparse.comparables.length, 2);
  const single = buildMarketValuation(input, good.slice(0, 1));
  assert.deepEqual(single.range, { low: 360000, high: 440000, median: 400000 });
  assert.equal(single.minimum_comparables, 1);
  assert.equal(single.approximation_percent, 10);
  assert.equal(buildMarketValuation(input, []).range, null);
  const grouped = good.map((row, i) => ({
    ...row,
    owners: i + 4,
    url: "javascript:alert(1)",
  }));
  const group = buildMarketValuation(
    { ...input, owners: 4, owners_at_least: true },
    grouped,
  );
  assert.equal(group.count, 3);
  assert.ok(group.comparables.every((row) => row.href === undefined));
});
test("market adapter sends documented filters, deduplicates overlapping pages and keeps cached collection time", async () => {
  const calls = [];
  const rows = [car("1", 400000), car("2", 450000), car("3", 500000)];
  const toSource = (row) => ({
    ...row,
    used_car_sku_id: row.id,
    price: { value: row.price, currency: row.currency },
    km: { value: row.mileage },
    owner: { count: row.owners },
    location: { city: row.location },
    seller: { email: "not-public@example.test" },
  });
  const provider = createMarketProvider({
    async get(endpoint, params, ttl, decode) {
      calls.push({ endpoint, params });
      return {
        collected_at: instant,
        data: decode(
          endpoint.endsWith("/filters")
            ? catalogData
            : {
                listings: (params.page === "1"
                  ? rows.slice(0, 2)
                  : rows.slice(1)
                ).map(toSource),
                pagination: { has_more: params.page === "1" },
              },
        ),
      };
    },
  });
  const result = await provider.value(input);
  assert.equal(result.count, 3);
  assert.equal(result.as_of, new Date(instant).toISOString());
  assert.equal(calls[1].params.city, "new-delhi");
  assert.equal(calls[1].params.make, "maruti");
  assert.equal(calls[1].params.model, "maruti-swift");
  assert.equal(calls[1].params.year_min, "2018");
  assert.equal(calls[1].params.year_max, "2022");
  assert.equal(calls[1].params.fuel, "petrol");
  assert.equal(calls[1].params.km_max, "60000");
  assert.equal(calls[1].params.variant, undefined);
  assert.equal(calls[1].params.owner, undefined);
  assert.equal(calls.length, 3);
  assert.doesNotMatch(JSON.stringify(result), /seller|not-public/);
  const unsupported = await provider.value({ ...input, model: "Unsupported" });
  assert.equal(unsupported.reason, "not_in_catalog");
  assert.equal(
    calls.length,
    4,
    "unsupported cars do not trigger billable guessed searches",
  );
});
test("Variant choices use the selected historical model, deduplicate names and exclude unrelated cars and private fields", async () => {
  const requests = [];
  const rows = [
    car("v1", 400000, { model: "Maruti Suzuki Swift", variant: "LXI" }),
    car("v2", 420000, { model: "Swift", variant: "lxi" }),
    car("v3", 450000, { model: "Swift", variant: "VXI", fuel: "CNG" }),
    car("v4", 500000, { model: "Swift", variant: "ZXI", year: 2017 }),
    car("v5", 500000, { model: "Swift Dzire", variant: "Wrong model" }),
    car("v6", 500000, {
      model: "Swift",
      make: "Honda",
      variant: "Wrong brand",
    }),
  ];
  const provider = createMarketProvider({
    async get(endpoint, params, ttl, decode) {
      requests.push({ endpoint, params, ttl });
      return {
        collected_at: instant,
        data: decode(
          endpoint.endsWith("/filters")
            ? catalogData
            : {
                listings: rows.map((row) => ({
                  ...row,
                  used_car_sku_id: row.id,
                  price: { value: row.price, currency: row.currency },
                  km: { value: row.mileage },
                  owner: { count: row.owners },
                  location: { city: row.location },
                  seller: { email: "private@example.test" },
                })),
              },
        ),
      };
    },
  });
  const result = await provider.variants({
    make: input.make,
    model: input.model,
    year: 2020,
  });
  assert.deepEqual(
    result.items.map((item) => item.variant),
    ["LXI", "VXI"],
  );
  assert.equal(result.items[1].fuel, "CNG");
  assert.equal(result.as_of, new Date(instant).toISOString());
  assert.deepEqual(requests[1].params, {
    make: "maruti",
    model: "maruti-swift",
    page: "1",
    year_min: "2018",
    year_max: "2022",
  });
  assert.equal(requests[1].ttl, 6 * 3600000);
  assert.doesNotMatch(JSON.stringify(result), /private|seller|price|v1/);
  assert.deepEqual(
    (await provider.variants({ make: "Unknown", model: "Nothing" })).items,
    [],
  );
  assert.equal(
    requests.length,
    3,
    "unknown models never trigger a guessed billable search",
  );
});
after(() => db.pool.end());
