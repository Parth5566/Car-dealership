import { pageMetadata } from "@/lib/seo";
import { PageSchema } from "@/components/structured-data";
import Link from "next/link";
import { ArrowUpRight, BadgePercent, Sparkles } from "lucide-react";
import { Faq } from "@/components/faq";
import { serverApi } from "@/lib/server";
import type { PublicOffer } from "@/lib/offers";
import { OfferCard } from "@/components/offer-card";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata("/discounts");
export default async function Page() {
  const { data, error } = await serverApi<{ items: PublicOffer[] }>("/offers");
  const active = data?.items || [];
  return (
    <>
      <PageSchema path="/discounts" />
      <section className="page-heading offers-heading">
        <div className="container">
          <span className="eyebrow">
            <BadgePercent size={22} /> A LITTLE EXTRA TO SMILE ABOUT
          </span>
          <h1>
            Good drives.
            <br />
            <em>Better possibilities.</em>
          </h1>
          <p>
            Explore offers for your next chapter, from the everyday commute to
            your business’s next move.
          </p>
        </div>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DISCOUNTS & OFFERS</span>
            <h2>
              {active.length
                ? "Find your next saving."
                : "Let’s find the right deal for you."}
            </h2>
          </div>
          <Link href="/contact" className="text-link">
            Ask about current pricing <ArrowUpRight size={18} />
          </Link>
        </div>
        {!active.length && (
          <p className="sample-disclosure">
            <Sparkles size={22} />{" "}
            {error
              ? "We couldn’t load our offers. Please try again shortly or contact the showroom."
              : "No offers are running right now. Ask our team about current pricing, or check back for our next special."}
          </p>
        )}
        <div className="offer-grid">
          {active.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      </section>
      <section className="container visit-banner">
        <div>
          <span className="eyebrow">MAKE THE NUMBERS WORK FOR YOU</span>
          <h2>What could your monthly payment look like?</h2>
          <p>Explore price, down payment and tenure with our EMI calculator.</p>
        </div>
        <Link className="btn primary" href="/emi-calculator">
          Calculate EMI <ArrowUpRight size={18} />
        </Link>
      </section>
      <Faq topic="discounts" />
    </>
  );
}
