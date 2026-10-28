"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CarFront } from "lucide-react";
import { api } from "@/lib/api";
import { date, label } from "@/lib/types";
import { Empty, ErrorBox, Status, Field } from "@/components/ui";
export default function Submissions() {
  const [items, setItems] = useState<any[] | null>(null),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    api("/account/submissions")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, []);
  const filtered = items?.filter((i) => !status || i.status === status);
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>My listed vehicles.</h1>
          <p>From private draft to public listing. Every step, in one place.</p>
        </div>
        <Link href="/sell" className="btn primary">
          + Add vehicle
        </Link>
      </div>
      <div className="toolbar">
        <select
          aria-label="Filter submissions by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {[
            "draft",
            "submitted",
            "under_review",
            "information_required",
            "approved",
            "published",
            "rejected",
            "sold",
            "archived",
          ].map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <ErrorBox message={error} />
      ) : !items ? (
        <div className="skeleton tall" />
      ) : filtered?.length ? (
        filtered.map((s) => (
          <article className="submission-card" key={s.id}>
            <div className="submission-top">
              <div className="submission-preview">
                {s.images[0] ? (
                  <img
                    src={s.images[0].url}
                    alt={s.data.make + " " + s.data.model}
                  />
                ) : (
                  <span className="submission-placeholder">
                    <CarFront size={25} />
                  </span>
                )}
                <div>
                  <h3>
                    {s.data.make} {s.data.model}
                  </h3>
                  <p>
                    {label(s.type)} ·{" "}
                    {s.submitted_at
                      ? "Submitted " + date(s.submitted_at)
                      : "Draft created " + date(s.created_at)}
                  </p>
                </div>
              </div>
              <Status value={s.status} />
            </div>
            {s.review_note && (
              <div className="notice info">
                <strong>Staff feedback</strong>
                <p className="break-text">{s.review_note}</p>
              </div>
            )}
            {s.status === "draft" && (
              <p className="notice info">
                Your draft is with our team. Complete your listing, or wait for
                us to contact you.
              </p>
            )}
            {s.status === "approved" && (
              <div className="notice success">
                Review approved. Your vehicle is waiting for staff publication
                and is not publicly live yet.
              </div>
            )}
            <div className="form-actions">
              <Link className="text-link" href={"/account/submissions/" + s.id}>
                {["draft", "information_required"].includes(s.status)
                  ? "Continue / update submission"
                  : "View details & history"}{" "}
                ↗
              </Link>
              {s.status === "published" && s.listing && (
                <Link
                  className="text-link"
                  href={`/vehicles/${s.listing.id}/${s.listing.slug}`}
                >
                  View public listing ↗
                </Link>
              )}
            </div>
          </article>
        ))
      ) : (
        <Empty
          title={
            status
              ? "No submissions in this status."
              : "Give your vehicle a new beginning."
          }
          action="Start a submission"
          href="/sell"
        >
          Add your vehicle, photos, and documents. Everything stays private
          until review and publication.
        </Empty>
      )}
    </>
  );
}
