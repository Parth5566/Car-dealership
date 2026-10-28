import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateLoan } from "../lib/loan.ts";
import { parseCompareIds, toggleCompareId } from "../lib/compare-state.ts";
import { money, fuelEconomy } from "../lib/types.ts";
import { offerState } from "../lib/offers.ts";
test("fuel economy uses the fuel's unit and never substitutes odometer distance", () => {
  for (const [fuel, value, expected] of [
    ["Petrol", 18.75, "18.75 km/l"],
    ["Diesel", 22, "22 km/l"],
    ["Hybrid", 24.5, "24.5 km/l"],
    ["CNG", 25, "25 km/kg"],
    ["Electric", 5.4, "5.4 km/kWh"],
  ])
    assert.equal(fuelEconomy({ fuel, fuel_economy: value }), expected);
  for (const value of [undefined, null, 0, NaN, Infinity])
    assert.equal(fuelEconomy({ fuel: "Petrol", fuel_economy: value }), null);
});

test("offer visibility labels respect draft state and exact start/expiry boundaries", () => {
  const base = {
    status: "published",
    starts_at: "2026-10-25T10:00:00Z",
    expires_at: "2026-10-26T10:00:00Z",
  };
  assert.equal(
    offerState(base, Date.parse("2026-10-25T09:59:59Z")),
    "scheduled",
  );
  assert.equal(offerState(base, Date.parse(base.starts_at)), "active");
  assert.equal(offerState(base, Date.parse(base.expires_at)), "expired");
  assert.equal(
    offerState({ ...base, status: "draft" }, Date.parse(base.starts_at)),
    "draft",
  );
});

test("rupee amounts preserve Indian grouping and whole-rupee rounding", () => {
  for (const [value, expected] of [
    [0, "₹0"],
    [725000, "₹7,25,000"],
    [10000000, "₹1,00,00,000"],
    [10623.52, "₹10,624"],
    [999999.5, "₹10,00,000"],
    [-725000, "-₹7,25,000"],
  ])
    assert.equal(money(value), expected);
});

test("server and browser currency spacing produces identical rupee text", (t) => {
  const NumberFormat = Intl.NumberFormat;
  let spacing = "";
  // Model engines whose locale data inserts different currency separators.
  t.mock.method(Intl, "NumberFormat", function (locale, options) {
    const formatter = new NumberFormat(locale, options);
    return {
      format(value) {
        return formatter.format(value).replace("₹", "₹" + spacing);
      },
    };
  });
  for (spacing of ["", " ", "\u00a0", "\u202f"]) {
    assert.equal(money(725000), "₹7,25,000");
    assert.equal(money(-725000), "-₹7,25,000");
  }
});

test("EMI matches a known reducing-balance example and amortizes the full loan", () => {
  const result = calculateLoan(600000, 100000, 10, 60);
  assert.ok(Math.abs(result.monthly - 10623.52) < 0.01);
  assert.ok(
    Math.abs(
      result.yearly.reduce((sum, row) => sum + row.principal, 0) - 500000,
    ) < 0.01,
  );
  assert.ok(
    Math.abs(
      result.yearly.reduce((sum, row) => sum + row.interest, 0) -
        result.interest,
    ) < 0.01,
  );
  assert.equal(result.yearly.at(-1).balance, 0);
});
test("EMI supports zero interest, full down payment and a partial final year", () => {
  const zero = calculateLoan(120000, 0, 0, 12);
  assert.equal(zero.monthly, 10000);
  assert.equal(zero.interest, 0);
  assert.equal(calculateLoan(120000, 120000, 10, 12).monthly, 0);
  const partial = calculateLoan(200000, 20000, 8, 18);
  assert.equal(partial.yearly.length, 2);
  assert.equal(partial.yearly[1].balance, 0);
});
test("EMI rejects invalid input and remains stable near zero interest", () => {
  for (const args of [
    [0, 0, 10, 12],
    [100, 101, 10, 12],
    [100, 0, -1, 12],
    [100, 0, 41, 12],
    [100, 0, 10, 1.5],
    [100, 0, 10, 121],
    [NaN, 0, 10, 12],
  ])
    assert.equal(calculateLoan(...args), null);
  assert.ok(
    Math.abs(calculateLoan(120000, 0, 1e-10, 12).monthly - 10000) < 0.00001,
  );
});
test("comparison restores only unique valid IDs and tolerates corrupt saved state", () => {
  assert.deepEqual(parseCompareIds("{}"), []);
  assert.deepEqual(parseCompareIds("invalid"), []);
  assert.deepEqual(parseCompareIds('[1,1,2,-1,"3",null,3,4]'), [1, 2, 3]);
});
test("comparison supports removal and replacement while enforcing three slots", () => {
  assert.deepEqual(toggleCompareId([1, 2], 3), [1, 2, 3]);
  assert.deepEqual(toggleCompareId([1, 2, 3], 4), [1, 2, 3]);
  const removed = toggleCompareId([1, 2, 3], 2);
  assert.deepEqual(toggleCompareId(removed, 4), [1, 3, 4]);
});
