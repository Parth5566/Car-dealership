import Link from "next/link";
import {
  ArrowUpRight,
  BadgePercent,
  CalendarDays,
  Gift,
  Sparkles,
  Star,
  CarFront,
} from "lucide-react";
import type { OfferContent } from "@/lib/offers";
import { offerDate } from "@/lib/offers";

export function OfferCard({
  offer,
  preview = false,
}: {
  offer: OfferContent;
  preview?: boolean;
}) {
  const Icon =
    { gift: Gift, sparkles: Sparkles, badge: BadgePercent, truck: CarFront }[
      offer.icon
    ] || Gift;
  return (
    <article
      className={`deal-card deal-${offer.theme} deal-pattern-${offer.pattern}${offer.featured ? " deal-featured" : ""}`}
    >
      <div className="deal-top">
        <span className="deal-badge">{offer.badge || "SPECIAL OFFER"}</span>
        <Icon size={24} aria-hidden="true" />
      </div>
      {offer.featured && (
        <span className="deal-pick">
          <Star size={13} aria-hidden="true" /> Showroom pick
        </span>
      )}
      <strong className="deal-benefit">
        {offer.benefit || "Your next great deal"}
      </strong>
      <h3>{offer.title || "Give your offer a headline"}</h3>
      <p className="deal-description">
        {offer.description || "Tell customers what makes this offer special."}
      </p>
      <p className="deal-eligibility">
        <b>Applies to:</b>{" "}
        {offer.eligibility || "Add eligible vehicles or customers"}
      </p>
      {offer.expires_at && (
        <p className="deal-expiry">
          <CalendarDays size={16} aria-hidden="true" /> Ends{" "}
          {offerDate(offer.expires_at)} IST
        </p>
      )}
      {offer.coupon_code && (
        <div className="deal-code">
          <span>Mention this code</span>
          <strong>{offer.coupon_code}</strong>
        </div>
      )}
      <details className="deal-terms">
        <summary>Offer terms</summary>
        <p>{offer.terms || "Your offer terms will appear here."}</p>
      </details>
      {preview ? (
        <span className="btn deal-cta">
          {offer.cta_label} <ArrowUpRight size={17} aria-hidden="true" />
        </span>
      ) : (
        <Link
          className="btn deal-cta"
          href={
            offer.cta_href === "/contact"
              ? `/contact?offer=${encodeURIComponent(offer.title)}`
              : offer.cta_href
          }
        >
          {offer.cta_label} <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}
