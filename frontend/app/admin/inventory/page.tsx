import { Suspense } from "react";
import { AdminInventoryList } from "@/components/admin-inventory";
export default function Page() {
  return (
    <Suspense>
      <AdminInventoryList />
    </Suspense>
  );
}
