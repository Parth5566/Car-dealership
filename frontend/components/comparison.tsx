"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { CarFront, Plus, X, Search, GitCompareArrows } from "lucide-react";
import { useComparison } from "./comparison-provider";
import { useToast } from "./providers";
import { api } from "@/lib/api";
import { Vehicle, money, fuelEconomy } from "@/lib/types";
import { Notice } from "./ui";
export function Comparison() {
  const { ids, items, ready, loading, error, remove, toggle, clear, retry } =
    useComparison();
  const toast = useToast();
  const [picker, setPicker] = useState(true),
    [term, setTerm] = useState(""),
    [type, setType] = useState("passenger");
  const [results, setResults] = useState<Vehicle[]>([]),
    [searching, setSearching] = useState(true),
    [searchError, setSearchError] = useState("");
  const [differences, setDifferences] = useState(false);
  useEffect(() => {
    let active = true;
    setSearching(true);
    setSearchError("");
    const timer = setTimeout(() => {
      api<{ items: Vehicle[] }>(
        "/vehicles?" + new URLSearchParams({ type, q: term, limit: "12" }),
      )
        .then((r) => {
          if (active) setResults(r.items);
        })
        .catch((e) => {
          if (active) setSearchError(e.message);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, type]);
  const available = items.filter((item): item is Vehicle => !item.unavailable);
  const fields: [string, (v: Vehicle) => string | number][] = [
    ["Price", (v) => money(v.price)],
    [
      "Vehicle type",
      (v) => (v.type === "passenger" ? "Passenger car" : "Commercial cab"),
    ],
    ["Variant", (v) => v.variant || "Not provided"],
    ["Year of manufacture", (v) => v.year],
    ["Kilometres driven", (v) => v.mileage.toLocaleString("en-IN") + " km"],
    ...(available.some((v) => fuelEconomy(v))
      ? [
          [
            "Mileage / fuel economy",
            (v: Vehicle) => fuelEconomy(v) || "Not provided",
          ] as [string, (v: Vehicle) => string],
        ]
      : []),
    ["Fuel type", (v) => v.fuel],
    ["Transmission", (v) => v.transmission],
    ["Vehicle style", (v) => v.body_type],
    ["Number of owners", (v) => v.owners],
    ["City / area", (v) => v.location],
    ["Number of seats", (v) => v.seats || "Not provided"],
    ["Features", (v) => [...v.features].sort().join(", ") || "Not provided"],
    [
      "Availability",
      (v) =>
        v.status === "reserved"
          ? "Reserved · check with team"
          : "Listed · check with team",
    ],
  ];
  const rows = fields.filter(
    ([, read]) => !differences || new Set(available.map(read)).size > 1,
  );
  return (
    <>
      <section className="page-heading">
        <div className="container">
          <span className="eyebrow">
            <GitCompareArrows size={20} /> YOUR SHORTLIST, SIDE BY SIDE
          </span>
          <h1>
            Which one feels like <em>you?</em>
          </h1>
          <p>
            Choose 2 or 3 vehicles. Compare the details, spot the differences,
            and find your next drive.
          </p>
        </div>
      </section>
      <div className="container section comparison-page">
        <div className="comparison-toolbar">
          <p aria-live="polite">
            <strong>{ids.length} of 3</strong> vehicles selected
          </p>
          {ids.length > 0 && (
            <button className="text-button" onClick={clear}>
              Clear selection
            </button>
          )}
        </div>
        {error && (
          <div>
            <Notice error message={error} />
            <button className="btn outline" onClick={retry}>
              Retry vehicle details
            </button>
          </div>
        )}
        <div className="compare-slots">
          {[0, 1, 2].map((index) => {
            const id = ids[index],
              v = items.find((item) => item.id === id);
            return id ? (
              <article className="compare-slot filled" key={id}>
                <button
                  className="icon-button slot-remove"
                  onClick={() => remove(id)}
                  aria-label={`Remove vehicle ${index + 1}`}
                >
                  <X size={19} />
                </button>
                {v && !v.unavailable ? (
                  <>
                    {v.images[0] ? (
                      <img
                        src={v.images[0].url + "?size=thumb"}
                        alt={
                          v.images[0].alt_text?.trim() || `${v.make} ${v.model}`
                        }
                      />
                    ) : (
                      <div className="compare-placeholder">
                        <CarFront size={55} />
                      </div>
                    )}
                    <div className="slot-copy">
                      <span>
                        {v.year} · {v.variant || v.body_type}
                      </span>
                      <h2>
                        {v.make} {v.model}
                      </h2>
                      <strong>{money(v.price)}</strong>
                      <Link
                        className="text-link"
                        href={`/vehicles/${v.id}/${v.slug}`}
                      >
                        View vehicle ↗
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="compare-placeholder">
                    <CarFront size={45} />
                    <p>
                      {loading
                        ? "Loading vehicle…"
                        : "Listing unavailable. Remove it and choose another."}
                    </p>
                  </div>
                )}
              </article>
            ) : (
              <button
                key={`empty-${index}`}
                className="compare-slot add-slot"
                onClick={() => {
                  setPicker(true);
                  document
                    .getElementById("compare-picker")
                    ?.scrollIntoView({ block: "center", behavior: "smooth" });
                }}
              >
                <span>
                  <Plus size={30} />
                </span>
                <strong>
                  Add {index === 2 ? "a third vehicle" : "a vehicle"}
                </strong>
                <small>
                  {index === 2
                    ? "Optional · compare up to 3"
                    : "Choose from available listings"}
                </small>
              </button>
            );
          })}
        </div>
        <section
          className="compare-picker panel"
          id="compare-picker"
          aria-label="Choose vehicles to compare"
        >
          <div className="comparison-toolbar">
            <h2>
              <Search size={22} /> Find your shortlist
            </h2>
            <button
              className="text-button"
              onClick={() => setPicker(!picker)}
              aria-expanded={picker}
              aria-controls="comparison-search"
            >
              {picker ? "Hide search" : "Add another vehicle"}
            </button>
          </div>
          {picker && (
            <div id="comparison-search">
              <div className="compare-search">
                <label>
                  Vehicle category
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="passenger">Passenger cars</option>
                    <option value="commercial">Commercial cabs</option>
                  </select>
                </label>
                <label>
                  Search brand or model
                  <input
                    type="search"
                    value={term}
                    maxLength={100}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="e.g. Swift"
                  />
                </label>
              </div>
              <div aria-live="polite">
                {searching ? (
                  <p>Finding vehicles…</p>
                ) : searchError ? (
                  <Notice error message={searchError} />
                ) : !results.length ? (
                  <p>
                    No matching published vehicles yet. Try another search or{" "}
                    <Link className="text-link" href="/contact">
                      ask our team
                    </Link>
                    .
                  </p>
                ) : (
                  <div className="compare-search-results">
                    {results.map((v) => (
                      <button
                        key={v.id}
                        className={ids.includes(v.id) ? "chosen" : ""}
                        disabled={
                          !ready || (!ids.includes(v.id) && ids.length >= 3)
                        }
                        aria-pressed={ids.includes(v.id)}
                        onClick={() => toast(toggle(v.id))}
                      >
                        <CarFront size={25} />
                        <span>
                          <strong>
                            {v.make} {v.model}
                          </strong>
                          <small>
                            {v.year} · {v.variant || v.body_type} ·{" "}
                            {money(v.price)}
                          </small>
                        </span>
                        <span>{ids.includes(v.id) ? "Remove" : "+ Add"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
        {available.length >= 2 && !loading ? (
          <section
            className="comparison-details"
            aria-label="Vehicle comparison"
          >
            <div className="comparison-toolbar comparison-details-toolbar">
              <div>
                <span className="eyebrow">SPECIFICATIONS</span>
                <h2>The details that matter.</h2>
              </div>
              <label className="check-label comparison-differences-toggle">
                <input
                  type="checkbox"
                  checked={differences}
                  onChange={(e) => setDifferences(e.target.checked)}
                />{" "}
                Show differences only
              </label>
            </div>
            <div
              className="table-wrap comparison-scroll"
              tabIndex={0}
              aria-label="Comparison table; scroll horizontally to see all vehicles"
            >
              <table className="comparison" data-vehicles={available.length}>
                <caption>
                  <span className="comparison-caption">
                    <span>
                      <GitCompareArrows size={18} aria-hidden="true" />
                      Compare {available.length} selected vehicles
                    </span>
                    <span className="comparison-legend">
                      <span
                        className="comparison-difference-dot"
                        aria-hidden="true"
                      />
                      Different values
                    </span>
                  </span>
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Specification</th>
                    {available.map((v, index) => (
                      <th scope="col" key={v.id}>
                        <div className="comparison-vehicle">
                          <span
                            className="comparison-vehicle-number"
                            aria-hidden="true"
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <span className="comparison-vehicle-name">
                              {v.make} {v.model}
                            </span>
                            {v.variant && <small>{v.variant}</small>}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([name, read]) => {
                    const different = new Set(available.map(read)).size > 1;
                    return (
                      <tr
                        key={name}
                        className={
                          name === "Price" ? "comparison-price" : undefined
                        }
                      >
                        <th scope="row">
                          <span className="comparison-field">
                            {name}
                            {different && (
                              <span
                                className="comparison-difference-dot"
                                role="img"
                                aria-label="Different values"
                              />
                            )}
                          </span>
                        </th>
                        {available.map((v) => (
                          <td key={v.id}>{read(v)}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <p className="notice info">
                These vehicles have the same listed specifications. Turn off
                “Show differences only” to see everything.
              </p>
            )}
          </section>
        ) : (
          <p className="compare-guidance" role="status">
            {!ready || loading
              ? "Loading your selection…"
              : "Choose at least two available vehicles to see their details side by side."}
          </p>
        )}
      </div>
    </>
  );
}
