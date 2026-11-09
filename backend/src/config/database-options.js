const fs = require("node:fs");
const net = require("node:net");
const tls = require("node:tls");

function databaseOptions(source = process.env) {
  const host = (source.DB_HOST || "127.0.0.1").trim();
  if (
    !net.isIP(host) &&
    !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)
  )
    throw new Error(
      "DB_HOST must be a hostname or IP address, without a URL scheme, path or port.",
    );
  const port = Number((source.DB_PORT || "3306").trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("DB_PORT must be a valid port number.");
  const sslEnabled = (source.DB_SSL || "false").trim().toLowerCase();
  if (!["true", "false"].includes(sslEnabled))
    throw new Error("Set DB_SSL to true or false.");
  const inlineCA = (source.DB_SSL_CA || "").trim();
  const caFile = (source.DB_SSL_CA_FILE || "").trim();
  if (inlineCA && caFile)
    throw new Error("Use either DB_SSL_CA or DB_SSL_CA_FILE, not both.");
  if (sslEnabled === "false" && (inlineCA || caFile))
    throw new Error(
      "Set DB_SSL=true when configuring a database CA certificate.",
    );
  let ssl;
  if (sslEnabled === "true") {
    let ca = inlineCA.replace(/\\n/g, "\n");
    if (caFile) {
      try {
        ca = fs.readFileSync(caFile, "utf8");
      } catch {
        throw new Error(
          "Cannot read DB_SSL_CA_FILE. Check the certificate file path and permissions.",
        );
      }
    }
    ssl = {
      rejectUnauthorized: true,
      verifyIdentity: true,
      minVersion: "TLSv1.2",
      ...(ca ? { ca } : {}),
    };
    if (ca) {
      try {
        if (!ca.includes("-----BEGIN CERTIFICATE-----")) throw new Error();
        tls.createSecureContext(ssl);
      } catch {
        throw new Error(
          "The database CA certificate is invalid. Use the full PEM certificate supplied by your database provider.",
        );
      }
    }
  }
  return {
    host,
    port,
    user: source.DB_USER?.trim(),
    password: source.DB_PASSWORD,
    database: source.DB_NAME?.trim(),
    ...(ssl ? { ssl } : {}),
    connectionLimit: 10,
    waitForConnections: true,
    charset: "utf8mb4",
    timezone: "Z",
    decimalNumbers: true,
    dateStrings: true,
    multipleStatements: false,
  };
}

module.exports = { databaseOptions };
