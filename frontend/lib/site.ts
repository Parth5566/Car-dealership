// Override for isolated QA or a future domain move; never derive SEO URLs from Host.
const configured = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || "https://ncrwheelz.com",
);
if (!["https:", "http:"].includes(configured.protocol))
  throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin");
export const site = configured.origin;

export const absoluteUrl = (path: string) => new URL(path, site).href;
