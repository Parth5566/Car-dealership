"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Vehicle } from "@/lib/types";
import { ChoiceField } from "./choice-field";

type Row = {
  make: string;
  model: string;
  year: number;
  variant: string | null;
};
type Make = { name: string; models: string[] };
type Identity = { make: string; model: string; year: string; variant: string };
const normal = (value: string) => value.trim().toLowerCase();
function unique(values: (string | null | undefined)[]) {
  const items = new Map<string, string>();
  for (const value of values)
    if (value?.trim() && !items.has(normal(value)))
      items.set(normal(value), value.trim());
  return [...items.values()].sort((a, b) => a.localeCompare(b));
}
export function VehicleIdentityFields({
  type,
  initial,
  disabled = false,
}: {
  type: "passenger" | "commercial";
  initial?: Partial<Vehicle>;
  disabled?: boolean;
}) {
  const [identity, setIdentity] = useState<Identity>({
    make: initial?.make || "",
    model: initial?.model || "",
    year: String(initial?.year ?? ""),
    variant: initial?.variant || "",
  });
  const [attempt, setAttempt] = useState(0);
  const [reference, setReference] = useState<{
    type: string;
    rows: Row[];
    makes: Make[];
    market: boolean;
    loading: boolean;
    error: string;
  }>({ type, rows: [], makes: [], market: false, loading: true, error: "" });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(20000),
    ]);
    setReference({
      type,
      rows: [],
      makes: [],
      market: false,
      loading: true,
      error: "",
    });
    // The catalog is independent of local inventory: an empty database or an
    // older API without /vehicle-options must not hide the provider's brands.
    // Both personal cars and yellow-plate cabs use the passenger-car catalog.
    const localRequest = api<{ items: Row[] }>(
      "/vehicle-options?type=" + type,
      { signal },
    ).then((local) => {
      if (
        !Array.isArray(local.items) ||
        local.items.some(
          (row) =>
            !row ||
            typeof row.make !== "string" ||
            typeof row.model !== "string" ||
            !Number.isInteger(row.year) ||
            (row.variant != null && typeof row.variant !== "string"),
        )
      )
        throw new Error("Invalid suggestions");
      if (active) setReference((old) => ({ ...old, rows: local.items }));
      return local.items;
    });
    const catalogRequest = api<{ makes: Make[] }>("/valuation/catalog", {
      signal,
    }).then((catalog) => {
      if (
        !Array.isArray(catalog.makes) ||
        catalog.makes.some(
          (make) =>
            !make ||
            typeof make.name !== "string" ||
            !Array.isArray(make.models) ||
            make.models.some((model) => typeof model !== "string"),
        )
      )
        throw new Error("Invalid catalog");
      if (active)
        setReference((old) => ({
          ...old,
          makes: catalog.makes,
          market: catalog.makes.length > 0,
        }));
      return catalog.makes;
    });
    void Promise.allSettled([localRequest, catalogRequest]).then(
      ([local, catalog]) => {
        if (!active) return;
        const rows = local.status === "fulfilled" ? local.value : [];
        const makes = catalog.status === "fulfilled" ? catalog.value : [];
        const available = rows.length > 0 || makes.length > 0;
        setReference({
          type,
          rows,
          makes,
          market: makes.length > 0,
          loading: false,
          error: !available
            ? "Brand suggestions are unavailable. Retry loading or choose Enter manually."
            : local.status === "rejected" || catalog.status === "rejected"
              ? "Some suggestions are unavailable. You can still enter missing details manually."
              : "",
        });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [type, attempt]);
  const current = reference.type === type ? reference : null;
  const { make, model, year, variant } = identity;
  const currentYear = new Date().getUTCFullYear();
  const yearNumber = Number(year);
  const variantKey = JSON.stringify([type, make.trim(), model.trim(), year]);
  const [remote, setRemote] = useState<{
    key: string;
    items: string[];
    loading: boolean;
    error: string;
  }>({ key: "", items: [], loading: false, error: "" });
  const knownModel =
    current?.makes.some(
      (brand) =>
        normal(brand.name) === normal(make) &&
        brand.models.some((item) => normal(item) === normal(model)),
    ) === true;
  useEffect(() => {
    if (
      !current?.market ||
      !knownModel ||
      !Number.isInteger(yearNumber) ||
      yearNumber < 1950 ||
      yearNumber > currentYear
    ) {
      setRemote({ key: "", items: [], loading: false, error: "" });
      return;
    }
    let active = true;
    const controller = new AbortController();
    setRemote({ key: variantKey, items: [], loading: true, error: "" });
    const query = new URLSearchParams({
      make: make.trim(),
      model: model.trim(),
      year: String(yearNumber),
    });
    api<{ items: { variant: string }[] }>("/valuation/variants?" + query, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    })
      .then((data) => {
        if (
          !Array.isArray(data.items) ||
          data.items.some((item) => !item || typeof item.variant !== "string")
        )
          throw new Error("Invalid Variants");
        if (active)
          setRemote({
            key: variantKey,
            items: unique(data.items.map((item) => item.variant)),
            loading: false,
            error: "",
          });
      })
      .catch(() => {
        if (active)
          setRemote({
            key: variantKey,
            items: [],
            loading: false,
            error:
              "Variant suggestions are unavailable. You can enter yours manually or leave it blank.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    type,
    current?.market,
    knownModel,
    make,
    model,
    yearNumber,
    currentYear,
    variantKey,
  ]);
  const variants = remote.key === variantKey ? remote : null;
  function change(key: keyof Identity, value: string) {
    setIdentity((old) => ({
      ...old,
      [key]: value,
      ...(key === "make"
        ? { model: "", variant: "" }
        : key === "model" || key === "year"
          ? { variant: "" }
          : {}),
    }));
  }
  const rows = current?.rows || [];
  const makes = unique([
    ...(current?.makes || []).map((brand) => brand.name),
    ...rows.map((row) => row.make),
  ]);
  const models = unique([
    ...(current?.makes || [])
      .filter((brand) => normal(brand.name) === normal(make))
      .flatMap((brand) => brand.models),
    ...rows
      .filter((row) => normal(row.make) === normal(make))
      .map((row) => row.model),
  ]);
  const variantChoices = unique([
    ...rows
      .filter(
        (row) =>
          normal(row.make) === normal(make) &&
          normal(row.model) === normal(model) &&
          row.year === yearNumber,
      )
      .map((row) => row.variant),
    ...(variants?.items || []),
  ]);
  return (
    <>
      <ChoiceField
        name="make"
        label="Vehicle brand"
        required
        maxLength={80}
        value={make}
        onChange={(value) => change("make", value)}
        options={makes}
        disabled={disabled}
        placeholder={current?.loading ? "Loading brands…" : "Choose brand"}
        hint={
          current?.error ||
          (current?.loading
            ? "Loading brands. Manual entry is also available."
            : "Not listed? Choose Enter manually.")
        }
      />
      <ChoiceField
        key={`model-${make}`}
        name="model"
        label="Model name"
        required
        maxLength={100}
        value={model}
        onChange={(value) => change("model", value)}
        options={models}
        disabled={disabled || !make.trim()}
        placeholder={make.trim() ? "Choose model" : "Choose brand first"}
      />
      <ChoiceField
        name="year"
        label="Year of manufacture"
        required
        value={year}
        onChange={(value) => change("year", value)}
        options={Array.from({ length: currentYear + 2 - 1950 }, (_, i) =>
          String(currentYear + 1 - i),
        )}
        inputType="number"
        min={1950}
        max={currentYear + 1}
        disabled={disabled}
        placeholder="Choose year"
        hint="The year the vehicle was built, not the year you bought it."
      />
      <ChoiceField
        key={`variant-${make}-${model}-${year}`}
        name="variant"
        label="Variant (optional)"
        maxLength={120}
        value={variant}
        onChange={(value) => change("variant", value)}
        options={variantChoices}
        disabled={disabled || !make.trim() || !model.trim() || !year}
        placeholder={variants?.loading ? "Loading Variants…" : "Choose Variant"}
        hint="Choose Enter manually if missing. Leave blank if unsure."
      />
      {current?.error && (
        <button
          type="button"
          className="text-button"
          disabled={disabled || current.loading}
          onClick={() => setAttempt((value) => value + 1)}
        >
          Retry loading brands
        </button>
      )}
      {(current?.loading ||
        current?.error ||
        variants?.loading ||
        variants?.error) && (
        <p className="full subtle" role="status">
          {current?.error ||
            variants?.error ||
            (current?.loading
              ? "Loading vehicle suggestions. Manual entry is available while you wait."
              : "Loading Variant suggestions…")}
        </p>
      )}
    </>
  );
}
