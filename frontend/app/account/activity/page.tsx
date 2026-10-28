"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { date } from "@/lib/types";
import { Empty, ErrorBox, Status } from "@/components/ui";
export default function Activity() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api("/account/enquiries"), api("/account/test-drives")])
      .then(([leads, drives]) =>
        setData({ leads: leads.items, drives: drives.items }),
      )
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <div className="skeleton tall" />;
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Your conversations.</h1>
          <p>Track enquiries and test-drive requests in one place.</p>
        </div>
      </div>
      {[
        ["Enquiries", data.leads],
        ["Test drives", data.drives],
      ].map(([title, items]: any) => (
        <section key={title} className="panel">
          <h2>{title}</h2>
          {items.length ? (
            items.map((i: any) => (
              <article className="submission-card" key={i.id}>
                <div className="submission-top">
                  <div>
                    <h3>
                      {i.make ? `${i.make} ${i.model}` : "General enquiry"}
                    </h3>
                    <p>{date(i.created_at)}</p>
                  </div>
                  <Status value={i.status} />
                </div>
                <p className="subtle break-text" style={{ marginTop: 15 }}>
                  {i.message || i.notes}
                </p>
                {i.preferred_at && (
                  <p className="subtle" style={{ marginTop: 10 }}>
                    Requested: {date(i.preferred_at)}
                    {i.confirmed_at && (
                      <> · Staff appointment: {date(i.confirmed_at)}</>
                    )}
                  </p>
                )}
              </article>
            ))
          ) : (
            <Empty
              title={"No " + String(title).toLowerCase() + " yet."}
              action="Browse vehicles"
              href="/cars"
            >
              Find a vehicle and start a conversation.
            </Empty>
          )}
        </section>
      ))}
    </>
  );
}
