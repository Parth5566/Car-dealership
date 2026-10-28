import type { Metadata } from "next";
import type { Settings, Vehicle } from "./types";
import { resolveBusiness } from "./business";
import { absoluteUrl, site } from "./site";

export const publicPages = {
  "/": {
    title: "Used Cars & Commercial Cabs in Delhi NCR",
    description:
      "Explore used cars and commercial cabs in Delhi NCR with NCR Wheelz. Compare vehicles, check car values and enquire about corporate office cab attachments.",
    name: "Home",
  },
  "/cars": {
    title: "Buy Used Cars in Delhi NCR",
    description:
      "Browse used passenger cars in Delhi NCR. Compare prices, brands, fuel types, transmission and kilometres driven, then enquire or request a test drive.",
    name: "Passenger cars",
  },
  "/commercial": {
    title: "Commercial Cabs & Cab Attachment in Delhi NCR",
    description:
      "Browse yellow-plate commercial cabs in Delhi NCR. Ask NCR Wheelz about corporate and MNC office cab attachments, available duties and monthly payment terms.",
    name: "Commercial cabs",
  },
  "/about": {
    title: "About Us | Used Vehicles in Delhi NCR",
    description:
      "Meet NCR Wheelz in Tilak Nagar, New Delhi. Explore used cars, commercial cabs and our support for corporate and MNC office cab attachment opportunities.",
    name: "About us",
  },
  "/contact": {
    title: "Contact Us | Tilak Nagar, New Delhi",
    description:
      "Contact NCR Wheelz about buying or selling a used vehicle. Find our contact details, send an enquiry and plan a visit to Tilak Nagar, New Delhi.",
    name: "Contact us",
  },
  "/finance": {
    title: "Used Car Finance | Down Payment, Loan Tenure & EMI",
    description:
      "Understand used car loan terms, down payments, interest rates and total repayment. Prepare questions for a lender and explore an indicative EMI.",
    name: "Finance information",
  },
  "/emi-calculator": {
    title: "Car Loan EMI Calculator | Monthly Payment Estimate",
    description:
      "Calculate an indicative car loan EMI, total interest and repayment. Adjust vehicle price, down payment, annual interest rate and loan tenure.",
    name: "EMI calculator",
  },
  "/car-valuation": {
    title: "Used Car Valuation | Check Buying & Selling Price",
    description:
      "Check an indicative used car price range with NCR Wheelz. Select brand, model, variant, year, city, kilometres driven and number of owners.",
    name: "Car valuation",
  },
  "/selling-guide": {
    title: "Sell Your Car in Delhi NCR | Photos & Documents Guide",
    description:
      "Prepare to sell a passenger or commercial cab with NCR Wheelz. Learn about price checks, private drafts, photos, documents and listing review.",
    name: "Selling guide",
  },
  "/discounts": {
    title: "Used Car Discounts & Offers in Delhi NCR",
    description:
      "Explore current NCR Wheelz vehicle offers in Delhi NCR. Check benefits, eligibility, terms and expiry dates, and enquire about vehicle pricing.",
    name: "Discounts & offers",
  },
  "/blog": {
    title: "Car Buying, Selling & Cab Guides | Blog",
    description:
      "Read the NCR Wheelz blog for practical car buying and selling guides, car care tips, commercial cab insights and updates from our team in Delhi NCR.",
    name: "Blog",
  },
} as const;
export type PublicPath = keyof typeof publicPages;
export const shareImage = {
  url: absoluteUrl("/brandings/ncr-wheelz-og.png"),
  width: 1200,
  height: 630,
  alt: "NCR Wheelz — used passenger cars and commercial cabs in Delhi NCR",
};

export function pageMetadata(path: PublicPath): Metadata {
  const { title, description } = publicPages[path];
  return {
    title: path === "/" ? { absolute: `${title} | NCR Wheelz` } : title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    robots: {
      index: true,
      follow: true,
      googleBot: { "max-image-preview": "large" },
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      siteName: "NCR Wheelz",
      locale: "en_IN",
      type: "website",
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [shareImage.url],
    },
  };
}

export function collectionMetadata(
  path: "/blog" | "/cars" | "/commercial",
  params: Record<string, string | string[] | undefined>,
): Metadata {
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  const validPage =
    !Array.isArray(params.page) &&
    Number.isInteger(page) &&
    page >= 1 &&
    page <= 10000;
  const filters =
    path === "/blog"
      ? ["q", "category"]
      : [
          "q",
          "make",
          "fuel",
          "transmission",
          "body_type",
          "location",
          "min_price",
          "max_price",
          "min_year",
          "max_mileage",
          "sort",
          "featured",
          "limit",
        ];
  const filtered = filters.some((key) => Boolean(params[key]));
  const canonical =
    !filtered && validPage && page > 1 ? `${path}?page=${page}` : path;
  const base = pageMetadata(path);
  const title =
    publicPages[path].title +
    (!filtered && validPage && page > 1 ? ` — Page ${page}` : "");
  return {
    ...base,
    title,
    alternates: { canonical: absoluteUrl(canonical) },
    openGraph: { ...base.openGraph, title, url: absoluteUrl(canonical) },
    twitter: { ...base.twitter, title },
    ...(filtered || !validPage
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

export const jsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, "\\u003c");
export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
export function pageSchema(path: PublicPath) {
  const { name, description } = publicPages[path];
  const type =
    path === "/blog"
      ? "Blog"
      : path === "/about"
        ? "AboutPage"
        : path === "/contact"
          ? "ContactPage"
          : path === "/cars" || path === "/commercial" || path === "/discounts"
            ? "CollectionPage"
            : "WebPage";
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": type,
        "@id": `${url}#webpage`,
        url,
        name: publicPages[path].title,
        description,
        inLanguage: "en-IN",
        isPartOf: { "@id": `${site}/#website` },
        about:
          path === "/commercial"
            ? [{ "@id": `${site}/#business` }, { "@id": cabAttachmentId }]
            : { "@id": `${site}/#business` },
        ...(path === "/car-valuation" || path === "/emi-calculator"
          ? {
              mainEntity: {
                "@type": "WebApplication",
                name,
                url,
                applicationCategory: "UtilitiesApplication",
                operatingSystem: "Any",
                browserRequirements: "Requires JavaScript",
                offers: { "@type": "Offer", price: 0, priceCurrency: "INR" },
              },
            }
          : {}),
      },
      ...(path === "/"
        ? []
        : [
            breadcrumbs([
              { name: "Home", path: "/" },
              { name, path },
            ]),
          ]),
    ],
  };
}

// The corporate/MNC cab attachment service shown on Home, About and Commercial.
const cabAttachmentId = `${site}/commercial#corporate-cab-attachment`;
export function businessSchema(settings: Partial<Settings> = {}) {
  const b = resolveBusiness(settings);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AutoDealer",
        "@id": `${site}/#business`,
        name: b.name,
        url: site,
        logo: absoluteUrl("/images/logo.png"),
        image: shareImage.url,
        ...(b.address
          ? {
              address: {
                "@type": "PostalAddress",
                streetAddress: b.address,
                addressCountry: "IN",
              },
            }
          : {}),
        ...(b.phones.length
          ? {
              telephone: b.phones[0].href.replace("tel:", ""),
              contactPoint: b.phones.map((phone) => ({
                "@type": "ContactPoint",
                telephone: phone.href.replace("tel:", ""),
                contactType: "customer service",
                areaServed: "IN",
              })),
            }
          : {}),
        ...(b.email ? { email: b.email } : {}),
        ...(b.address && b.mapsUrl ? { hasMap: b.mapsUrl } : {}),
        ...(b.instagram ? { sameAs: [b.instagram] } : {}),
        areaServed: { "@type": "Place", name: "Delhi NCR" },
        makesOffer: {
          "@type": "Offer",
          itemOffered: { "@id": cabAttachmentId },
        },
      },
      {
        "@type": "Service",
        "@id": cabAttachmentId,
        name: "Corporate cab attachment",
        serviceType:
          "Commercial cab attachment for corporate employee transport",
        description:
          "NCR Wheelz helps owners of yellow-plate commercial cabs, or buyers of one, explore attachment opportunities with corporate and MNC offices in Delhi NCR. Assignments depend on current requirements and vehicle eligibility.",
        url: absoluteUrl("/commercial#corporate-cab-attachment"),
        provider: { "@id": `${site}/#business` },
        areaServed: { "@type": "Place", name: "Delhi NCR" },
      },
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        url: site,
        name: b.name,
        inLanguage: "en-IN",
        publisher: { "@id": `${site}/#business` },
      },
    ],
  };
}

export function vehicleSchema(v: Vehicle) {
  if (v.is_sample) return null;
  const path = `/vehicles/${v.id}/${v.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Product", "Car"],
        "@id": absoluteUrl(path) + "#vehicle",
        url: absoluteUrl(path),
        name: `${v.year} ${v.make} ${v.model}${v.variant ? " " + v.variant : ""}`,
        brand: { "@type": "Brand", name: v.make },
        model: v.model,
        ...(v.variant ? { vehicleConfiguration: v.variant } : {}),
        vehicleModelDate: String(v.year),
        productionDate: String(v.year),
        description: v.description,
        fuelType: v.fuel,
        vehicleTransmission: v.transmission,
        mileageFromOdometer: {
          "@type": "QuantitativeValue",
          value: v.mileage,
          unitCode: "KMT",
        },
        numberOfPreviousOwners: v.owners,
        ...(v.seats ? { vehicleSeatingCapacity: v.seats } : {}),
        image: v.images.map((image) => absoluteUrl(image.url)),
        offers: {
          "@type": "Offer",
          price: v.price,
          priceCurrency: "INR",
          url: absoluteUrl(path),
          itemCondition: "https://schema.org/UsedCondition",
          // A reserved car is not available for a new purchase enquiry without confirmation.
          availability:
            v.status === "reserved"
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
          seller: { "@id": `${site}/#business` },
        },
      },
      breadcrumbs([
        { name: "Home", path: "/" },
        {
          name: v.type === "commercial" ? "Commercial cabs" : "Passenger cars",
          path: v.type === "commercial" ? "/commercial" : "/cars",
        },
        { name: `${v.make} ${v.model}`, path },
      ]),
    ],
  };
}

export function sitemapDate(value: string): Date | undefined {
  // MySQL UTC strings, ISO strings and ISO strings already carrying an offset.
  const iso = value.replace(" ", "T");
  const date = new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
  return Number.isFinite(date.getTime()) ? date : undefined;
}
