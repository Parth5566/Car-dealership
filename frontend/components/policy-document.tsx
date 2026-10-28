import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { CookiePreferences } from "./cookie-preferences";
import {
  getPolicy,
  policyOrder,
  policyReadingMinutes,
  policyUpdated,
  type Policy,
} from "@/lib/policies";
import { resolveBusiness } from "@/lib/business";
import type { Settings } from "@/lib/types";
import styles from "./policy-document.module.css";

function Contents({ policy, label }: { policy: Policy; label: string }) {
  return (
    <nav className={styles.contents} aria-label={label}>
      <ol>
        {policy.sections.map((section, index) => (
          <li key={section.id}>
            <a href={`#${section.id}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>{section.title}</span>
            </a>
          </li>
        ))}
      </ol>
      {policy.shortTitle === "Cookies & preferences" && (
        <a className={styles.preferenceLink} href="#cookie-preferences">
          Your preferences <ArrowUpRight size={14} />
        </a>
      )}
      <a className={styles.preferenceLink} href="#policy-contact">
        Contact & questions <ArrowUpRight size={14} />
      </a>
    </nav>
  );
}

export function PolicyDocument({
  slug,
  policy,
  settings,
}: {
  slug: string;
  policy: Policy;
  settings: Partial<Settings>;
}) {
  const business = resolveBusiness(settings);
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className="container">
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <ChevronRight size={12} />
            <Link href="/policies/terms">Policies & agreements</Link>
            <ChevronRight size={12} />
            <span>{policy.shortTitle}</span>
          </nav>
          <div className={styles.heroInner}>
            <div>
              <span className={styles.eyebrow}>
                <ShieldCheck size={15} />
                {policy.category}
              </span>
              <h1>{policy.title}</h1>
              <p>{policy.description}</p>
              <div className={styles.meta}>
                <span>
                  <CalendarDays size={14} />
                  Updated {policyUpdated}
                </span>
                <span>
                  <Clock3 size={14} />
                  {policyReadingMinutes(policy)} min read
                </span>
                <span className={styles.draft}>Draft for review</span>
              </div>
            </div>
            <div className={styles.heroMark} aria-hidden="true">
              <FileText size={67} strokeWidth={1} />
              <span>NCR WHEELZ</span>
            </div>
          </div>
        </div>
      </header>
      <div className={`container ${styles.layout}`}>
        <aside className={styles.sidebar}>
          <div className={styles.sideCard}>
            <p className={styles.sideLabel}>ON THIS PAGE</p>
            <Contents policy={policy} label="Policy contents" />
          </div>
          <nav
            className={styles.policyNav}
            aria-label="All policies and agreements"
          >
            <p className={styles.sideLabel}>POLICIES & AGREEMENTS</p>
            {policyOrder.map((key) => (
              <Link
                key={key}
                href={`/policies/${key}`}
                aria-current={slug === key ? "page" : undefined}
              >
                {getPolicy(key)?.shortTitle}
                <ChevronRight size={13} />
              </Link>
            ))}
          </nav>
        </aside>
        <div className={styles.main}>
          <details className={styles.mobileContents}>
            <summary>
              In this document <ChevronDown size={17} />
            </summary>
            <Contents policy={policy} label="Mobile policy contents" />
          </details>
          <article className={styles.paper} aria-label={policy.title}>
            <section
              className={styles.summary}
              aria-labelledby="policy-summary-title"
            >
              <span className={styles.summaryIcon} aria-hidden="true">
                <ShieldCheck size={23} />
              </span>
              <div>
                <h2 id="policy-summary-title">At a glance</h2>
                <ul>
                  {policy.summary.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </div>
            </section>
            <p className={styles.scopeNote}>
              These pages describe the website’s current services.
              Vehicle-specific sale, payment, transfer and warranty terms must
              be confirmed separately in writing.
            </p>
            <div className={styles.sections}>
              {policy.sections.map((section, index) => (
                <section
                  className={styles.section}
                  id={section.id}
                  key={section.id}
                  aria-labelledby={`${section.id}-title`}
                >
                  <div className={styles.sectionHeading}>
                    <span className={styles.sectionNumber} aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2 id={`${section.id}-title`}>{section.title}</h2>
                  </div>
                  <div className={styles.sectionBody}>
                    {section.paragraphs.map((text) => (
                      <p key={text}>{text}</p>
                    ))}
                    {section.points && (
                      <ul>
                        {section.points.map((text) => (
                          <li key={text}>{text}</li>
                        ))}
                      </ul>
                    )}
                    {section.note && (
                      <p className={styles.note}>{section.note}</p>
                    )}
                  </div>
                </section>
              ))}
            </div>
            {slug === "cookies" && (
              <section
                className={styles.preferences}
                id="cookie-preferences"
                aria-label="Cookie preference controls"
              >
                <CookiePreferences />
              </section>
            )}
            <section
              className={styles.contact}
              id="policy-contact"
              aria-labelledby="policy-contact-title"
            >
              <div className={styles.contactHeading}>
                <Mail size={21} />
                <h2 id="policy-contact-title">Questions about this policy?</h2>
              </div>
              <p>
                Contact {business.name} with the relevant listing, enquiry or
                submission reference. We can help explain the website process
                and direct your question.
              </p>
              <div className={styles.contactDetails}>
                {business.email && (
                  <a href={`mailto:${business.email}`}>
                    <Mail size={15} />
                    {business.email}
                  </a>
                )}
                {business.phones.map((phone) => (
                  <a href={phone.href} key={phone.href}>
                    <Phone size={15} />
                    {phone.display}
                  </a>
                ))}
                {business.address && (
                  <span>
                    <MapPin size={15} />
                    {business.address}
                  </span>
                )}
              </div>
              <Link className={styles.contactAction} href="/contact">
                Send an enquiry <ArrowUpRight size={15} />
              </Link>
            </section>
          </article>
          <section
            className={styles.related}
            aria-labelledby="related-policies-title"
          >
            <div className={styles.relatedHeading}>
              <h2 id="related-policies-title">Related policies</h2>
              <a href="#main">Back to top ↑</a>
            </div>
            <div className={styles.relatedGrid}>
              {policy.related.map((key) => {
                const related = getPolicy(key);
                return related ? (
                  <Link href={`/policies/${key}`} key={key}>
                    <FileText size={20} />
                    <span>{related.shortTitle}</span>
                    <ArrowUpRight size={16} />
                  </Link>
                ) : null;
              })}
            </div>
          </section>
          <nav
            className={styles.mobilePolicyNav}
            aria-label="Browse all policies"
          >
            <span>Browse all policies</span>
            {policyOrder
              .filter((key) => key !== slug)
              .map((key) => (
                <Link href={`/policies/${key}`} key={key}>
                  {getPolicy(key)?.shortTitle}
                </Link>
              ))}
          </nav>
          <Link className={styles.back} href="/">
            <ArrowLeft size={14} />
            Back to NCR Wheelz
          </Link>
        </div>
      </div>
    </div>
  );
}
