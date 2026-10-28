"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CarFront, ChevronRight, X } from "lucide-react";
import { Field } from "./ui";
import { api } from "@/lib/api";
import type { ValuationOption } from "@/lib/valuation";

export type ValuationCar = {
  make: string;
  model: string;
  variant: string;
  fuel: string;
  transmission: string;
};
export const emptyValuationCar: ValuationCar = {
  make: "",
  model: "",
  variant: "",
  fuel: "",
  transmission: "",
};
const normalise = (value: string) => value.trim().toLowerCase();
const fuels = ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"];
const transmissions = ["Manual", "Automatic"];
function choices(values: (string | null | undefined)[]) {
  const unique = new Map<string, string>();
  for (const item of values) {
    if (item?.trim() && !unique.has(normalise(item)))
      unique.set(normalise(item), item.trim());
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b));
}
export function ValuationCarPicker({
  value,
  options,
  disabled = false,
  marketEnabled = false,
  year,
  onChange,
}: {
  value: ValuationCar;
  options: ValuationOption[];
  disabled?: boolean;
  marketEnabled?: boolean;
  year?: number;
  onChange: (car: ValuationCar) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [manual, setManual] = useState(false);
  const [manualVariant, setManualVariant] = useState(false);
  const [remote, setRemote] = useState<{
    key: string;
    items: ValuationOption[];
    loading: boolean;
    error: string;
  }>({ key: "", items: [], loading: false, error: "" });
  const variantKey = JSON.stringify([draft.make, draft.model, year || null]);
  useEffect(() => {
    if (!open || !marketEnabled || manual || !draft.make || !draft.model) {
      setRemote({ key: "", items: [], loading: false, error: "" });
      return;
    }
    let active = true;
    const controller = new AbortController();
    const make = draft.make,
      model = draft.model;
    setRemote({ key: variantKey, items: [], loading: true, error: "" });
    const query = new URLSearchParams({
      make,
      model,
      ...(year ? { year: String(year) } : {}),
    });
    api<{ items: { variant: string; fuel?: string; transmission?: string }[] }>(
      "/valuation/variants?" + query,
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(20000),
        ]),
      },
    )
      .then((data) => {
        if (
          !Array.isArray(data.items) ||
          data.items.some(
            (item) =>
              !item ||
              typeof item.variant !== "string" ||
              (item.fuel !== undefined && typeof item.fuel !== "string") ||
              (item.transmission !== undefined &&
                typeof item.transmission !== "string"),
          )
        )
          throw new Error("Variant choices are temporarily unavailable.");
        if (active)
          setRemote({
            key: variantKey,
            items: data.items.map((item) => ({
              ...item,
              make,
              model,
              location: "",
            })),
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
              "Variant choices are temporarily unavailable. Choose Enter another Variant to continue.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [open, marketEnabled, manual, draft.make, draft.model, year, variantKey]);
  const variantState = remote.key === variantKey ? remote : null;
  const carOptions = [...options, ...(variantState?.items || [])];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      triggerRef.current?.focus();
    };
  }, [open]);
  const sameCar = (item: ValuationOption, car: ValuationCar) =>
    ["make", "model", "variant"].every(
      (key) =>
        normalise(String(item[key as keyof ValuationOption] || "")) ===
        normalise(car[key as keyof ValuationCar]),
    );
  const makes = choices(options.map((item) => item.make));
  const models = choices(
    options
      .filter((item) => normalise(item.make) === normalise(draft.make))
      .map((item) => item.model),
  );
  const variants = choices(
    carOptions
      .filter(
        (item) =>
          normalise(item.make) === normalise(draft.make) &&
          normalise(item.model) === normalise(draft.model),
      )
      .map((item) => item.variant),
  );
  const matching = carOptions.filter((item) => sameCar(item, draft));
  const knownFuels = choices(matching.map((item) => item.fuel)).filter((item) =>
    fuels.includes(item),
  );
  const fuelChoices =
    !manual && !marketEnabled && knownFuels.length ? knownFuels : fuels;
  const knownTransmissions = choices(
    matching
      .filter(
        (item) => !item.fuel || normalise(item.fuel) === normalise(draft.fuel),
      )
      .map((item) => item.transmission),
  ).filter((item) => transmissions.includes(item));
  const transmissionChoices =
    !manual && !marketEnabled && knownTransmissions.length
      ? knownTransmissions
      : transmissions;
  function change(key: keyof ValuationCar, next: string) {
    if (key === "make" || key === "model") setManualVariant(false);
    setDraft((old) => {
      const car = {
        ...old,
        [key]: next,
        ...(key === "make"
          ? { model: "", variant: "", fuel: "", transmission: "" }
          : key === "model"
            ? { variant: "", fuel: "", transmission: "" }
            : {}),
      };
      if (key === "variant" && !manual) {
        const rows = carOptions.filter((item) => sameCar(item, car));
        const availableFuels = choices(rows.map((item) => item.fuel)).filter(
          (item) => fuels.includes(item),
        );
        car.fuel = availableFuels.length === 1 ? availableFuels[0] : "";
        const availableTransmissions = choices(
          rows
            .filter(
              (item) =>
                car.fuel && normalise(item.fuel || "") === normalise(car.fuel),
            )
            .map((item) => item.transmission),
        ).filter((item) => transmissions.includes(item));
        car.transmission =
          availableTransmissions.length === 1 ? availableTransmissions[0] : "";
      } else if (key === "fuel") {
        const availableTransmissions = choices(
          carOptions
            .filter(
              (item) =>
                sameCar(item, car) &&
                normalise(item.fuel || "") === normalise(next),
            )
            .map((item) => item.transmission),
        ).filter((item) => transmissions.includes(item));
        car.transmission =
          !manual && availableTransmissions.length === 1
            ? availableTransmissions[0]
            : "";
      }
      return car;
    });
  }
  return (
    <>
      <div className="valuation-car-field">
        <span id="valuation-car-label">Car</span>
        <button
          type="button"
          ref={triggerRef}
          disabled={disabled}
          className="valuation-car-trigger"
          aria-label={
            value.make
              ? `Change selected car: ${value.make} ${value.model} ${value.variant}`
              : "Select car"
          }
          aria-haspopup="dialog"
          onClick={() => {
            setDraft(value);
            setManual(
              Boolean(value.make) &&
                !options.some((item) =>
                  marketEnabled
                    ? normalise(item.make) === normalise(value.make) &&
                      normalise(item.model) === normalise(value.model)
                    : sameCar(item, value),
                ),
            );
            setManualVariant(false);
            setOpen(true);
          }}
        >
          <CarFront size={20} />
          <span id="valuation-car-choice">
            {value.make ? (
              <>
                <strong>
                  {value.make} {value.model}
                </strong>
                <small>
                  {value.variant} · {value.fuel} · {value.transmission}
                </small>
              </>
            ) : (
              "Select brand, model and Variant"
            )}
          </span>
          <ChevronRight size={17} />
        </button>
      </div>
      {open &&
        createPortal(
          <dialog
            ref={dialogRef}
            className="valuation-car-dialog"
            aria-labelledby="valuation-picker-heading"
            onCancel={(event) => {
              event.preventDefault();
              setOpen(false);
            }}
            onKeyDown={(event) => {
              if (
                event.key !== "Tab" ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey
              )
                return;
              const controls = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not([disabled]), input:not([disabled]), select:not([disabled])",
                ),
              );
              const index = controls.indexOf(
                document.activeElement as HTMLElement,
              );
              if (!controls.length) return;
              event.preventDefault();
              controls[
                index < 0
                  ? event.shiftKey
                    ? controls.length - 1
                    : 0
                  : (index + (event.shiftKey ? -1 : 1) + controls.length) %
                    controls.length
              ].focus();
            }}
          >
            <div className="valuation-dialog-heading">
              <div>
                <span>CAR DETAILS</span>
                <h2 id="valuation-picker-heading">Select your car</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close car selector"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange(
                  Object.fromEntries(
                    Object.entries(draft).map(([key, item]) => [
                      key,
                      item.trim(),
                    ]),
                  ) as ValuationCar,
                );
                setOpen(false);
              }}
            >
              <p className="valuation-picker-help">
                {manual
                  ? "Enter your car details to check for matches or request a review."
                  : marketEnabled
                    ? "Choose your brand, model and Variant."
                    : "Choose the brand, then model and Variant. Dropdowns use our current listings."}
              </p>
              <div className="valuation-picker-fields">
                {(
                  [
                    ["make", "Vehicle brand", "brand", makes, false, 80],
                    ["model", "Model", "model", models, !draft.make, 100],
                    [
                      "variant",
                      "Variant",
                      "Variant",
                      variants,
                      !draft.model,
                      120,
                    ],
                  ] as const
                ).map(([key, label, noun, items, disabled, limit]) => (
                  <Field label={label} key={key}>
                    {manual ||
                    (key === "variant" &&
                      draft.model &&
                      (manualVariant || (!marketEnabled && !items.length))) ? (
                      <input
                        name={key}
                        required
                        pattern={".*\\S.*"}
                        maxLength={limit}
                        value={draft[key]}
                        onChange={(event) => change(key, event.target.value)}
                        placeholder={`Enter ${noun}`}
                        autoComplete="off"
                        autoFocus={key === "variant" && manualVariant}
                      />
                    ) : (
                      <select
                        name={key}
                        required
                        value={draft[key]}
                        disabled={
                          disabled ||
                          (!items.length &&
                            !(key === "variant" && marketEnabled))
                        }
                        onChange={(event) => {
                          if (
                            key === "variant" &&
                            event.target.value === "__other__"
                          ) {
                            setManualVariant(true);
                            change("variant", "");
                          } else change(key, event.target.value);
                        }}
                      >
                        <option value="">
                          {disabled
                            ? `Choose a ${key === "model" ? "brand" : "model"} first`
                            : key === "variant" && variantState?.loading
                              ? "Loading Variants…"
                              : items.length ||
                                  (key === "variant" && marketEnabled)
                                ? `Select ${noun}`
                                : `No ${noun === "Variant" ? "Variants" : noun + "s"} listed`}
                        </option>
                        {items.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                        {key === "variant" &&
                          marketEnabled &&
                          draft.variant &&
                          !items.some((item) => item === draft.variant) && (
                            <option value={draft.variant}>
                              {draft.variant}
                            </option>
                          )}
                        {key === "variant" && marketEnabled && (
                          <option value="__other__">
                            Enter another Variant
                          </option>
                        )}
                      </select>
                    )}
                  </Field>
                ))}
                <Field label="Fuel type">
                  <select
                    name="fuel"
                    required
                    value={draft.fuel}
                    disabled={!manual && !draft.variant}
                    onChange={(event) => change("fuel", event.target.value)}
                  >
                    <option value="">Select fuel</option>
                    {fuelChoices.map((fuel) => (
                      <option key={fuel}>{fuel}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Transmission">
                  <select
                    name="transmission"
                    required
                    value={draft.transmission}
                    disabled={!manual && !draft.fuel}
                    onChange={(event) =>
                      change("transmission", event.target.value)
                    }
                  >
                    <option value="">Select Transmission</option>
                    {transmissionChoices.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </Field>
              </div>
              {variantState?.loading && (
                <p className="valuation-picker-help" role="status">
                  Loading Variant choices…
                </p>
              )}
              {variantState?.error && (
                <p className="valuation-picker-help" role="status">
                  {variantState.error}
                </p>
              )}
              <button
                type="button"
                className="valuation-entry-toggle"
                onClick={() => {
                  setManual(!manual);
                  setManualVariant(false);
                  setDraft(emptyValuationCar);
                }}
              >
                {manual
                  ? "Choose from dropdowns"
                  : "Car not listed? Enter details"}
              </button>
              <button
                className="btn primary"
                type="submit"
                disabled={
                  ![
                    draft.make,
                    draft.model,
                    draft.variant,
                    draft.fuel,
                    draft.transmission,
                  ].every((item) => item.trim())
                }
              >
                Use this car
              </button>
            </form>
          </dialog>,
          document.body,
        )}
    </>
  );
}
