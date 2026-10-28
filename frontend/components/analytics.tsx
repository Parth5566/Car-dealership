"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const measurementId = "G-992285CP03";
const preferenceKey = "nw_cookie_preferences";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

export function Analytics() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setChoice(localStorage.getItem(preferenceKey));
    } catch {
      setChoice("essential-only");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    function syncPreference(event: StorageEvent) {
      if (event.key === preferenceKey) window.location.reload();
    }
    window.addEventListener("storage", syncPreference);
    return () => window.removeEventListener("storage", syncPreference);
  }, []);

  useEffect(() => {
    if (choice !== "analytics") return;
    const win = window as AnalyticsWindow;
    if (!win.gtag) {
      win.dataLayer = win.dataLayer || [];
      win.gtag = function () {
        win.dataLayer!.push(arguments);
      };
      win.gtag("js", new Date());
      win.gtag("config", measurementId, { send_page_view: false });
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);
    }
    // Do not include query strings, which can contain personal details.
    // Exclude staff and account pages from the explicit page-view events.
    if (
      pathname &&
      !/^\/(admin|account|session|reset-password)(\/|$)/.test(pathname)
    ) {
      win.gtag("event", "page_view", {
        page_path: pathname,
        page_location: window.location.origin + pathname,
      });
    }
  }, [choice, pathname]);

  function choose(value: string) {
    try {
      localStorage.setItem(preferenceKey, value);
      setChoice(value);
    } catch {
      setChoice("essential-only");
    }
  }

  if (!ready || choice) return null;
  return (
    <aside
      aria-label="Cookie choices"
      style={{
        position: "fixed",
        zIndex: 1000,
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 620,
        margin: "auto",
        background: "white",
        padding: 20,
        borderRadius: 12,
        boxShadow: "0 4px 24px #0003",
      }}
    >
      <p>
        We use essential storage for the website. With your permission, Google
        Analytics helps us understand visits.{" "}
        <Link href="/policies/cookies">Cookie preferences</Link>
      </p>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}
      >
        <button className="btn primary" onClick={() => choose("analytics")}>
          Allow analytics
        </button>
        <button className="btn" onClick={() => choose("essential-only")}>
          Essential only
        </button>
      </div>
    </aside>
  );
}
