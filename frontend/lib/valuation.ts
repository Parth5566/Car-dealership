export type ValuationInput = {
  purpose: "buy" | "sell";
  make: string;
  model: string;
  variant: string;
  year: number;
  mileage: number;
  fuel: string;
  transmission: string;
  owners: number;
  owners_at_least?: boolean;
  location: string;
};
export type ValuationResult = {
  status: "available" | "insufficient_data";
  basis: "ncr_wheelz_asking_prices" | "scrappa_cardekho_asking_prices";
  source_label?: string;
  reason?: "not_in_catalog";
  as_of: string;
  count: number;
  minimum_comparables: number;
  range_method?: "estimated_band" | "observed_prices" | null;
  approximation_percent?: number | null;
  range: { low: number; high: number; median: number } | null;
  matching: {
    year_from: number;
    year_to: number;
    kilometres_from: number;
    kilometres_to: number;
    updated_within_days?: number;
    collected_within_hours?: number;
    location_scope?: string;
    inspected_limit?: number;
    broad_matches?: boolean;
  };
  comparables: {
    id: number | string;
    slug?: string;
    href?: string;
    year: number;
    mileage: number;
    price: number;
    variant?: string;
    owners?: number;
  }[];
};
export type ValuationOption = {
  make: string;
  model: string;
  variant: string | null;
  location: string;
  fuel?: string;
  transmission?: string;
};
export function valuationMessage(input: ValuationInput) {
  return `I'd like help ${input.purpose === "buy" ? "checking a buying price for" : "valuing my"} ${input.year} ${input.make} ${input.model} ${input.variant}. ${input.mileage.toLocaleString("en-IN")} km driven; ${input.fuel}; ${input.transmission}; ${input.owners}${input.owners_at_least ? " or more" : ""} owner(s); ${input.location}. Please help me review its condition and price.`;
}
