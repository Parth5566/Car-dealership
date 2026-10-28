import { pageMetadata } from "@/lib/seo";
import { PageSchema } from "@/components/structured-data";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowUpRight,
  ArrowDown,
  MessageCircle,
  CarFront,
  Instagram,
} from "lucide-react";
import { EnquiryForm } from "@/components/enquiry-form";
import { Faq } from "@/components/faq";
import { EditorialGuide } from "@/components/editorial-guide";
import { resolveBusiness } from "@/lib/business";
import { serverApi } from "@/lib/server";
import type { Settings } from "@/lib/types";
import styles from "./contact.module.css";

export const metadata = pageMetadata("/contact");

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    offer?: string | string[];
    valuation?: string | string[];
    service?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const corporateCab = params.service === "corporate-cab";
  const offer =
    typeof params.offer === "string" ? params.offer.trim().slice(0, 100) : "";
  const valuation =
    typeof params.valuation === "string"
      ? params.valuation.trim().slice(0, 1200)
      : "";
  const { data } = await serverApi<Settings>("/settings");
  const business = resolveBusiness(data || {});
  return (
    <div className={styles.page}>
      <PageSchema path="/contact" />
      <header className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div>
            <span className={styles.eyebrow}>NCR WHEELZ · GET IN TOUCH</span>
            <h1>
              {corporateCab ? "Let’s put your cab" : "Let’s talk about"}
              <br />
              <em>{corporateCab ? "to work." : "your next drive."}</em>
            </h1>
            <p>
              {corporateCab
                ? "Looking for a cab or a corporate office attachment? Tell us about your plans and we’ll discuss current opportunities in Delhi NCR."
                : "Buying, selling or just figuring things out? Bring your questions. We’ll help you find the next step."}
            </p>
            <div className={styles.heroActions}>
              <a href="#contact-form" className={styles.primary}>
                Send a message <ArrowDown size={16} />
              </a>
              <a href="#visit-us" className={styles.visitLink}>
                Plan a visit <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
          <div className={styles.heroArt} aria-hidden="true">
            <div className={styles.orbit} />
            <span className={styles.smallDot} />
            <div className={styles.chatCard}>
              <MessageCircle size={42} strokeWidth={1.4} />
              <span>
                Good conversations.
                <br />
                New possibilities.
              </span>
            </div>
            <div className={styles.carCard}>
              <CarFront size={68} strokeWidth={1.1} />
              <span>YOUR NEXT CHAPTER ↗</span>
            </div>
            <div className={styles.pin}>
              <MapPin size={27} strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </header>
      <section
        className={`container ${styles.contactLayout}`}
        aria-label="Contact options and enquiry form"
      >
        <div className={styles.contactDetails}>
          <header className={styles.sectionHeading}>
            <span className={styles.eyebrow}>A CONVERSATION AWAY</span>
            <h2>Reach us your way.</h2>
            <p>
              Call, write or leave a message below. Choose what works for you.
            </p>
          </header>
          <div className={styles.methods}>
            {business.phones.length > 0 && (
              <article className={styles.method}>
                <span className={styles.methodIcon}>
                  <Phone size={22} />
                </span>
                <h3>Give us a call</h3>
                <div className={styles.values}>
                  {business.phones.map((phone) => (
                    <a href={phone.href} key={phone.href}>
                      {phone.display}
                    </a>
                  ))}
                </div>
                <p>Buying, selling & vehicle questions</p>
              </article>
            )}
            {business.email && (
              <article className={styles.method}>
                <span className={styles.methodIcon}>
                  <Mail size={22} />
                </span>
                <h3>Drop us a line</h3>
                <div className={styles.values}>
                  <a href={`mailto:${business.email}`}>{business.email}</a>
                </div>
                <p>Have a reference? Include it in your message.</p>
              </article>
            )}
            {business.hours && (
              <article className={styles.method}>
                <span className={styles.methodIcon}>
                  <Clock size={22} />
                </span>
                <h3>Working hours</h3>
                <div className={styles.values}>
                  <span>{business.hours}</span>
                </div>
                <p>India Standard Time</p>
              </article>
            )}
            {business.address && (
              <article className={styles.method}>
                <span className={styles.methodIcon}>
                  <MapPin size={22} />
                </span>
                <h3>Come say hello</h3>
                <div className={styles.values}>
                  <span>{business.address}</span>
                </div>
                <a
                  href={business.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.cardLink}
                >
                  Get directions <ArrowUpRight size={14} />
                </a>
              </article>
            )}
            {business.whatsapp && (
              <article className={`${styles.method} ${styles.whatsapp}`}>
                <span className={styles.methodIcon}>
                  <MessageCircle size={22} />
                </span>
                <div>
                  <h3>Prefer to chat?</h3>
                  <p>Continue the conversation on WhatsApp.</p>
                </div>
                <a
                  href={`https://wa.me/${business.whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.cardLink}
                >
                  Start a chat <ArrowUpRight size={14} />
                </a>
              </article>
            )}
            {business.instagram && (
              <article className={`${styles.method} ${styles.instagram}`}>
                <span className={styles.methodIcon}>
                  <Instagram size={22} />
                </span>
                <div>
                  <h3>See our latest arrivals</h3>
                  <p>Follow @ncrwheels2026 on Instagram.</p>
                </div>
                <a
                  href={business.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.cardLink}
                >
                  Follow us <ArrowUpRight size={14} />
                </a>
              </article>
            )}
          </div>
          <div className={styles.visitNote}>
            <CarFront size={24} strokeWidth={1.5} />
            <div>
              <h3>Coming to see a vehicle?</h3>
              <p>
                Contact the team first to confirm availability and timing. For a
                test drive, send a request from the vehicle’s listing.
              </p>
            </div>
          </div>
        </div>
        <section
          className={styles.formPanel}
          id="contact-form"
          aria-labelledby="contact-form-title"
        >
          <div className={styles.formTitle}>
            <span>
              <Mail size={23} />
            </span>
            <div>
              <span className={styles.eyebrow}>WHAT’S ON YOUR MIND?</span>
              <h2 id="contact-form-title">
                {corporateCab
                  ? "Enquire about cab attachment."
                  : "Send us a message."}
              </h2>
            </div>
          </div>
          <p className={styles.formIntro}>
            {corporateCab
              ? "Let us know if you need a cab or already own one. Include the model, year and your preferred operating area so we can discuss a suitable opportunity."
              : "Tell us what you’re looking for. We’ll follow up using the details you provide."}
          </p>
          <EnquiryForm
            initialMessage={
              corporateCab
                ? "I’m interested in corporate / MNC office cab attachment. Please contact me about available opportunities and monthly payment terms.\n\nI need a cab / I already own a cab:\nCab model and year:\nPreferred operating area:"
                : offer
                  ? `I’m interested in the offer: ${offer}. Please share the details.`
                  : valuation
            }
          />
        </section>
      </section>
      <section
        className={`container ${styles.visit}`}
        id="visit-us"
        aria-labelledby="visit-title"
      >
        <div
          className={`${styles.visitCard} ${!business.mapEmbed ? styles.noMap : ""}`}
        >
          <div className={styles.visitCopy}>
            <span className={styles.eyebrow}>MAKE YOUR WAY HERE</span>
            <h2 id="visit-title">
              A screen is a start.
              <br />
              Let’s meet in person.
            </h2>
            <p>
              Plan a visit to take a closer look and talk through the details
              with the team.
            </p>
            {business.address && (
              <address>
                <MapPin size={19} />
                <span>{business.address}</span>
              </address>
            )}
            {business.hours && (
              <p className={styles.visitHours}>
                <Clock size={17} />
                {business.hours} · IST
              </p>
            )}
            <p className={styles.visitReminder}>
              Confirm your visit and vehicle availability before setting off.
            </p>
            {business.address && (
              <a
                href={business.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.primary}
              >
                Open in Google Maps <ArrowUpRight size={16} />
              </a>
            )}
          </div>
          {business.mapEmbed && (
            <iframe
              title={business.name + " location"}
              src={business.mapEmbed}
              width="600"
              height="400"
              className={styles.map}
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
        </div>
      </section>
      <EditorialGuide topic="contact" />
      <Faq topic="contact" settings={data || {}} />
    </div>
  );
}
