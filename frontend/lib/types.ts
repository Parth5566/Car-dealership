export type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "admin" | "sales" | "reviewer";
  permissions: string[];
};
export type Vehicle = {
  id: number;
  slug: string;
  type: "passenger" | "commercial";
  make: string;
  model: string;
  variant: string;
  year: number;
  price: number;
  mileage: number; // Total kilometres driven; retained legacy API name.
  fuel_economy?: number | null;
  fuel: string;
  transmission: string;
  location: string;
  body_type: string;
  owners: number;
  description: string;
  payload_kg?: number | null;
  seats?: number | null;
  features: string[];
  status: string;
  featured: boolean;
  is_sample?: boolean;
  seo_title?: string;
  seo_description?: string;
  images: { id: number; url: string; alt_text: string; sort_order: number }[];
  created_at: string;
  unavailable?: boolean;
};
export type Settings = {
  business_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  about: string;
  home_headline: string;
  contact_customized?: boolean;
  phone_secondary?: string;
  hours?: string;
  maps_url?: string;
  map_embed?: string;
};
export type Paged<T> = { items: T[]; total: number; page: number };
export type InventoryReview = {
  id: number;
  expected_version: string;
  status: string;
  approved: boolean;
  data: Omit<Vehicle, "id" | "slug" | "images" | "status" | "created_at">;
  images: Vehicle["images"];
};
export type PublicationCandidate = Omit<InventoryReview, "approved"> & {
  vehicle_id: number | null;
  inventory_approved: boolean | null;
};
export const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  })
    .format(value)
    // Currency spacing varies with runtime locale data; keep SSR text stable.
    .replace(/\s/g, "");
const displayLabels: Record<string, string> = {
  passenger: "Passenger car",
  commercial: "Commercial cab",
  make: "Vehicle brand",
  model: "Model name",
  variant: "Variant",
  year: "Year of manufacture",
  price: "Selling price",
  mileage: "Kilometres driven",
  fuel_economy: "Mileage / fuel economy",
  fuel: "Fuel type",
  transmission: "Transmission",
  body_type: "Vehicle style",
  location: "City / area",
  owners: "Number of owners",
  payload_kg: "Load capacity (kg)",
  seats: "Number of seats",
  seo_title: "Search result title",
  seo_description: "Search result summary",
  rc: "Vehicle registration certificate (RC)",
  ownership_authority: "Proof of ownership or permission to sell",
  insurance: "Insurance document",
  puc: "Pollution certificate (PUC)",
  loan_status: "Vehicle loan details",
  challans: "Traffic fine details (challans)",
  fitness: "Fitness certificate",
  permit: "Commercial cab permit",
  tax: "Vehicle tax receipt",
  draft_contacted: "Seller contacted",
};
export const label = (s: string) =>
  displayLabels[s] ||
  s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const fuelEconomyUnit = (fuel: string) =>
  fuel === "Electric" ? "km/kWh" : fuel === "CNG" ? "km/kg" : "km/l";
export function fuelEconomy(vehicle: Pick<Vehicle, "fuel" | "fuel_economy">) {
  const value = vehicle.fuel_economy;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? `${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${fuelEconomyUnit(vehicle.fuel)}`
    : null;
}
export const date = (s: string) =>
  new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z").toLocaleString(
    "en-IN",
    { dateStyle: "medium", timeStyle: "short" },
  );
