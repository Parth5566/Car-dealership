const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { HttpError } = require("./core");

const unavailable = () =>
  new HttpError(
    503,
    "Market data is temporarily unavailable. Please try again shortly.",
    "MARKET_UNAVAILABLE",
  );
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

// Credentials and provider responses stay on the API server. Persist only the
// decoded, allowlisted catalog/listing data supplied by each caller.
function createScrappaClient({
  apiKey,
  directory,
  fetchImpl = fetch,
  now = Date.now,
  dailyLimit = 15,
  monthlyLimit = 450,
}) {
  if (
    ![dailyLimit, monthlyLimit].every(
      (limit) => Number.isSafeInteger(limit) && limit > 0,
    )
  )
    throw new Error("Scrappa request limits must be positive whole numbers.");
  const root = path.join(directory, digest(apiKey || "disabled").slice(0, 16));
  const pending = new Map();
  let cooldownUntil = 0;
  async function write(file, value) {
    await fs.mkdir(root, { recursive: true });
    const temp = file + "." + crypto.randomUUID() + ".tmp";
    try {
      await fs.writeFile(temp, JSON.stringify(value), { mode: 0o600 });
      await fs.rename(temp, file);
    } finally {
      await fs.rm(temp, { force: true });
    }
  }
  async function reserve() {
    await fs.mkdir(root, { recursive: true });
    const lockPath = path.join(root, "usage.lock");
    let lock;
    for (let attempt = 0; attempt < 20 && !lock; attempt++) {
      try {
        lock = await fs.open(lockPath, "wx", 0o600);
      } catch (error) {
        if (error.code !== "EEXIST") throw unavailable();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    if (!lock) throw unavailable();
    try {
      const file = path.join(root, "usage.json");
      let usage = {};
      try {
        usage = JSON.parse(await fs.readFile(file, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw unavailable();
      }
      const day = new Date(now()).toISOString().slice(0, 10),
        month = day.slice(0, 7);
      if (usage.month !== month) usage = { month, monthCount: 0 };
      if (usage.day !== day) usage = { ...usage, day, dayCount: 0 };
      if (
        ![usage.dayCount, usage.monthCount].every(
          (value) => Number.isInteger(value) && value >= 0,
        )
      )
        throw unavailable();
      if (usage.dayCount >= dailyLimit || usage.monthCount >= monthlyLimit)
        throw new HttpError(
          503,
          "Market checks have reached the site's request allowance. Please request a price review.",
          "MARKET_BUDGET",
        );
      // Count attempts conservatively, including requests with uncertain outcomes.
      usage.dayCount++;
      usage.monthCount++;
      await write(file, usage);
    } finally {
      await lock.close();
      await fs.rm(lockPath, { force: true });
    }
  }
  async function get(endpoint, params, ttl, decode) {
    if (!apiKey)
      throw new HttpError(
        503,
        "Market pricing is not configured.",
        "MARKET_NOT_CONFIGURED",
      );
    if (
      !/^\/api\/cardekho\/v1\/(used-cars(?:\/filters)?|models|new-cars)$/.test(
        endpoint,
      )
    )
      throw unavailable();
    const query = new URLSearchParams(
      Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
    );
    const key = digest("v1|" + endpoint + "?" + query);
    if (pending.has(key)) return pending.get(key);
    const work = (async () => {
      const file = path.join(root, key + ".json");
      try {
        const entry = JSON.parse(await fs.readFile(file, "utf8"));
        if (
          entry.expires > now() &&
          entry.collected_at <= now() &&
          entry.checksum === digest(JSON.stringify(entry.data))
        )
          return entry;
      } catch {
        /* A missing or invalid cache entry is fetched within the budget. */
      }
      if (now() < cooldownUntil) throw unavailable();
      await reserve();
      try {
        const response = await fetchImpl(
          "https://scrappa.co" + endpoint + "?" + query,
          {
            headers: { "x-api-key": apiKey, Accept: "application/json" },
            redirect: "error",
            signal: AbortSignal.timeout(9000),
          },
        );
        if ([401, 403].includes(response.status))
          throw new HttpError(
            503,
            "The market data service needs its API key or account checked.",
            "MARKET_AUTH",
          );
        if (response.status === 429)
          throw new HttpError(
            503,
            "The market data allowance is temporarily exhausted. Please request a price review.",
            "MARKET_QUOTA",
          );
        if (!response.ok) throw unavailable();
        const raw = await response.text();
        if (raw.length > 2000000) throw unavailable();
        const body = JSON.parse(raw);
        if (
          body?.success !== true ||
          !body.data ||
          typeof body.data !== "object"
        )
          throw unavailable();
        const data = decode(body.data);
        const collected = now();
        const entry = {
          collected_at: collected,
          expires: collected + ttl,
          data,
          checksum: digest(JSON.stringify(data)),
        };
        await write(file, entry);
        return entry;
      } catch (error) {
        cooldownUntil = now() + 60000;
        // Never relay a provider error body (which could echo a credential).
        throw error instanceof HttpError ? error : unavailable();
      }
    })();
    pending.set(key, work);
    try {
      return await work;
    } finally {
      pending.delete(key);
    }
  }
  return { get };
}
module.exports = { createScrappaClient, unavailable };
