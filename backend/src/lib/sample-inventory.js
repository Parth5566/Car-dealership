const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const fixtures = require("../../fixtures/sample-vehicles.json");
const { vehicleSchema, fail } = require("./core");
const { saveVehicle } = require("../routes/admin");
const { audit, history } = require("./store");
const prefix = "ncr-wheelz-sample-v1-";
const samples = fixtures.map(({ key, color, status, ...fields }) => ({
  status,
  color,
  vehicle: {
    ...vehicleSchema.parse({
      ...fields,
      variant: "SAMPLE ONLY — not for sale",
      description:
        "SAMPLE VEHICLE FOR WEBSITE TESTING ONLY. Not a real vehicle, offer or verified specification. All prices, mileage, equipment and capacities are hypothetical test values. Images are generic illustrations, not photographs of this model.",
    }),
    is_sample: true,
    sample_key: prefix + key,
  },
}));
const escapeXml = (text) =>
  text.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character],
  );
function illustration(sample, index) {
  const title = escapeXml(`${sample.vehicle.make} ${sample.vehicle.model}`);
  const commercial = sample.vehicle.type === "commercial";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <rect width="1200" height="800" fill="${index ? "#dfe7ed" : "#edf0f4"}"/>
    <rect x="65" y="55" width="1070" height="72" rx="15" fill="#101c2c"/>
    <text x="600" y="103" text-anchor="middle" font-family="sans-serif" font-size="30" fill="white">SAMPLE VEHICLE — NOT FOR SALE</text>
    <text x="600" y="210" text-anchor="middle" font-family="sans-serif" font-size="42" fill="#101c2c">${title}</text>
    <ellipse cx="600" cy="575" rx="445" ry="42" fill="#c5ced7"/>
    <path d="M185 490L315 440L435 320H745L900 440L1000 475V535H185Z" fill="${sample.color}"/><path d="M355 436L452 343H575V436Z M600 343H732L846 436H600Z" fill="#c1dce8"/>
    <rect x="560" y="490" width="100" height="30" rx="4" fill="${commercial ? "#f5cc42" : "#fff"}"/>
    <circle cx="355" cy="535" r="68" fill="#202b38"/><circle cx="355" cy="535" r="33" fill="#a9b6c2"/>
    <circle cx="850" cy="535" r="68" fill="#202b38"/><circle cx="850" cy="535" r="33" fill="#a9b6c2"/>
    <text x="600" y="685" text-anchor="middle" font-family="sans-serif" font-size="29" fill="#244d70">Generic illustration ${index + 1} — not a model photograph</text>
    <text x="600" y="735" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#244d70">Fictional price and specifications for local testing</text>
  </svg>`);
}
async function writePhoto(storage, sample, index, createdFiles) {
  const key = crypto.randomUUID() + ".webp";
  const full = path.join(storage, key),
    thumb = path.join(storage, key.replace(".webp", ".thumb.webp"));
  createdFiles.push(full, thumb);
  const source = illustration(sample, index);
  await fs.writeFile(
    full,
    await sharp(source).webp({ quality: 85 }).toBuffer(),
    { mode: 0o600, flag: "wx" },
  );
  await fs.writeFile(
    thumb,
    await sharp(source).resize(600, 400).webp({ quality: 80 }).toBuffer(),
    { mode: 0o600, flag: "wx" },
  );
  return key;
}
async function manageSamples(
  connection,
  { action, storage, production = false },
) {
  if (production)
    fail(403, "Sample imports and archival are disabled in production");
  if (!["add", "archive"].includes(action))
    throw new Error("Choose add or archive");
  const execute = async (sql, values = []) =>
    (await connection.execute(sql, values))[0];
  const [database] = await execute("SELECT DATABASE() AS database_name");
  if (!database?.database_name) throw new Error("No database selected");
  const lockName =
    "nw_samples_" +
    crypto
      .createHash("sha256")
      .update(database.database_name)
      .digest("hex")
      .slice(0, 40);
  const [lock] = await execute("SELECT GET_LOCK(?,10) AS acquired", [lockName]);
  if (!lock.acquired) throw new Error("Another sample import is running");
  const createdFiles = [];
  let committed = false;
  let commitAttempted = false;
  try {
    await connection.beginTransaction();
    const result = {
      database: database.database_name,
      added: [],
      existing: [],
      archived: [],
    };
    const batch =
      action === "archive"
        ? [
            ...samples,
            ...["ace", "bolero"].map((key) => ({
              vehicle: { sample_key: prefix + key },
            })),
          ]
        : samples;
    for (const sample of batch) {
      const [existing] = await execute(
        "SELECT id,status FROM nw_vehicles WHERE JSON_UNQUOTE(JSON_EXTRACT(data,'$.sample_key'))=? AND JSON_UNQUOTE(JSON_EXTRACT(data,'$.is_sample'))='true' FOR UPDATE",
        [sample.vehicle.sample_key],
      );
      if (action === "archive") {
        if (existing && existing.status !== "archived") {
          await execute("UPDATE nw_vehicles SET status='archived' WHERE id=?", [
            existing.id,
          ]);
          await audit(
            null,
            "development.sample_archive",
            "vehicle",
            existing.id,
            { sample_key: sample.vehicle.sample_key },
            connection,
          );
          await history(
            "vehicle",
            existing.id,
            "archived",
            null,
            "Test sample archived; existing records and files retained",
            connection,
          );
          result.archived.push(existing.id);
        }
        continue;
      }
      if (existing) {
        result.existing.push(existing.id);
        continue;
      }
      await fs.mkdir(storage, { recursive: true, mode: 0o700 });
      const id = await saveVehicle(sample.vehicle, connection);
      for (let index = 0; index < 2; index++) {
        const key = await writePhoto(storage, sample, index, createdFiles);
        await execute(
          "INSERT INTO nw_images(vehicle_id,storage_key,alt_text,sort_order) VALUES (?,?,?,?)",
          [
            id,
            key,
            `${sample.vehicle.make} ${sample.vehicle.model}: sample illustration, not a real vehicle photograph`,
            index,
          ],
        );
      }
      await execute(
        "UPDATE nw_vehicles SET approved=TRUE,status=? WHERE id=?",
        [sample.status, id],
      );
      await history(
        "vehicle",
        id,
        sample.status,
        null,
        "Sample published explicitly for local website testing; not real stock",
        connection,
      );
      await audit(
        null,
        "development.sample_publish",
        "vehicle",
        id,
        { sample_key: sample.vehicle.sample_key },
        connection,
      );
      result.added.push({
        id,
        make: sample.vehicle.make,
        model: sample.vehicle.model,
        type: sample.vehicle.type,
        status: sample.status,
      });
    }
    commitAttempted = true;
    await connection.commit();
    committed = true;
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (!commitAttempted) {
      await Promise.all(
        createdFiles.map((file) => fs.rm(file, { force: true })),
      );
    } else if (createdFiles.length) {
      // A lost commit acknowledgement does not prove that rows were rolled back.
      // Keep media intact so a committed listing cannot acquire broken references.
      console.error(
        JSON.stringify({
          event: "sample_commit_outcome_unknown",
          message:
            "Generated files retained. Inspect the sample batch or rerun the idempotent importer before cleanup.",
        }),
      );
    }
    throw error;
  } finally {
    await execute("SELECT RELEASE_LOCK(?)", [lockName]).catch((error) => {
      if (!committed) return;
      console.error(
        JSON.stringify({
          event: "sample_lock_release_failed",
          code: error.code,
        }),
      );
    });
  }
}
module.exports = { samples, illustration, manageSamples };
