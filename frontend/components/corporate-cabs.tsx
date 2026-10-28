import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CarFront,
  IndianRupee,
  MapPin,
  Route,
} from "lucide-react";
import styles from "./corporate-cabs.module.css";

export const corporateCabEnquiry =
  "/contact?service=corporate-cab#contact-form";

const benefits = [
  {
    Icon: CarFront,
    title: "Start with the right cab",
    text: "Explore yellow-plate passenger cabs for office transport. Already own one? Ask our team whether it suits an available assignment.",
  },
  {
    Icon: Building2,
    title: "Connect with corporate offices",
    text: "We help attach suitable cabs to corporate and MNC offices for employee transport, based on their current vehicle and route requirements.",
  },
  {
    Icon: IndianRupee,
    title: "Work towards regular income",
    text: "Explore ongoing office duties and discuss a monthly payment arrangement. Understand the work, running costs and payment terms before you decide.",
  },
];

export function CorporateCabs({
  variant = "commercial",
}: {
  variant?: "home" | "about" | "commercial";
}) {
  const compact = variant === "home";
  return (
    <section
      id="corporate-cab-attachment"
      className={styles.section}
      aria-labelledby="corporate-cabs-title"
    >
      <div className="container">
        <div className={styles.panel}>
          <div className={styles.intro}>
            <header className={styles.heading}>
              <span className={styles.eyebrow}>
                A CAB. A CONNECTION. A WAY FORWARD.
              </span>
              <h2 id="corporate-cabs-title">
                {variant === "about"
                  ? "Helping cab owners take the next step."
                  : "Your cab. A corporate connection."}
              </h2>
              <p>
                {variant === "about"
                  ? "Our support goes beyond finding a vehicle. NCR Wheelz also helps connect commercial cab owners with corporate and MNC office transport opportunities in Delhi NCR."
                  : "Put your next drive to work. Alongside commercial cabs, NCR Wheelz helps owners explore corporate and MNC office attachments in Delhi NCR for more regular work."}
              </p>
              <Link href={corporateCabEnquiry} className={styles.primary}>
                Enquire about cab attachment <ArrowUpRight size={18} />
              </Link>
            </header>
            <div className={styles.visual} aria-hidden="true">
              <div className={styles.visualTop}>
                <span>
                  <MapPin size={13} /> DELHI NCR
                </span>
                <span>CORPORATE MOBILITY</span>
              </div>
              <div className={styles.connection}>
                <div className={styles.cab}>
                  <CarFront size={62} strokeWidth={1.2} />
                  <span className={styles.plate}>YOUR CAB</span>
                </div>
                <div className={styles.route}>
                  <span />
                  <Route size={25} />
                  <span />
                </div>
                <div className={styles.office}>
                  <Building2 size={68} strokeWidth={1.1} />
                  <span>THE OFFICE</span>
                </div>
              </div>
              <div className={styles.duty}>
                <span className={styles.dutyIcon}>
                  <CalendarDays size={20} />
                </span>
                <div>
                  <strong>A route to regular work</strong>
                  <span>Office commutes · Corporate duties</span>
                </div>
                <ArrowUpRight size={18} />
              </div>
            </div>
          </div>
          <div className={styles.cards}>
            {benefits.map(({ Icon, title, text }, index) => (
              <article className={styles.card} key={title}>
                <div className={styles.cardTop}>
                  <span className={styles.cardIcon}>
                    <Icon size={24} strokeWidth={1.6} />
                  </span>
                  <span className={styles.number}>0{index + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          {!compact && (
            <div className={styles.process}>
              <div className={styles.processHeading}>
                <span className={styles.eyebrow}>LET’S GET STARTED</span>
                <h3>From your first enquiry to the working details.</h3>
              </div>
              <ol className={styles.steps}>
                <li>
                  <strong>Tell us what you need</strong>
                  <p>
                    Share your cab’s model, year and operating area, or let us
                    know you want to buy a cab for corporate work.
                  </p>
                </li>
                <li>
                  <strong>Discuss a suitable opportunity</strong>
                  <p>
                    Our team will discuss current requirements, vehicle
                    suitability and the routes or office duties available.
                  </p>
                </li>
                <li>
                  <strong>Understand the arrangement</strong>
                  <p>
                    Confirm the duty hours, payment schedule and responsibility
                    for driver, fuel and maintenance costs.
                  </p>
                </li>
              </ol>
            </div>
          )}
          <footer className={styles.footer}>
            <p>
              Attachments depend on available assignments and vehicle
              eligibility. Any fixed monthly payment must be agreed in the
              contract; take-home income also depends on your running costs.
            </p>
            <Link
              href={
                compact
                  ? "/commercial#corporate-cab-attachment"
                  : corporateCabEnquiry
              }
            >
              {compact
                ? "Explore corporate cab opportunities"
                : "Discuss your cab with us"}{" "}
              <ArrowRight size={17} />
            </Link>
          </footer>
        </div>
      </div>
    </section>
  );
}
