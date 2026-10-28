const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../config/db");
const { wrap, z, text } = require("../lib/core");
const market = require("../lib/scrappa");
const { comparisonWindow, locationKeys } = require("../lib/valuation-policy");
const {
  valuationSchema,
  valuationWhere,
  buildValuation,
} = require("../lib/valuation");
const router = express.Router();
const priceLimit = rateLimit({
  windowMs: 60000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMIT",
      message: "Please wait a minute before checking another price.",
    },
  },
});
router.get(
  "/vehicle-options",
  priceLimit,
  wrap(async (req, res) => {
    const type = z.enum(["passenger", "commercial"]).parse(req.query.type);
    const items = await query(
      "SELECT make,model,year,JSON_UNQUOTE(JSON_EXTRACT(data,'$.variant')) AS variant FROM nw_vehicles WHERE approved=TRUE AND status IN ('published','reserved') AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data,'$.is_sample')),'false')='false' AND type=? GROUP BY make,model,year,variant ORDER BY make,model,year DESC,variant LIMIT 1000",
      [type],
    );
    res.set("Cache-Control", "no-store");
    res.json({ items, market_enabled: market.enabled });
  }),
);
router.get(
  "/valuation/options",
  priceLimit,
  wrap(async (req, res) => {
    const items = await query(
      `SELECT make,model,location,fuel,transmission,JSON_UNQUOTE(JSON_EXTRACT(data,'$.variant')) AS variant FROM nw_vehicles WHERE ${valuationWhere} GROUP BY make,model,location,variant,fuel,transmission ORDER BY make,model,variant,location,fuel,transmission LIMIT 500`,
    );
    res.set("Cache-Control", "no-store");
    res.json({ items, market_enabled: market.enabled });
  }),
);
router.get(
  "/valuation/catalog",
  priceLimit,
  wrap(async (req, res) => {
    if (!market.enabled) {
      res.set("Cache-Control", "no-store");
      return res.json({ makes: [], source: "unconfigured" });
    }
    const reference = await market.catalog();
    res.set("Cache-Control", "no-store");
    res.json({
      makes: reference.data.makes.map((make) => ({
        name: make.name,
        models: make.models.map((model) => model.name),
      })),
      source: "scrappa_cardekho",
      as_of: new Date(reference.collected_at).toISOString(),
    });
  }),
);
const variantQuery = z
  .object({
    make: text(80),
    model: text(100),
    year: z.coerce
      .number()
      .int()
      .min(1950)
      .max(new Date().getUTCFullYear())
      .optional(),
  })
  .strict();
router.get(
  "/valuation/variants",
  priceLimit,
  wrap(async (req, res) => {
    const input = variantQuery.parse(req.query);
    res.set("Cache-Control", "no-store");
    if (!market.enabled) return res.json({ items: [], source: "unconfigured" });
    const result = await market.variants(input);
    res.json({ ...result, source: "scrappa_cardekho" });
  }),
);
router.post(
  "/valuation",
  priceLimit,
  wrap(async (req, res) => {
    const input = valuationSchema.parse(req.body);
    if (market.enabled) {
      const report = await market.value(input);
      res.set("Cache-Control", "no-store");
      return res.json(report);
    }
    const window = comparisonWindow(input);
    const areas = locationKeys(input.location);
    const rows = await query(
      `SELECT id,slug,type,approved,status,make,model,year,price,mileage,fuel,transmission,location,data,updated_at FROM nw_vehicles WHERE ${valuationWhere} AND LOWER(TRIM(make))=? AND LOWER(TRIM(model))=? AND LOWER(TRIM(fuel))=? AND LOWER(TRIM(transmission))=? AND LOWER(REPLACE(REPLACE(TRIM(location),' ',''),'-','')) IN (${areas.map(() => "?").join(",")}) AND year BETWEEN ? AND ? AND mileage BETWEEN ? AND ? ORDER BY updated_at DESC,id DESC LIMIT 200`,
      [input.make, input.model, input.fuel, input.transmission]
        .map((value) => value.toLowerCase())
        .concat([
          ...areas,
          window.year_from,
          window.year_to,
          window.kilometres_from,
          window.kilometres_to,
        ]),
    );
    res.set("Cache-Control", "no-store");
    res.json(buildValuation(input, rows));
  }),
);
module.exports = { router };
