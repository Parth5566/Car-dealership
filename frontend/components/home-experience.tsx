"use client";
import { useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ClipboardCheck,
  CarFront,
  Calculator,
  MessagesSquare,
  BadgeIndianRupee,
  LockKeyhole,
  Images,
  ListChecks,
} from "lucide-react";
import { ProcessArt } from "./process-art";
import styles from "./home-experience.module.css";

const content = {
  buy: {
    title: "A clearer way to find your next car.",
    intro:
      "Useful details. A little planning. A conversation when you’re ready.",
    cards: [
      {
        image: "benefit-details",
        alt: "Illustrative vehicle specialist inspecting a car’s tyre and wheel",
        icon: ClipboardCheck,
        title: "Look beyond the photos",
        text: "Compare kilometres, ownership and specifications. Ask about condition and service history.",
      },
      {
        image: "benefit-drive",
        alt: "Illustrative buyer exploring a parked burgundy hatchback",
        icon: CarFront,
        title: "Get a feel for the drive",
        text: "Find a car you like and request a test drive. The team confirms its availability and timing.",
      },
      {
        image: "benefit-budget",
        alt: "Illustrative overhead arrangement of a calculator, notebook and car keys",
        icon: Calculator,
        title: "Plan the whole budget",
        text: "Explore an indicative EMI and leave room for insurance, fees and running costs.",
      },
      {
        image: "benefit-advice",
        alt: "Illustrative advisor and buyer talking in a showroom lounge",
        icon: MessagesSquare,
        title: "Talk through the details",
        text: "Ask about the car, its paperwork and the next step before making a decision.",
      },
    ],
    steps: [
      {
        art: "browse",
        title: "Find your shortlist",
        text: "Browse by budget and the details that matter. Compare up to three vehicles side by side.",
      },
      {
        art: "drive",
        title: "See how it feels",
        text: "Send a test-drive request from a listing. Use your visit to look closely and ask questions.",
      },
      {
        art: "next",
        title: "Choose your next step",
        text: "Discuss the condition, final price and paperwork with the team before proceeding.",
      },
    ],
    action: "Browse passenger cars",
    href: "/cars",
    more: "Explore buying guidance",
    moreHref: "/cars#guide-passenger",
  },
  sell: {
    title: "Your vehicle’s next chapter starts here.",
    intro:
      "Start with a price guide, share the details and follow the review from your account.",
    cards: [
      {
        image: "benefit-budget",
        alt: "Illustrative car-price planning with a calculator, notebook and keys",
        icon: BadgeIndianRupee,
        title: "Start with a price check",
        text: "Use an indicative valuation as a starting point. Your car’s condition still needs an individual look.",
      },
      {
        image: "benefit-advice",
        alt: "Illustrative vehicle discussion with an advisor in a showroom lounge",
        icon: LockKeyhole,
        title: "Keep your draft private",
        text: "Save the details to your account. A draft is visible to you and authorised staff.",
      },
      {
        image: "benefit-details",
        alt: "Illustrative specialist checking a car’s tyre and wheel condition",
        icon: Images,
        title: "Tell the full story",
        text: "Add clear photos, describe the condition and upload the documents requested in your checklist.",
      },
      {
        image: "benefit-drive",
        alt: "Illustrative view of a buyer beside a parked hatchback",
        icon: ListChecks,
        title: "Follow the review",
        text: "See requests for more information and review progress online. Publication is a separate staff step.",
      },
    ],
    steps: [
      {
        art: "browse",
        title: "Share the essentials",
        text: "Enter your brand, model, variant, year, kilometres driven and expected price in a private draft.",
      },
      {
        art: "drive",
        title: "Add photos and documents",
        text: "Show the vehicle clearly and complete the checklist for passenger or commercial cabs.",
      },
      {
        art: "next",
        title: "Follow up from your account",
        text: "Submit for manual review, respond to questions and discuss a suitable next step with the team.",
      },
    ],
    action: "Start a private draft",
    href: "/sell",
    more: "Read the selling guide",
    moreHref: "/selling-guide",
  },
} as const;

export function HomeExperience() {
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const id = useId();
  const tabs = useRef<HTMLDivElement>(null);
  const selected = content[mode];
  return (
    <div className={styles.experience}>
      <div className="container">
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Buying and selling with NCR Wheelz"
          ref={tabs}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "buy"
                : event.key === "End"
                  ? "sell"
                  : mode === "buy"
                    ? "sell"
                    : "buy";
            setMode(next);
            tabs.current
              ?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)
              ?.focus();
          }}
        >
          {(["buy", "sell"] as const).map((value) => (
            <button
              type="button"
              key={value}
              id={`${id}-${value}`}
              data-mode={value}
              role="tab"
              aria-selected={mode === value}
              aria-controls={`${id}-panel`}
              tabIndex={mode === value ? 0 : -1}
              onClick={() => setMode(value)}
            >
              {value === "buy" ? "Buy a car" : "Sell a vehicle"}
            </button>
          ))}
        </div>
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-${mode}`}
          tabIndex={0}
        >
          <section
            className={styles.benefits}
            aria-labelledby={`${id}-benefits`}
          >
            <header className={styles.heading}>
              <span>MADE FOR YOUR NEXT MOVE</span>
              <h2 id={`${id}-benefits`}>{selected.title}</h2>
              <p>{selected.intro}</p>
            </header>
            <div className={styles.photoGrid}>
              {selected.cards.map((card) => (
                <article key={card.title} className={styles.photoCard}>
                  <div className={styles.photo}>
                    <img
                      src={`/images/brand/${card.image}.webp`}
                      alt={card.alt}
                      width={960}
                      height={640}
                      loading="lazy"
                    />
                    <span className={styles.photoIcon}>
                      <card.icon
                        size={27}
                        strokeWidth={1.6}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </article>
              ))}
            </div>
            <div className={styles.actions}>
              <Link className="btn primary" href={selected.href}>
                {selected.action}
                <ArrowUpRight size={17} />
              </Link>
              <Link href={selected.moreHref} className="text-link">
                {selected.more}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </section>
          <section className={styles.process} aria-labelledby={`${id}-process`}>
            <header className={styles.heading}>
              <span>ONE STEP AT A TIME</span>
              <h2 id={`${id}-process`}>How NCR Wheelz works</h2>
              <p>
                {mode === "buy"
                  ? "From a first look to a more informed choice."
                  : "From a private draft to a conversation about your vehicle."}
              </p>
            </header>
            <ol className={styles.steps}>
              {selected.steps.map((step, index) => (
                <li key={step.title}>
                  <div className={styles.processArt}>
                    <ProcessArt kind={step.art} />
                    <span className={styles.stepNumber}>0{index + 1}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
