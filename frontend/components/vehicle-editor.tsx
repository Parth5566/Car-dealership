"use client";
import { useState } from "react";
import { Vehicle, fuelEconomyUnit } from "@/lib/types";
import { Field, Notice, SubmitButton } from "./ui";
import { ChoiceField } from "./choice-field";
import { VehicleIdentityFields } from "./vehicle-identity-fields";
export function VehicleEditor({
  initial,
  onSave,
  seller = false,
  contact,
  typeLocked = false,
}: {
  initial?: Partial<Vehicle>;
  onSave: (vehicle: any, contact?: any) => Promise<void>;
  seller?: boolean;
  contact?: { name: string; email: string; phone: string };
  typeLocked?: boolean;
}) {
  const [type, setType] = useState(initial?.type || "passenger"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [fuel, setFuel] = useState(initial?.fuel || ""),
    [economy, setEconomy] = useState(String(initial?.fuel_economy ?? ""));
  const [bodyStyle, setBodyStyle] = useState(initial?.body_type || ""),
    [location, setLocation] = useState(initial?.location || ""),
    [owners, setOwners] = useState(String(initial?.owners ?? 1)),
    [seats, setSeats] = useState(String(initial?.seats ?? ""));
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    const sellerContact = seller
      ? { name: d.seller_name, email: d.seller_email, phone: d.seller_phone }
      : undefined;
    delete d.seller_name;
    delete d.seller_email;
    delete d.seller_phone;
    d.type = type;
    d.features = String(d.features || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    d.featured = d.featured === "on";
    // Retain the legacy API field as null; cabs do not have goods payloads.
    d.payload_kg = null;
    d.seats = d.seats ? Number(d.seats) : null;
    d.fuel_economy = economy.trim() === "" ? null : Number(economy);
    try {
      await onSave(d, sellerContact);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p className="panel-intro">
        Fill in the details below. Fields marked optional can be left blank.
      </p>
      <div className="form-grid">
        <Field
          label="Vehicle type"
          hint="Choose a personal car or a yellow-plate cab used to carry passengers."
        >
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as any);
              if (seller) setBodyStyle("");
            }}
            disabled={typeLocked}
          >
            <option value="passenger">Passenger car</option>
            <option value="commercial">Commercial cab (yellow plate)</option>
          </select>
        </Field>
        {seller ? (
          <VehicleIdentityFields
            key={type}
            type={type}
            initial={
              (initial?.type || "passenger") === type ? initial : undefined
            }
            disabled={busy}
          />
        ) : (
          <>
            <Field
              label="Vehicle brand"
              hint="The company that makes the vehicle, e.g. Maruti Suzuki, Hyundai or Tata."
            >
              <input
                name="make"
                required
                maxLength={80}
                defaultValue={initial?.make}
                placeholder="e.g. Maruti Suzuki"
              />
            </Field>
            <Field
              label="Model name"
              hint="The vehicle's name, e.g. Swift, Creta or Nexon."
            >
              <input
                name="model"
                required
                maxLength={100}
                defaultValue={initial?.model}
                placeholder="e.g. Swift"
              />
            </Field>
            <Field
              label="Variant (optional)"
              hint="The version of the model, e.g. LXI, VXI, Sportz or HTK. Leave blank if unsure."
            >
              <input
                name="variant"
                maxLength={120}
                defaultValue={initial?.variant}
                placeholder="e.g. VXI"
              />
            </Field>
            <Field
              label="Year of manufacture"
              hint="The year the vehicle was built, not the year you bought it."
            >
              <input
                name="year"
                type="number"
                required
                min="1950"
                max={new Date().getFullYear() + 1}
                defaultValue={initial?.year}
              />
            </Field>
          </>
        )}
        <Field
          label="Expected selling price (₹)"
          hint="Enter the full amount in rupees, e.g. 500000 for ₹5 lakh."
        >
          <input
            name="price"
            type="number"
            min="1"
            max="1000000000"
            step="0.01"
            required
            defaultValue={initial?.price}
          />
        </Field>
        <Field
          label="Kilometres driven (km)"
          hint="Enter the total distance the vehicle has travelled, shown on its dashboard's km counter (odometer), e.g. 42000."
        >
          <input
            name="mileage"
            type="number"
            min="0"
            max="5000000"
            required
            defaultValue={initial?.mileage}
            placeholder="e.g. 42000"
          />
        </Field>
        <Field label="Fuel type">
          <select
            name="fuel"
            required
            value={fuel}
            onChange={(e) => {
              const next = e.target.value;
              if (fuelEconomyUnit(next) !== fuelEconomyUnit(fuel))
                setEconomy("");
              setFuel(next);
            }}
          >
            <option value="" disabled>
              Choose fuel type
            </option>
            {["Petrol", "Diesel", "CNG", "Electric", "Hybrid"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field
          label={`Mileage (${fuelEconomyUnit(fuel)}, optional)`}
          hint={
            !fuel
              ? "Choose the fuel type first. Leave mileage blank if you do not know it."
              : fuel === "Electric"
                ? "Distance travelled using 1 kWh of electricity. This is efficiency, not the range on a full charge. Leave blank if unknown."
                : fuel === "CNG"
                  ? "Distance travelled using 1 kg of CNG, e.g. 25 km/kg. Leave blank if unknown."
                  : "Distance travelled using 1 litre of fuel, e.g. 18.5 km/l. Leave blank if unknown."
          }
        >
          <input
            name="fuel_economy"
            type="number"
            min="0.01"
            max="1000"
            step="0.01"
            disabled={!fuel}
            value={economy}
            onChange={(e) => setEconomy(e.target.value)}
            placeholder={
              fuel === "Electric"
                ? "e.g. 5"
                : fuel === "CNG"
                  ? "e.g. 25"
                  : "e.g. 18.5"
            }
          />
        </Field>
        <Field
          label="Transmission"
          hint="Manual means you change gears. Automatic changes gears for you."
        >
          <select
            name="transmission"
            required
            defaultValue={initial?.transmission || ""}
          >
            <option value="" disabled>
              Choose manual or automatic
            </option>
            <option>Manual</option>
            <option>Automatic</option>
          </select>
        </Field>
        {seller ? (
          <>
            <ChoiceField
              key={`body-${type}`}
              name="body_type"
              label="Vehicle style"
              required
              value={bodyStyle}
              onChange={setBodyStyle}
              maxLength={80}
              disabled={busy}
              placeholder="Choose vehicle style"
              options={[
                "Hatchback",
                "Sedan",
                "SUV",
                "MUV",
                "Coupe",
                "Convertible",
                "Wagon",
                "Van",
              ]}
            />
            <ChoiceField
              name="location"
              label="City / area"
              required
              value={location}
              onChange={setLocation}
              maxLength={120}
              disabled={busy}
              placeholder="Choose city / area"
              options={[
                "New Delhi",
                "Delhi",
                "Noida",
                "Greater Noida",
                "Gurugram",
                "Ghaziabad",
                "Faridabad",
              ]}
              hint="Enter another city or area manually if needed. Do not enter your home address."
            />
            <ChoiceField
              name="owners"
              label="Number of owners"
              required
              value={owners}
              onChange={setOwners}
              options={["1", "2", "3", "4", "5"]}
              inputType="number"
              min={1}
              max={20}
              disabled={busy}
              placeholder="Choose owner count"
              hint="Include the current owner. Enter another count manually if needed."
            />
          </>
        ) : (
          <>
            <Field
              label="Vehicle style"
              hint="The shape or kind of vehicle. Use one of the examples below."
            >
              <input
                name="body_type"
                required
                maxLength={80}
                defaultValue={initial?.body_type}
                placeholder="e.g. Sedan"
              />
            </Field>
            <Field
              label="City / area"
              hint="Where the vehicle is available, e.g. Tilak Nagar, Delhi. Do not enter your home address."
            >
              <input
                name="location"
                required
                maxLength={120}
                defaultValue={initial?.location}
              />
            </Field>
            <Field
              label="Number of owners"
              hint="Count all registered owners, including the current owner. Enter 1 for a first-owner vehicle."
            >
              <input
                name="owners"
                type="number"
                required
                min="1"
                max="20"
                defaultValue={initial?.owners || 1}
              />
            </Field>
          </>
        )}
        {seller ? (
          <ChoiceField
            name="seats"
            label="Number of seats (optional)"
            value={seats}
            onChange={setSeats}
            options={["1", "2", "3", "4", "5", "6", "7", "8", "9"]}
            inputType="number"
            min={1}
            max={100}
            disabled={busy}
            placeholder="Choose number of seats"
            hint="Include the driver's seat. Leave blank if unsure."
          />
        ) : (
          <Field
            label="Number of seats (optional)"
            hint="Include the driver's seat. Leave blank if unsure."
          >
            <input
              name="seats"
              type="number"
              min="1"
              max="100"
              defaultValue={initial?.seats ?? ""}
            />
          </Field>
        )}
        <div className="full">
          <Field
            label="Vehicle condition and details"
            hint="Describe the condition, service history and any damage or repairs. Do not add phone numbers, email addresses or document numbers."
          >
            <textarea
              name="description"
              required
              maxLength={10000}
              defaultValue={initial?.description}
            />
          </Field>
          <Field
            label="Features (optional)"
            hint="Separate each feature with a comma, e.g. Air conditioning, Parking camera, Airbags."
          >
            <input
              name="features"
              defaultValue={initial?.features?.join(", ")}
            />
          </Field>
        </div>
        {!seller && (
          <>
            <Field
              label="Search result title (optional)"
              hint="The title that may appear on Google and other search engines. Leave blank to use the year, make, model and variant automatically."
            >
              <input
                name="seo_title"
                maxLength={160}
                defaultValue={initial?.seo_title}
              />
            </Field>
            <Field
              label="Search result summary (optional)"
              hint="A short summary for search engines. Leave blank for an automatic summary with the price, location, fuel, transmission, kilometres and owners."
            >
              <input
                name="seo_description"
                maxLength={320}
                defaultValue={initial?.seo_description}
              />
            </Field>
            <label className="check-label full">
              <input
                name="featured"
                type="checkbox"
                defaultChecked={initial?.featured}
              />
              <span>Highlight this vehicle in featured listings.</span>
            </label>
          </>
        )}
        {seller && (
          <>
            <div className="full">
              <h3>Seller contact details</h3>
              <p className="subtle" style={{ marginBottom: 20 }}>
                These contact details stay private and are available only to
                authorised review staff.
              </p>
            </div>
            <Field label="Seller name">
              <input
                name="seller_name"
                required
                maxLength={100}
                defaultValue={contact?.name}
              />
            </Field>
            <Field label="Seller email address">
              <input
                name="seller_email"
                type="email"
                required
                maxLength={254}
                defaultValue={contact?.email}
              />
            </Field>
            <Field label="Seller phone number">
              <input
                name="seller_phone"
                type="tel"
                required
                maxLength={20}
                defaultValue={contact?.phone}
              />
            </Field>
          </>
        )}
      </div>
      {error && <Notice error message={error} />}
      <SubmitButton busy={busy}>
        {initial
          ? "Save vehicle details"
          : seller
            ? "Save draft & notify team"
            : "Create draft vehicle"}
      </SubmitButton>
    </form>
  );
}
