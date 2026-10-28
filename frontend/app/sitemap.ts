import type { MetadataRoute } from "next";
import { serverApi, site } from "@/lib/server";
import { publicPages, sitemapDate } from "@/lib/seo";
// Generated on every request so published posts and live listings appear
// immediately and disappear when unpublished or archived.
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = Object.keys(publicPages);
  const [{ data }, { data: blog }] = await Promise.all([
    serverApi<{
      items: {
        id: number;
        slug: string;
        updated_at: string;
        images?: string[];
      }[];
    }>("/seo/listings"),
    serverApi<{
      items: { slug: string; updated_at: string; images?: string[] }[];
    }>("/seo/blog"),
  ]);
  if (!data || !blog)
    throw new Error("Cannot generate the sitemap while the API is unavailable");
  return [
    ...paths.map((p) => ({
      url: site + p,
      changeFrequency: "weekly" as const,
      priority: p === "/" ? 1 : 0.7,
    })),
    ...blog.items.map((post) => ({
      url: `${site}/blog/${post.slug}`,
      lastModified: sitemapDate(post.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.7,
      ...(post.images?.length
        ? { images: post.images.map((url) => new URL(url, site).href) }
        : {}),
    })),
    ...(data?.items || []).map((v) => ({
      url: `${site}/vehicles/${v.id}/${v.slug}`,
      lastModified: sitemapDate(v.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.8,
      ...(v.images?.length
        ? { images: v.images.map((url) => new URL(url, site).href) }
        : {}),
    })),
  ];
}
