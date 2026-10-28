import { pageMetadata } from "@/lib/seo";
import { PageSchema } from "@/components/structured-data";
import Link from "next/link";
import { EditorialGuide } from "@/components/editorial-guide";
import { Faq } from "@/components/faq";
import styles from "@/components/editorial-guide.module.css";

export const metadata = pageMetadata("/selling-guide");

export default function Page() {
  return (
    <>
      <PageSchema path="/selling-guide" />
      <header className="page-heading">
        <div className="container">
          <span className="eyebrow">READY FOR THE NEXT CHAPTER?</span>
          <h1>A simple guide to selling your vehicle.</h1>
          <p>
            Prepare the details first. Start a private draft when you are ready.
          </p>
        </div>
      </header>
      <EditorialGuide topic="selling" />
      <section
        className={`${styles.section} ${styles.reading}`}
        aria-labelledby="selling-paperwork"
      >
        <div className="container">
          <header className={styles.header}>
            <span className={styles.eyebrow}>KEEP THE PAPERWORK IN VIEW</span>
            <h2 id="selling-paperwork">
              The listing review is one step. Ownership transfer is another.
            </h2>
            <p>
              A website submission does not transfer ownership or complete a
              sale. Before proceeding, confirm the vehicle’s registration and
              insurance details, any outstanding finance, and the process
              applicable to the buyer and seller.
            </p>
          </header>
          <div className={styles.items} style={{ marginTop: 28 }}>
            <article>
              <h3>Check the vehicle records</h3>
              <p>
                Keep registration, insurance and available service records
                ready. Make sure names and vehicle details are consistent, and
                ask the team about any missing information.
              </p>
            </article>
            <article>
              <h3>Clarify finance and commercial use</h3>
              <p>
                If finance is recorded against the vehicle, ask the lender about
                its closure and release process. Commercial cabs may need
                additional fitness, permit or tax documents depending on their
                use.
              </p>
            </article>
            <article>
              <h3>Agree on the handover details</h3>
              <p>
                Confirm the agreed price, payment arrangements, transfer
                responsibilities and handover record with the other party. Check
                the current requirements with the relevant transport authority
                and insurer.
              </p>
            </article>
          </div>
          <p className={styles.resource}>
            Official references:{" "}
            <a
              href="https://parivahan.gov.in/parivahan/en/content/download-forms"
              target="_blank"
              rel="noreferrer"
            >
              Parivahan forms and transport services ↗
            </a>{" "}
            ·{" "}
            <a
              href="https://irdai.gov.in/web/policy-holder/motor-insurance"
              target="_blank"
              rel="noreferrer"
            >
              IRDAI motor insurance information ↗
            </a>
          </p>
          <div className={styles.links}>
            <Link href="/sell" className="btn primary">
              Start your private draft ↗
            </Link>
            <Link href="/account/submissions">View your submissions ↗</Link>
          </div>
        </div>
      </section>
      <Faq topic="selling" />
    </>
  );
}
