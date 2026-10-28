const jwt = require("jsonwebtoken");
const { query } = require("../config/db");
const env = require("../config/env");
const { fail, wrap } = require("../lib/core");
const permissions = {
  admin: [
    "inventory",
    "reviews",
    "leads",
    "customers",
    "settings",
    "users",
    "audit",
    "reports",
  ],
  sales: ["inventory", "leads", "customers", "reports"],
  reviewer: ["reviews"],
};
const authenticate = wrap(async (req, res, next) => {
  const raw = req.cookies.nw_access;
  if (!raw)
    fail(
      401,
      "Please sign in",
      req.cookies.nw_refresh ? "SESSION_EXPIRED" : "AUTH_REQUIRED",
    );
  let data;
  try {
    data = jwt.verify(raw, env.secret, {
      algorithms: ["HS256"],
      issuer: "ncr-wheelz",
      audience: "ncr-wheelz-web",
    });
  } catch {
    fail(401, "Your session expired. Please sign in.", "SESSION_EXPIRED");
  }
  const rows = await query(
    "SELECT u.id,u.name,u.email,u.phone,u.role,u.active,u.token_version FROM nw_users u JOIN nw_sessions s ON s.user_id=u.id WHERE u.id=? AND s.id=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP()",
    [data.sub, data.sid],
  );
  if (!rows[0]?.active || rows[0].token_version !== data.ver)
    fail(401, "Your session is no longer valid", "SESSION_EXPIRED");
  req.user = rows[0];
  next();
});
const allow = (permission) => (req, res, next) => {
  if (!permissions[req.user.role]?.includes(permission))
    return next(
      Object.assign(new Error("You do not have permission for this action"), {
        status: 403,
      }),
    );
  next();
};
const optional = (req, res, next) =>
  req.cookies.nw_access || req.cookies.nw_refresh
    ? authenticate(req, res, next)
    : next();
const userView = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  permissions: permissions[u.role] || [],
});
module.exports = { authenticate, allow, optional, userView, permissions };
