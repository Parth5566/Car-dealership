"use client";
import { useEffect, useState } from "react";

export function CookiePreferences() {
  const [choice, setChoice] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    try {
      setChoice(localStorage.getItem("nw_cookie_preferences"));
    } catch {
      setError(true);
    }
  }, []);
  function save(value: string) {
    try {
      localStorage.setItem("nw_cookie_preferences", value);
      // Reload stops any already-loaded analytics script when consent is withdrawn.
      window.location.reload();
    } catch {
      setError(true);
    }
  }
  return (
    <div className="panel">
      <h2>Your preferences</h2>
      <p className="subtle">
        Essential storage supports sign-in and security. Optional Google
        Analytics helps us understand visits. You can change your choice at any
        time.
      </p>
      <p>
        Current choice:{" "}
        {choice === "analytics"
          ? "Analytics allowed"
          : choice === "essential-only"
            ? "Essential only"
            : "No choice saved"}
        .
      </p>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 }}
      >
        <button className="btn primary" onClick={() => save("analytics")}>
          Allow analytics
        </button>
        <button className="btn" onClick={() => save("essential-only")}>
          Keep essential storage only
        </button>
      </div>
      {error && (
        <p role="alert" className="notice error">
          Browser storage is unavailable, so your preference could not be saved.
          Analytics remains disabled unless a previous choice was saved.
        </p>
      )}
    </div>
  );
}
