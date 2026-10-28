import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { serverApi, site } from "@/lib/server";
import { Vehicle, money, fuelEconomy } from "@/lib/types";
import { Gallery } from "@/components/gallery";
import {
  CompareButton,
  SaveButton,
  VehicleCard,
  ErrorBox,
} from "@/components/ui";
import { EnquiryForm } from "@/components/enquiry-form";
import { CalendarDays, ArrowUpRight, MapPin } from "lucide-react";
import { EditorialGuide } from "@/components/editorial-guide";
import { StructuredData } from "@/components/structured-data";
import { vehicleSchema, shareImage } from "@/lib/seo";
import { photoAlt } from "@/lib/photo-alt";
type Props = { params: Promise<{ id: string; slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const { data: v } = await serverApi<Vehicle>("/vehicles/" + id);
  if (!v)
    return {
      title: "Listing unavailable",
      robots: { index: false, follow: true },
    };
  const title =
    v.seo_title ||
    `${v.year} ${v.make} ${v.model}${v.variant ? " " + v.variant : ""}`;
  const description =
    v.seo_description ||
    `${v.year} ${v.make} ${v.model}${v.variant ? " " + v.variant : ""} for ${money(v.price)} in ${v.location}: ${v.fuel}, ${v.transmission}, ${v.mileage.toLocaleString("en-IN")} km, ${v.owners === 1 ? "1st" : v.owners === 2 ? "2nd" : v.owners === 3 ? "3rd" : v.owners + "th"} owner. Enquire or book a test drive with NCR Wheelz.`;
  const url = `${site}/vehicles/${v.id}/${v.slug}`;
  const images = v.images[0]
    ? [
        {
          url: new URL(v.images[0].url, site).href,
          alt: photoAlt(v.images[0].alt_text, v, 0, v.images.length),
        },
      ]
    : [shareImage];
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: v.is_sample ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      url,
      siteName: "NCR Wheelz",
      type: "website",
      locale: "en_IN",
      images,
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}
export default async function Page({ params }: Props) {
  const p = await params;
  const { data: v, error } = await serverApi<Vehicle>("/vehicles/" + p.id);
  if (!v) {
    if (error === "Listing unavailable") notFound();
    return (
      <div className="container section">
        <h1>Vehicle temporarily unavailable.</h1>
        <ErrorBox message={error || "Vehicle unavailable"} />
      </div>
    );
  }
  if (p.slug !== v.slug) permanentRedirect(`/vehicles/${v.id}/${v.slug}`);
  const { data: similar } = await serverApi<{ items: Vehicle[] }>(
    "/vehicles?type=" + v.type + "&limit=4",
  );
  const briefDescription =
    v.description.trim().length <= 180 && !v.features.length;
  const structured = vehicleSchema(v);
  return (
    <div className="container section vehicle-detail-page">
      <StructuredData data={structured} />
      {v.is_sample && (
        <div className="notice info">
          <strong>Sample vehicle — not for sale.</strong> This listing uses
          fictional prices/specifications and generic illustrations for website
          testing. It is not real dealership inventory. Requests submitted here
          are test requests.
        </div>
      )}
      <div className="breadcrumb">
        <Link href={v.type === "commercial" ? "/commercial" : "/cars"}>
          ← Back to {v.type === "commercial" ? "commercial cabs" : "used cars"}
        </Link>
        <span>/</span>
        {v.make} {v.model}
      </div>
      <div className="detail-grid">
        <div className="detail-media">
          <Gallery images={v.images} vehicle={v} />
          <section
            className={`vehicle-description${briefDescription ? " is-brief" : ""}`}
            aria-labelledby="vehicle-description-heading"
          >
            <h2 id="vehicle-description-heading">
              {briefDescription ? "Seller’s note" : "Seller’s description"}
            </h2>
            <p className="vehicle-description-text">{v.description}</p>
            {v.features.length > 0 && (
              <div className="vehicle-description-features">
                <h3>Features</h3>
                <div className="features">
                  {v.features.map((f) => (
                    <span key={f}>{f}</span>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
        <div className="vehicle-summary">
          <div className="vehicle-summary-topline">
            <span className="vehicle-type-tag">
              {v.type === "commercial" ? "Commercial cab" : v.body_type}
            </span>
            <span className="vehicle-summary-location">
              <MapPin size={14} aria-hidden="true" /> {v.location}
            </span>
          </div>
          <h1 className="detail-title">
            <span className="vehicle-make">{v.make}</span> {v.model}
          </h1>
          <p className="vehicle-summary-meta">
            {v.year} ·{" "}
            <span className={v.variant ? "vehicle-variant" : undefined}>
              {v.variant || v.transmission}
            </span>
            {v.status === "reserved" ? " · Currently reserved" : ""}
          </p>
          <span className="vehicle-price-label">Asking price</span>
          <p className="detail-price">{money(v.price)}</p>
          <div className="detail-specs">
            {[
              ["Year of manufacture", v.year],
              ["Kilometres driven", v.mileage.toLocaleString("en-IN") + " km"],
              ...(fuelEconomy(v)
                ? [["Mileage / fuel economy", fuelEconomy(v)!]]
                : []),
              ["Fuel type", v.fuel],
              ["Transmission", v.transmission],
              ["Number of owners", v.owners],
              ["City / area", v.location],
              ...(v.seats ? [["Number of seats", v.seats]] : []),
            ].map(([key, value]) => (
              <div key={String(key)}>
                <small>{key}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="detail-actions">
            <Link
              href={"/test-drive?vehicle=" + v.id}
              className="btn gold detail-test-drive"
            >
              <CalendarDays size={21} aria-hidden="true" />
              Request a test drive
              <ArrowUpRight size={20} aria-hidden="true" />
            </Link>
            <a href="#enquire" className="btn outline detail-enquiry">
              Send an enquiry
            </a>
            <SaveButton id={v.id} />
            <CompareButton id={v.id} />
          </div>
          <div className="inline-links">
            <Link
              href={"/emi-calculator?price=" + v.price}
              className="text-link"
            >
              Calculate EMI
            </Link>
          </div>
          <div className="notice info vehicle-review-note">
            Document review is manual and does not guarantee authenticity,
            title, or mechanical condition. Inspect the vehicle and confirm all
            details before a transaction.
          </div>
        </div>
      </div>
      <section id="enquire" className="panel content-width vehicle-enquiry">
        <h2>Let’s talk about this vehicle.</h2>
        <EnquiryForm vehicleId={v.id} />
      </section>
      <EditorialGuide topic="vehicle" contained />
      {similar && similar.items.filter((i) => i.id !== v.id).length > 0 && (
        <section className="section">
          <div className="section-heading">
            <h2>More to consider</h2>
          </div>
          <div className="vehicle-grid">
            {similar.items
              .filter((i) => i.id !== v.id)
              .slice(0, 3)
              .map((i) => (
                <VehicleCard key={i.id} vehicle={i} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
