const { test } = require("node:test");
process.env.SCRAPPA_ENABLED = "false";
const assert = require("node:assert/strict");
const {
  valuationSchema,
  buildValuation,
  valuationWhere,
} = require("../src/lib/valuation");
const now = new Date("2026-10-25T09:00:00Z");
const input = {
  purpose: "sell",
  make: "Maruti Suzuki",
  model: "Swift",
  variant: "VXi",
  year: 2020,
  mileage: 40000,
  owners: 1,
  fuel: "Petrol",
  transmission: "Manual",
  location: "New Delhi",
};
const row = (id, price, extra = {}) => ({
  ...input,
  id,
  price,
  slug: "test-car",
  type: "passenger",
  approved: 1,
  status: "published",
  updated_at: "2026-10-24 09:00:00",
  data: { variant: "VXi", owners: 1 },
  ...extra,
});
test("valuation reports only the observed range and median; buying and selling use the same data", () => {
  const rows = [row(1, "500000.00"), row(2, 400000), row(3, 450000)];
  const report = buildValuation(input, rows, now);
  assert.equal(report.status, "available");
  assert.deepEqual(report.range, { low: 400000, high: 500000, median: 450000 });
  assert.equal(report.count, 3);
  assert.deepEqual(
    report,
    buildValuation({ ...input, purpose: "buy" }, rows, now),
  );
  assert.equal(
    buildValuation(input, [...rows, row(4, 550000)], now).range.median,
    475000,
  );
  assert.equal(report.comparables[0].data, undefined);
  assert.equal(report.comparables[0].seller_contact, undefined);
});
test("valuation accepts two real listings while excluding samples, unpublished cars, stale rows and duplicates", () => {
  const good = [row(1, 400000), row(2, 500000)];
  const excluded = [
    row(3, 1, { data: { variant: "VXi", owners: 1, is_sample: true } }),
    row(4, 1, {
      data: JSON.stringify({ variant: "VXi", owners: 1, is_sample: "true" }),
    }),
    row(5, 1, { status: "draft" }),
    row(6, 1, { status: "reserved" }),
    row(7, 1, { status: "sold" }),
    row(8, 1, { approved: 0 }),
    row(9, 1, { approved: "0" }),
    row(10, 1, { updated_at: "2026-01-01 00:00:00" }),
    row(11, 1, { updated_at: "2027-01-01 00:00:00" }),
    row(12, 1, { updated_at: "invalid" }),
    row(13, 1, { type: "commercial" }),
    row(14, 1, { data: "invalid-json" }),
    row(17, 1, { data: "null" }),
    row(18, 1, { data: "[]" }),
    row(19, 1, { mileage: null }),
    row(20, 1, { mileage: "" }),
    row(21, 1, { mileage: undefined }),
    row(15, NaN),
    row(16, 0),
    row(1, 1),
  ];
  const report = buildValuation(input, [...good, ...excluded], now);
  assert.equal(report.count, 2);
  assert.equal(report.status, "available");
  assert.deepEqual(report.range, { low: 400000, high: 500000, median: 450000 });
  assert.equal(report.range_method, "estimated_band");
  assert.equal(report.comparables.length, 2);
  assert.match(valuationWhere, /is_sample/);
  assert.match(valuationWhere, /status='published'/);
  assert.match(valuationWhere, /INTERVAL 90 DAY/);
});
test("valuation keeps the model and powertrain compatible within broader year/distance windows", () => {
  const changes = [
    { make: "Other" },
    { model: "Other" },
    { fuel: "Diesel" },
    { transmission: "Automatic" },
    { location: "Mumbai" },
    { year: 2017 },
    { mileage: 70001 },
  ];
  const report = buildValuation(
    input,
    [
      row(1, 400000, { make: " maruti suzuki " }),
      row(2, 450000, {
        year: 2018,
        mileage: 10000,
        location: "Gurugram",
        data: { variant: "ZXi", owners: 2 },
      }),
      row(3, 500000, { year: 2022, mileage: 70000 }),
      ...changes.map((change, i) => row(i + 10, 1, change)),
    ],
    now,
  );
  assert.equal(report.count, 3);
  assert.equal(report.range.low, 400000);
  assert.deepEqual(report.matching, {
    year_from: 2018,
    year_to: 2022,
    kilometres_from: 10000,
    kilometres_to: 70000,
    broad_matches: true,
    updated_within_days: 90,
  });
});
test("valuation input rejects nonnumeric distance, implausible values and extra fields", () => {
  assert.equal(valuationSchema.parse(input).mileage, 40000);
  for (const change of [
    { mileage: "" },
    { mileage: true },
    { mileage: -1 },
    { mileage: 1.5 },
    { mileage: 5000001 },
    { year: 1949 },
    { year: new Date().getUTCFullYear() + 1 },
    { owners: 0 },
    { owners: 1, owners_at_least: true },
    { owners: 4, owners_at_least: "true" },
    { location: " " },
    { variant: "" },
    { purpose: "trade" },
    { price: 1 },
  ])
    assert.equal(
      valuationSchema.safeParse({ ...input, ...change }).success,
      false,
    );
});
test("ownership groups rank nearby cars without excluding other valid owner counts", () => {
  const rows = [3, 4, 5, 6, 21].map((owners, index) =>
    row(index + 1, 400000 + index * 10000, {
      data: { variant: "VXi", owners },
    }),
  );
  const grouped = valuationSchema.parse({
    ...input,
    owners: 4,
    owners_at_least: true,
  });
  const broad = buildValuation(grouped, rows, now);
  assert.equal(broad.count, 4);
  assert.ok(broad.comparables.every((car) => car.owners >= 4));
  const exact = buildValuation({ ...input, owners: 4 }, rows, now);
  assert.equal(exact.count, 4);
  assert.equal(exact.comparables[0].owners, 4);
  assert.equal(
    buildValuation({ ...input, owners: 4, owners_at_least: false }, rows, now)
      .count,
    4,
  );
});
test("valuation endpoints bind comparisons, return public fields and scope rate limiting to price checks", async () => {
  const db = require("../src/config/db");
  const previous = db.query,
    calls = [];
  db.query = async (sql, values) => {
    calls.push({ sql, values });
    return sql.startsWith("SELECT make")
      ? []
      : [
          row(1, 400000, { updated_at: new Date() }),
          row(2, 450000, { updated_at: new Date() }),
          row(3, 500000, { updated_at: new Date() }),
        ];
  };
  try {
    const { router } = require("../src/routes/valuation");
    assert.equal(
      router.stack.filter((layer) => !layer.route).length,
      0,
      "limiter must not affect unrelated account/admin/media routes",
    );
    async function invoke(path, body) {
      const handler = router.stack
        .find((layer) => layer.route.path === path)
        .route.stack.at(-1).handle;
      let data, error;
      await handler(
        { body, query: body },
        {
          set() {},
          json(value) {
            data = value;
          },
        },
        (value) => {
          error = value;
        },
      );
      return { data, error };
    }
    const good = await invoke("/valuation", input);
    assert.equal(good.data.count, 3);
    assert.equal(good.data.range.low, 400000);
    assert.doesNotMatch(calls[0].sql, /\$\.owners|\$\.variant/);
    assert.equal(
      (calls[0].sql.match(/\?/g) || []).length,
      calls[0].values.length,
    );
    await invoke("/valuation", { ...input, make: "Brand' OR 1=1 --" });
    assert.equal(calls[1].sql.includes("Brand'"), false);
    assert.equal(calls[1].values[0], "brand' or 1=1 --");
    assert.match(calls[1].sql, /LIMIT 200/);
    await invoke("/valuation", { ...input, owners: 4, owners_at_least: true });
    assert.doesNotMatch(calls.at(-1).sql, /\$\.owners|\$\.variant/);
    assert.deepEqual(calls.at(-1).values.slice(-4), [2018, 2022, 10000, 70000]);
    assert.equal(
      (await invoke("/valuation", { ...input, mileage: -1 })).error.name,
      "ZodError",
    );
    await invoke("/valuation/options");
    assert.match(calls.at(-1).sql, /GROUP BY make,model,location,variant/);
    assert.match(calls.at(-1).sql, /LIMIT 500/);
    const market = require("../src/lib/scrappa");
    const before = {
      enabled: market.enabled,
      catalog: market.catalog,
      variants: market.variants,
      value: market.value,
    };
    try {
      market.enabled = true;
      const sellerOptions = await invoke("/vehicle-options", {
        type: "passenger",
      });
      assert.equal(sellerOptions.data.market_enabled, true);
      assert.deepEqual(calls.at(-1).values, ["passenger"]);
      assert.match(calls.at(-1).sql, /approved=TRUE/);
      assert.match(calls.at(-1).sql, /status IN \('published','reserved'\)/);
      assert.match(calls.at(-1).sql, /is_sample/);
      assert.doesNotMatch(
        calls.at(-1).sql,
        /seller|contact|document|SELECT \*/i,
      );
      assert.equal(
        (await invoke("/vehicle-options", { type: "commercial" })).data
          .market_enabled,
        true,
      );
      assert.deepEqual(calls.at(-1).values, ["commercial"]);
      const validQueries = calls.length;
      assert.equal(
        (await invoke("/vehicle-options", { type: "passenger' OR 1=1" })).error
          .name,
        "ZodError",
      );
      assert.equal(
        calls.length,
        validQueries,
        "reject unsupported categories before querying",
      );
      market.catalog = async () => ({
        collected_at: now.getTime(),
        data: {
          makes: [
            {
              name: "Honda",
              slug: "honda",
              models: [{ name: "City", slug: "honda-city" }],
            },
          ],
        },
      });
      const report = {
        status: "insufficient_data",
        basis: "scrappa_cardekho_asking_prices",
        range: null,
      };
      let checks = 0;
      market.value = async (value) => {
        checks++;
        assert.equal(value.mileage, 40000);
        return report;
      };
      const start = calls.length;
      const catalog = await invoke("/valuation/catalog");
      assert.deepEqual(catalog.data.makes, [
        { name: "Honda", models: ["City"] },
      ]);
      assert.equal(catalog.data.source, "scrappa_cardekho");
      let variantCalls = 0;
      market.variants = async (value) => {
        variantCalls++;
        assert.equal(value.year, 2020);
        return {
          items: [{ variant: "VXi", fuel: "Petrol", transmission: "Manual" }],
          as_of: now.toISOString(),
        };
      };
      const variants = await invoke("/valuation/variants", {
        make: "Honda",
        model: "City",
        year: "2020",
      });
      assert.equal(variants.data.items[0].variant, "VXi");
      assert.equal(variants.data.source, "scrappa_cardekho");
      assert.equal(
        (
          await invoke("/valuation/variants", {
            make: "Honda",
            model: "City",
            year: "oops",
          })
        ).error.name,
        "ZodError",
      );
      assert.equal(variantCalls, 1);

      assert.equal((await invoke("/valuation", input)).data, report);
      assert.equal(
        calls.length,
        start,
        "market results never silently mix with local stock",
      );
      assert.equal(checks, 1);
      assert.equal(
        (await invoke("/valuation", { ...input, mileage: -1 })).error.name,
        "ZodError",
      );
      assert.equal(checks, 1, "validate before a billable provider request");
      await invoke("/valuation/options");
      assert.equal(
        (await invoke("/valuation/options")).data.market_enabled,
        true,
      );
    } finally {
      Object.assign(market, before);
    }
  } finally {
    db.query = previous;
  }
});

test("one listing produces a disclosed approximate band; no listings still has no range", () => {
  const single = buildValuation(input, [row(1, 400000)], now);
  assert.equal(single.minimum_comparables, 1);
  assert.equal(single.range_method, "estimated_band");
  assert.equal(single.approximation_percent, 10);
  assert.deepEqual(single.range, { low: 360000, high: 440000, median: 400000 });
  assert.equal(single.comparables.length, 1);
  const empty = buildValuation(input, [], now);
  assert.equal(empty.status, "insufficient_data");
  assert.equal(empty.range, null);
  assert.deepEqual(empty.comparables, []);
  for (const mileage of [null, undefined, ""]) {
    assert.equal(
      buildValuation(
        { ...input, mileage: 30000 },
        [row(2, 400000, { mileage })],
        now,
      ).count,
      0,
      "missing distance cannot become a zero-kilometre comparison",
    );
  }
});
test("price bands handle two ads, identical prices and small prices without floating point rounding jumps", () => {
  const { priceSummary } = require("../src/lib/valuation-policy");
  assert.deepEqual(priceSummary([400000, 420000]).range, {
    low: 369000,
    high: 451000,
    median: 410000,
  });
  assert.deepEqual(priceSummary([500000]).range, {
    low: 450000,
    high: 550000,
    median: 500000,
  });
  assert.deepEqual(priceSummary([400000, 400000, 400000]).range, {
    low: 360000,
    high: 440000,
    median: 400000,
  });
  assert.equal(
    priceSummary([400000, 450000, 500000]).range_method,
    "observed_prices",
  );
  assert.ok(priceSummary([1]).range.low > 0);
  assert.ok(priceSummary([1]).range.high > priceSummary([1]).range.low);
});
