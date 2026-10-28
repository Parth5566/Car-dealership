const { hash } = require("./core");
const { parse } = require("./store");

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}

// Bind approval to the inspected specifications, immutable photo keys and order/text.
function inventoryVersion(vehicle, photos) {
  return hash(
    JSON.stringify(
      canonical({
        id: vehicle.id,
        status: vehicle.status,
        data: parse(vehicle).data,
        images: photos.map(({ id, storage_key, alt_text, sort_order }) => ({
          id,
          storage_key,
          alt_text,
          sort_order,
        })),
      }),
    ),
  );
}
function submissionVersion(submission) {
  return hash(
    JSON.stringify(
      canonical({
        id: submission.id,
        type: submission.type,
        status: submission.status,
        data: parse(submission).data,
      }),
    ),
  );
}
module.exports = { inventoryVersion, submissionVersion };
