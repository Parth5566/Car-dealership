"use client";
import { useState } from "react";
import Link from "next/link";
import { api, send } from "@/lib/api";
import { localDateTime } from "@/lib/datetime";
import { useAuth } from "./providers";
import { Field, Notice, SubmitButton } from "./ui";
export function EnquiryForm({
  vehicleId,
  testDrive = false,
  initialMessage = "",
}: {
  vehicleId?: number;
  testDrive?: boolean;
  initialMessage?: string;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget,
      data = Object.fromEntries(new FormData(form));
    try {
      const payload: any = {
        ...data,
        consent: data.consent === "on",
        consent_version: "contact-2026-10-21",
        vehicle_id: vehicleId || null,
        source: typeof location !== "undefined" ? location.pathname : "contact",
      };
      if (testDrive) {
        payload.preferred_at = new Date(
          String(data.preferred_at),
        ).toISOString();
        delete payload.message;
        delete payload.source;
      }
      const r = await api(
        testDrive ? "/account/test-drives" : "/enquiries",
        send("POST", payload),
      );
      setMessage(
        testDrive
          ? r.message
          : `${r.message} Your reference is NCR-${r.id}. Keep this number if you contact our team.`,
      );
      form.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (testDrive && !user)
    return (
      <Notice message="Sign in to request a test drive. Staff must confirm the appointment." />
    );
  return (
    <form onSubmit={submit} key={user?.id || "visitor"}>
      {message ? (
        <Notice message={message} />
      ) : (
        <>
          <div className="form-grid">
            <Field label="Your name">
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={100}
                defaultValue={user?.name}
              />
            </Field>
            <Field label="Phone number">
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                maxLength={20}
                defaultValue={user?.phone}
              />
            </Field>
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                defaultValue={user?.email}
              />
            </Field>
            {testDrive && (
              <Field
                label="Preferred date and time"
                hint="Choose when you would like to visit, using your local time. Our team will confirm the appointment."
              >
                <input
                  type="datetime-local"
                  name="preferred_at"
                  required
                  min={localDateTime(Date.now() + 60000)}
                />
              </Field>
            )}
            <div className="full">
              <Field
                label={
                  testDrive
                    ? "Anything we should know? (optional)"
                    : "Your message"
                }
                hint={
                  testDrive
                    ? "For example, tell us if you need help arranging your visit."
                    : "Tell us which vehicle you are interested in or what you would like to ask."
                }
              >
                <textarea
                  name={testDrive ? "notes" : "message"}
                  required={!testDrive}
                  maxLength={3000}
                  defaultValue={
                    vehicleId && !testDrive
                      ? "I would like to know more about this vehicle."
                      : initialMessage
                  }
                />
              </Field>
            </div>
          </div>
          <label className="check-label">
            <input name="consent" type="checkbox" required />
            <span>
              I agree to be contacted about this request and have read the{" "}
              <Link href="/policies/privacy">privacy policy</Link> and{" "}
              <Link href="/policies/buyer-agreement">buyer agreement</Link>.
            </span>
          </label>
          {error && <Notice error message={error} />}
          <SubmitButton busy={busy}>
            {testDrive ? "Request a test drive" : "Send enquiry"}
          </SubmitButton>
          <p className="subtle" style={{ marginTop: 14 }}>
            {testDrive
              ? "This is a request, not a confirmed appointment. No payment is collected."
              : "Your details are used to respond to this enquiry."}
          </p>
        </>
      )}
    </form>
  );
}
