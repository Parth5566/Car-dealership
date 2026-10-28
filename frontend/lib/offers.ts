export type OfferContent = {
  title: string;
  description: string;
  benefit: string;
  eligibility: string;
  terms: string;
  badge: string;
  theme: "gold" | "midnight" | "emerald" | "rose";
  pattern: "glow" | "rings" | "grid" | "plain";
  icon: "gift" | "sparkles" | "badge" | "truck";
  cta_label: string;
  cta_href: "/contact" | "/cars" | "/commercial";
  coupon_code: string;
  featured: boolean;
  sort_order: number;
  starts_at: string | null;
  expires_at: string | null;
};
export type PublicOffer = OfferContent & { id: number };
export type AdminOffer = PublicOffer & {
  status: "draft" | "published";
  version: number;
  updated_at: string;
};
export const emptyOffer: OfferContent = {
  title: "",
  description: "",
  benefit: "",
  eligibility: "",
  terms: "",
  badge: "SPECIAL OFFER",
  theme: "gold",
  pattern: "glow",
  icon: "gift",
  cta_label: "Enquire about this offer",
  cta_href: "/contact",
  coupon_code: "",
  featured: false,
  sort_order: 0,
  starts_at: null,
  expires_at: null,
};
export function offerState(
  offer: Pick<AdminOffer, "status" | "starts_at" | "expires_at">,
  now = Date.now(),
) {
  if (offer.status === "draft") return "draft";
  if (offer.expires_at && Date.parse(offer.expires_at) <= now) return "expired";
  if (offer.starts_at && Date.parse(offer.starts_at) > now) return "scheduled";
  return "active";
}
export function offerDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
