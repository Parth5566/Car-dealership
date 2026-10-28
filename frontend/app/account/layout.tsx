import { AuthGate } from "@/components/providers";
import { AccountNav } from "@/components/account-nav";
export const metadata = {
  title: "My account",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="container section">
        <div className="account-layout">
          <AccountNav />
          <div>{children}</div>
        </div>
      </div>
    </AuthGate>
  );
}
