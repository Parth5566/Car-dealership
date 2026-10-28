"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "./providers";
import styles from "./admin-draft-notice.module.css";

export function AdminDraftNotice({ refreshKey }: { refreshKey: string }) {
  const { user } = useAuth();
  const canReview = !!user?.permissions.includes("reviews");
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setTotal(null);
    setFailed(false);
    if (!canReview) return;
    let active = true;
    let loading = false;
    async function refresh() {
      if (!active || loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const result = await api("/admin/seller-drafts");
        if (active) {
          setTotal(result.total);
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        loading = false;
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("seller-drafts-updated", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("seller-drafts-updated", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [canReview, user?.id, refreshKey, retry]);
  if (!canReview || (!total && !failed)) return null;
  return (
    <aside className={styles.banner} aria-label="Seller draft notifications">
      <BellRing size={23} aria-hidden="true" />
      <div className={styles.copy}>
        <p role="status">
          {total
            ? `${total} seller ${total === 1 ? "draft needs" : "drafts need"} a follow-up`
            : "Draft notifications are temporarily unavailable"}
        </p>
        <span>
          {failed
            ? "We couldn’t refresh the notifications."
            : "Vehicle details are saved. Contact these sellers to help complete their listings."}
        </span>
      </div>
      {failed && (
        <button
          className="text-button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry
        </button>
      )}
      <Link href="/admin/submissions?status=draft&follow_up=pending">
        View seller drafts <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </aside>
  );
}
