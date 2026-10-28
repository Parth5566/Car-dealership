import { collectionMetadata } from "@/lib/seo";
import { Inventory } from "@/components/inventory";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  return collectionMetadata("/commercial", await searchParams);
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  return <Inventory type="commercial" params={await searchParams} />;
}
