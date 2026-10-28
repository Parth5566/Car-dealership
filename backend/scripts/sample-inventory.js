// Explicit owner-requested test inventory. Normal startup never runs this importer.
const { pool } = require("../src/config/db");
const env = require("../src/config/env");
const { samples, manageSamples } = require("../src/lib/sample-inventory");
(async () => {
  let connection;
  try {
    const action = process.argv[2] || "plan";
    if (action === "plan") {
      console.log(
        JSON.stringify(
          samples.map(({ vehicle, status }) => ({
            make: vehicle.make,
            model: vehicle.model,
            price: vehicle.price,
            type: vehicle.type,
            status,
            label: "SAMPLE ONLY — not for sale",
          })),
          null,
          2,
        ),
      );
      return;
    }
    if (env.production)
      throw new Error("Sample inventory is disabled in production");
    connection = await pool.getConnection();
    const result = await manageSamples(connection, {
      action,
      storage: env.storage,
      production: env.production,
    });
    console.log(JSON.stringify(result, null, 2));
    console.log(
      action === "add"
        ? "Sample vehicles are visible in /cars and /commercial. All entries and illustrations are labelled test data. Existing inventory was preserved."
        : "Only the known sample batch was archived. Vehicles, customer records and files were retained.",
    );
  } catch (error) {
    console.error(
      error.code === "EPERM"
        ? "Database access was denied by the execution sandbox. Run npm run samples:add from your local terminal."
        : "Sample inventory failed: " + (error.code || error.message),
    );
    process.exitCode = 1;
  } finally {
    connection?.release();
    await pool.end();
  }
})();
