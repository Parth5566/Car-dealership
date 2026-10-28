"use client";
import { useEffect, useState } from "react";
import { api, send } from "@/lib/api";
import type { Settings as PublicSettings } from "@/lib/types";
import { resolveBusiness } from "@/lib/business";
import { Field, Notice, SubmitButton, ErrorBox } from "@/components/ui";
export default function Settings() {
  const [d, setD] = useState<PublicSettings | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    api<PublicSettings>("/admin/settings")
      .then((settings) => {
        const business = resolveBusiness(settings);
        setD({
          ...settings,
          email: business.email,
          phone: business.phones[0]?.display || "",
          phone_secondary: business.phones[1]?.display || "",
          address: business.address,
          hours: business.hours,
          maps_url: business.mapsUrl,
          map_embed: business.mapEmbed,
          whatsapp: business.whatsapp,
        });
      })
      .catch((e) => setError(e.message));
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        "/admin/settings",
        send("PUT", Object.fromEntries(new FormData(e.currentTarget))),
      );
      setMessage(
        "Settings saved. Public content updates on the next page load.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!d)
    return error ? (
      <ErrorBox message={error} />
    ) : (
      <div className="skeleton tall" />
    );
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Content & settings.</h1>
          <p>
            Public business details. Keep integration secrets in the backend
            environment.
          </p>
        </div>
      </div>
      <div className="panel">
        <form onSubmit={save}>
          <div className="form-grid">
            {[
              ["business_name", "Business name"],
              ["email", "Public email"],
              ["phone", "Public phone"],
              ["phone_secondary", "Second public phone"],
              ["whatsapp", "WhatsApp number (country code, digits only)"],
              ["address", "Verified showroom address"],
              ["hours", "Opening hours"],
              ["maps_url", "Google Maps directions URL"],
              ["map_embed", "Google Maps embed URL (blank to hide map)"],
              ["home_headline", "Homepage headline"],
            ].map(([key, title]) => (
              <Field key={key} label={title}>
                <input
                  name={key}
                  defaultValue={String(d[key as keyof PublicSettings] ?? "")}
                  maxLength={
                    key === "address"
                      ? 500
                      : key === "maps_url" || key === "map_embed"
                        ? 4000
                        : 200
                  }
                  required={["business_name", "home_headline"].includes(key)}
                />
              </Field>
            ))}
            <div className="full">
              <Field label="About NCR Wheelz">
                <textarea
                  name="about"
                  defaultValue={d.about}
                  required
                  maxLength={5000}
                />
              </Field>
            </div>
          </div>
          {error && <Notice error message={error} />}
          {message && <Notice message={message} />}
          <SubmitButton busy={busy}>Save public settings</SubmitButton>
        </form>
      </div>
      <div className="notice info">
        Email delivery, maps, analytics, cloud storage and API notifications are
        not activated by these fields. They need a configured provider and
        credentials. Never paste API keys here.
      </div>
    </>
  );
}
