"use client";
import { Suspense } from "react";
import { SessionRestore } from "@/components/session-restore";
export default function Page() {
  return (
    <Suspense>
      <SessionRestore />
    </Suspense>
  );
}
