const path = require("node:path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});
const production = process.env.NODE_ENV === "production";
const secret = process.env.JWT_SECRET || "";
if (secret.length < 48)
  throw new Error("JWT_SECRET must contain at least 48 random characters.");
const site = new URL(process.env.SITE_URL || "https://ncrwheelz.com");
if (!["https:", "http:"].includes(site.protocol))
  throw new Error("SITE_URL must be an HTTP(S) origin");
const indexNowKey = (process.env.INDEXNOW_KEY || "").trim();
if (indexNowKey && !/^[a-zA-Z0-9-]{8,128}$/.test(indexNowKey))
  throw new Error(
    "INDEXNOW_KEY must contain 8 to 128 letters, numbers or hyphens.",
  );
module.exports = {
  email: require("../lib/email-config").emailConfig(),
  production,
  secret,
  port: Number(process.env.PORT || 5001),
  origin: process.env.APP_ORIGIN || "http://localhost:3000",
  storage: path.resolve(
    __dirname,
    "../..",
    process.env.STORAGE_DIR || "./storage",
  ),
  secure: production || process.env.COOKIE_SECURE === "true",
  // Canonical public origin; must match the frontend's NEXT_PUBLIC_SITE_URL.
  siteUrl: site.origin,
  indexNow: {
    key: indexNowKey,
    // Search engines only accept URLs on a live host serving the key file.
    enabled: production && Boolean(indexNowKey),
    endpoint:
      process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow",
  },
  scrappa: {
    key: (process.env.SCRAPPA_API_KEY || "").trim(),
    enabled: process.env.SCRAPPA_ENABLED !== "false",
    dailyLimit: Number(process.env.SCRAPPA_DAILY_LIMIT || 15),
    monthlyLimit: Number(process.env.SCRAPPA_MONTHLY_LIMIT || 450),
  },
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10,
    waitForConnections: true,
    charset: "utf8mb4",
    timezone: "Z",
    decimalNumbers: true,
    dateStrings: true,
    multipleStatements: false,
  },
};
