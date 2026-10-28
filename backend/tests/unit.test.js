const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  transition,
  submissionTransitions,
  vehicleTransitions,
  emi,
  vehicleSchema,
  requirements,
  password,
} = require("../src/lib/core");
const { search } = require("../src/routes/public");
const { pool } = require("../src/config/db");
const valid = {
  type: "passenger",
  make: "Test",
  model: "Fixture",
  year: 2024,
  price: 500000,
  mileage: 10000,
  fuel: "Petrol",
  transmission: "Manual",
  location: "Delhi",
  body_type: "Hatchback",
  owners: 1,
  description: "Development fixture",
};
test("seller approval and publication are separate valid transitions", () => {
  transition(submissionTransitions, "submitted", "approved");
  transition(submissionTransitions, "approved", "published");
  assert.throws(() =>
    transition(submissionTransitions, "submitted", "published"),
  );
  assert.throws(() => transition(submissionTransitions, "draft", "approved"));
});
test("information can be resubmitted without a duplicate submission", () => {
  transition(submissionTransitions, "information_required", "submitted");
  assert.throws(() =>
    transition(submissionTransitions, "rejected", "published"),
  );
});
test("inventory lifecycle prevents sold inventory from being republished", () => {
  transition(vehicleTransitions, "published", "sold");
  assert.throws(() => transition(vehicleTransitions, "sold", "published"));
});
test("EMI handles both interest-bearing and zero-interest loans", () => {
  assert.ok(Math.abs(emi(500000, 10, 60).monthly - 10623.52) < 0.01);
  assert.equal(emi(120000, 0, 12).monthly, 10000);
  assert.throws(() => emi(1, -1, 12));
});
test("commercial checklist extends the passenger requirements", () => {
  assert.ok(requirements("commercial").includes("permit"));
  assert.ok(!requirements("passenger").includes("permit"));
  assert.ok(!requirements("passenger").includes("aadhaar"));
});
test("vehicle validation rejects invalid and irrelevant values", () => {
  assert.equal(vehicleSchema.parse(valid).type, "passenger");
  assert.throws(() => vehicleSchema.parse({ ...valid, price: -1 }));
  assert.throws(() => vehicleSchema.parse({ ...valid, payload_kg: 200 }));
});
test("fuel economy is optional and independent of total kilometres driven", () => {
  assert.equal(vehicleSchema.parse(valid).fuel_economy, undefined);
  for (const value of [null, "", "   "])
    assert.equal(
      vehicleSchema.parse({ ...valid, fuel_economy: value }).fuel_economy,
      null,
    );
  const parsed = vehicleSchema.parse({
    ...valid,
    mileage: 42000,
    fuel_economy: "18.75",
  });
  assert.equal(parsed.mileage, 42000);
  assert.equal(parsed.fuel_economy, 18.75);
  for (const value of [0, -1, 1001, "not a number", Infinity, true, [], {}])
    assert.throws(() => vehicleSchema.parse({ ...valid, fuel_economy: value }));
});
test("search always enforces public visibility and allowlisted sorting", () => {
  const s = search({ q: "' OR 1=1 --", sort: "price_asc", page: 2 });
  assert.match(s.where, /approved=TRUE/);
  assert.match(s.where, /status IN/);
  assert.ok(!s.where.includes("1=1"));
  assert.equal(s.order, "price ASC,id DESC");
  assert.throws(() => search({ sort: "DROP TABLE cars" }));
});
test("password limits account for bcrypt UTF-8 byte truncation", () => {
  assert.throws(() => password.parse("short"));
  assert.equal(password.parse("six123"), "six123");
  assert.throws(() => password.parse("🔑".repeat(20)));
  assert.equal(password.parse("a strong password"), "a strong password");
});
require("node:test").after(() => pool.end());
