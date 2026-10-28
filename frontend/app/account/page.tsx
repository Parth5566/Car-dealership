"use client";
import { useState } from "react";
import { useAuth } from "@/components/providers";
import { Field, SubmitButton, Notice } from "@/components/ui";
import { api, send } from "@/lib/api";
import Link from "next/link";
export default function Profile() {
  const { user, reload } = useAuth();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        "/auth/profile",
        send("PATCH", Object.fromEntries(new FormData(e.currentTarget))),
      );
      await reload();
      setMessage("Your profile has been updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h1>Hello, {user?.name.split(" ")[0]}.</h1>
          <p>Keep your details up to date and your next step in view.</p>
        </div>
      </div>
      <div className="panel">
        <h2>Your profile</h2>
        <form onSubmit={save}>
          <div className="form-grid">
            <Field label="Full name">
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={user?.name}
              />
            </Field>
            <Field label="Phone number">
              <input
                name="phone"
                type="tel"
                required
                maxLength={20}
                defaultValue={user?.phone}
              />
            </Field>
            <Field
              label="Email address"
              hint="Contact our team if you need to change your account email address."
            >
              <input value={user?.email || ""} readOnly type="email" />
            </Field>
          </div>
          {message && <Notice message={message} />}
          <SubmitButton busy={busy}>Save changes</SubmitButton>
          {error && <Notice error message={error} />}
        </form>
      </div>
      <div className="panel">
        <h2>Account security</h2>
        <p className="subtle">
          Use a secure reset link to change your password. Resetting it signs
          out all existing sessions.
        </p>
        <Link
          href="/forgot-password"
          className="text-link"
          style={{ marginTop: 17 }}
        >
          Reset password
        </Link>
      </div>
    </>
  );
}
