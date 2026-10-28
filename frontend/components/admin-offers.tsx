"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgePercent,
  CalendarDays,
  Check,
  Copy,
  Eye,
  Gift,
  LoaderCircle,
  Monitor,
  Palette,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  CarFront,
  X,
} from "lucide-react";
import { api, send } from "@/lib/api";
import {
  emptyOffer,
  offerDate,
  offerState,
  type AdminOffer,
  type OfferContent,
} from "@/lib/offers";
import { localDateTime } from "@/lib/datetime";
import { useAuth } from "./providers";
import { Field, Notice } from "./ui";
import { OfferCard } from "./offer-card";

type Collection = {
  items: AdminOffer[];
  total: number;
  pages: number;
  stats: Record<string, number>;
};
const filters = [
  ["all", "All offers"],
  ["active", "Live"],
  ["draft", "Drafts"],
  ["scheduled", "Scheduled"],
  ["expired", "Expired"],
];
const themes = [
  ["gold", "Champagne"],
  ["midnight", "Midnight"],
  ["emerald", "Evergreen"],
  ["rose", "Rose"],
] as const;
const patterns = [
  ["glow", "Soft glow"],
  ["rings", "Orbit rings"],
  ["grid", "Fine grid"],
  ["plain", "Minimal"],
] as const;
const icons = [
  ["gift", "Gift", Gift],
  ["sparkles", "Sparkles", Sparkles],
  ["badge", "Discount", BadgePercent],
  ["truck", "Commercial", CarFront],
] as const;
const templates: {
  name: string;
  icon: typeof Gift;
  content: Partial<OfferContent>;
}[] = [
  {
    name: "First car",
    icon: Gift,
    content: {
      title: "Your first car. A fresh start.",
      benefit: "₹10,000 off",
      description: "A little extra help for your first set of wheels.",
      eligibility:
        "Selected passenger cars. Confirm eligible vehicles with our team.",
      badge: "FIRST CAR SPECIAL",
      theme: "gold",
      icon: "gift",
    },
  },
  {
    name: "Seasonal special",
    icon: Sparkles,
    content: {
      title: "A new season. A better drive.",
      benefit: "Up to ₹25,000 off",
      description:
        "Make room for new adventures with a limited-time showroom offer.",
      eligibility: "Selected vehicles only. Savings vary by vehicle.",
      badge: "SEASONAL SPECIAL",
      theme: "midnight",
      pattern: "rings",
      icon: "sparkles",
      featured: true,
    },
  },
  {
    name: "Business boost",
    icon: CarFront,
    content: {
      title: "Give your business a head start.",
      benefit: "₹15,000 off",
      description:
        "Get your next business vehicle working harder for your budget.",
      eligibility: "Selected commercial cabs. Ask our team for eligible stock.",
      badge: "BUSINESS BOOST",
      theme: "emerald",
      pattern: "grid",
      icon: "truck",
      cta_href: "/commercial",
      cta_label: "Explore commercial cabs",
    },
  },
];
function contentOf(offer: AdminOffer): OfferContent {
  return Object.fromEntries(
    Object.keys(emptyOffer).map((key) => [
      key,
      offer[key as keyof OfferContent],
    ]),
  ) as OfferContent;
}
function newContent(): OfferContent {
  return {
    ...emptyOffer,
    starts_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
}

export function AdminOffers() {
  const { user } = useAuth();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [editor, setEditor] = useState<AdminOffer | "new" | null>(null);
  const [draft, setDraft] = useState<OfferContent>(emptyOffer);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState("content");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [removing, setRemoving] = useState<AdminOffer | null>(null);
  const editorRef = useRef<HTMLElement>(null);
  const operation = useRef(false);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setListError("");
    api<Collection>(
      `/admin/offers?${new URLSearchParams({ q: query, status: filter, page: String(page) })}`,
    )
      .then((data) => {
        if (current) setCollection(data);
      })
      .catch((e) => {
        if (current) {
          setCollection(null);
          setListError(e.message);
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [query, filter, page, revision]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  function change<K extends keyof OfferContent>(
    key: K,
    value: OfferContent[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setError("");
  }
  function canLeave() {
    return !dirty || window.confirm("Discard your unsaved offer changes?");
  }
  function open(offer?: AdminOffer, duplicate = false) {
    if (busy || !canLeave()) return;
    setEditor(duplicate || !offer ? "new" : offer);
    setDraft(
      offer
        ? {
            ...contentOf(offer),
            ...(duplicate
              ? {
                  title: `${offer.title.slice(0, 93)} (copy)`,
                  starts_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
                }
              : {}),
          }
        : newContent(),
    );
    setDirty(duplicate);
    setError("");
    setMessage("");
    setTab("content");
    requestAnimationFrame(() =>
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  function close() {
    if (!busy && canLeave()) {
      setEditor(null);
      setDirty(false);
      setError("");
    }
  }
  async function save(status: "draft" | "published") {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const existing = editor && editor !== "new" ? editor : null;
      const result = await api<AdminOffer>(
        existing ? `/admin/offers/${existing.id}` : "/admin/offers",
        send(existing ? "PUT" : "POST", {
          ...draft,
          status,
          ...(existing ? { version: existing.version } : {}),
        }),
      );
      setEditor(result);
      setDraft(contentOf(result));
      setDirty(false);
      setMessage(
        status === "draft"
          ? "Draft saved. Customers cannot see it."
          : offerState(result) === "scheduled"
            ? "Offer scheduled. It will appear at its start time."
            : "Offer published. It is now on the Discounts page.",
      );
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function toggle(offer: AdminOffer) {
    if (
      operation.current ||
      (editor !== null &&
        editor !== "new" &&
        editor.id === offer.id &&
        !canLeave())
    )
      return;
    operation.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<AdminOffer>(
        `/admin/offers/${offer.id}/status`,
        send("PATCH", {
          version: offer.version,
          status: offer.status === "draft" ? "published" : "draft",
        }),
      );
      if (editor !== null && editor !== "new" && editor.id === offer.id) {
        setEditor(result);
        setDraft(contentOf(result));
        setDirty(false);
      }
      setMessage(
        result.status === "draft"
          ? "Offer unpublished and kept as a draft."
          : offerState(result) === "scheduled"
            ? "Offer scheduled."
            : "Offer published.",
      );
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (!removing || operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(
        `/admin/offers/${removing.id}`,
        send("DELETE", { version: removing.version }),
      );
      if (editor !== null && editor !== "new" && editor.id === removing.id) {
        setEditor(null);
        setDirty(false);
      }
      setRemoving(null);
      setMessage("Offer removed.");
      if (collection?.items.length === 1 && page > 1) setPage((v) => v - 1);
      else setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function reloadEditor() {
    if (!editor || editor === "new" || operation.current || !canLeave()) return;
    operation.current = true;
    setBusy(true);
    try {
      const result = await api<AdminOffer>(`/admin/offers/${editor.id}`);
      setEditor(result);
      setDraft(contentOf(result));
      setDirty(false);
      setError("");
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  if (user && !user.permissions.includes("settings"))
    return (
      <Notice error message="You do not have permission to manage offers." />
    );
  const currentStatus = editor && editor !== "new" ? editor.status : "draft";
  const state = editor && editor !== "new" ? offerState(editor) : "draft";
  return (
    <div className="offer-studio">
      <div className="admin-heading">
        <div>
          <span className="studio-eyebrow">
            <BadgePercent size={16} /> SHOWROOM CAMPAIGNS
          </span>
          <h1>Discounts & offers.</h1>
          <p>A great deal deserves a great first impression.</p>
        </div>
        <div className="studio-actions">
          <Link
            href="/discounts"
            target="_blank"
            rel="noreferrer"
            className="btn outline"
          >
            <Eye size={16} /> View public page
          </Link>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => open()}
          >
            <Plus size={17} /> Create offer
          </button>
        </div>
      </div>
      <div className="studio-stats" aria-label="Offer overview">
        {[
          ["active", "Live now"],
          ["scheduled", "Scheduled"],
          ["draft", "Drafts"],
          ["expired", "Expired"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setFilter(key);
              setPage(1);
            }}
            className={filter === key ? "selected" : ""}
          >
            <span className={`studio-dot dot-${key}`} />
            <span>{label}</span>
            <strong>{collection?.stats[key] ?? "—"}</strong>
          </button>
        ))}
      </div>
      {message && <Notice message={message} />}
      {error && (
        <div>
          <Notice error message={error} />
          {editor && editor !== "new" && (
            <button
              className="text-link"
              disabled={busy}
              onClick={reloadEditor}
            >
              Reload saved version
            </button>
          )}
        </div>
      )}
      <section className="studio-library" aria-label="Your offers">
        <div className="studio-toolbar">
          <div className="studio-filters" aria-label="Filter offers">
            {filters.map(([key, label]) => (
              <button
                key={key}
                aria-pressed={filter === key}
                className={filter === key ? "selected" : ""}
                onClick={() => {
                  setFilter(key);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="studio-search">
            <Search size={17} />
            <input
              aria-label="Search offers"
              placeholder="Search offers"
              value={query}
              maxLength={100}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        {listError && (
          <>
            <Notice error message={listError} />
            <button
              className="btn outline"
              onClick={() => setRevision((v) => v + 1)}
            >
              Retry loading offers
            </button>
          </>
        )}
        {loading ? (
          <p className="studio-loading" role="status">
            <LoaderCircle className="spin" size={18} /> Loading offers…
          </p>
        ) : collection && !collection.items.length ? (
          <div className="studio-empty">
            <Gift size={34} />
            <h2>
              {query || filter !== "all"
                ? "No matching offers"
                : "Your next campaign starts here."}
            </h2>
            <p>
              {query || filter !== "all"
                ? "Try another search or filter."
                : "Start with a template, make it yours, and publish when you’re ready."}
            </p>
            <button
              className="btn primary"
              onClick={() => open()}
              disabled={busy}
            >
              <Plus size={16} /> Create an offer
            </button>
          </div>
        ) : (
          <div className="studio-offer-list">
            {collection?.items.map((offer) => (
              <article className="studio-offer-row" key={offer.id}>
                <div
                  className={`studio-mini deal-${offer.theme}`}
                  aria-hidden="true"
                >
                  <BadgePercent size={24} />
                </div>
                <div className="studio-row-text">
                  <div className="studio-row-title">
                    <h3>{offer.title || "Untitled offer"}</h3>
                    {offer.featured && <Star size={14} aria-label="Featured" />}
                    <span
                      className={`studio-status state-${offerState(offer)}`}
                    >
                      {offerState(offer) === "active"
                        ? "Live"
                        : offerState(offer)}
                    </span>
                  </div>
                  <p>
                    {offer.benefit || "No benefit added"}
                    {offer.expires_at && (
                      <>
                        {" "}
                        ·{" "}
                        {offerState(offer) === "scheduled" && offer.starts_at
                          ? `Starts ${offerDate(offer.starts_at)}`
                          : `Ends ${offerDate(offer.expires_at)}`}{" "}
                        IST
                      </>
                    )}
                  </p>
                </div>
                <div className="studio-row-actions">
                  <button
                    disabled={busy}
                    onClick={() => open(offer)}
                    aria-label={`Edit ${offer.title || "untitled offer"}`}
                    title="Edit offer"
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => open(offer, true)}
                    aria-label={`Duplicate ${offer.title || "untitled offer"}`}
                    title="Duplicate as draft"
                  >
                    <Copy size={17} />
                  </button>
                  <button
                    className="studio-publish-toggle"
                    disabled={busy}
                    onClick={() => toggle(offer)}
                  >
                    {offer.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    disabled={busy}
                    className="studio-delete"
                    onClick={() => setRemoving(offer)}
                    aria-label={`Remove ${offer.title || "untitled offer"}`}
                    title="Remove offer"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {collection && collection.pages > 1 && (
          <div className="studio-pagination">
            <button
              className="btn outline"
              disabled={loading || page === 1}
              onClick={() => setPage((v) => v - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {collection.pages}
            </span>
            <button
              className="btn outline"
              disabled={loading || page >= collection.pages}
              onClick={() => setPage((v) => v + 1)}
            >
              Next
            </button>
          </div>
        )}
      </section>
      {removing && (
        <div className="studio-remove" role="alert">
          <div>
            <strong>Remove “{removing.title || "Untitled offer"}”?</strong>
            <p>
              This permanently removes the offer and takes it off the public
              page.
            </p>
          </div>
          <button
            className="btn studio-danger"
            disabled={busy}
            onClick={remove}
          >
            Remove permanently
          </button>
          <button
            className="btn outline"
            disabled={busy}
            onClick={() => setRemoving(null)}
          >
            Keep offer
          </button>
        </div>
      )}
      {editor && (
        <section
          className="studio-editor"
          ref={editorRef}
          aria-labelledby="offer-editor-heading"
        >
          <div className="studio-editor-heading">
            <div>
              <span className="studio-eyebrow">THE OFFER STUDIO</span>
              <h2 id="offer-editor-heading">
                {editor === "new"
                  ? "Create something worth sharing."
                  : "Make your offer shine."}
              </h2>
              <p>
                <span className={`studio-status state-${state}`}>
                  {state === "active" ? "Live" : state}
                </span>{" "}
                {dirty
                  ? "Unsaved changes"
                  : editor === "new"
                    ? "Only published offers are visible to customers."
                    : "All changes saved"}
              </p>
            </div>
            <button
              className="studio-icon-button"
              onClick={close}
              disabled={busy}
              aria-label="Close offer editor"
            >
              <X size={21} />
            </button>
          </div>
          <div className="studio-workspace">
            <form
              id="offer-editor"
              onSubmit={(e) => {
                e.preventDefault();
                save(currentStatus);
              }}
            >
              <fieldset disabled={busy} className="studio-fields">
                <legend className="sr-only">Offer settings</legend>
                <div className="studio-tabs" aria-label="Editor sections">
                  {[
                    ["content", "The details", Pencil],
                    ["design", "Look & feel", Palette],
                    ["schedule", "Timing & rules", CalendarDays],
                  ].map(([key, label, Icon]: any) => (
                    <button
                      type="button"
                      key={key}
                      aria-pressed={tab === key}
                      className={tab === key ? "selected" : ""}
                      onClick={() => setTab(key)}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ))}
                </div>
                <div hidden={tab !== "content"} className="studio-tab-panel">
                  <div className="studio-template-box">
                    <span className="studio-field-label">
                      A little inspiration
                    </span>
                    <div className="studio-templates">
                      {templates.map((t) => (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() => {
                            if (
                              (draft.title || draft.benefit) &&
                              !window.confirm(
                                "Replace the current content and design with this starter? Dates and terms are kept.",
                              )
                            )
                              return;
                            setDraft((v) => ({ ...v, ...t.content }));
                            setDirty(true);
                          }}
                        >
                          <t.icon size={16} />
                          {t.name}
                        </button>
                      ))}
                    </div>
                    <small>
                      Starter wording and amounts are editable. Confirm them
                      before publishing.
                    </small>
                  </div>
                  <Field label="Offer headline">
                    <input
                      value={draft.title}
                      maxLength={100}
                      placeholder="e.g. Festive offer"
                      onChange={(e) => change("title", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="The saving or benefit"
                    hint="For example: ₹15,000 off, free insurance, or a service package."
                  >
                    <input
                      value={draft.benefit}
                      maxLength={60}
                      placeholder="₹15,000 off"
                      onChange={(e) => change("benefit", e.target.value)}
                    />
                  </Field>
                  <Field label="Short description">
                    <textarea
                      value={draft.description}
                      maxLength={600}
                      rows={3}
                      placeholder="A short description"
                      onChange={(e) => change("description", e.target.value)}
                    />
                  </Field>
                  <Field label="Who or what is eligible?">
                    <textarea
                      value={draft.eligibility}
                      maxLength={500}
                      rows={2}
                      placeholder="e.g. Selected cars"
                      onChange={(e) => change("eligibility", e.target.value)}
                    />
                  </Field>
                  <div className="studio-two-fields">
                    <Field label="Button text">
                      <input
                        value={draft.cta_label}
                        maxLength={40}
                        onChange={(e) => change("cta_label", e.target.value)}
                      />
                    </Field>
                    <Field label="Button destination">
                      <select
                        value={draft.cta_href}
                        onChange={(e) =>
                          change(
                            "cta_href",
                            e.target.value as OfferContent["cta_href"],
                          )
                        }
                      >
                        <option value="/contact">Contact showroom</option>
                        <option value="/cars">Passenger cars</option>
                        <option value="/commercial">Commercial cabs</option>
                      </select>
                    </Field>
                  </div>
                </div>
                <div hidden={tab !== "design"} className="studio-tab-panel">
                  <div>
                    <span className="studio-field-label">Color story</span>
                    <div className="studio-theme-options">
                      {themes.map(([key, label]) => (
                        <button
                          type="button"
                          key={key}
                          aria-pressed={draft.theme === key}
                          className={`studio-theme deal-${key}${draft.theme === key ? " selected" : ""}`}
                          onClick={() => change("theme", key)}
                        >
                          <span>
                            {draft.theme === key ? (
                              <Check size={18} />
                            ) : (
                              <Palette size={18} />
                            )}
                          </span>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="studio-field-label">
                      Background detail
                    </span>
                    <div className="studio-pattern-options">
                      {patterns.map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={draft.pattern === key}
                          className={draft.pattern === key ? "selected" : ""}
                          onClick={() => change("pattern", key)}
                        >
                          <span
                            className={`studio-pattern-sample deal-pattern-${key}`}
                          />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="studio-field-label">Signature icon</span>
                    <div className="studio-icon-options">
                      {icons.map(([key, label, Icon]) => (
                        <button
                          type="button"
                          key={key}
                          aria-pressed={draft.icon === key}
                          className={draft.icon === key ? "selected" : ""}
                          onClick={() => change("icon", key)}
                        >
                          <Icon size={21} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field label="Badge text">
                    <input
                      value={draft.badge}
                      maxLength={32}
                      placeholder="LIMITED TIME"
                      onChange={(e) => change("badge", e.target.value)}
                    />
                  </Field>
                  <label className="studio-featured">
                    <input
                      type="checkbox"
                      checked={draft.featured}
                      onChange={(e) => change("featured", e.target.checked)}
                    />
                    <span>
                      <strong>
                        <Star size={16} /> Make it a showroom pick
                      </strong>
                      <small>
                        Adds a featured badge and places this offer before other
                        offers.
                      </small>
                    </span>
                  </label>
                </div>
                <div hidden={tab !== "schedule"} className="studio-tab-panel">
                  <div className="studio-tip">
                    <CalendarDays size={20} />
                    <p>
                      Publish now or set a future start. Offers disappear
                      automatically at their expiry time. Times below use your
                      device’s timezone.
                    </p>
                  </div>
                  <Field label="Starts at">
                    <input
                      type="datetime-local"
                      value={
                        draft.starts_at ? localDateTime(draft.starts_at) : ""
                      }
                      onChange={(e) =>
                        change(
                          "starts_at",
                          e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        )
                      }
                    />
                  </Field>
                  <Field label="Ends at">
                    <input
                      type="datetime-local"
                      value={
                        draft.expires_at ? localDateTime(draft.expires_at) : ""
                      }
                      onChange={(e) =>
                        change(
                          "expires_at",
                          e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        )
                      }
                    />
                  </Field>
                  <div className="studio-duration">
                    {[7, 14, 30].map((days) => (
                      <button
                        type="button"
                        key={days}
                        onClick={() => {
                          const start = draft.starts_at
                            ? Date.parse(draft.starts_at)
                            : Date.now();
                          setDraft((v) => ({
                            ...v,
                            starts_at:
                              v.starts_at || new Date(start).toISOString(),
                            expires_at: new Date(
                              start + days * 86400000,
                            ).toISOString(),
                          }));
                          setDirty(true);
                        }}
                      >
                        {days} days
                      </button>
                    ))}
                  </div>
                  <Field label="Offer terms">
                    <textarea
                      rows={5}
                      value={draft.terms}
                      maxLength={3000}
                      placeholder="Offer conditions"
                      onChange={(e) => change("terms", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Reference code (optional)"
                    hint="Customers can mention this code to staff. It does not change vehicle prices automatically."
                  >
                    <input
                      value={draft.coupon_code}
                      maxLength={24}
                      pattern={"[A-Za-z0-9_\\-]*"}
                      placeholder="DRIVE2026"
                      onChange={(e) =>
                        change("coupon_code", e.target.value.toUpperCase())
                      }
                    />
                  </Field>
                  <Field
                    label="Display order"
                    hint="Lower numbers appear first within the same featured group."
                  >
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      value={draft.sort_order}
                      onChange={(e) =>
                        change("sort_order", Number(e.target.value))
                      }
                    />
                  </Field>
                </div>
              </fieldset>
              <div className="studio-save-bar">
                <span>
                  {dirty ? "● Unsaved changes" : "Ready when you are"}
                </span>
                <div>
                  <button type="submit" disabled={busy} className="btn outline">
                    <Save size={16} />
                    {currentStatus === "published"
                      ? "Save changes"
                      : "Save draft"}
                  </button>
                  {currentStatus === "draft" && (
                    <button
                      type="button"
                      disabled={busy}
                      className="btn primary"
                      onClick={() => save("published")}
                    >
                      {busy ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <Send size={16} />
                      )}{" "}
                      Publish offer
                    </button>
                  )}
                  {currentStatus === "published" && editor !== "new" && (
                    <button
                      type="button"
                      disabled={busy}
                      className="btn outline"
                      onClick={() => toggle(editor)}
                    >
                      Unpublish
                    </button>
                  )}
                </div>
              </div>
            </form>
            <aside className="studio-preview" aria-label="Live offer preview">
              <div className="studio-preview-heading">
                <span>
                  <span className="studio-dot dot-active" /> LIVE PREVIEW
                </span>
                <div>
                  <button
                    type="button"
                    aria-label="Wide preview"
                    aria-pressed={!mobilePreview}
                    onClick={() => setMobilePreview(false)}
                  >
                    <Monitor size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label="Narrow preview"
                    aria-pressed={mobilePreview}
                    onClick={() => setMobilePreview(true)}
                  >
                    <Smartphone size={18} />
                  </button>
                </div>
              </div>
              <div
                className={`studio-preview-stage${mobilePreview ? " narrow" : ""}`}
              >
                <OfferCard offer={draft} preview />
              </div>
              <p className="studio-preview-caption">
                <Eye size={14} /> This is how your offer will look on the
                Discounts page.
              </p>
              <Link
                href="/discounts"
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                Open public page <ArrowUpRight size={15} />
              </Link>
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}
