import { publicPages } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { serverApi } from "@/lib/server";
import { resolveBusiness } from "@/lib/business";
import type { Settings } from "@/lib/types";
import type { BlogPage } from "@/lib/blog";
import { policies, policyOrder } from "@/lib/policies";

// Dynamic so contact details follow Admin → Content & settings, like the footer.
export const dynamic = "force-dynamic";
export async function GET() {
  const [{ data }, { data: blog }] = await Promise.all([
    serverApi<Settings>("/settings"),
    serverApi<BlogPage>("/blog?limit=6"),
  ]);
  const b = resolveBusiness(data || {});
  const plain = (text: string) =>
    text
      .replace(/\s+/g, " ")
      .replace(/[\\[\]<>]/g, "\\$&")
      .trim();
  const contact = [
    ...b.phones.map((phone) => `- Phone: ${phone.display} (${phone.href})`),
    ...(b.email ? [`- Email: ${b.email}`] : []),
    ...(b.whatsapp ? [`- WhatsApp: https://wa.me/${b.whatsapp}`] : []),
    ...(b.instagram ? [`- Instagram: ${b.instagram}`] : []),
    ...(b.address ? [`- Address: ${b.address}`] : []),
    ...(b.hours ? [`- Working hours: ${b.hours}, India time`] : []),
  ];
  const content = [
    "# NCR Wheelz",
    "",
    "> A website for browsing used passenger cars and commercial cabs in Delhi NCR, India, contacting the NCR Wheelz team about buying or selling, and enquiring about corporate cab attachment.",
    "",
    "Public inventory pages are the source for current vehicle details and availability. Sample listings are for testing and are not real inventory. Enquiries and test-drive requests do not reserve a vehicle. Valuations are indicative estimates, not guaranteed offers; EMI calculations are planning tools, not loan approvals.",
    "",
    "## Explore and plan",
    ...Object.entries(publicPages).map(
      ([path, page]) =>
        `- [${page.name}](${absoluteUrl(path)}): ${page.description}`,
    ),
    "",
    ...(blog?.items?.length
      ? [
          "## Recent articles",
          ...blog.items.map(
            (post) =>
              `- [${plain(post.title)}](${absoluteUrl(`/blog/${post.slug}`)}): ${plain(post.excerpt)}`,
          ),
          "",
        ]
      : []),
    "## Services",
    "- Buying used passenger cars and yellow-plate commercial cabs listed on the website.",
    "- Selling a passenger car or commercial cab through a reviewed listing: " +
      absoluteUrl("/selling-guide"),
    "- Corporate cab attachment: helping commercial cab owners, or buyers of a cab, explore corporate and MNC office transport assignments in Delhi NCR. Assignments depend on current requirements and vehicle eligibility; any monthly payment, duty hours and cost responsibilities are agreed in a contract. Details: " +
      absoluteUrl("/commercial#corporate-cab-attachment") +
      " Enquire: " +
      absoluteUrl("/contact?service=corporate-cab"),
    "",
    ...(contact.length ? ["## Contact", ...contact, ""] : []),
    "## Policies",
    ...policyOrder.map(
      (slug) =>
        `- [${policies[slug].title}](${absoluteUrl(`/policies/${slug}`)}): ${policies[slug].description}`,
    ),
    "",
    "## Site directory",
    `- [XML sitemap](${absoluteUrl("/sitemap.xml")}): All indexable public pages, current listings and published articles.`,
    "",
  ].join("\n");
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
