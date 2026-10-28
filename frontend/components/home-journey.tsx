import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import styles from "./home-journey.module.css";

type ArtKind = "compare" | "value" | "drive" | "help";

// Original vector artwork. Decorative: the card copy carries its meaning.
export function JourneyArt({ kind }: { kind: ArtKind }) {
  return (
    <svg
      className={styles.illustration}
      viewBox="0 0 144 144"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="#193B42"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === "compare" && (
          <>
            <rect
              x="16"
              y="25"
              width="68"
              height="86"
              rx="12"
              fill="#F2C671"
              transform="rotate(-12 16 25)"
            />
            <rect
              x="52"
              y="17"
              width="68"
              height="86"
              rx="12"
              fill="#7EB3A1"
              transform="rotate(12 52 17)"
            />
            <rect x="32" y="35" width="78" height="92" rx="13" fill="#FFF9ED" />
            <path
              d="m45 77 7-18a6 6 0 0 1 6-4h27a6 6 0 0 1 6 4l7 18"
              fill="#9ACABD"
            />
            <rect x="42" y="75" width="60" height="28" rx="9" fill="#6FAD9B" />
            <path d="M49 103v5m46-5v5m-38-20h2m26 0h2m-22 4q7 6 14 0M56 117h30" />
            <path d="m111 18 3-7m9 19 7-2M17 121l-5 5" />
            <circle cx="20" cy="49" r="3" fill="#F2C671" stroke="none" />
          </>
        )}
        {kind === "value" && (
          <>
            <path d="m109 16 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="#FFF9ED" />
            <path
              d="M25 79a39 39 0 0 1 78 0v17a25 25 0 0 1-25 25H56a31 31 0 0 1-31-31Z"
              fill="#90C2AE"
            />
            <path
              d="M26 65V48a25 25 0 0 1 25-25h24a23 23 0 0 1 23 23v16Z"
              fill="#FFF9ED"
            />
            <path d="M26 62h82q8 0 8 7H21q-5-7 5-7Z" fill="#F2C671" />
            <path d="M65 24v37" />
            <circle cx="50" cy="85" r="3" fill="#193B42" stroke="none" />
            <circle cx="80" cy="85" r="3" fill="#193B42" stroke="none" />
            <path d="M54 99q11 12 23 0" />
            <ellipse
              cx="37"
              cy="96"
              rx="6"
              ry="3"
              fill="#F0B48D"
              stroke="none"
            />
            <circle cx="110" cy="108" r="23" fill="#F2C671" />
            <path
              d="M101 98h17m-17 5h17m-12-5q13 1 7 8-3 3-10 2l12 12"
              strokeWidth="2.7"
            />
            <path d="m15 39-4-5M19 112l-5 3" />
          </>
        )}
        {kind === "drive" && (
          <>
            <path
              d="M28 86 39 53a12 12 0 0 1 12-9h42a12 12 0 0 1 12 9l11 33"
              fill="#F2C671"
            />
            <path d="m42 77 7-22h43l7 22Z" fill="#FFF9ED" />
            <path d="M72 55v22" />
            <rect x="23" y="79" width="99" height="36" rx="13" fill="#81B7A5" />
            <path d="M34 115v8h12v-8m53 0v8h12v-8" fill="#193B42" />
            <circle cx="42" cy="94" r="5" fill="#FFF9ED" />
            <circle cx="102" cy="94" r="5" fill="#FFF9ED" />
            <path d="M62 99q10 8 20 0M15 129h115" />
            <path d="M44 30q28-15 54 0m-7-10 8 11-13 3" />
            <path d="m13 59 4 4m109-17 4-4m-6 23 7 1" />
          </>
        )}
        {kind === "help" && (
          <>
            <path
              d="M27 132v-6a31 31 0 0 1 31-31h21a31 31 0 0 1 31 31v6"
              fill="#79AE9A"
            />
            <path d="M56 98q12 16 25 0v-9H56Z" fill="#EAB38D" />
            <path
              d="M36 57a33 33 0 0 1 66 0v14a33 33 0 0 1-66 0Z"
              fill="#F2C7A3"
            />
            <path
              d="M36 64q18-3 23-24 14 18 43 15V44q-2-28-34-27-35 2-32 47Z"
              fill="#193B42"
            />
            <path d="M29 64v-8a40 40 0 0 1 80 0v10" />
            <rect x="26" y="60" width="12" height="24" rx="6" fill="#F2C671" />
            <rect x="100" y="60" width="12" height="24" rx="6" fill="#F2C671" />
            <path d="M108 84v5q0 8-17 8h-8" />
            <circle cx="54" cy="70" r="2.5" fill="#193B42" stroke="none" />
            <circle cx="83" cy="70" r="2.5" fill="#193B42" stroke="none" />
            <path d="M61 83q7 7 15 0" />
            <path
              d="M108 15h17a9 9 0 0 1 9 9v5a9 9 0 0 1-9 9h-8l-8 7V34q-10-5-10-10 0-9 9-9Z"
              fill="#FFF9ED"
            />
            <path d="M109 26h15" strokeWidth="2.5" />
          </>
        )}
      </g>
    </svg>
  );
}

const cards: {
  kind: ArtKind;
  metric: string;
  title: string;
  text: string;
  action: string;
  href: string;
}[] = [
  {
    kind: "compare",
    metric: "3 cars",
    title: "One clearer choice",
    text: "Compare your favourites, side by side.",
    action: "Start comparing",
    href: "/compare",
  },
  {
    kind: "value",
    metric: "Free",
    title: "A little price clarity",
    text: "Check an indicative car value before you decide.",
    action: "Check car value",
    href: "/car-valuation",
  },
  {
    kind: "drive",
    metric: "Your pace",
    title: "Get a feel for it",
    text: "Find a car you like and request a test drive.",
    action: "Find your next car",
    href: "/cars",
  },
  {
    kind: "help",
    metric: "Real help",
    title: "A team on your side",
    text: "Ask about a car, the paperwork or your next step.",
    action: "Talk to our team",
    href: "/contact",
  },
];

export function HomeJourney() {
  return (
    <section className={styles.section} aria-labelledby="home-journey-heading">
      <div className="container">
        <div className={styles.heading}>
          <span className={styles.eyebrow}>THE NCR WHEELZ WAY</span>
          <div className={styles.titleRow}>
            <span aria-hidden="true" />
            <h2 id="home-journey-heading">
              Good journeys start with confidence.
            </h2>
            <span aria-hidden="true" />
          </div>
          <p>Tools and support for your next drive.</p>
        </div>
        <ul className={styles.cards}>
          {cards.map((card) => (
            <li key={card.kind}>
              <Link
                className={`${styles.card} ${styles[card.kind]}`}
                href={card.href}
              >
                <div className={styles.art}>
                  <JourneyArt kind={card.kind} />
                </div>
                <div className={styles.copy}>
                  <p className={styles.metric}>{card.metric}</p>
                  <h3>{card.title}</h3>
                  <p className={styles.description}>{card.text}</p>
                  <span className={styles.action}>
                    {card.action}
                    <ArrowUpRight size={15} />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <p className={styles.swipe}>
          Swipe to explore <ArrowRight size={15} aria-hidden="true" />
        </p>
      </div>
    </section>
  );
}
