const dns = require("node:dns/promises");
const net = require("node:net");

// Explicit allowlist: never log environment objects, credentials or error messages.
async function databaseDnsDiagnostic(
  options,
  log = console.info,
  lookup = dns.lookup,
) {
  const details = {
    event: "database_dns_diagnostic",
    host: options.host,
    port: options.port,
    database: options.database,
    tls: Boolean(options.ssl),
  };
  try {
    const addresses = await lookup(options.host, { all: true });
    log(
      JSON.stringify({
        ...details,
        status: "resolved",
        address_count: addresses.length,
      }),
    );
  } catch (error) {
    log(
      JSON.stringify({
        ...details,
        status: "failed",
        code: error.code || "DNS_ERROR",
      }),
    );
  }
}

function proxyDiagnostic(trust, log = console.info) {
  let reported = false;
  return (req, res, next) => {
    if (!reported && req.headers["x-forwarded-for"]) {
      reported = true;
      const peer = req.socket?.remoteAddress;
      log(
        JSON.stringify({
          event: "proxy_diagnostic",
          peer: net.isIP(peer || "") ? peer : "unknown",
          peer_trusted: Boolean(trust && peer && trust(peer, 0)),
          forwarded_entries: String(req.headers["x-forwarded-for"]).split(",")
            .length,
        }),
      );
    }
    next();
  };
}

module.exports = { databaseDnsDiagnostic, proxyDiagnostic };
