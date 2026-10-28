import { pageMetadata } from "@/lib/seo";
import { PageSchema } from "@/components/structured-data";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  CarFront,
  Calculator,
  Gauge,
  Tag,
} from "lucide-react";
import { serverApi } from "@/lib/server";
import { Settings } from "@/lib/types";
import { HomeSearch } from "@/components/home-search";
import { HomeInventory } from "@/components/home-inventory";
import { HomeJourney } from "@/components/home-journey";
import { HomeExperience } from "@/components/home-experience";
import { HomeReading } from "@/components/editorial-guide";
import { Faq } from "@/components/faq";
import { CorporateCabs } from "@/components/corporate-cabs";
import { RecentBlogPosts } from "@/components/recent-blog-posts";
import heroStyles from "./home-hero.module.css";
export const metadata = pageMetadata("/");
export default async function Home() {
  const settings = await serverApi<Settings>("/settings");
  return (
    <>
      <PageSchema path="/" />
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow light">
              <span className="little-line" /> THE ROAD AHEAD STARTS HERE
            </span>
            <h1>
              {settings.data?.home_headline ||
                "Your next chapter. Your next drive."}
            </h1>
            <p>
              From everyday journeys to business ambitions.
              <br className="desktop" /> Find a used vehicle that moves you
              forward.
            </p>
            <div className="hero-buttons">
              <Link className="btn gold" href="/cars">
                Browse passenger cars <ArrowUpRight size={18} />
              </Link>
              <Link
                className={`hero-secondary ${heroStyles.commercialButton}`}
                href="/commercial"
              >
                Browse commercial cabs <ArrowRight size={17} />
              </Link>
            </div>
            <div className="hero-note">
              <span className="small-dot" />
              PASSENGER & COMMERCIAL · DELHI NCR
            </div>
            <nav className="hero-quick" aria-label="Quick actions">
              <Link href="/sell">
                <Tag size={20} aria-hidden="true" />
                Sell your car
              </Link>
              <Link href="/car-valuation">
                <Gauge size={20} aria-hidden="true" />
                Check car value
              </Link>
              <Link href="/emi-calculator">
                <Calculator size={20} aria-hidden="true" />
                EMI calculator
              </Link>
            </nav>
          </div>
          <div className="hero-visual">
            {/* Phones get a real photograph; wider screens keep the illustration. */}
            <picture>
              <source
                media="(max-width: 760px)"
                srcSet="/images/brand/benefit-drive.webp"
                width={960}
                height={640}
              />
              <img
                src="/hero.webp"
                alt="A used car ready for its next drive"
                width="1200"
                height="720"
                fetchPriority="high"
              />
            </picture>
            <div className="hero-visual-caption">
              <span>THE POSSIBILITIES ARE OPEN.</span>
              <span>01 / NCR WHEELZ</span>
            </div>
          </div>
        </div>
      </section>
      <div className="container search-container">
        <HomeSearch />
      </div>
      <div className="home-flow">
        <section className="container section home-categories">
          <div className="section-heading">
            <div>
              <span className="eyebrow">BUILT AROUND YOUR JOURNEY</span>
              <h2>Choose your vehicle category.</h2>
            </div>
            <p>
              A daily companion or your next business partner.
              <br />
              Start with what matters to you.
            </p>
          </div>
          <div className="category-grid">
            <Link className="category-card passenger" href="/cars">
              <div>
                <span className="eyebrow">FOR LIFE, EVERY DAY</span>
                <h3>Passenger cars</h3>
                <p>Hatchbacks, sedans, SUVs and more.</p>
                <span className="category-link">
                  Find your car <ArrowUpRight size={18} />
                </span>
              </div>
              <CarFront className="category-icon" strokeWidth={0.8} />
            </Link>
            <Link className="category-card commercial" href="/commercial">
              <div>
                <span className="eyebrow">FOR THE WORK AHEAD</span>
                <h3>Commercial cabs</h3>
                <p>Yellow-plate cars for passenger trips.</p>
                <span className="category-link">
                  Explore commercial <ArrowUpRight size={18} />
                </span>
              </div>
              <CarFront className="category-icon" strokeWidth={0.8} />
            </Link>
          </div>
        </section>
        <div className="home-block home-experience">
          <HomeExperience />
        </div>
        <div className="home-block home-passenger">
          <HomeInventory type="passenger" />
        </div>
        <div className="home-block home-commercial">
          <HomeInventory type="commercial" />
        </div>
        <div className="home-block home-cabs">
          <CorporateCabs variant="home" />
        </div>
        <section className="container visit-banner">
          <div>
            <span className="eyebrow">BEFORE YOU PUT A NUMBER ON IT</span>
            <h2>Buying or selling? Start with a price check.</h2>
            <p>
              Compare similar asking prices and get a clearer starting point for
              your conversation.
            </p>
          </div>
          <Link href="/car-valuation" className="btn primary">
            Check car value <ArrowUpRight size={18} />
          </Link>
        </section>
        <HomeJourney />
        <HomeReading />
        <RecentBlogPosts />
        <section className="container sell-banner">
          <div>
            <span className="eyebrow light">MAKE ROOM FOR WHAT’S NEXT</span>
            <h2>
              Your vehicle’s next chapter
              <br />
              could start here.
            </h2>
            <p>
              Submit the details. Upload your documents privately.
              <br />
              Follow every step of the review from your account.
            </p>
          </div>
          <Link href="/sell" className="btn gold">
            Sell your vehicle <ArrowUpRight size={18} />
          </Link>
        </section>
        <Faq topic="buying" />
      </div>
    </>
  );
}
