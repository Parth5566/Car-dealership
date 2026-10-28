import "./globals.css";
import "./redesign.css";
import "./offers.css";
import "./mobile.css";
import type { Metadata, Viewport } from "next";
import { Header, Footer } from "@/components/shell";
import { Providers } from "@/components/providers";
import { serverApi, site } from "@/lib/server";
import { Settings } from "@/lib/types";
import { businessSchema, pageMetadata } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";
import { FloatingContact } from "@/components/floating-contact";
import { resolveBusiness } from "@/lib/business";
import { Analytics } from "@/components/analytics";
export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: {
    default: "NCR Wheelz | Used cars & commercial cabs in Delhi NCR",
    template: "%s | NCR Wheelz",
  },
  description:
    "Explore used passenger and commercial cabs in Delhi NCR. Compare vehicles, enquire, request a test drive, or submit your vehicle for review.",
  openGraph: pageMetadata("/").openGraph,
  twitter: pageMetadata("/").twitter,
  icons: {
    icon: [
      {
        url: "/brandings/favicon.ico",
        type: "image/x-icon",
        sizes: "16x16 32x32 48x48",
      },
      {
        url: "/brandings/favicon-32x32.png",
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: "/brandings/favicon-16x16.png",
        type: "image/png",
        sizes: "16x16",
      },
    ],
    apple: [
      {
        url: "/brandings/apple-touch-icon.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
  // Search Console / Bing Webmaster ownership tokens, set per deployment.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
      : {}),
  },
};
export const viewport: Viewport = { themeColor: "#101c2c" };
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data } = await serverApi<Settings>("/settings");
  return (
    <html lang="en-IN" data-scroll-behavior="smooth">
      <body>
        <StructuredData data={businessSchema(data || {})} />
        <Analytics />
        <Providers>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Header settings={data || {}} />
          <main id="main">{children}</main>
          <Footer settings={data || {}} />
          <FloatingContact
            whatsapp={resolveBusiness(data || {}).whatsapp}
            call={resolveBusiness(data || {}).callButton}
          />
        </Providers>
      </body>
    </html>
  );
}
