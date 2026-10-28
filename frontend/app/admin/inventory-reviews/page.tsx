import { Suspense } from "react";
import { AuthGate } from "@/components/providers";
import { InventoryWorkQueue } from "@/components/inventory-work-queue";
export default function Page() {
  return (
    <AuthGate permission="reviews">
      <Suspense>
        <InventoryWorkQueue />
      </Suspense>
    </AuthGate>
  );
}
