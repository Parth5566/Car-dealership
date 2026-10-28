"use client";
import { usePathname } from "next/navigation";
import { AuthGate, useAuth } from "./providers";
import { AccountNav } from "./account-nav";
import { AdminDraftNotice } from "./admin-draft-notice";
export function AdminFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    { user } = useAuth();
  if (path === "/admin/login") return <>{children}</>;
  return (
    <AuthGate>
      {user?.role === "customer" ? (
        <div className="container section">
          <div className="notice error">Staff access required.</div>
        </div>
      ) : (
        <div className="container section">
          <div className="account-layout">
            <AccountNav admin />
            <div>
              <AdminDraftNotice key={user?.id} refreshKey={path} />
              {children}
            </div>
          </div>
        </div>
      )}
    </AuthGate>
  );
}
