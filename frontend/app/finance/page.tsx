import { pageMetadata } from "@/lib/seo";
import { PageSchema } from "@/components/structured-data";
import Link from "next/link";
import { Faq } from "@/components/faq";
import { EditorialGuide } from "@/components/editorial-guide";
export const metadata = pageMetadata("/finance");
export default function Page() {
  return (
    <>
      <PageSchema path="/finance" />
      <div className="page-heading">
        <div className="container">
          <span className="eyebrow">PLAN WITH PERSPECTIVE</span>
          <h1>Make room for the road ahead.</h1>
          <p>General information to help you prepare questions for a lender.</p>
        </div>
      </div>
      <EditorialGuide topic="finance" />
      <div className="container section content-width prose">
        <div className="notice info">
          No lender partnership or application service is currently configured.
          NCR Wheelz does not guarantee finance approval. This information is
          general and is not financial advice.
        </div>
        <h2>Prepare for a document request</h2>
        <p>
          A lender may ask for identity or address evidence, income information,
          bank statements, and vehicle documents. The exact checklist is set by
          the lender. Share sensitive information only through an authorised,
          secure lender channel. Do not upload Aadhaar to NCR Wheelz.
        </p>
        <h2>Explore an illustrative scenario</h2>
        <p>
          The EMI calculator uses a monthly reducing-balance formula and
          excludes extra charges. Use it to explore assumptions; confirm actual
          terms directly with your lender.
        </p>
        <Link href="/emi-calculator" className="btn primary">
          Open EMI calculator ↗
        </Link>
        <p style={{ marginTop: 25 }}>
          <Link href="/policies/finance" className="text-link">
            Read the draft finance disclaimer
          </Link>
        </p>
      </div>
      <Faq topic="finance" />
    </>
  );
}
