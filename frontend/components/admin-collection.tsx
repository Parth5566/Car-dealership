"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, send } from "@/lib/api";
import { localDateTime } from "@/lib/datetime";
import { date, label } from "@/lib/types";
import { useToast } from "./providers";
import { Field, Status, Notice, ErrorBox, Empty, SubmitButton } from "./ui";
import { AdminPagination } from "./admin-inventory";
const states: Record<string, string[]> = {
  leads: ["new", "contacted", "test_drive", "negotiation", "sold", "lost"],
  "test-drives": [
    "requested",
    "confirmed",
    "rescheduled",
    "completed",
    "cancelled",
  ],
  submissions: [
    "draft",
    "submitted",
    "under_review",
    "information_required",
    "approved",
    "published",
    "rejected",
    "sold",
    "archived",
  ],
};
const titles: Record<string, string> = {
  submissions: "Seller review queue.",
  leads: "Your lead pipeline.",
  "test-drives": "Test-drive requests.",
  customers: "Customer accounts.",
  users: "Staff & permissions.",
  audit: "Audit trail.",
};
export function AdminCollection({ kind }: { kind: string }) {
  const params = useSearchParams(),
    toast = useToast();
  const [data, setData] = useState<any>(null),
    [selected, setSelected] = useState<any>(null),
    [history, setHistory] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [create, setCreate] = useState(false);
  const detailGeneration = useRef(0);
  const listGeneration = useRef(0);
  const listScope = useRef("");
  const scope = "/admin/" + kind + "?" + params;
  const load = useCallback(async () => {
    if (listScope.current !== scope) return false;
    const generation = ++listGeneration.current;
    try {
      const r = await api(scope);
      if (generation !== listGeneration.current || listScope.current !== scope)
        return false;
      setData(r);
      return true;
    } catch (error) {
      if (generation === listGeneration.current && listScope.current === scope)
        throw error;
      return false;
    }
  }, [scope]);
  const open = useCallback(
    async (row: any, generation = ++detailGeneration.current) => {
      if (generation !== detailGeneration.current) return;
      setSelected(row);
      setHistory([]);
      setError("");
      try {
        if (["leads", "test-drives"].includes(kind)) {
          const h = await api(
            `/admin/history/${kind === "leads" ? "lead" : "test_drive"}/${row.id}`,
          );
          if (generation !== detailGeneration.current) return;
          setHistory(h.items);
        } else if (kind === "customers") {
          const detail = await api("/admin/customers/" + row.id);
          if (generation !== detailGeneration.current) return;
          setSelected({ ...row, ...detail });
        }
        setTimeout(() => {
          if (generation === detailGeneration.current)
            document
              .getElementById("record-detail")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      } catch (err) {
        if (generation === detailGeneration.current)
          setError((err as Error).message);
      }
    },
    [kind],
  );
  useEffect(() => {
    let active = true;
    listScope.current = scope;
    setData(null);
    setError("");
    load().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
      listScope.current = "";
      ++listGeneration.current;
    };
  }, [load, scope]);
  useEffect(() => {
    const generation = ++detailGeneration.current;
    setSelected(null);
    setHistory([]);
    if (params.get("open") && ["leads", "test-drives"].includes(kind))
      api("/admin/" + kind + "/" + params.get("open"))
        .then((row) => open(row, generation))
        .catch((e) => {
          if (generation === detailGeneration.current) setError(e.message);
        });
    return () => {
      ++detailGeneration.current;
    };
  }, [params, kind, open]);
  async function update(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f: any = Object.fromEntries(new FormData(e.currentTarget));
    if (["customers", "users"].includes(kind)) f.active = f.active === "true";
    if (kind === "leads")
      f.assigned_to = f.assigned_to ? Number(f.assigned_to) : null;
    try {
      if (kind === "test-drives")
        f.confirmed_at =
          f.confirmed_at &&
          !(
            f.status === selected.status &&
            f.confirmed_at === localDateTime(selected.confirmed_at || "")
          )
            ? new Date(f.confirmed_at).toISOString()
            : null;
      await api("/admin/" + kind + "/" + selected.id, send("PATCH", f));
      if (!(await load())) return;
      toast("Record updated");
      ++detailGeneration.current;
      setSelected(null);
      setHistory([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function staff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        "/admin/users",
        send("POST", Object.fromEntries(new FormData(e.currentTarget))),
      );
      if (!(await load())) return;
      toast("Staff account created");
      setCreate(false);
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
          <h1>{titles[kind]}</h1>
          <p>
            {kind === "audit"
              ? "Administrative and security actions with actor references and timestamps."
              : kind === "submissions"
                ? "Contact sellers who saved a draft, and review completed submissions before approval."
                : "Search, review, and update operational records."}
          </p>
        </div>
        {kind === "users" && (
          <button className="btn primary" onClick={() => setCreate(!create)}>
            + Add staff
          </button>
        )}
      </div>
      {kind === "submissions" && (
        <nav className="toolbar" aria-label="Seller queues">
          <Link
            className={
              params.get("follow_up") === "pending"
                ? "btn primary small"
                : "btn outline small"
            }
            href="/admin/submissions?status=draft&follow_up=pending"
          >
            Drafts to contact
          </Link>
          <Link
            className="btn outline small"
            href="/admin/submissions?status=submitted"
          >
            Submitted for review
          </Link>
          <Link className="text-link" href="/admin/submissions">
            All seller vehicles
          </Link>
        </nav>
      )}
      <form className="toolbar">
        {kind === "submissions" && params.get("follow_up") === "pending" && (
          <input type="hidden" name="follow_up" value="pending" />
        )}
        <input
          name="q"
          className="search-input"
          aria-label="Search records"
          defaultValue={params.get("q") || ""}
          placeholder={
            kind === "audit"
              ? "Action"
              : kind === "leads"
                ? "Name or reference"
                : "Name or vehicle"
          }
        />
        {kind === "submissions" && params.get("follow_up") === "pending" ? (
          <input type="hidden" name="status" value="draft" />
        ) : (
          states[kind] && (
            <select
              aria-label="Filter status"
              name="status"
              defaultValue={params.get("status") || ""}
            >
              <option value="">All statuses</option>
              {states[kind].map((s) => (
                <option value={s} key={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          )
        )}
        <button className="btn primary small">Filter</button>
        <Link className="text-button" href={"/admin/" + kind}>
          Reset
        </Link>
      </form>
      {error && <Notice error message={error} />}
      <p className="subtle" style={{ marginBottom: 15 }}>
        {data ? `${data.total} records` : ""}
      </p>
      {!data ? (
        <div className="skeleton tall" />
      ) : data.items.length ? (
        <>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>
                    {kind === "audit"
                      ? "Action"
                      : kind === "submissions"
                        ? "Vehicle"
                        : "Name"}
                  </th>
                  <th>
                    {kind === "audit"
                      ? "Target"
                      : kind === "submissions"
                        ? "Seller"
                        : "Contact / context"}
                  </th>
                  <th>{kind === "audit" ? "Actor" : "Status"}</th>
                  <th>Date</th>
                  {kind !== "audit" && <th />}
                </tr>
              </thead>
              <tbody>
                {data.items.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <strong>
                        {kind === "audit"
                          ? r.action
                          : kind === "submissions"
                            ? r.data.make + " " + r.data.model
                            : r.name}
                      </strong>
                      <small>
                        #{r.id}
                        {r.role ? " · " + label(r.role) : ""}
                      </small>
                    </td>
                    <td
                      data-label={
                        kind === "audit"
                          ? "Target"
                          : kind === "submissions"
                            ? "Seller"
                            : "Contact"
                      }
                    >
                      {kind === "audit" ? (
                        r.target_type + " #" + r.target_id
                      ) : kind === "submissions" ? (
                        r.seller_name
                      ) : (
                        <>
                          {r.email}
                          <br />
                          <small>
                            {r.phone}
                            {r.vehicle_id ? " · Vehicle #" + r.vehicle_id : ""}
                          </small>
                        </>
                      )}
                    </td>
                    <td data-label={kind === "audit" ? "Actor" : "Status"}>
                      {kind === "audit" ? (
                        r.actor_id || "System"
                      ) : r.status ? (
                        <>
                          <Status value={r.status} />
                          {kind === "submissions" && r.status === "draft" && (
                            <small>
                              {r.draft_contacted_at
                                ? "Contact recorded"
                                : "Awaiting first contact"}
                            </small>
                          )}
                        </>
                      ) : (
                        <Status value={r.active ? "active" : "disabled"} />
                      )}
                    </td>
                    <td data-label="Date">
                      {date(r.submitted_at || r.created_at)}
                    </td>
                    {kind !== "audit" && (
                      <td className="admin-table-action">
                        {kind === "submissions" ? (
                          <Link
                            href={"/admin/submissions/" + r.id}
                            className="text-link"
                          >
                            {r.status === "draft"
                              ? "View draft / contact seller ↗"
                              : "Review ↗"}
                          </Link>
                        ) : (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => open(r)}
                          >
                            Manage ↗
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination total={data.total} page={data.page} />
        </>
      ) : (
        <Empty
          title="Nothing in this queue."
          action="Back to overview"
          href="/admin"
        >
          Matching records will appear here when there is activity.
        </Empty>
      )}
      {create && kind === "users" && (
        <div className="panel" style={{ marginTop: 25 }}>
          <h2>Create staff account</h2>
          <form onSubmit={staff}>
            <div className="form-grid">
              <Field label="Name">
                <input name="name" required maxLength={100} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" required />
              </Field>
              <Field label="Phone">
                <input name="phone" type="tel" required />
              </Field>
              <Field
                label="Temporary password"
                hint="Provide securely to the staff member. They can reset it."
              >
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={72}
                  required
                />
              </Field>
              <Field label="Role">
                <select name="role">
                  <option value="sales">
                    Sales: inventory, leads, customers, reports
                  </option>
                  <option value="reviewer">
                    Reviewer: submissions and documents
                  </option>
                  <option value="admin">Admin: all permissions</option>
                </select>
              </Field>
            </div>
            <SubmitButton busy={busy}>Create staff account</SubmitButton>
          </form>
        </div>
      )}
      {selected && (
        <div className="panel" id="record-detail" style={{ marginTop: 25 }}>
          <div className="admin-heading">
            <h2 style={{ margin: 0 }}>
              {selected.name} · #{selected.id}
            </h2>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                ++detailGeneration.current;
                setSelected(null);
                setHistory([]);
              }}
            >
              Close
            </button>
          </div>
          {selected.message && (
            <p className="subtle break-text" style={{ marginBottom: 20 }}>
              {selected.message}
            </p>
          )}
          {selected.notes && (
            <p className="subtle break-text" style={{ marginBottom: 20 }}>
              {selected.notes}
            </p>
          )}
          {selected.preferred_at && (
            <p className="subtle" style={{ marginBottom: 20 }}>
              Preferred: {date(selected.preferred_at)}
            </p>
          )}
          <div className="inline-links" style={{ marginBottom: 20 }}>
            <a className="text-link" href={"mailto:" + selected.email}>
              Email customer
            </a>
            {selected.phone && (
              <a className="text-link" href={"tel:" + selected.phone}>
                Call customer
              </a>
            )}
          </div>
          <form onSubmit={update} key={selected.id}>
            {states[kind] && (
              <>
                <Field label="Status">
                  <select name="status" defaultValue={selected.status}>
                    {(kind === "test-drives"
                      ? [
                          selected.status,
                          ...(
                            {
                              requested: [
                                "confirmed",
                                "rescheduled",
                                "cancelled",
                              ],
                              confirmed: [
                                "rescheduled",
                                "completed",
                                "cancelled",
                              ],
                              rescheduled: [
                                "confirmed",
                                "completed",
                                "cancelled",
                              ],
                              completed: [],
                              cancelled: [],
                            } as Record<string, string[]>
                          )[selected.status],
                        ]
                      : states[kind]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </Field>
                {kind === "test-drives" && (
                  <Field
                    label="Confirmed / rescheduled date and time"
                    hint="Local time. Required for confirmation or rescheduling."
                  >
                    <input
                      type="datetime-local"
                      name="confirmed_at"
                      defaultValue={localDateTime(selected.confirmed_at || "")}
                    />
                  </Field>
                )}
                {kind === "leads" && (
                  <Field
                    label="Assigned staff ID (optional)"
                    hint="Use an active sales or admin account ID."
                  >
                    <input
                      name="assigned_to"
                      type="number"
                      min="1"
                      defaultValue={selected.assigned_to || ""}
                    />
                  </Field>
                )}
                <Field label="Internal staff notes">
                  <textarea
                    name="internal_note"
                    maxLength={3000}
                    defaultValue={selected.internal_note || ""}
                  />
                </Field>
              </>
            )}
            {["users", "customers"].includes(kind) && (
              <>
                <Field label="Account status">
                  <select
                    name="active"
                    defaultValue={selected.active ? "true" : "false"}
                  >
                    <option value="true">Active</option>
                    <option value="false">Disabled</option>
                  </select>
                </Field>
                <Field label="Role">
                  <select name="role" defaultValue={selected.role}>
                    {(kind === "users"
                      ? ["sales", "reviewer", "admin"]
                      : ["customer"]
                    ).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <p className="subtle" style={{ marginBottom: 18 }}>
                  Access changes revoke existing sessions. An admin cannot
                  remove their own access or the last active admin.
                </p>
              </>
            )}
            <SubmitButton busy={busy}>Save changes</SubmitButton>
          </form>
          {selected.activity && (
            <>
              <h3 style={{ marginTop: 30 }}>Account activity</h3>
              <p className="subtle">
                Enquiries: {selected.activity.enquiries} · Test drives:{" "}
                {selected.activity.test_drives} · Seller submissions:{" "}
                {selected.activity.submissions}
              </p>
            </>
          )}
          {history.length > 0 && (
            <>
              <h3 style={{ marginTop: 30 }}>Status history</h3>
              <div className="timeline">
                {history.map((h) => (
                  <div key={h.id}>
                    <p>{label(h.status)}</p>
                    <small>
                      {date(h.created_at)} · {h.actor || "System"}
                    </small>
                    <span>{h.note}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
