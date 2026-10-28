import { pageMetadata } from "@/lib/seo";
import { PageSchema } from "@/components/structured-data";
import Link from "next/link";
import {
  ArrowUpRight,
  CarFront,
  HeartHandshake,
  MessageCircle,
  MapPin,
} from "lucide-react";
import { Faq } from "@/components/faq";
import { CorporateCabs } from "@/components/corporate-cabs";
import { EditorialGuide } from "@/components/editorial-guide";
import { serverApi } from "@/lib/server";
import type { Settings } from "@/lib/types";
export const metadata = pageMetadata("/about");
export default async function Page() {
  const { data: settings } = await serverApi<Settings>("/settings");
  return (
    <>
      <PageSchema path="/about" />
      <section className="about-hero">
        <div className="container about-hero-grid">
          <div>
            <span className="eyebrow light">DELHI ROOTS. NEW ROADS.</span>
            <h1>
              Every drive
              <br />
              has a <em>story.</em>
            </h1>
            <p>
              The first set of keys. A little more room for the family. A bigger
              step for your business. We’re here for what comes next.
            </p>
            <Link href="/cars" className="btn gold">
              Find your next chapter <ArrowUpRight size={20} />
            </Link>
          </div>
          <div
            className="journey-art"
            aria-label="Passenger cars and commercial cabs for life's next chapter"
          >
            <div className="journey-orbit" />
            <span className="journey-stamp">
              <MapPin size={18} /> MADE FOR DELHI NCR
            </span>
            <div className="journey-car">
              <CarFront size={105} strokeWidth={1.2} />
              <span>For life’s little detours.</span>
            </div>
            <div className="journey-truck">
              <CarFront size={95} strokeWidth={1.2} />
              <span>For your next passenger trip.</span>
            </div>
            <span className="journey-note">New keys. New possibilities. ↗</span>
          </div>
        </div>
      </section>
      <section className="container section story-grid">
        <div>
          <span className="eyebrow">HELLO, WE’RE NCR WHEELZ</span>
          <h2>
            Big decisions feel better
            <br />
            with a human touch.
          </h2>
        </div>
        <div className="story-copy">
          <p className="break-text">
            {settings?.about ||
              "Based in Tilak Nagar, New Delhi, NCR Wheelz brings used passenger cars and commercial cabs into one place. Start with a shortlist, get into the details, and talk to us when you’re ready."}
          </p>
          <p>
            We’re here to help you explore what fits your life, your work and
            your budget. No need to have every answer before you say hello.
          </p>
          <Link className="text-link" href="/contact">
            Get to know the team <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
      <section className="container about-values">
        {[
          [
            CarFront,
            "Your kind of drive",
            "City commutes, family weekends or the workday ahead. Explore passenger and commercial cabs in their own sections.",
          ],
          [
            HeartHandshake,
            "Space to decide",
            "Compare your favourites, plan a monthly budget and ask us the questions that matter to you.",
          ],
          [
            MessageCircle,
            "A conversation away",
            "Call, send an enquiry or arrange a visit. There’s a team behind the screen, right here in Delhi.",
          ],
        ].map(([Icon, title, text]: any) => (
          <article key={title}>
            <Icon size={30} />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <CorporateCabs variant="about" />
      <EditorialGuide topic="about" />
      <section className="container visit-banner">
        <div>
          <span className="eyebrow">LESS SCROLLING. MORE EXPLORING.</span>
          <h2>Your next story starts here.</h2>
          <p>Arrange a visit, or give us a call. We’ll take it from there.</p>
        </div>
        <Link className="btn primary" href="/contact">
          Let’s meet <ArrowUpRight size={20} />
        </Link>
      </section>
      <Faq topic="about" />
    </>
  );
}
