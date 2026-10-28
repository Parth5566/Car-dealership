"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeIndianRupee,
  Check,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import { api, send } from "@/lib/api";
import { money } from "@/lib/types";
import {
  valuationMessage,
  type ValuationInput,
  type ValuationOption,
  type ValuationResult,
} from "@/lib/valuation";
import {
  ValuationCarPicker,
  emptyValuationCar,
  type ValuationCar,
} from "./valuation-car-picker";
import { Field, Notice } from "./ui";

export function CarValuation({
  options,
  optionsUnavailable = false,
  marketEnabled = false,
  currentYear,
}: {
  options: ValuationOption[];
  optionsUnavailable?: boolean;
  marketEnabled?: boolean;
  currentYear: number;
}) {
  const [purpose, setPurpose] = useState<"buy" | "sell">("sell");
  const [car, setCar] = useState<ValuationCar>(emptyValuationCar);
  const [draft, setDraft] = useState({
    year: "",
    location: "",
    mileage: "",
    owners: "1",
  });
  const [busy, setBusy] = useState(false);
  const [manualCity, setManualCity] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    input: ValuationInput;
    report: ValuationResult;
  } | null>(null);
  const [catalog, setCatalog] = useState<ValuationOption[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  useEffect(() => {
    setCatalog([]);
    setCatalogError("");
    if (!marketEnabled) {
      setCatalogLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setCatalogLoading(true);
    api<{ makes: { name: string; models: string[] }[] }>("/valuation/catalog", {
      signal: controller.signal,
    })
      .then((response) => {
        if (
          !Array.isArray(response.makes) ||
          response.makes.some(
            (make) =>
              typeof make.name !== "string" ||
              !Array.isArray(make.models) ||
              make.models.some((model) => typeof model !== "string"),
          )
        )
          throw new Error("The car catalog is temporarily unavailable.");
        if (active)
          setCatalog(
            response.makes.flatMap((make) =>
              (make.models.length ? make.models : [""]).map((model) => ({
                make: make.name,
                model,
                variant: null,
                location: "",
              })),
            ),
          );
      })
      .catch((error) => {
        if (active) setCatalogError((error as Error).message);
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [marketEnabled]);
  const generation = useRef(0),
    pending = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(
    () => () => {
      generation.current++;
      pending.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!result || !resultRef.current) return;
    resultRef.current.focus();
    resultRef.current.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
  }, [result]);
  function clearResult() {
    generation.current++;
    setResult(null);
    setError("");
  }
  function change(key: keyof typeof draft, value: string) {
    clearResult();
    setDraft((old) => ({ ...old, [key]: value }));
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    if (![car.make, car.model, car.variant].every((value) => value.trim())) {
      setError("Select your brand, model and Variant to check the value.");
      return;
    }
    const input: ValuationInput = {
      ...car,
      purpose,
      year: Number(draft.year),
      mileage: Number(draft.mileage),
      owners: Number(draft.owners),
      owners_at_least: draft.owners === "4",
      location: draft.location.trim(),
    };
    const request = new AbortController();
    pending.current = request;
    const version = ++generation.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const report = await api<ValuationResult>("/valuation", {
        ...send("POST", input),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(35000)]),
      });
      if (version === generation.current) setResult({ input, report });
    } catch (error) {
      if (version === generation.current) setError((error as Error).message);
    } finally {
      if (pending.current === request) pending.current = null;
      if (version === generation.current) setBusy(false);
    }
  }
  const cities = [
    ...new Set([
      ...options.map((item) => item.location).filter(Boolean),
      "New Delhi",
      "Delhi",
      "Gurugram",
      "Noida",
      "Ghaziabad",
      "Faridabad",
    ]),
  ];
  const report = result?.report,
    range = report?.range;
  const marketResult = report?.basis === "scrappa_cardekho_asking_prices";
  const medianPosition =
    range && range.high > range.low
      ? ((range.median - range.low) / (range.high - range.low)) * 100
      : 50;
  return (
    <section
      className="valuation-calculator"
      aria-labelledby="valuation-calculator-heading"
    >
      <div className="valuation-calculator-title">
        <div>
          <h2 id="valuation-calculator-heading">Used Car Price Calculator</h2>
          <p>
            {marketEnabled
              ? "Compare asking prices from Indian market listings."
              : "Compare asking prices for similar cars in our stock."}
          </p>
        </div>
        <span>
          <BadgeIndianRupee size={20} /> NCR WHEELZ
        </span>
      </div>
      <form onSubmit={submit} aria-label="Car valuation details">
        <fieldset disabled={busy} className="valuation-main-fields">
          <legend className="sr-only">Your valuation details</legend>
          <fieldset className="valuation-intent">
            <legend>I am a</legend>
            {(
              [
                ["buy", "Buyer"],
                ["sell", "Seller"],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="purpose"
                  value={value}
                  checked={purpose === value}
                  onChange={() => {
                    clearResult();
                    setPurpose(value);
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <div className="valuation-input-grid">
            <Field label="Manufacturing year">
              <select
                name="year"
                value={draft.year}
                onChange={(event) => change("year", event.target.value)}
                required
              >
                <option value="">Select year</option>
                {Array.from(
                  { length: currentYear - 1949 },
                  (_, index) => currentYear - index,
                ).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <Field label="City">
                <select
                  name="location"
                  value={manualCity ? "__other__" : draft.location}
                  required
                  onChange={(event) => {
                    const other = event.target.value === "__other__";
                    setManualCity(other);
                    change("location", other ? "" : event.target.value);
                  }}
                >
                  <option value="">Select city</option>
                  {cities.map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                  <option value="__other__">Other city</option>
                </select>
              </Field>
              {manualCity && (
                <Field label="Enter city">
                  <input
                    name="custom_location"
                    value={draft.location}
                    onChange={(event) => change("location", event.target.value)}
                    required
                    pattern={".*\\S.*"}
                    maxLength={120}
                    placeholder="Enter city"
                    autoComplete="off"
                  />
                </Field>
              )}
            </div>
            <div className="valuation-car-select">
              <ValuationCarPicker
                value={car}
                options={[...catalog, ...options]}
                marketEnabled={marketEnabled}
                year={draft.year ? Number(draft.year) : undefined}
                disabled={busy}
                onChange={(next) => {
                  clearResult();
                  setCar(next);
                }}
              />
            </div>
            <Field
              label="Kilometres driven"
              hint="Total distance on the odometer."
            >
              <span className="valuation-distance-input">
                <input
                  name="mileage"
                  type="number"
                  value={draft.mileage}
                  onChange={(event) => change("mileage", event.target.value)}
                  min={0}
                  max={5000000}
                  required
                  placeholder="e.g. 45000"
                />
                <span aria-hidden="true">km</span>
              </span>
            </Field>
          </div>
          <fieldset className="valuation-ownership">
            <legend>Number of owners</legend>
            <div>
              {[
                ["1", "First owner"],
                ["2", "Second owner"],
                ["3", "Third owner"],
                ["4", "Four or more"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className={draft.owners === value ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="owners"
                    value={value}
                    checked={draft.owners === value}
                    onChange={() => change("owners", value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <>
              <Notice error message={error} />
              <p>
                <Link
                  className="text-link"
                  href={
                    "/contact?" +
                    new URLSearchParams({
                      valuation: valuationMessage({
                        ...car,
                        ...draft,
                        purpose,
                        year: Number(draft.year),
                        mileage: Number(draft.mileage),
                        owners: Number(draft.owners),
                        owners_at_least: draft.owners === "4",
                      }),
                    })
                  }
                >
                  Request a price review
                </Link>
              </p>
            </>
          )}
          <button className="btn primary valuation-submit" type="submit">
            {busy ? (
              <>
                <LoaderCircle size={17} className="spin" /> Checking value…
              </>
            ) : (
              <>
                Check Value <ChevronRight size={17} />
              </>
            )}
          </button>
        </fieldset>
        <p className="valuation-privacy">
          <Check size={14} /> Free to check. No phone number or sign-in
          required.
        </p>
        {optionsUnavailable && !marketEnabled && (
          <p className="valuation-inline-note">
            Car dropdowns are temporarily unavailable. You can enter your car
            details using “Car not listed?” and try again.
          </p>
        )}
        {catalogLoading && (
          <p className="valuation-inline-note" role="status">
            Loading car brands and models…
          </p>
        )}
        {catalogError && (
          <p className="valuation-inline-note" role="status">
            {catalogError} You can still enter your car using “Car not listed?”.
          </p>
        )}
      </form>
      {result && (
        <section
          className="valuation-report"
          ref={resultRef}
          tabIndex={-1}
          aria-labelledby="valuation-result-title"
        >
          <div className="valuation-report-top">
            <div>
              <span>
                {result.input.purpose === "buy"
                  ? "BUYING PRICE CHECK"
                  : "SELLING PRICE CHECK"}
              </span>
              <h3>
                {result.input.year} {result.input.make} {result.input.model}
              </h3>
              <p>
                {result.input.variant} ·{" "}
                {result.input.mileage.toLocaleString("en-IN")} km ·{" "}
                {result.input.location}
              </p>
            </div>
            <span className="valuation-report-date">
              {new Date(report!.as_of).toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                dateStyle: "medium",
              })}
            </span>
          </div>
          {marketResult && (
            <p className="valuation-source-note">
              Source: {report!.source_label}. Compared within{" "}
              {report!.matching.location_scope || result.input.location};
              retrieved{" "}
              {new Date(report!.as_of).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              IST.
            </p>
          )}
          {range ? (
            <>
              <h2 id="valuation-result-title">
                {report!.range_method === "estimated_band"
                  ? "Approximate price range"
                  : "Indicative price range"}
              </h2>
              <p className="valuation-range">
                <strong>{money(range.low)}</strong>
                <span>–</span>
                <strong>{money(range.high)}</strong>
              </p>
              <div className="valuation-price-scale" aria-hidden="true">
                <span style={{ left: `${medianPosition}%` }} />
              </div>
              <div className="valuation-scale-labels">
                <span>Lower asking price</span>
                <span>Higher asking price</span>
              </div>
              <p className="valuation-evidence">
                Based on{" "}
                <strong>
                  {report!.count} similar{" "}
                  {report!.count === 1 ? "listing" : "listings"}
                </strong>{" "}
                ·{" "}
                {report!.count === 1
                  ? "Reference asking price"
                  : "Median asking price"}{" "}
                <strong>{money(range.median)}</strong>
              </p>
              {report!.range_method === "estimated_band" && (
                <p className="valuation-source-note">
                  Approximate estimate: NCR Wheelz applies a{" "}
                  {report!.approximation_percent}% allowance below and above the
                  reference asking price
                  {report!.count > 1
                    ? ", using the median and including the advertised prices"
                    : ""}
                  . The range endpoints are estimated, not advertised prices.
                </p>
              )}
              {report!.matching.broad_matches && (
                <p className="valuation-source-note">
                  Based on similar cars. Variants and owner counts may differ;
                  condition and features can affect your car’s price.
                </p>
              )}
            </>
          ) : (
            <>
              <h2 id="valuation-result-title">
                An estimate isn’t available for this car yet.
              </h2>
              <p className="valuation-insufficient">
                We found {report!.count} matching{" "}
                {report!.count === 1 ? "listing" : "listings"}. A price range
                needs at least {report!.minimum_comparables}.{" "}
                {marketResult
                  ? report!.reason === "not_in_catalog"
                    ? "This brand or model is not in the current market catalog."
                    : "No usable similar market listings were found for this search."
                  : "No usable similar cars were found in NCR Wheelz stock."}
              </p>
              <p className="valuation-source-note">
                Our team can review your car’s condition and help you discuss a
                suitable price.
              </p>
            </>
          )}
          <p className="valuation-source-note">
            {range
              ? marketResult
                ? "This guide uses advertised market prices, not completed sales. "
                : "This guide uses advertised NCR Wheelz prices. "
              : ""}
            An individual car’s condition, history and negotiation can change
            its final selling price.
          </p>
          <div className="valuation-report-actions">
            <Link
              className="btn primary"
              href={
                "/contact?" +
                new URLSearchParams({
                  valuation: valuationMessage(result.input),
                })
              }
            >
              Request a price review <ChevronRight size={16} />
            </Link>
            <Link
              className="text-link"
              href={
                result.input.purpose === "sell"
                  ? "/sell"
                  : "/cars?" +
                    new URLSearchParams({
                      q: `${result.input.make} ${result.input.model}`,
                    })
              }
            >
              {result.input.purpose === "sell"
                ? "List your car"
                : "Browse similar cars"}{" "}
              <ChevronRight size={14} />
            </Link>
          </div>
        </section>
      )}
      <p className="valuation-data-note">
        {marketEnabled
          ? "Market comparisons use CarDekho listings through Scrappa. Catalog and estimate availability depend on source coverage."
          : "Current price checks use comparable NCR Wheelz listings. Availability depends on matching cars."}
      </p>
    </section>
  );
}
