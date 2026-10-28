import type { Metadata } from "next";
import { absoluteUrl } from "./site";
import { breadcrumbs, shareImage, collectionMetadata } from "./seo";
import { articleStats, type ArticleBody } from "./blog-document";

export const blogCategories = {
  buying: "Buying advice",
  selling: "Selling advice",
  "car-care": "Car care",
  commercial: "Commercial cabs",
  updates: "News & updates",
} as const;
export type BlogBlock = {
  type:
    "paragraph" | "heading" | "subheading" | "bullets" | "numbered" | "quote";
  text: string;
};
export type BlogPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  category: keyof typeof blogCategories;
  author_name: string;
  body: ArticleBody;
  seo_title: string;
  seo_description: string;
  seo_keywords?: string;
  cover_alt: string;
  cover: { id: number; url: string } | null;
  cover_id?: number | null;
  published_at: string | null;
  updated_at: string | null;
  reading_minutes: number;
  word_count?: number;
  reading_wpm?: number;
  is_scheduled?: boolean;
  scheduled_at?: string | null;
  status?: "draft" | "published" | "archived";
  version?: number;
};
export type BlogPage = {
  items: BlogPost[];
  total: number;
  page: number;
  pages: number;
};
export function blogIndexMetadata(
  params: Record<string, string | string[] | undefined>,
): Metadata {
  return collectionMetadata("/blog", params);
}
export function blogDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date(value))
    : "Not published yet";
}
export function blogMetadata(post: BlogPost): Metadata {
  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt;
  const url = absoluteUrl(`/blog/${post.slug}`);
  const images = post.cover
    ? [{ url: absoluteUrl(post.cover.url), alt: post.cover_alt }]
    : [shareImage];
  const keywords = (post.seo_keywords || "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  return {
    title,
    description,
    authors: [
      {
        name: post.author_name,
        ...(post.author_name === "NCR Wheelz"
          ? { url: absoluteUrl("/about") }
          : {}),
      },
    ],
    creator: post.author_name,
    publisher: "NCR Wheelz",
    category: blogCategories[post.category],
    robots: {
      index: true,
      follow: true,
      googleBot: { "max-image-preview": "large" },
    },
    ...(keywords.length ? { keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "article",
      url,
      siteName: "NCR Wheelz",
      locale: "en_IN",
      authors: [post.author_name],
      section: blogCategories[post.category],
      ...(keywords.length ? { tags: keywords } : {}),
      images,
      ...(post.published_at ? { publishedTime: post.published_at } : {}),
      ...(post.updated_at ? { modifiedTime: post.updated_at } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}
export function blogSchema(post: BlogPost) {
  const url = absoluteUrl(`/blog/${post.slug}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": url + "#article",
        mainEntityOfPage: url,
        url,
        headline: post.title,
        description: post.excerpt,
        inLanguage: "en-IN",
        isPartOf: { "@id": absoluteUrl("/blog#webpage") },
        articleSection: blogCategories[post.category],
        wordCount: articleStats(post.body).words,
        timeRequired: `PT${post.reading_minutes}M`,
        author:
          post.author_name === "NCR Wheelz"
            ? {
                "@type": "Organization",
                name: post.author_name,
                url: absoluteUrl("/about"),
                "@id": absoluteUrl("/#business"),
              }
            : { "@type": "Person", name: post.author_name },
        publisher: { "@id": absoluteUrl("/#business") },
        ...(post.published_at ? { datePublished: post.published_at } : {}),
        ...(post.updated_at ? { dateModified: post.updated_at } : {}),
        // Article images must depict this article, not a generic brand logo.
        ...(post.cover ? { image: [absoluteUrl(post.cover.url)] } : {}),
      },
      breadcrumbs([
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
        { name: post.title, path: `/blog/${post.slug}` },
      ]),
    ],
  };
}
