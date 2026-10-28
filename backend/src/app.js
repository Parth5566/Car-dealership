const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const crypto = require("node:crypto");
const { ZodError } = require("zod");
const env = require("./config/env");
const { query } = require("./config/db");
const { wrap } = require("./lib/core");
require("./lib/core").requirements("passenger");
const app = express();
const loopback = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
function internalRead(req) {
  return (
    ["GET", "HEAD"].includes(req.method) &&
    !req.headers["x-forwarded-for"] &&
    loopback.has(req.socket?.remoteAddress)
  );
}
app.disable("x-powered-by");
if (process.env.TRUST_PROXY) {
  if (/^(true|\d+)$/i.test(process.env.TRUST_PROXY.trim()))
    throw new Error(
      "TRUST_PROXY must list the trusted proxy IP addresses or CIDRs, not a hop count or true.",
    );
  app.set(
    "trust proxy",
    process.env.TRUST_PROXY.split(",").map((value) => value.trim()),
  );
}
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(cors({ origin: env.origin, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (req.headers["x-ncr-request"] !== "1")
      return res.status(403).json({
        error: { code: "CSRF", message: "Missing request protection header" },
      });
    if (req.headers.origin && req.headers.origin !== env.origin)
      return res
        .status(403)
        .json({ error: { code: "CSRF", message: "Origin is not allowed" } });
  }
  next();
});
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // The API listens on loopback only. Server-side page rendering reads it
    // directly (no X-Forwarded-For), while browser calls arrive through the
    // Next.js rewrite with the visitor's forwarded address. Counting those
    // internal reads made every page view share one 300/min allowance.
    // Writes and the dedicated auth/submission limiters are unaffected.
    skip: internalRead,
    message: { error: { code: "RATE_LIMIT", message: "Too many requests" } },
  }),
);
app.get(
  "/api/v1/health",
  wrap(async (req, res) => {
    await query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  }),
);
app.use("/api/v1/auth", require("./routes/auth").router);
app.use("/api/v1", require("./routes/public").router);
app.use("/api/v1", require("./routes/blog").publicRouter);
app.use("/api/v1", require("./routes/valuation").router);
app.use("/api/v1/account", require("./routes/account").router);
app.use("/api/v1/admin", require("./routes/admin").router);
app.use("/api/v1", require("./routes/media").router);
app.use((req, res) =>
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Endpoint not found" } }),
);
app.use((error, req, res, next) => {
  const status =
    error instanceof ZodError
      ? 422
      : error.status ||
        (error.code === "LIMIT_FILE_SIZE"
          ? 413
          : error.name === "MulterError"
            ? 400
            : 500);
  const message =
    error instanceof ZodError
      ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      : status < 500 || error.code === "DELIVERY_UNAVAILABLE"
        ? error.message
        : "The server could not complete this request. Please try again.";
  if (status >= 500)
    console.error(
      JSON.stringify({
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        code: error.code || error.name,
      }),
    );
  res.status(status).json({
    error: {
      code: status === 422 ? "VALIDATION_ERROR" : error.code || "REQUEST_ERROR",
      message,
      request_id: req.requestId,
    },
  });
});
module.exports = { app, internalRead };
