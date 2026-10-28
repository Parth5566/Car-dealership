const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = rateLimit;
const env = require("../config/env");
const { query, transaction } = require("../config/db");
const {
  z,
  wrap,
  fail,
  hash,
  token,
  text,
  email,
  phone,
  password,
} = require("../lib/core");
const { authenticate, userView } = require("../middleware/auth");
const { audit } = require("../lib/store");
const { sendResetEmail } = require("../lib/reset-email");
// RESET_DELIVERY=email sends reset links through the site's Gmail/SMTP
// settings; "webhook" keeps the earlier external adapter.
function resetDelivery() {
  const mode = process.env.RESET_DELIVERY;
  if (mode === "email" && env.email.enabled && env.email.pass) return "email";
  if (
    mode === "webhook" &&
    process.env.RESET_WEBHOOK_URL &&
    process.env.RESET_WEBHOOK_TOKEN
  )
    return "webhook";
  return null;
}
const router = express.Router();
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip)}:${hash(typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "unknown")}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMIT",
      message: "Too many attempts. Please try again later.",
    },
  },
});
const refreshLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  skip: (req) => !req.cookies.nw_refresh,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMIT",
      message: "Too many session requests. Please try again later.",
    },
  },
});
const cookieOptions = { httpOnly: true, secure: env.secure, sameSite: "lax" };
function clear(res) {
  res.clearCookie("nw_access", { ...cookieOptions, path: "/" });
  res.clearCookie("nw_refresh", { ...cookieOptions, path: "/" });
}
async function issue(user, db, family = crypto.randomUUID()) {
  const raw = token(),
    sid = crypto.randomUUID();
  await query(
    "INSERT INTO nw_sessions(id,user_id,family,token_hash,expires_at) VALUES (?,?,?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 14 DAY))",
    [sid, user.id, family, hash(raw)],
    db,
  );
  const access = jwt.sign({ sid, ver: user.token_version }, env.secret, {
    subject: String(user.id),
    expiresIn: "15m",
    issuer: "ncr-wheelz",
    audience: "ncr-wheelz-web",
    algorithm: "HS256",
  });
  return { access, refresh: raw };
}
function setSessionCookies(res, session) {
  res.cookie("nw_access", session.access, {
    ...cookieOptions,
    path: "/",
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("nw_refresh", session.refresh, {
    ...cookieOptions,
    path: "/",
    maxAge: 14 * 86400000,
  });
}
router.post(
  "/register",
  limit,
  wrap(async (req, res) => {
    const data = z
      .object({
        name: text(100),
        email,
        phone,
        password,
        consent: z.literal(true),
      })
      .parse(req.body);
    const digest = await bcrypt.hash(data.password, 12);
    const { user, session } = await transaction(async (db) => {
      try {
        const r = await query(
          "INSERT INTO nw_users(name,email,phone,password_hash,consent_at) VALUES (?,?,?,?,UTC_TIMESTAMP())",
          [data.name, data.email, data.phone, digest],
          db,
        );
        const [u] = await query(
          "SELECT * FROM nw_users WHERE id=?",
          [r.insertId],
          db,
        );
        await audit(u.id, "auth.register", "user", u.id, {}, db);
        const session = await issue(u, db);
        return { user: u, session };
      } catch (e) {
        if (e.code === "ER_DUP_ENTRY")
          fail(
            409,
            "An account already exists. Sign in or reset your password.",
          );
        throw e;
      }
    });
    setSessionCookies(res, session);
    res.status(201).json({ user: userView(user) });
  }),
);
router.post(
  "/login",
  limit,
  wrap(async (req, res) => {
    const data = z
      .object({
        email,
        password: z.string().max(200),
        scope: z.enum(["customer", "admin"]).default("customer"),
      })
      .parse(req.body);
    const [u] = await query("SELECT * FROM nw_users WHERE email=?", [
      data.email,
    ]);
    const valid = await bcrypt.compare(
      data.password,
      u?.password_hash ||
        "$2b$12$5NADuRY0yugI1Bqkv04uL.4Jh98rrdOpBIviOePFHBu3KqEX2CoCy",
    );
    if (!u || !u.active || !valid) fail(401, "Email or password is incorrect");
    if (data.scope === "admin" && u.role === "customer")
      fail(403, "This account does not have staff access");
    const session = await transaction(async (db) => {
      const session = await issue(u, db);
      await audit(u.id, "auth.login", "user", u.id, {}, db);
      return session;
    });
    setSessionCookies(res, session);
    res.json({ user: userView(u) });
  }),
);
router.post(
  "/refresh",
  refreshLimit,
  wrap(async (req, res) => {
    const raw = req.cookies.nw_refresh;
    if (!raw) fail(401, "Please sign in");
    const result = await transaction(async (db) => {
      const [s] = await query(
        "SELECT *,expires_at>UTC_TIMESTAMP() AS valid FROM nw_sessions WHERE token_hash=? FOR UPDATE",
        [hash(raw)],
        db,
      );
      if (!s) return false;
      if (s.revoked_at) {
        await query(
          "UPDATE nw_sessions SET revoked_at=UTC_TIMESTAMP() WHERE family=? AND revoked_at IS NULL",
          [s.family],
          db,
        );
        return false;
      }
      const [u] = await query(
        "SELECT * FROM nw_users WHERE id=?",
        [s.user_id],
        db,
      );
      if (!s.valid || !u?.active) return false;
      await query(
        "UPDATE nw_sessions SET revoked_at=UTC_TIMESTAMP() WHERE id=?",
        [s.id],
        db,
      );
      return issue(u, db, s.family);
    });
    if (!result) {
      clear(res);
      fail(401, "Your session expired. Please sign in.");
    }
    setSessionCookies(res, result);
    res.json({ ok: true });
  }),
);
router.post(
  "/logout",
  wrap(async (req, res) => {
    if (req.cookies.nw_refresh) {
      await query(
        "UPDATE nw_sessions SET revoked_at=UTC_TIMESTAMP() WHERE family IN (SELECT family FROM (SELECT family FROM nw_sessions WHERE token_hash=?) AS own_session)",
        [hash(req.cookies.nw_refresh)],
      );
    }
    clear(res);
    res.json({ ok: true });
  }),
);
router.get("/me", authenticate, (req, res) =>
  res.json({ user: userView(req.user) }),
);
router.patch(
  "/profile",
  authenticate,
  wrap(async (req, res) => {
    const d = z.object({ name: text(100), phone }).parse(req.body);
    await query("UPDATE nw_users SET name=?,phone=? WHERE id=?", [
      d.name,
      d.phone,
      req.user.id,
    ]);
    res.json({ user: userView({ ...req.user, ...d }) });
  }),
);
async function createReset(user, db) {
  const raw = token();
  await query(
    "UPDATE nw_resets SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL",
    [user.id],
    db,
  );
  await query(
    "INSERT INTO nw_resets(user_id,token_hash,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 MINUTE))",
    [user.id, hash(raw)],
    db,
  );
  return `${env.origin}/reset-password?token=${raw}`;
}
router.post(
  "/forgot-password",
  limit,
  wrap(async (req, res) => {
    const data = z.object({ email }).parse(req.body);
    const delivery = resetDelivery();
    if (!delivery)
      fail(
        503,
        "Email delivery is not configured. Contact the site operator for account recovery.",
        "DELIVERY_UNAVAILABLE",
      );
    const [u] = await query(
      "SELECT * FROM nw_users WHERE email=? AND active=TRUE",
      [data.email],
    );
    // Delivery runs after the same generic response path for known/unknown emails.
    // A production provider should replace this best-effort adapter with a durable queue.
    if (u)
      setImmediate(async () => {
        let link;
        try {
          link = await transaction((db) => createReset(u, db));
          if (delivery === "email") {
            await sendResetEmail(u, link);
            return;
          }
          const url = new URL(process.env.RESET_WEBHOOK_URL);
          if (url.protocol !== "https:") throw new Error("HTTPS required");
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${process.env.RESET_WEBHOOK_TOKEN}`,
            },
            body: JSON.stringify({
              event: "password_reset",
              email: u.email,
              reset_url: link,
            }),
            signal: AbortSignal.timeout(5000),
            redirect: "error",
          });
          if (!response.ok) throw new Error("Delivery failed");
        } catch {
          try {
            if (link)
              await query(
                "UPDATE nw_resets SET used_at=UTC_TIMESTAMP() WHERE token_hash=? AND used_at IS NULL",
                [hash(new URL(link).searchParams.get("token"))],
              );
            await audit(null, "auth.reset_delivery_failed", "user", u.id);
          } catch (error) {
            console.error(
              JSON.stringify({
                event: "reset_delivery_failed",
                code: error.code || error.name,
              }),
            );
          }
        }
      });
    res.status(202).json({
      message:
        "If an eligible account exists, a reset email will arrive shortly.",
    });
  }),
);
router.post(
  "/reset-password",
  limit,
  wrap(async (req, res) => {
    const data = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/), password })
      .parse(req.body);
    const digest = await bcrypt.hash(data.password, 12);
    await transaction(async (db) => {
      const [r] = await query(
        "SELECT *,expires_at>UTC_TIMESTAMP() AS valid FROM nw_resets WHERE token_hash=? FOR UPDATE",
        [hash(data.token)],
        db,
      );
      if (!r || r.used_at || !r.valid)
        fail(400, "This reset link is invalid or expired");
      const [user] = await query(
        "SELECT role,active FROM nw_users WHERE id=? FOR UPDATE",
        [r.user_id],
        db,
      );
      if (!user?.active) fail(400, "This reset link is invalid or expired");
      await query(
        "UPDATE nw_users SET password_hash=?,token_version=token_version+1 WHERE id=?",
        [digest, r.user_id],
        db,
      );
      await query(
        "UPDATE nw_resets SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL",
        [r.user_id],
        db,
      );
      await query(
        "UPDATE nw_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL",
        [r.user_id],
        db,
      );
      await audit(r.user_id, "auth.password_reset", "user", r.user_id, {}, db);
    });
    clear(res);
    res.json({ message: "Password updated. Please sign in." });
  }),
);
module.exports = { router, createReset };
