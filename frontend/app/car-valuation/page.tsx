import { pageMetadata } from "@/lib/seo";
import { PageSchema } from "@/components/structured-data";
import Link from "next/link";
import { EditorialGuide } from "@/components/editorial-guide";
import { CarValuation } from "@/components/car-valuation";
import { serverApi } from "@/lib/server";
import type { ValuationOption } from "@/lib/valuation";
import "./valuation.css";

export const metadata = pageMetadata("/car-valuation");
export default async function Page() {
  const { data, error } = await serverApi<{
    items: ValuationOption[];
    market_enabled?: boolean;
  }>("/valuation/options");
  return (
    <div className="valuation-page">
      <PageSchema path="/car-valuation" />
      <div className="container valuation-content">
        <nav className="valuation-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">›</span>
          <span>Used car valuation</span>
        </nav>
        <header className="valuation-heading">
          <h1>Used Car Valuation</h1>
          <p>
            Buying or selling? Compare similar cars to check an indicative
            asking-price range.
          </p>
        </header>
        <CarValuation
          options={data?.items || []}
          optionsUnavailable={Boolean(error)}
          marketEnabled={data?.market_enabled === true}
          currentYear={new Date().getUTCFullYear()}
        />
        <EditorialGuide topic="valuation" contained />
        <section
          className="valuation-faq"
          aria-labelledby="valuation-faq-heading"
        >
          <h2 id="valuation-faq-heading">Used Car Valuation FAQs</h2>
          {[
            [
              "Can I check a car’s value before buying it?",
              "Yes. Choose Buyer and enter the car’s details to see comparable asking prices when enough matches are available. Review the car’s condition, service history and documents before deciding what to pay.",
            ],
            [
              "Is the displayed range a guaranteed selling price?",
              "No. The range reflects comparable advertised prices, with the data source shown in the result. It is not a purchase offer or confirmed transaction price. A physical assessment and negotiation can change the final amount.",
            ],
            [
              "Why might my car not have a price range?",
              "An estimate needs at least one usable similar listing. We allow nearby years, different Variants and owner counts. With limited data we show an approximate range; if no usable listings are available, you can request a price review.",
            ],
            [
              "Is the tool free, and do I need to share my phone number?",
              "The price check is free and does not require sign-in or a phone number. If you choose to request a review afterwards, the enquiry form asks for contact details so the team can respond.",
            ],
            [
              "What is the difference between kilometres driven and mileage?",
              "Kilometres driven is the total distance recorded on the odometer. Mileage usually means fuel economy, such as kilometres per litre. This calculator asks for the total distance driven.",
            ],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </section>
      </div>
    </div>
  );
}
