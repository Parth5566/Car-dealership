// Development fixtures are opt-in and forbidden in the owner's existing database.
const { pool, query, transaction } = require("../src/config/db");
const env = require("../src/config/env");
const { saveVehicle } = require("../src/routes/admin");
const { audit } = require("../src/lib/store");
(async () => {
  try {
    if (
      process.env.NODE_ENV === "production" ||
      !/^ncrwheelz_(dev|test|e2e)_/.test(env.db.database) ||
      process.env.ALLOW_DEVELOPMENT_FIXTURES !== "true"
    )
      throw new Error(
        "Fixtures require a separate ncrwheelz_dev_*, ncrwheelz_test_* or ncrwheelz_e2e_* database and ALLOW_DEVELOPMENT_FIXTURES=true",
      );
    await transaction(async (db) => {
      const v = await saveVehicle(
        {
          type: "passenger",
          make: "DEVELOPMENT FIXTURE",
          model: "Example Hatchback",
          variant: "Sample only",
          year: 2024,
          price: 600000,
          mileage: 12000,
          fuel: "Petrol",
          transmission: "Manual",
          location: "Delhi NCR (fixture)",
          body_type: "Hatchback",
          owners: 1,
          description:
            "DEVELOPMENT FIXTURE. Not a real vehicle listing. Do not publish to a live marketplace.",
          features: [],
          featured: false,
          seo_title: "",
          seo_description: "",
        },
        db,
      );
      await audit(null, "development.seed", "vehicle", v, {}, db);
    });
    console.log(
      "Created one private development fixture. No real inventory was imported.",
    );
  } catch (e) {
    console.error(e.code || e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
