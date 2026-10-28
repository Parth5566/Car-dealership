"use client";
import {
  ReactNode,
  useState,
  useEffect,
  useId,
  isValidElement,
  cloneElement,
  Children,
} from "react";
import Link from "next/link";
import {
  CarFront,
  Heart,
  ArrowUpRight,
  GitCompareArrows,
  Fuel,
  Gauge,
  MapPin,
  Check,
  LoaderCircle,
} from "lucide-react";
import { api, send } from "@/lib/api";
import { Vehicle, money } from "@/lib/types";
import { photoAlt } from "@/lib/photo-alt";
import { useAuth, useToast, useSaved } from "./providers";
import { useComparison } from "./comparison-provider";
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  function associate(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (child) => {
      if (
        !isValidElement<{
          children?: ReactNode;
          "aria-label"?: string;
          "aria-labelledby"?: string;
          "aria-describedby"?: string;
        }>(child)
      )
        return child;
      // Label the actual control, including inputs inside a password wrapper.
      // Naming the wrapper too creates two matches for one field.
      if (["input", "select", "textarea"].includes(String(child.type)))
        return cloneElement(child, {
          "aria-labelledby":
            child.props["aria-labelledby"] ||
            (child.props["aria-label"] ? undefined : labelId),
          "aria-describedby":
            [child.props["aria-describedby"], hint && hintId]
              .filter(Boolean)
              .join(" ") || undefined,
        });
      return child.props.children
        ? cloneElement(child, { children: associate(child.props.children) })
        : child;
    });
  }
  const control = associate(children);
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {control}
      {hint && <small id={hintId}>{hint}</small>}
    </label>
  );
}
export function Notice({
  error,
  message,
}: {
  error?: boolean;
  message: string;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={"notice " + (error ? "error" : "success")}
    >
      {message}
    </div>
  );
}
export function SubmitButton({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button className="btn primary" disabled={busy} type="submit">
      {busy ? (
        <>
          <LoaderCircle className="spin" size={17} /> Please wait
        </>
      ) : (
        children
      )}
    </button>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={"status status-" + value}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
export function Empty({
  title,
  children,
  action,
  href,
}: {
  title: string;
  children: ReactNode;
  action?: string;
  href?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <CarFront size={32} />
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
      {href && (
        <Link className="btn primary" href={href}>
          {action}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function SaveButton({
  id,
  initial = false,
  onRemove,
}: {
  id: number;
  initial?: boolean;
  onRemove?: () => void;
}) {
  const { user } = useAuth(),
    toast = useToast();
  const shared = useSaved();
  const [saved, setSaved] = useState(initial),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (shared.loaded) setSaved(shared.ids.includes(id));
  }, [shared.ids, shared.loaded, id]);
  async function save() {
    if (!user) {
      location.href = "/login?next=" + encodeURIComponent(location.pathname);
      return;
    }
    setBusy(true);
    try {
      await api("/account/favourites/" + id, send(saved ? "DELETE" : "PUT"));
      setSaved(!saved);
      shared.update(id, !saved);
      toast(
        saved ? "Removed from saved vehicles" : "Vehicle saved to your account",
      );
      if (saved) onRemove?.();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      className={"save-button icon-button " + (saved ? "is-saved" : "")}
      aria-label={saved ? "Remove saved vehicle" : "Save vehicle"}
      aria-pressed={saved}
      onClick={save}
      disabled={busy}
    >
      <Heart size={19} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
export function CompareButton({ id }: { id: number }) {
  const toast = useToast();
  const { ids, toggle, ready } = useComparison();
  const selected = ids.includes(id);
  return (
    <button
      className={"compare-choice " + (selected ? "selected" : "")}
      aria-pressed={selected}
      disabled={!ready}
      onClick={() => toast(toggle(id))}
    >
      {selected ? <Check size={18} /> : <GitCompareArrows size={18} />}{" "}
      {selected ? "Selected" : "Compare"}
    </button>
  );
}
export function VehicleCard({
  vehicle,
  saved = false,
  onRemove,
}: {
  vehicle: Vehicle;
  saved?: boolean;
  onRemove?: () => void;
}) {
  return (
    <article className="vehicle-card">
      <div className="vehicle-image">
        {vehicle.images[0] ? (
          <Link href={`/vehicles/${vehicle.id}/${vehicle.slug}`}>
            <img
              loading="lazy"
              src={vehicle.images[0].url + "?size=thumb"}
              alt={photoAlt(vehicle.images[0].alt_text, vehicle)}
              width={600}
              height={400}
            />
          </Link>
        ) : (
          <div className="no-image">
            <CarFront size={54} />
            <span>Photo not available</span>
          </div>
        )}
        <span className="image-badge">
          {vehicle.is_sample ? (
            "SAMPLE ONLY · Not for sale"
          ) : (
            <>
              {vehicle.featured ? "Featured · " : ""}
              {vehicle.type === "commercial" ? "Commercial" : vehicle.body_type}
            </>
          )}
        </span>
        <SaveButton id={vehicle.id} initial={saved} onRemove={onRemove} />
      </div>
      <div className="vehicle-info">
        <div className="vehicle-meta">
          {vehicle.year} <span>•</span>{" "}
          {vehicle.variant || vehicle.transmission}
          {vehicle.status === "reserved" && <Status value="reserved" />}
        </div>
        <Link
          className="vehicle-title"
          href={`/vehicles/${vehicle.id}/${vehicle.slug}`}
        >
          {vehicle.make} {vehicle.model}
        </Link>
        <div className="spec-line">
          <span>
            <Gauge size={14} />
            {vehicle.mileage.toLocaleString("en-IN")} km
          </span>
          <span>
            <Fuel size={14} />
            {vehicle.fuel}
          </span>
          <span>{vehicle.transmission}</span>
        </div>
        <div className="card-price">
          <strong>{money(vehicle.price)}</strong>
          <CompareButton id={vehicle.id} />
        </div>
        <div className="card-bottom">
          <span>
            <MapPin size={13} />
            {vehicle.location}
          </span>
          <Link href={`/vehicles/${vehicle.id}/${vehicle.slug}`}>
            View vehicle <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="notice error">
      <p>{message}</p>
      <button className="text-button" onClick={() => location.reload()}>
        Try again
      </button>
    </div>
  );
}
