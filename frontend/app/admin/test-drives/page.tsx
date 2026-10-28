import { Suspense } from "react";
import { AdminCollection } from "@/components/admin-collection";
export default function Page() {
  return (
    <Suspense>
      <AdminCollection kind="test-drives" />
    </Suspense>
  );
}
