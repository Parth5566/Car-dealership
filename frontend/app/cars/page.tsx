import { collectionMetadata } from "@/lib/seo";
import { Inventory } from "@/components/inventory";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  return collectionMetadata("/cars", await searchParams);
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  return <Inventory type="passenger" params={await searchParams} />;
}
