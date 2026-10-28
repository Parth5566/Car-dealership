"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Menu,
  UserRound,
  Heart,
  MessageCircle,
  CarFront,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Users,
  FileText,
  ChartNoAxesCombined,
  ShieldCheck,
  BadgePercent,
  BookOpen,
} from "lucide-react";
import { useAuth } from "./providers";
export function AccountNav({ admin = false }: { admin?: boolean }) {
  const path = usePathname(),
    { user } = useAuth();
  const customer = [
    ["/account", "My profile", UserRound],
    ["/saved", "Saved vehicles", Heart],
    ["/account/activity", "Enquiries & test drives", MessageCircle],
    ["/account/submissions", "My listed vehicles", ClipboardList],
    ["/sell", "Sell a vehicle", CarFront],
  ];
  const staff = [
    ["/admin", "Overview", LayoutDashboard, ""],
    ["/admin/inventory", "Inventory", CarFront, "inventory"],
    ["/admin/inventory-reviews", "Inventory approvals", ShieldCheck, "reviews"],
    ["/admin/publishing", "Ready to publish", CarFront, "inventory"],
    ["/admin/submissions", "Seller reviews", ClipboardList, "reviews"],
    ["/admin/leads", "Leads", MessageCircle, "leads"],
    ["/admin/test-drives", "Test drives", CarFront, "leads"],
    ["/admin/customers", "Customers", Users, "customers"],
    ["/admin/reports", "Reports", ChartNoAxesCombined, "reports"],
    ["/admin/settings", "Content & settings", Settings, "settings"],
    ["/admin/offers", "Discounts & offers", BadgePercent, "settings"],
    ["/admin/blog", "Blog posts", BookOpen, "settings"],
    ["/admin/users", "Staff & permissions", ShieldCheck, "users"],
    ["/admin/audit", "Audit log", FileText, "audit"],
  ];
  // Phones fold the 14 admin sections behind one button (see mobile.css);
  // wider screens show the full list and ignore the toggle.
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const isActive = (href: string) =>
    href === "/admin" || href === "/account"
      ? path === href
      : path === href || path.startsWith(href + "/");
  const items = (admin ? staff : customer).filter(
    (item: any) => !admin || !item[3] || user?.permissions.includes(item[3]),
  );
  const current = items.find(([href]: any) => isActive(href));
  return (
    <aside
      className={`side-nav${admin ? " admin-nav" : ""}`}
      aria-label={admin ? "Administration navigation" : "Account navigation"}
      data-open={open}
    >
      {admin && (
        <button
          type="button"
          className="side-nav-toggle"
          aria-expanded={open}
          aria-controls="admin-sections"
          onClick={() => setOpen((value) => !value)}
        >
          <Menu size={18} aria-hidden="true" />
          <span>Admin sections</span>
          <strong>{current ? String(current[1]) : "Overview"}</strong>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      )}
      <div className="side-nav-links" id={admin ? "admin-sections" : undefined}>
        {items.map(([href, title, Icon]: any) => (
          <Link
            key={href}
            href={href}
            className={isActive(href) ? "active" : ""}
          >
            <Icon size={17} />
            {title}
          </Link>
        ))}
      </div>
    </aside>
  );
}
