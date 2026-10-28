import { jsonLd, pageSchema, type PublicPath } from "@/lib/seo";

export function StructuredData({ data }: { data: unknown }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
    />
  );
}

export function PageSchema({ path }: { path: PublicPath }) {
  return <StructuredData data={pageSchema(path)} />;
}
