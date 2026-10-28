"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "./providers";
import { safeNext } from "./auth-form";

export function SessionRestore() {
  const { reload } = useAuth(),
    params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    // Recheck /auth/me so the API wrapper can refresh an expired access cookie.
    // Shared auth context may still contain the user from an earlier page.
    reload()
      .then((current) => {
        if (!active) return;
        // Request a fresh document with the rotated cookies. The client router
        // may still cache the protected route's redirect back to /session.
        window.location.replace(
          current
            ? next
            : (next.startsWith("/admin") ? "/admin/login" : "/login") +
                "?next=" +
                encodeURIComponent(next),
        );
      })
      .catch((error) => {
        if (active)
          setError(
            (error as Error).message ||
              "We couldn’t check your session. Please try again.",
          );
      });
    return () => {
      active = false;
    };
  }, [reload, next, attempt]);
  return (
    <div className="container section">
      {error ? (
        <div className="notice error" role="alert">
          <h1>Connection interrupted.</h1>
          <p>{error}</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="skeleton tall" aria-label="Restoring session" />
      )}
    </div>
  );
}
