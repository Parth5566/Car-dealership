"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { date, label } from "@/lib/types";
import { ErrorBox, Empty, Status } from "@/components/ui";
import { useAuth } from "@/components/providers";
export default function Dashboard() {
  const [d, setD] = useState<any>(null),
    [error, setError] = useState("");
  const { user } = useAuth();
  useEffect(() => {
    api("/admin/dashboard")
      .then(setD)
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <ErrorBox message={error} />;
  if (!d) return <div className="skeleton tall" />;
  const metrics = [
    ...(d.inventory
      ? [
          [
            "Available listings",
            d.inventory.available,
            "/admin/inventory?status=published",
          ],
          [
            "Reserved",
            d.inventory.reserved,
            "/admin/inventory?status=reserved",
          ],
          ["Sold vehicles", d.inventory.sold, "/admin/inventory?status=sold"],
          [
            "Unpublished drafts",
            d.inventory.drafts,
            "/admin/inventory?status=draft",
          ],
        ]
      : []),
    ...(d.leads
      ? [
          ["New leads", d.leads.new_leads, "/admin/leads?status=new"],
          [
            "Open test drives",
            d.test_drives.open,
            "/admin/test-drives?status=requested",
          ],
        ]
      : []),
    ...(d.submissions
      ? [
          [
            "Seller drafts to contact",
            d.seller_drafts?.total || 0,
            "/admin/submissions?status=draft&follow_up=pending",
          ],
          [
            "Awaiting review",
            d.submissions.awaiting,
            "/admin/submissions?status=submitted",
          ],
          ["Documents pending", d.submissions.pending, "/admin/submissions"],
        ]
      : []),
  ];
  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">OPERATIONS AT A GLANCE</span>
          <h1>Welcome, {user?.name.split(" ")[0]}.</h1>
          <p>Live operational counts from the marketplace database.</p>
        </div>
      </div>
      <div className="stat-grid">
        {metrics.map(([title, count, url]) => (
          <Link key={title} href={url} className="stat-card">
            <small>{title}</small>
            <strong>{count}</strong>
          </Link>
        ))}
      </div>
      <div className="two-columns">
        {d.seller_drafts && (
          <div className="panel queue">
            <h2>Seller drafts to contact</h2>
            {d.seller_drafts.items.length ? (
              d.seller_drafts.items.map((s: any) => (
                <Link key={s.id} href={"/admin/submissions/" + s.id}>
                  {s.make} {s.model}
                  <small>
                    {s.seller_name} · Draft #{s.id} · {date(s.created_at)}
                  </small>
                </Link>
              ))
            ) : (
              <p className="subtle">
                No seller drafts waiting for a first contact.
              </p>
            )}
            <Link
              className="text-link"
              href="/admin/submissions?status=draft&follow_up=pending"
            >
              Open draft follow-ups ↗
            </Link>
          </div>
        )}
        {d.review_queue && (
          <div className="panel queue">
            <h2>Seller review queue</h2>
            {d.review_queue.length ? (
              d.review_queue.map((s: any) => (
                <Link key={s.id} href={"/admin/submissions/" + s.id}>
                  {s.make} {s.model} <Status value={s.status} />
                  <small>
                    Submission #{s.id} ·{" "}
                    {s.submitted_at && date(s.submitted_at)}
                  </small>
                </Link>
              ))
            ) : (
              <p className="subtle">No submissions awaiting review.</p>
            )}
          </div>
        )}
        {d.lead_queue && (
          <div className="panel queue">
            <h2>Follow up on leads</h2>
            {d.lead_queue.length ? (
              d.lead_queue.map((l: any) => (
                <Link key={l.id} href={"/admin/leads?open=" + l.id}>
                  {l.name} <Status value={l.status} />
                  <small>{date(l.created_at)}</small>
                </Link>
              ))
            ) : (
              <p className="subtle">No new leads to follow up.</p>
            )}
          </div>
        )}
        {d.drive_queue && (
          <div className="panel queue">
            <h2>Test-drive requests</h2>
            {d.drive_queue.length ? (
              d.drive_queue.map((l: any) => (
                <Link key={l.id} href={"/admin/test-drives?open=" + l.id}>
                  {l.name}
                  <small>
                    {date(l.preferred_at)} · {label(l.status)}
                  </small>
                </Link>
              ))
            ) : (
              <p className="subtle">No open test-drive requests.</p>
            )}
          </div>
        )}
      </div>
      {d.activity && (
        <div className="panel">
          <h2>Recent activity</h2>
          {d.activity.length ? (
            d.activity.map((a: any) => (
              <div className="activity" key={a.id}>
                <span>
                  {a.action}
                  <br />
                  <small>
                    {a.actor || "System"} · {a.target_type} #{a.target_id}
                  </small>
                </span>
                <small>{date(a.created_at)}</small>
              </div>
            ))
          ) : (
            <p className="subtle">No administrative activity recorded yet.</p>
          )}
        </div>
      )}
    </>
  );
}
