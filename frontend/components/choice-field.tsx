"use client";
import { useState } from "react";
import { Field } from "./ui";

// Manual text is submitted under the real field name; the UI sentinel never is.
export function ChoiceField({
  name,
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  hint,
  maxLength,
  inputType = "text",
  min,
  max,
  placeholder,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  maxLength?: number;
  inputType?: "text" | "number";
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  const [manual, setManual] = useState(false);
  const hasValue = options.some((item) => item === value);
  return (
    <div className="choice-field">
      <Field label={label} hint={hint}>
        {manual ? (
          <input
            name={name}
            type={inputType}
            value={value}
            required={required}
            disabled={disabled}
            maxLength={maxLength}
            min={min}
            max={max}
            step={inputType === "number" ? 1 : undefined}
            pattern={required && inputType === "text" ? ".*\\S.*" : undefined}
            placeholder="Enter manually"
            autoFocus
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <select
            name={name}
            value={value}
            required={required}
            disabled={disabled}
            onChange={(event) => {
              if (event.target.value === "__enter_manually__") setManual(true);
              else onChange(event.target.value);
            }}
          >
            <option value="">{placeholder || "Choose an option"}</option>
            {value && !hasValue && (
              <option value={value}>{value} (your entry)</option>
            )}
            {options.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
            <option value="__enter_manually__">
              Not listed? Enter manually…
            </option>
          </select>
        )}
      </Field>
      {manual && (
        <button
          type="button"
          className="choice-field-switch"
          disabled={disabled}
          aria-label={`Choose ${label} from list`}
          onClick={() => setManual(false)}
        >
          Choose from list
        </button>
      )}
    </div>
  );
}
