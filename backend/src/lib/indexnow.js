const env = require("../config/env");
const { query } = require("../config/db");
const { parse } = require("./store");
// IndexNow tells Bing, Yandex, Naver, Seznam and other participants that a URL
// was added, changed or removed. Google ignores it and reads /sitemap.xml.
const listingUrl = (row) => `${env.siteUrl}/vehicles/${row.id}/${row.slug}`;
async function submit(urls, settings = env.indexNow) {
  if (!settings.enabled || !urls.length) return false;
  const res = await fetch(settings.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(env.siteUrl).host,
      key: settings.key,
      keyLocation: `${env.siteUrl}/indexnow-key.txt`,
      urlList: urls,
    }),
    signal: AbortSignal.timeout(5000),
  });
  // 200 = accepted, 202 = accepted while the key file is being verified.
  if (!res.ok)
    throw Object.assign(new Error("IndexNow rejected the submission"), {
      code: `INDEXNOW_${res.status}`,
    });
  return true;
}
// Called after a listing's public visibility changes. Never throws or delays the
// staff action: the sitemap remains the source of truth if a notification fails.
async function notifyListing(vehicleId, settings = env.indexNow) {
  if (!settings.enabled) return false;
  try {
    const [row] = await query(
      "SELECT id,slug,data FROM nw_vehicles WHERE id=?",
      [vehicleId],
    );
    if (!row || parse(row).data?.is_sample) return false;
    return await submit([listingUrl(row)], settings);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "indexnow_failed",
        vehicle_id: vehicleId,
        code: error.code || error.name,
      }),
    );
    return false;
  }
}
module.exports = { listingUrl, submit, notifyListing };
