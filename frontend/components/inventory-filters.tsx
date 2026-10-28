"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, ChevronDown, Search, X } from "lucide-react";
import { Field } from "./ui";
import { money } from "@/lib/types";

const budgets = [
  ["300000", "₹3 lakh"],
  ["500000", "₹5 lakh"],
  ["800000", "₹8 lakh"],
  ["1200000", "₹12 lakh"],
  ["2000000", "₹20 lakh"],
];
const advancedKeys = [
  "make",
  "min_price",
  "transmission",
  "body_type",
  "min_year",
  "max_mileage",
  "location",
];
const filterLabels: Record<string, string> = {
  q: "Search",
  make: "Vehicle brand",
  min_price: "Budget from",
  max_price: "Budget up to",
  fuel: "Fuel type",
  transmission: "Transmission",
  body_type: "Vehicle style",
  min_year: "Built in or after",
  max_mileage: "Kilometres driven up to",
  location: "City / area",
  featured: "Featured vehicles",
};

export function InventoryFilters({
  type,
  params,
  maxYear,
}: {
  type: "passenger" | "commercial";
  params: Record<string, string | undefined>;
  maxYear: number;
}) {
  const commercial = type === "commercial";
  const base = commercial ? "/commercial" : "/cars";
  const [budget, setBudget] = useState(
    !params.max_price
      ? ""
      : budgets.some(([value]) => value === params.max_price)
        ? params.max_price
        : "custom",
  );
  const [customBudget, setCustomBudget] = useState(params.max_price || "");
  const advancedCount = advancedKeys.filter((key) => params[key]).length;
  const activeFilters = Object.entries(filterLabels).filter(
    ([key]) => params[key] && (key !== "featured" || params[key] === "true"),
  );
  function removeFilter(key: string) {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(params))
      if (value && ![key, "page", "type", "min_payload"].includes(name))
        query.set(name, value);
    const search = query.toString();
    return base + (search ? "?" + search : "");
  }
  function filterText(key: string, label: string) {
    const value = params[key]!;
    if (key === "featured") return label;
    const amount = Number(value);
    const formatted =
      ["min_price", "max_price"].includes(key) && Number.isFinite(amount)
        ? money(amount)
        : value;
    return `${label}: ${formatted}${key === "max_mileage" ? " km" : ""}`;
  }
  const chips = activeFilters.map(([key, label]) => {
    const text = filterText(key, label);
    return (
      <Link
        key={key}
        href={removeFilter(key)}
        className="filter-chip"
        aria-label={"Remove " + text}
      >
        <span>{text}</span>
        <X size={13} aria-hidden="true" />
      </Link>
    );
  });
  // Phones show a slim search/filters bar; the form opens as a bottom sheet.
  // Wider screens ignore the sheet state and keep the sidebar form (see CSS).
  const [sheetOpen, setSheetOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const sheet = useRef<HTMLFormElement>(null);
  const focusSearch = useRef(false);
  function openSheet(button: HTMLButtonElement, search: boolean) {
    opener.current = button;
    focusSearch.current = search;
    setSheetOpen(true);
  }
  useEffect(() => {
    if (!sheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const form = sheet.current;
    (focusSearch.current
      ? form?.querySelector<HTMLElement>('input[name="q"]')
      : form?.querySelector<HTMLElement>(".filter-sheet-close")
    )?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      opener.current?.focus();
    };
  }, [sheetOpen]);
  return (
    <>
      <div className="filter-phone-bar">
        <button
          type="button"
          className="filter-phone-search"
          aria-controls="inventory-filter-form"
          aria-expanded={sheetOpen}
          onClick={(event) => openSheet(event.currentTarget, true)}
        >
          <Search size={18} aria-hidden="true" />
          <span>
            {params.q ||
              (commercial ? "Search commercial cabs" : "Search used cars")}
          </span>
        </button>
        <button
          type="button"
          className="filter-phone-toggle"
          aria-controls="inventory-filter-form"
          aria-expanded={sheetOpen}
          onClick={(event) => openSheet(event.currentTarget, false)}
        >
          <SlidersHorizontal size={18} aria-hidden="true" /> Filters
          {activeFilters.length > 0 && (
            <span className="filter-phone-count">{activeFilters.length}</span>
          )}
        </button>
      </div>
      {chips.length > 0 && (
        <div className="filter-phone-chips" aria-label="Applied filters">
          {chips}
        </div>
      )}
      <div
        className="filter-sheet-backdrop"
        hidden={!sheetOpen}
        onClick={() => setSheetOpen(false)}
      />
      <form
        id="inventory-filter-form"
        action={base}
        method="get"
        ref={sheet}
        className={`filter-sheet${sheetOpen ? " is-open" : ""}`}
      >
        <div className="filters-title">
          <h2 id="vehicle-filters-heading">
            <SlidersHorizontal size={17} aria-hidden="true" /> Find a vehicle
          </h2>
          <Link href={base}>Clear all</Link>
          <button
            type="button"
            className="filter-sheet-close"
            aria-label="Close filters"
            onClick={() => setSheetOpen(false)}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div
          className={`filter-basics${budget === "custom" ? " has-custom" : ""}`}
        >
          <Field label="Search">
            <input
              name="q"
              defaultValue={params.q}
              maxLength={100}
              placeholder={commercial ? "e.g. Dzire" : "e.g. Swift"}
            />
          </Field>
          <div>
            <Field label="Budget up to">
              <select
                aria-label="Maximum budget"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
              >
                <option value="">No limit</option>
                {budgets.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
                <option value="custom">Enter my own budget</option>
              </select>
            </Field>
            {budget === "custom" ? (
              <div className="custom-budget">
                <Field label="Your maximum budget (₹)">
                  <input
                    name="max_price"
                    type="number"
                    min="0"
                    required
                    value={customBudget}
                    placeholder="e.g. 750000"
                    onChange={(event) => setCustomBudget(event.target.value)}
                  />
                </Field>
              </div>
            ) : (
              <input type="hidden" name="max_price" value={budget} />
            )}
          </div>
          <Field label="Fuel type">
            <select
              name="fuel"
              aria-label="Fuel type"
              defaultValue={params.fuel || ""}
            >
              <option value="">Any fuel</option>
              {["Petrol", "Diesel", "CNG", "Electric", "Hybrid"].map((fuel) => (
                <option key={fuel}>{fuel}</option>
              ))}
            </select>
          </Field>
        </div>
        <details className="more-filters" open={advancedCount > 0}>
          <summary>
            <span>
              More filters
              {advancedCount > 0 && (
                <span className="more-filters-count">{advancedCount}</span>
              )}
            </span>
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <div className="filter-extras">
            <Field label="Transmission">
              <select
                name="transmission"
                aria-label="Transmission"
                defaultValue={params.transmission || ""}
              >
                <option value="">Manual or automatic</option>
                <option>Manual</option>
                <option>Automatic</option>
              </select>
            </Field>
            <Field label="Vehicle brand">
              <input
                name="make"
                defaultValue={params.make}
                maxLength={80}
                placeholder="e.g. Tata"
              />
            </Field>
            <Field label="Minimum budget (₹)">
              <input
                name="min_price"
                type="number"
                min="0"
                defaultValue={params.min_price}
                placeholder="No minimum"
              />
            </Field>
            <Field label="Vehicle style">
              <input
                name="body_type"
                defaultValue={params.body_type}
                maxLength={80}
                placeholder={commercial ? "e.g. Sedan" : "e.g. SUV"}
              />
            </Field>
            <Field label="Built in or after">
              <input
                name="min_year"
                type="number"
                min="1950"
                max={maxYear}
                defaultValue={params.min_year}
                placeholder="Any year"
              />
            </Field>
            <Field
              label="Maximum kilometres driven (km)"
              hint="Total distance travelled, not fuel economy (km/l)."
            >
              <input
                name="max_mileage"
                type="number"
                min="0"
                defaultValue={params.max_mileage}
                placeholder="Any distance"
              />
            </Field>
            <Field label="City / area">
              <input
                name="location"
                defaultValue={params.location}
                maxLength={120}
                placeholder="e.g. Delhi"
              />
            </Field>
          </div>
        </details>
        <div className="filter-form-footer">
          <button className="btn primary" type="submit">
            Show vehicles
          </button>
        </div>
        {params.featured && (
          <input type="hidden" name="featured" value={params.featured} />
        )}
        {activeFilters.length > 0 && (
          <div className="applied-filters" aria-label="Applied filters">
            <p>Applied filters</p>
            {chips}
          </div>
        )}
      </form>
    </>
  );
}

export function InventorySort({ value }: { value?: string }) {
  return (
    <label className="inventory-sort">
      <span>Sort by</span>
      <select
        name="sort"
        form="inventory-filter-form"
        aria-label="Sort results"
        defaultValue={value || "newest"}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="newest">Newest listings</option>
        <option value="price_asc">Lowest price first</option>
        <option value="price_desc">Highest price first</option>
        <option value="year_desc">Newest manufacture year first</option>
        <option value="mileage_asc">Least kilometres driven first</option>
      </select>
    </label>
  );
}
