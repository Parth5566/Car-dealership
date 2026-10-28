import { AdminInventoryEditor } from "@/components/admin-inventory";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <AdminInventoryEditor id={(await params).id} />;
}
