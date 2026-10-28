"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, send } from "@/lib/api";
import { useAuth } from "./providers";
import { Field, Notice, SubmitButton } from "./ui";
import { Eye, EyeOff } from "lucide-react";
export const safeNext = (value: string | null, fallback = "/account") =>
  value &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !/[\\\u0000-\u0020]/.test(value)
    ? value
    : fallback;
export function AuthForm({
  mode,
  admin = false,
}: {
  mode: "login" | "signup" | "forgot" | "reset";
  admin?: boolean;
}) {
  const { reload } = useAuth(),
    router = useRouter(),
    params = useSearchParams();
  const [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const destination = safeNext(
    params.get("next"),
    admin ? "/admin" : "/account",
  );
  useEffect(() => {
    if (mode !== "login") return;
    let active = true;
    // A previously loaded user can outlive the access cookie during navigation.
    // Confirm the session before leaving sign-in to avoid a proxy redirect loop.
    reload()
      .then((current) => {
        if (active && current && (!admin || current.role !== "customer"))
          router.replace(destination);
      })
      .catch((error) => {
        if (active) setError((error as Error).message);
      });
    return () => {
      active = false;
    };
  }, [reload, mode, admin, destination, router]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    if (mode === "signup") d.consent = d.consent === "on";
    if (mode === "login") d.scope = admin ? "admin" : "customer";
    if (mode === "reset") d.token = params.get("token");
    try {
      const endpoint = {
        login: "login",
        signup: "register",
        forgot: "forgot-password",
        reset: "reset-password",
      }[mode];
      const r = await api("/auth/" + endpoint, send("POST", d));
      if (mode === "login" || mode === "signup") {
        await reload();
        router.replace(destination);
        router.refresh();
      } else setMessage(r.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const title = {
    login: admin ? "Staff sign in" : "Welcome back.",
    signup: "Your next chapter starts here.",
    forgot: "Let’s get you back in.",
    reset: "Choose a new password.",
  }[mode];
  return (
    <div className="auth-wrap">
      <span className="eyebrow">
        {admin ? "NCR WHEELZ · ADMINISTRATION" : "YOUR NCR WHEELZ ACCOUNT"}
      </span>
      <h1>{title}</h1>
      <p>
        {mode === "signup"
          ? "Save your favourites, track enquiries, and sell your vehicle."
          : mode === "forgot"
            ? "Request a secure password reset link."
            : mode === "reset"
              ? "Use at least 6 characters for a customer account, or 12 for a staff account."
              : "Sign in to pick up where you left off."}
      </p>
      <div className="panel">
        {message ? (
          <>
            <Notice message={message} />
            <Link className="btn primary" href="/login">
              Back to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            {mode === "signup" && (
              <Field label="Full name">
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </Field>
            )}
            {mode !== "reset" && (
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </Field>
            )}
            {mode === "signup" && (
              <Field label="Phone number">
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={20}
                />
              </Field>
            )}
            {mode !== "forgot" && (
              <Field
                label="Password"
                hint={mode === "signup" ? "At least 6 characters." : undefined}
              >
                <span className="password-input">
                  <input
                    name="password"
                    aria-label="Password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    minLength={mode === "login" ? undefined : 6}
                    maxLength={72}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </span>
              </Field>
            )}
            {mode === "signup" && (
              <label className="check-label">
                <input name="consent" type="checkbox" required />
                <span>
                  I accept the <Link href="/policies/terms">terms</Link>,{" "}
                  <Link href="/policies/buyer-agreement">buyer agreement</Link>,
                  and <Link href="/policies/privacy">privacy policy</Link>.
                </span>
              </label>
            )}
            {mode === "login" && (
              <p
                style={{
                  textAlign: "right",
                  fontSize: 16,
                  margin: "-4px 0 20px",
                }}
              >
                <Link href="/forgot-password">Forgot password?</Link>
              </p>
            )}
            {error && <Notice error message={error} />}
            <SubmitButton busy={busy}>
              {
                {
                  login: "Sign in",
                  signup: "Create account",
                  forgot: "Send reset link",
                  reset: "Update password",
                }[mode]
              }
            </SubmitButton>
          </form>
        )}
      </div>
      {mode === "login" && !admin && (
        <div className="auth-bottom">
          New here?{" "}
          <Link href={"/signup?next=" + encodeURIComponent(destination)}>
            Create an account
          </Link>
        </div>
      )}
      {mode === "signup" && (
        <div className="auth-bottom">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      )}
      {admin && (
        <p className="subtle">
          Staff accounts are created by an administrator. Customer registrations
          do not grant staff access.
        </p>
      )}
    </div>
  );
}
