"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, send, download } from "@/lib/api";
import { date, label, money, fuelEconomy } from "@/lib/types";
import { useToast, useAuth } from "./providers";
import { Field, Status, Notice, ErrorBox, SubmitButton } from "./ui";
import { VehicleEditor } from "./vehicle-editor";
const documentGuidance: Record<string, string> = {
  rc: "The vehicle's registration document, showing its registered details.",
  ownership_authority:
    "A document showing that you own the vehicle or have permission to sell it.",
  insurance: "The vehicle's insurance policy document.",
  puc: "The vehicle's pollution test certificate.",
  loan_status:
    "Loan account or clearance documents, if the vehicle has or had a loan.",
  challans:
    "Records of vehicle traffic fines and their payment status, if applicable.",
  fitness: "The vehicle's fitness certificate.",
  permit: "The permit for the vehicle's commercial use.",
  tax: "A record of vehicle tax payments.",
};
export function SubmissionDetail({
  id,
  admin = false,
}: {
  id: string;
  admin?: boolean;
}) {
  const [s, setS] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [consent, setConsent] = useState(false);
  const toast = useToast(),
    { user } = useAuth();
  const load = useCallback(async () => {
    const data = await api(
      (admin ? "/admin" : "/account") + "/submissions/" + id,
    );
    setS(data);
  }, [id, admin]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const action = async (path: string, data: any) => {
    setBusy(true);
    setError("");
    try {
      const result = await api(path, send("POST", data));
      toast(result?.message || "Changes saved");
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("seller-drafts-updated"));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const changePhotos = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file: File, path: string, type?: string) => {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      if (type) form.set("type", type);
      await api(path, { method: "POST", body: form });
      await load();
      toast("File uploaded privately");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!s)
    return error ? (
      <ErrorBox message={error} />
    ) : (
      <div className="skeleton tall" />
    );
  const canEdit =
    !admin && ["draft", "information_required"].includes(s.status);
  const canEditAsAdmin =
    admin &&
    user?.permissions.includes("inventory") &&
    user?.permissions.includes("reviews");
  const canEditDetails =
    canEdit ||
    (canEditAsAdmin &&
      !s.listing &&
      [
        "draft",
        "submitted",
        "under_review",
        "information_required",
        "approved",
      ].includes(s.status));
  const missing = s.required_documents.filter(
    (type: string) => !s.documents.some((d: any) => d.type === type),
  );
  return (
    <>
      <div className="breadcrumb">
        <Link href={admin ? "/admin/submissions" : "/account/submissions"}>
          ← All submissions
        </Link>
        <span>/ #{s.id}</span>
      </div>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">{label(s.type)} · PRIVATE SUBMISSION</span>
          <h1>
            {s.data.make} {s.data.model}
          </h1>
          <p>
            {s.data.year} · {money(s.data.price)} ·{" "}
            {s.data.mileage.toLocaleString("en-IN")} km
          </p>
        </div>
        <Status value={s.status} />
      </div>
      {error && <Notice error message={error} />}
      {!admin && s.status === "draft" && (
        <section className="notice success" aria-labelledby="draft-saved-title">
          <h2 id="draft-saved-title" style={{ fontSize: 23, marginBottom: 10 }}>
            Your draft is submitted to our team.
          </h2>
          <p>
            Complete your car listing now, or wait for our team to contact you
            using the details you provided. Your vehicle stays private until
            review and publication.
          </p>
          <div className="form-actions" style={{ marginTop: 18 }}>
            <a className="btn primary small" href="#vehicle-photos">
              Complete my listing
            </a>
            <Link className="text-link" href="/account/submissions">
              I’ll wait for the team ↗
            </Link>
          </div>
        </section>
      )}
      {admin && s.status === "draft" && (
        <section className="panel">
          <h2>Seller draft follow-up</h2>
          <p className="subtle">
            The seller saved their vehicle details and may be waiting for help.
            Contact them about the next steps for their listing.
          </p>
          <p style={{ marginTop: 14 }}>
            <strong>{s.seller_contact.name}</strong> · {s.seller_contact.phone}{" "}
            · {s.seller_contact.email}
          </p>
          {s.draft_contacted_at ? (
            <p className="notice success" style={{ marginTop: 18 }}>
              Contact recorded on {date(s.draft_contacted_at)}. The vehicle is
              still a draft.
            </p>
          ) : (
            <div style={{ marginTop: 18 }}>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  action(`/admin/submissions/${s.id}/contacted`, {})
                }
              >
                {busy ? "Please wait…" : "Mark contacted"}
              </button>
              <p className="subtle" style={{ marginTop: 10 }}>
                Use this after speaking with or messaging the seller. It clears
                the follow-up notice.
              </p>
            </div>
          )}
        </section>
      )}
      {s.status !== "draft" && (
        <div className="notice info">
          {s.status === "approved"
            ? "Review approved. Your listing is not publicly live until staff publish it."
            : s.status === "published"
              ? "This vehicle has been published. Private documents and seller contact details remain protected."
              : s.status === "information_required"
                ? "Action required: review the staff feedback, correct the details or replace the requested files, then resubmit this same submission."
                : "This submission remains private during review. Document review is manual and is not proof of authenticity, title, or mechanical condition."}
          {s.review_note && (
            <p className="break-text">
              <strong>Staff feedback: </strong>
              {s.review_note}
            </p>
          )}
        </div>
      )}
      {s.listing && s.status === "published" && (
        <p style={{ marginBottom: 20 }}>
          <Link
            href={`/vehicles/${s.listing.id}/${s.listing.slug}`}
            className="text-link"
          >
            Open public listing ↗
          </Link>
        </p>
      )}
      <div className="panel">
        <div className="admin-heading">
          <h2 style={{ margin: 0 }}>Vehicle details</h2>
          {canEditDetails && (
            <button
              className="text-button"
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Cancel edit" : "Edit details"}
            </button>
          )}
          {canEditAsAdmin && s.listing && (
            <Link
              className="btn outline small"
              href={`/admin/inventory/${s.listing.id}`}
            >
              Edit listing details
            </Link>
          )}
        </div>
        {admin && canEditDetails && (
          <p className="subtle" style={{ marginBottom: 20 }}>
            Adjust the price, specifications or description here. Changes are
            recorded in the seller's history and clear any previous review
            approval.
          </p>
        )}
        {editing ? (
          <VehicleEditor
            initial={s.data}
            contact={s.seller_contact}
            seller={!admin}
            typeLocked={!admin}
            onSave={async (vehicle, contact) => {
              await api(
                (admin ? "/admin" : "/account") + "/submissions/" + s.id,
                send("PATCH", {
                  vehicle,
                  ...(admin ? {} : { contact }),
                  expected_version: s.expected_version,
                }),
              );
              setEditing(false);
              await load();
              toast(
                admin
                  ? "Vehicle details saved. Review approval is required before publication."
                  : "Details saved",
              );
            }}
          />
        ) : (
          <>
            <div className="detail-specs">
              {[
                [
                  "Vehicle type",
                  s.type === "passenger" ? "Passenger car" : "Commercial cab",
                ],
                ["Vehicle brand", s.data.make],
                ["Model name", s.data.model],
                ["Variant", s.data.variant || "Not provided"],
                ["Year of manufacture", s.data.year],
                [
                  "Kilometres driven",
                  s.data.mileage.toLocaleString("en-IN") + " km",
                ],
                ["Fuel type", s.data.fuel],
                ...(fuelEconomy(s.data)
                  ? [["Mileage / fuel economy", fuelEconomy(s.data)]]
                  : []),
                ["Transmission", s.data.transmission],
                ["Vehicle style", s.data.body_type],
                ["City / area", s.data.location],
                ["Number of owners", s.data.owners],
                ["Number of seats", s.data.seats || "Not provided"],
              ].map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <p className="subtle break-text">{s.data.description}</p>
            <div className="features" style={{ marginTop: 18 }}>
              {s.data.features?.map((f: string) => (
                <span key={f}>{f}</span>
              ))}
            </div>
            <p className="subtle" style={{ marginTop: 22 }}>
              Private seller contact: {s.seller_contact.name} ·{" "}
              {s.seller_contact.email} · {s.seller_contact.phone}
            </p>
          </>
        )}
      </div>
      <div
        className="panel"
        id="vehicle-photos"
        style={{ scrollMarginTop: 120 }}
      >
        <h2>Vehicle photos</h2>
        <p className="subtle">
          Add up to 20 photos in JPEG, PNG or WebP format, up to 10 MB each.
          Photos are automatically resized when uploaded.
        </p>
        <div className="uploads-grid">
          {s.images.map((image: any, index: number) => (
            <div className="upload-photo" key={image.id}>
              <img
                src={image.url}
                alt={image.alt_text?.trim() || "Vehicle photo"}
              />
              {canEdit && (
                <div>
                  <button
                    disabled={busy}
                    onClick={() =>
                      changePhotos(() =>
                        api(
                          `/account/submissions/${s.id}/images/${image.id}`,
                          send("DELETE"),
                        ),
                      )
                    }
                  >
                    Remove
                  </button>
                  <button
                    style={{ marginLeft: 12, color: "var(--blue)" }}
                    disabled={busy || index === 0}
                    onClick={() =>
                      changePhotos(() => {
                        const ids = s.images.map((photo: any) => photo.id);
                        [ids[index - 1], ids[index]] = [
                          ids[index],
                          ids[index - 1],
                        ];
                        return api(
                          `/account/submissions/${s.id}/images/reorder`,
                          send("PATCH", { image_ids: ids }),
                        );
                      })
                    }
                  >
                    Move earlier
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <Field label="Add a vehicle photo">
            <input
              type="file"
              className="file-upload-input"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f, `/account/submissions/${s.id}/images`);
                e.target.value = "";
              }}
            />
          </Field>
        )}
      </div>
      <div className="panel">
        <h2>Supporting documents</h2>
        <p className="subtle" style={{ marginBottom: 22 }}>
          These files stay private. Upload the files marked Required for our
          team to review. PDF, JPEG, PNG or WebP, up to 10 MB each. Do not
          upload Aadhaar.
        </p>
        <div className="documents-grid">
          {Array.from(
            new Set<string>([
              ...s.required_documents,
              ...s.documents.map((d: any) => d.type),
              "loan_status",
              "challans",
            ]),
          ).map((type: string) => {
            const d = s.documents.find((v: any) => v.type === type);
            return (
              <div className="document-card" key={type}>
                <strong>
                  {label(type)}
                  {s.required_documents.includes(type)
                    ? " · Required"
                    : " · Optional"}
                </strong>
                {documentGuidance[type] && (
                  <p className="subtle">{documentGuidance[type]}</p>
                )}
                {d ? (
                  <>
                    <Status value={d.status} />
                    <p>
                      {d.uploaded_at
                        ? "Last uploaded: " + date(d.uploaded_at)
                        : "Originally added: " + date(d.created_at)}
                    </p>
                    <button
                      className="text-button"
                      disabled={busy}
                      style={{ marginTop: 10 }}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          await download(
                            `/account/submissions/${s.id}/documents/${d.id}`,
                            `${d.type}.${d.mime === "application/pdf" ? "pdf" : "webp"}`,
                          );
                        } catch (err) {
                          setError((err as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Download privately
                    </button>
                    {d.review_note && (
                      <p className="break-text">{d.review_note}</p>
                    )}
                  </>
                ) : (
                  <Status value="not uploaded" />
                )}
                {canEdit && (
                  <input
                    aria-label={"Upload " + label(type)}
                    type="file"
                    className="file-upload-input"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        upload(
                          f,
                          `/account/submissions/${s.id}/documents`,
                          type,
                        );
                      e.target.value = "";
                    }}
                  />
                )}
                {admin &&
                  d &&
                  ["submitted", "under_review"].includes(s.status) && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = Object.fromEntries(
                          new FormData(e.currentTarget),
                        );
                        action("/admin/documents/" + d.id + "/review", f);
                      }}
                    >
                      <Field label="Review note">
                        <input name="note" required maxLength={3000} />
                      </Field>
                      <Field label="Decision">
                        <select name="status">
                          <option value="accepted">
                            Accept for manual review
                          </option>
                          <option value="rejected">Reject document</option>
                        </select>
                      </Field>
                      <SubmitButton busy={busy}>
                        Record document review
                      </SubmitButton>
                    </form>
                  )}
              </div>
            );
          })}
        </div>
      </div>
      {canEdit && (
        <div className="panel">
          <h2>
            {s.status === "draft"
              ? "Ready for review?"
              : "Resubmit your updates"}
          </h2>
          {missing.length > 0 && (
            <p className="subtle" style={{ marginBottom: 18 }}>
              Still needed: {missing.map(label).join(", ")}.
            </p>
          )}
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I am authorised to submit this vehicle. The details and documents
              are accurate to the best of my knowledge. I accept the{" "}
              <Link href="/policies/seller-agreement">seller agreement</Link>{" "}
              and{" "}
              <Link href="/policies/verification">document review policy</Link>.
              I understand that approval does not automatically publish my
              vehicle.
            </span>
          </label>
          <button
            className="btn primary"
            disabled={
              busy || !consent || missing.length > 0 || !s.images.length
            }
            onClick={() =>
              action(`/account/submissions/${s.id}/submit`, { consent: true })
            }
          >
            {busy ? "Please wait…" : "Submit for manual review"}
          </button>
        </div>
      )}
      {admin && (
        <div className="panel">
          <h2>Review decision</h2>
          {["submitted", "under_review"].includes(s.status) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                action(`/admin/submissions/${s.id}/review`, {
                  ...Object.fromEntries(new FormData(e.currentTarget)),
                  expected_version: s.expected_version,
                });
              }}
            >
              <Field label="Decision">
                <select name="status" required defaultValue="">
                  <option value="" disabled>
                    Select a decision
                  </option>
                  {s.status === "submitted" && (
                    <option value="under_review">Mark under review</option>
                  )}
                  <option value="information_required">
                    Request more information
                  </option>
                  <option value="approved">
                    Approve review (keep private)
                  </option>
                  <option value="rejected">Reject submission</option>
                </select>
              </Field>
              <Field label="Feedback for the seller">
                <textarea name="note" required maxLength={3000} />
              </Field>
              <SubmitButton busy={busy}>Record decision</SubmitButton>
            </form>
          )}
          {s.status === "approved" &&
            user?.permissions.includes("inventory") && (
              <>
                <p className="subtle" style={{ marginBottom: 20 }}>
                  The review has passed. Publication makes the vehicle
                  specifications and photos public. Seller contact information
                  and documents stay private.
                </p>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() =>
                    action(`/admin/submissions/${s.id}/publish`, {})
                  }
                >
                  Publish approved vehicle
                </button>
              </>
            )}
          {!["submitted", "under_review", "approved"].includes(s.status) && (
            <p className="subtle">
              There is no review action available in this status.
            </p>
          )}
        </div>
      )}
      <div className="panel">
        <h2>Submission timeline</h2>
        <div className="timeline">
          {s.history.map((h: any, index: number) => (
            <div key={index}>
              <p>{label(h.status)}</p>
              <small>{date(h.created_at)}</small>
              <span className="break-text">{h.note}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
