"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, send } from "@/lib/api";
import { label, money } from "@/lib/types";
import { isAutomaticAlt, photoAlt } from "@/lib/photo-alt";
import { useAuth, useToast } from "./providers";
import { VehicleEditor } from "./vehicle-editor";
import { Field, Status, Notice, ErrorBox, Empty, SubmitButton } from "./ui";
export function AdminInventoryList() {
  const params = useSearchParams();
  const [d, setD] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setD(null);
    setError("");
    api("/admin/vehicles?" + params)
      .then((result) => {
        if (active) setD(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [params]);
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Vehicle inventory.</h1>
          <p>Manage passenger and commercial listings.</p>
        </div>
        <Link href="/admin/inventory/new" className="btn primary">
          + Add vehicle
        </Link>
      </div>
      <form className="toolbar">
        <input
          className="search-input"
          name="q"
          defaultValue={params.get("q") || ""}
          placeholder="Brand or model"
          aria-label="Search inventory"
        />
        <select
          name="type"
          defaultValue={params.get("type") || ""}
          aria-label="Vehicle type"
        >
          <option value="">All types</option>
          <option value="passenger">Passenger</option>
          <option value="commercial">Commercial</option>
        </select>
        <select
          name="status"
          defaultValue={params.get("status") || ""}
          aria-label="Listing status"
        >
          <option value="">All statuses</option>
          {["draft", "published", "reserved", "sold", "archived"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn primary small">Filter</button>
        <Link className="text-button" href="/admin/inventory">
          Reset
        </Link>
      </form>
      {error ? (
        <ErrorBox message={error} />
      ) : !d ? (
        <div className="skeleton tall" />
      ) : d.items.length ? (
        <>
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Type / location</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.items.map((v: any) => (
                  <tr key={v.id}>
                    <td>
                      <strong>
                        {v.make} {v.model}
                      </strong>
                      <small>
                        {v.year} · #{v.id}
                      </small>
                    </td>
                    <td data-label="Type / location">
                      {label(v.type)}
                      <br />
                      <small>{v.location}</small>
                    </td>
                    <td data-label="Price">{money(v.price)}</td>
                    <td data-label="Status">
                      <Status value={v.status} />
                      <br />
                      <small>
                        {v.approved ? "Approved" : "Needs approval"}
                      </small>
                    </td>
                    <td className="admin-table-action">
                      <Link
                        className="text-link"
                        href={"/admin/inventory/" + v.id}
                      >
                        Edit vehicle ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination total={d.total} page={d.page} />
        </>
      ) : (
        <Empty
          title="No inventory to show."
          action="Create a vehicle"
          href="/admin/inventory/new"
        >
          Create a draft listing or publish an approved seller submission.
        </Empty>
      )}
    </>
  );
}
export function AdminPagination({
  total,
  page,
}: {
  total: number;
  page: number;
}) {
  const params = useSearchParams();
  function url(p: number) {
    const q = new URLSearchParams(params.toString());
    q.set("page", String(p));
    return "?" + q;
  }
  return total > 20 || page > 1 ? (
    <div className="pagination">
      {page > 1 && (
        <Link className="btn outline small" href={url(page - 1)}>
          Previous
        </Link>
      )}
      <span>
        Page {page} · {total} records
      </span>
      {page * 20 < total && (
        <Link className="btn primary small" href={url(page + 1)}>
          Next
        </Link>
      )}
    </div>
  ) : null;
}
export function AdminInventoryEditor({ id }: { id?: string }) {
  const [v, setV] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter(),
    toast = useToast(),
    { user } = useAuth();
  const load = useCallback(
    () => (id ? api("/admin/vehicles/" + id).then(setV) : Promise.resolve()),
    [id],
  );
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  const act = async (path: string, data: any) => {
    setBusy(true);
    setError("");
    try {
      await api(path, send("POST", data));
      await load();
      toast("Listing updated");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (id && !v)
    return error ? (
      <ErrorBox message={error} />
    ) : (
      <div className="skeleton tall" />
    );
  return (
    <>
      <div className="breadcrumb">
        <Link href="/admin/inventory">← Inventory</Link>
      </div>
      <div className="admin-heading">
        <div>
          <h1>{v ? `${v.make} ${v.model}` : "Create a vehicle."}</h1>
          <p>
            {v
              ? "Edit details, organise images, and manage publication."
              : "New vehicles start as private, unapproved drafts."}
          </p>
        </div>
        {v && <Status value={v.status} />}
      </div>
      {error && <Notice error message={error} />}
      <div className="panel">
        <h2>Vehicle details</h2>
        {v && ["published", "reserved"].includes(v.status) ? (
          <>
            <p className="subtle" style={{ marginBottom: 18 }}>
              Move this vehicle to a private draft to change its price or other
              details. It will need approval before appearing on the website
              again.
            </p>
            <button
              className="btn outline"
              disabled={busy}
              onClick={() =>
                act(`/admin/vehicles/${v.id}/status`, { status: "draft" })
              }
            >
              Unpublish & edit vehicle
            </button>
          </>
        ) : (
          <VehicleEditor
            initial={v?.data}
            onSave={async (data) => {
              const r = await api(
                "/admin/vehicles" + (id ? "/" + id : ""),
                send(
                  id ? "PATCH" : "POST",
                  id ? { ...data, expected_version: v.expected_version } : data,
                ),
              );
              if (!id) router.push("/admin/inventory/" + r.id);
              else {
                await load();
                toast("Details saved. Listing needs approval again.");
              }
            }}
          />
        )}
      </div>
      {v?.submission_id && (
        <p className="notice info">
          Price and specification changes also appear in the seller's account.
          Changing between passenger and commercial cabs requires another
          seller-document review before inventory approval.
          {user?.permissions.includes("reviews") && (
            <>
              {" "}
              <Link
                className="text-link"
                href={`/admin/submissions/${v.submission_id}`}
              >
                Open seller review
              </Link>
            </>
          )}
        </p>
      )}
      {v && (
        <>
          <div className="panel">
            <h2>Listing images</h2>
            <p className="subtle">
              Up to 20 photos, 10 MB each. Upload vehicle photos only. Never put
              seller documents here.
            </p>
            {v.status !== "draft" && (
              <p className="notice info">
                Move the listing to draft before changing photos. Photo changes
                require fresh approval.
              </p>
            )}
            <fieldset
              disabled={v.status !== "draft" || busy}
              style={{ border: 0, padding: 0, minWidth: 0 }}
            >
              <div className="uploads-grid">
                {v.images.map((i: any, index: number) => (
                  <div key={i.id} className="upload-photo">
                    <img
                      src={i.url}
                      alt={photoAlt(
                        i.alt_text,
                        { ...v, ...v.data },
                        index,
                        v.images.length,
                      )}
                    />
                    <label className="field">
                      <span>Alternative text</span>
                      <input
                        defaultValue={
                          isAutomaticAlt(i.alt_text, { ...v, ...v.data })
                            ? ""
                            : i.alt_text
                        }
                        placeholder={`Automatic: ${photoAlt("", { ...v, ...v.data }, index, v.images.length)}`}
                        title="Leave blank to describe this photo automatically from the vehicle details."
                        maxLength={200}
                        onBlur={async (e) => {
                          const value = e.target.value.trim();
                          if (
                            value ===
                            (isAutomaticAlt(i.alt_text, { ...v, ...v.data })
                              ? ""
                              : i.alt_text)
                          )
                            return;
                          try {
                            await api(
                              `/admin/vehicles/${v.id}/images/${i.id}`,
                              send("PATCH", {
                                alt_text: value,
                                sort_order: i.sort_order,
                              }),
                            );
                            await load();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>Photo order</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        defaultValue={i.sort_order}
                        onBlur={async (e) => {
                          if (Number(e.target.value) === i.sort_order) return;
                          try {
                            await api(
                              `/admin/vehicles/${v.id}/images/${i.id}`,
                              send("PATCH", {
                                alt_text: i.alt_text,
                                sort_order: Number(e.target.value),
                              }),
                            );
                            await load();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      />
                    </label>
                    <button
                      onClick={async () => {
                        try {
                          await api(
                            `/admin/vehicles/${v.id}/images/${i.id}`,
                            send("DELETE"),
                          );
                          await load();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Remove image
                    </button>
                  </div>
                ))}
              </div>
              <Field label="Upload photo">
                <input
                  type="file"
                  className="file-upload-input"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setBusy(true);
                    try {
                      const form = new FormData();
                      form.set("file", f);
                      await api(`/admin/vehicles/${v.id}/images`, {
                        method: "POST",
                        body: form,
                      });
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                    e.target.value = "";
                  }}
                />
              </Field>
            </fieldset>
          </div>
          <div className="panel">
            <h2>Approval & publication</h2>
            <p className="subtle">
              Approval and publication are separate actions. Only approved
              vehicles with photos can be published.
            </p>
            <p style={{ marginTop: 15, marginBottom: 20 }}>
              <Status value={v.approved ? "approved" : "approval required"} />
            </p>
            {!v.approved && user?.permissions.includes("reviews") && (
              <button
                className="btn outline"
                disabled={busy}
                onClick={() =>
                  act(`/admin/vehicles/${v.id}/approve`, {
                    expected_version: v.expected_version,
                  })
                }
              >
                Approve vehicle for publication
              </button>
            )}
            <form
              style={{ marginTop: 20 }}
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                act(`/admin/vehicles/${v.id}/status`, data);
              }}
            >
              <Field label="Change status">
                <select name="status" required defaultValue="">
                  <option value="" disabled>
                    Select next status
                  </option>
                  {(
                    {
                      draft: ["published", "archived"],
                      published: ["draft", "reserved", "sold", "archived"],
                      reserved: ["draft", "published", "sold", "archived"],
                      sold: ["archived"],
                      archived: ["draft"],
                    } as Record<string, string[]>
                  )[v.status].map((s) => (
                    <option key={s} value={s}>
                      {s === "draft" ? "Unpublish / draft" : label(s)}
                    </option>
                  ))}
                </select>
              </Field>
              <SubmitButton busy={busy}>Update listing status</SubmitButton>
            </form>
            {v.status === "published" && (
              <Link
                href={`/vehicles/${v.id}/${v.slug}`}
                className="text-link"
                style={{ marginTop: 25 }}
              >
                View public listing ↗
              </Link>
            )}
          </div>
        </>
      )}
    </>
  );
}
