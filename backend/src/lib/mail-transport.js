const env = require("../config/env");

function createMailTransport(config = env.email, factory) {
  if (!config.pass)
    throw Object.assign(new Error("Save SMTP_PASS in backend/.env"), {
      code: "EMAIL_NOT_CONFIGURED",
    });
  if (!factory) {
    try {
      factory = require("nodemailer").createTransport;
    } catch {
      throw Object.assign(
        new Error(
          "Install backend dependencies with npm --prefix backend install",
        ),
        { code: "EMAIL_DEPENDENCY_MISSING" },
      );
    }
  }
  return factory({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.pass },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    dnsTimeout: 5000,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
}
module.exports = { createMailTransport };
