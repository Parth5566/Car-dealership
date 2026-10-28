"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, send } from "@/lib/api";
import type { InventoryReview, PublicationCandidate, Paged } from "@/lib/types";
import { money, label, fuelEconomy } from "@/lib/types";
import { Empty, ErrorBox, Notice } from "./ui";
import { AdminPagination } from "./admin-inventory";
import { useAuth } from "./providers";

export function InventoryWorkQueue({
  publishing = false,
}: {
  publishing?: boolean;
}) {
  const { user } = useAuth();
  const params = useSearchParams();
  const [data, setData] = useState<Paged<
    InventoryReview | PublicationCandidate
  > | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const endpoint = publishing ? "/publishing" : "/inventory-reviews";
  const scope = "/admin" + endpoint + "?" + params;
  const currentScope = useRef("");
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (currentScope.current !== scope) return false;
    const request = ++generation.current;
    try {
      const result =
        await api<Paged<InventoryReview | PublicationCandidate>>(scope);
      if (currentScope.current !== scope || request !== generation.current)
        return false;
      setData(result);
      return true;
    } catch (error) {
      if (currentScope.current === scope && request === generation.current)
        throw error;
      return false;
    }
  }, [scope]);
  useEffect(() => {
    currentScope.current = scope;
    setData(null);
    setError("");
    setMessage("");
    load().catch((e) => setError(e.message));
    return () => {
      currentScope.current = "";
      ++generation.current;
    };
  }, [load, scope]);
  async function act(item: InventoryReview | PublicationCandidate) {
    const id = item.id;
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await api(
        publishing
          ? `/admin/submissions/${id}/publish`
          : `/admin/vehicles/${id}/approve`,
        send(
          "POST",
          publishing
            ? {}
            : { expected_version: (item as InventoryReview).expected_version },
        ),
      );
      if (!(await load())) return;
      setMessage(
        publishing
          ? "Vehicle published."
          : "Inventory approved. Publication remains a separate staff action.",
      );
    } catch (e) {
      if (currentScope.current === scope) setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{publishing ? "Ready to publish." : "Inventory approvals."}</h1>
          <p>
            {publishing
              ? "Review the vehicle details and photos before making an approved submission public."
              : "Inspect draft specifications and photos before approving inventory. Approval keeps the listing private."}
          </p>
        </div>
      </div>
      <form className="toolbar">
        <input
          name="q"
          aria-label="Search vehicles"
          placeholder="Brand or model"
          defaultValue={params.get("q") || ""}
        />
        <button className="btn primary small">Search</button>
        <Link href={"/admin" + endpoint}>Reset</Link>
      </form>
      {error && <ErrorBox message={error} />}
      {message && <Notice message={message} />}
      {!data ? (
        !error && <div className="skeleton tall" />
      ) : (
        <>
          {!data.items.length && (
            <Empty
              title="No vehicles in this queue."
              href="/admin"
              action="Back to overview"
            >
              Vehicles will appear here when ready for this step.
            </Empty>
          )}
          {data.items.map((item) => (
            <article className="panel" key={item.id}>
              <h2>
                {item.data.year} {item.data.make} {item.data.model} · #{item.id}
              </h2>
              <p>
                {money(item.data.price)} · {label(item.data.type)} ·{" "}
                {item.data.location}
              </p>
              <div className="uploads-grid">
                {item.images.map((image) => (
                  <div key={image.id} className="upload-photo">
                    <img
                      src={image.url + "?size=thumb"}
                      alt={image.alt_text?.trim() || "Vehicle photo"}
                    />
                  </div>
                ))}
              </div>
              <details>
                <summary>Inspect all vehicle details</summary>
                <dl className="detail-specs">
                  {Object.entries(item.data).map(([key, value]) => (
                    <div key={key}>
                      <dt>{label(key)}</dt>
                      <dd className="break-text">
                        {key === "fuel_economy"
                          ? fuelEconomy(item.data) || "Not provided"
                          : Array.isArray(value)
                            ? value.join(", ") || "Not supplied"
                            : value == null || value === ""
                              ? "Not supplied"
                              : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
              {"vehicle_id" in item &&
                item.vehicle_id &&
                !item.inventory_approved && (
                  <Notice message="This listing was edited and needs fresh inventory approval before publication." />
                )}
              {!item.images.length && (
                <Notice message="A vehicle photo is required before approval or publication." />
              )}
              <button
                className="btn primary"
                disabled={
                  busy !== null ||
                  !item.images.length ||
                  ("vehicle_id" in item &&
                    !!item.vehicle_id &&
                    !item.inventory_approved)
                }
                onClick={() => act(item)}
              >
                {busy === item.id
                  ? "Saving…"
                  : publishing
                    ? "Publish approved vehicle"
                    : "Approve inventory"}
              </button>
              {user?.permissions.includes("inventory") &&
                (!publishing ||
                  ("vehicle_id" in item && item.vehicle_id) ||
                  user.permissions.includes("reviews")) && (
                  <Link
                    className="text-link"
                    style={{ marginLeft: 18 }}
                    href={
                      publishing
                        ? "vehicle_id" in item && item.vehicle_id
                          ? `/admin/inventory/${item.vehicle_id}`
                          : `/admin/submissions/${item.id}`
                        : `/admin/inventory/${item.id}`
                    }
                  >
                    {publishing && !("vehicle_id" in item && item.vehicle_id)
                      ? "Open seller review"
                      : "Edit vehicle details"}
                  </Link>
                )}
            </article>
          ))}
          <AdminPagination total={data.total} page={data.page} />
        </>
      )}
    </>
  );
}
