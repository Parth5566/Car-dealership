import { fileURLToPath } from "node:url";
const api = process.env.API_URL || "http://127.0.0.1:5001";
export default {
  poweredByHeader: false,
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  // Development only: webpack's persistent cache kept serving an outdated
  // compiled app/globals.css after edits, even across restarts. An in-memory
  // cache still rebuilds incrementally but starts fresh on every launch.
  webpack(config, { dev }) {
    if (dev) config.cache = { type: "memory" };
    return config;
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
