import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  guides,
  type GuideContent,
  type GuideTopic,
} from "@/lib/editorial-content";
import styles from "./editorial-guide.module.css";

export function EditorialGuide({
  topic,
  contained = false,
}: {
  topic: GuideTopic;
  contained?: boolean;
}) {
  const guide: GuideContent = guides[topic];
  return (
    <section
      id={`guide-${topic}`}
      className={styles.section}
      aria-labelledby={`guide-${topic}-title`}
    >
      <div className={contained ? undefined : "container"}>
        <div className={guide.image ? styles.split : styles.headerOnly}>
          <header className={styles.header}>
            <span className={styles.eyebrow}>{guide.eyebrow}</span>
            <h2 id={`guide-${topic}-title`}>{guide.title}</h2>
            <p>{guide.intro}</p>
          </header>
          {guide.image && (
            <figure className={styles.visual}>
              <img
                src={`/images/brand/${guide.image}.webp`}
                alt={guide.alt || ""}
                width={960}
                height={640}
                loading="lazy"
              />
            </figure>
          )}
        </div>
        <div
          className={`${styles.items} ${guide.items.length === 4 ? styles.four : ""}`}
        >
          {guide.items.map((item, index) => (
            <article key={item.title}>
              <span className={styles.number}>0{index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        <nav className={styles.links} aria-label={`${guide.title} resources`}>
          {guide.links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </nav>
        {guide.resource && (
          <p className={styles.resource}>
            Further reading:{" "}
            <a href={guide.resource.href} target="_blank" rel="noreferrer">
              {guide.resource.label}
              <ArrowUpRight size={13} />
            </a>
          </p>
        )}
      </div>
    </section>
  );
}

export function HomeReading() {
  return (
    <section
      className={`${styles.section} ${styles.reading}`}
      aria-labelledby="home-reading-title"
    >
      <div className="container">
        <header className={styles.header}>
          <span className={styles.eyebrow}>GOOD TO KNOW BEFORE YOU GO</span>
          <h2 id="home-reading-title">
            A little reading. A clearer next step.
          </h2>
          <p>Practical guides for the decisions around your next vehicle.</p>
        </header>
        <div className={styles.readingCards}>
          {[
            {
              image: "test-drive",
              title: "Build a better shortlist",
              text: "Budget, body type, history and the questions to ask on a visit.",
              href: "/cars#guide-passenger",
              action: "Read the buying guide",
            },
            {
              image: "inspection",
              title: "Get ready to sell",
              text: "A simple guide to price checks, private drafts, photos and documents.",
              href: "/selling-guide",
              action: "Explore selling steps",
            },
            {
              image: "planning",
              title: "Make sense of the numbers",
              text: "Understand down payments, loan tenure and the cost beyond an EMI.",
              href: "/finance",
              action: "Explore finance basics",
            },
          ].map((item) => (
            <Link
              href={item.href}
              className={styles.readingCard}
              key={item.href}
            >
              <img
                src={`/images/brand/${item.image}.webp`}
                alt=""
                width={960}
                height={640}
                loading="lazy"
              />
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <span>
                  {item.action}
                  <ArrowUpRight size={15} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
