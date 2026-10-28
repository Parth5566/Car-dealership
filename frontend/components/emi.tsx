"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, RotateCcw, Calculator } from "lucide-react";
import { money } from "@/lib/types";
import { calculateLoan } from "@/lib/loan";
function AmountControl({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  sliderMax = max,
  sliderMin = min,
  sliderStep = step,
  unit,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  step?: number;
  sliderMax?: number;
  sliderMin?: number;
  sliderStep?: number;
  unit: string;
  hint: string;
}) {
  return (
    <div className="loan-control">
      <label>
        <span>{label}</span>
        <div className="loan-input">
          <span aria-hidden="true">{unit}</span>
          <input
            aria-label={label}
            type="number"
            inputMode="decimal"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </label>
      <input
        aria-label={`Adjust ${label.toLowerCase()}`}
        className="range"
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={sliderStep}
        value={Math.min(
          sliderMax,
          Math.max(sliderMin, Number(value) || sliderMin),
        )}
        onChange={(e) => onChange(e.target.value)}
      />
      <p>{hint}</p>
    </div>
  );
}
export function EmiCalculator() {
  const params = useSearchParams();
  const inputPrice = Number(params.get("price"));
  const initial =
    Number.isFinite(inputPrice) && inputPrice > 0 && inputPrice <= 1e9
      ? inputPrice
      : 800000;
  const [price, setPrice] = useState(String(initial)),
    [down, setDown] = useState(String(Math.round(initial * 0.2))),
    [rate, setRate] = useState("10"),
    [months, setMonths] = useState("60");
  const loan = [price, down, rate, months].every((v) => v.trim() !== "")
    ? calculateLoan(Number(price), Number(down), Number(rate), Number(months))
    : null;
  const share =
    loan && loan.repayment > 0 ? (loan.principal / loan.repayment) * 100 : 100;
  return (
    <>
      <div className="loan-layout">
        <section className="panel loan-controls" aria-label="Loan inputs">
          <div className="comparison-toolbar">
            <h2>Make it your budget.</h2>
            <button
              className="text-button"
              onClick={() => {
                setPrice(String(initial));
                setDown(String(Math.round(initial * 0.2)));
                setRate("10");
                setMonths("60");
              }}
            >
              <RotateCcw size={17} /> Reset
            </button>
          </div>
          <p className="panel-intro">
            Move the sliders or type your own numbers. Your estimate updates as
            you go.
          </p>
          <AmountControl
            label="Vehicle price"
            value={price}
            onChange={setPrice}
            min={1}
            max={1000000000}
            sliderMax={Math.max(5000000, Number(price) || 0)}
            sliderMin={10000}
            sliderStep={10000}
            unit="₹"
            hint="Enter the vehicle's selling price in rupees."
          />
          <AmountControl
            label="Down payment"
            value={down}
            onChange={setDown}
            min={0}
            max={Math.max(1, Number(price) || 1)}
            unit="₹"
            hint={
              Number(price) > 0 &&
              Number(down) >= 0 &&
              Number(down) <= Number(price)
                ? `${Math.round((Number(down) / Number(price)) * 100)}% of the vehicle price paid upfront`
                : "Enter an amount between zero and the vehicle price."
            }
          />
          <AmountControl
            label="Annual interest rate"
            value={rate}
            onChange={setRate}
            min={0}
            max={40}
            step={0.1}
            unit="%"
            hint="Enter the yearly interest rate offered by your bank or lender. 10% is an example."
          />
          <AmountControl
            label="Loan tenure (months)"
            value={months}
            onChange={setMonths}
            min={1}
            max={120}
            unit="months"
            hint="How long you will take to repay the loan. For example, 60 months is 5 years. Choose 1 to 120 months."
          />
          <div
            className="tenure-presets"
            role="group"
            aria-label="Popular loan tenures"
          >
            {[24, 36, 48, 60, 84].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={Number(months) === m}
                onClick={() => setMonths(String(m))}
              >
                {m / 12} years
              </button>
            ))}
          </div>
          {!loan && (
            <p className="notice error" role="alert">
              Enter a price greater than zero, a down payment no higher than the
              price, an interest rate from 0–40%, and a whole number of months
              from 1–120.
            </p>
          )}
        </section>
        <section className="loan-summary" aria-label="Estimated repayments">
          <div className="monthly-payment">
            <span>
              <Calculator size={20} /> ESTIMATED MONTHLY PAYMENT (EMI)
            </span>
            <strong aria-live="polite">
              {loan ? money(loan.monthly) : "—"}
            </strong>
            <p>
              {loan
                ? `${months} monthly payments · ${rate}% annual interest`
                : "Adjust your inputs to see an estimate"}
            </p>
          </div>
          <div className="loan-breakdown">
            <div
              className="loan-chart"
              role="img"
              aria-label={
                loan
                  ? `Loan amount ${money(loan.principal)}; total interest ${money(loan.interest)}`
                  : "No estimate available"
              }
              style={{
                background: `conic-gradient(var(--navy) 0% ${share}%, var(--gold) ${share}% 100%)`,
              }}
            >
              <div>
                <span>Loan amount</span>
                <strong>{loan ? money(loan.principal) : "—"}</strong>
              </div>
            </div>
            <dl>
              <div>
                <dt>
                  <i className="principal-dot" /> Loan amount
                </dt>
                <dd>{loan ? money(loan.principal) : "—"}</dd>
              </div>
              <div>
                <dt>
                  <i className="interest-dot" /> Total interest
                </dt>
                <dd>{loan ? money(loan.interest) : "—"}</dd>
              </div>
              <div className="repayment-total">
                <dt>Total loan repayment</dt>
                <dd>{loan ? money(loan.repayment) : "—"}</dd>
              </div>
              <div>
                <dt>Including down payment</dt>
                <dd>{loan ? money(loan.total) : "—"}</dd>
              </div>
            </dl>
            {loan?.principal === 0 && (
              <p className="notice info">
                Your down payment covers the full price. There is no loan to
                repay.
              </p>
            )}
            <Link href="/contact" className="btn primary">
              Talk through your options <ArrowUpRight size={18} />
            </Link>
            <p className="loan-disclaimer">
              An estimate for planning, not a loan offer. Fees, insurance and
              taxes are excluded. Confirm actual rates and terms with your
              lender.
            </p>
          </div>
        </section>
      </div>
      {loan && loan.principal > 0 && (
        <details className="repayment-schedule">
          <summary>See your year-by-year repayment breakdown</summary>
          <div className="table-wrap">
            <table>
              <caption>
                Illustrative repayment schedule, rounded to the nearest rupee
              </caption>
              <thead>
                <tr>
                  <th scope="col">Loan year</th>
                  <th scope="col">Loan amount repaid</th>
                  <th scope="col">Interest paid</th>
                  <th scope="col">Loan amount still owed</th>
                </tr>
              </thead>
              <tbody>
                {loan.yearly.map((year) => (
                  <tr key={year.year}>
                    <th scope="row">Year {year.year}</th>
                    <td>{money(year.principal)}</td>
                    <td>{money(year.interest)}</td>
                    <td>{money(year.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}
