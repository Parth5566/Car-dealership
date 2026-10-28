import { pageMetadata } from "@/lib/seo";
import { PageSchema } from "@/components/structured-data";
import { Suspense } from "react";
import { EmiCalculator } from "@/components/emi";
import { Faq } from "@/components/faq";
import { EditorialGuide } from "@/components/editorial-guide";
export const metadata = pageMetadata("/emi-calculator");
export default function Page() {
  return (
    <>
      <PageSchema path="/emi-calculator" />
      <div className="page-heading">
        <div className="container">
          <span className="eyebrow">PLAN YOUR NEXT MOVE</span>
          <h1>
            Your next drive.
            <br />
            <em>Your kind of budget.</em>
          </h1>
          <p>
            Explore your monthly EMI, total interest and repayment plan. A few
            numbers. A clearer next step.
          </p>
        </div>
      </div>
      <div className="container section">
        <Suspense>
          <EmiCalculator />
        </Suspense>
      </div>
      <EditorialGuide topic="emi" />
      <Faq topic="emi" />
    </>
  );
}
