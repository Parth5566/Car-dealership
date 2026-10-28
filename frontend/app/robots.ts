import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/v1/media/", "/api/v1/blog-media/"],
      disallow: [
        "/account$",
        "/account/",
        "/admin$",
        "/admin/",
        "/saved$",
        "/sell$",
        "/test-drive$",
        "/session$",
        "/api/",
      ],
    },
    sitemap: site + "/sitemap.xml",
  };
}
