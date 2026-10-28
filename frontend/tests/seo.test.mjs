import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "../node_modules/typescript/lib/typescript.js";
import { createRequire } from "node:module";
const sharp = createRequire(
  new URL("../../backend/package.json", import.meta.url),
)("sharp");
const frontendRequire = createRequire(
  new URL("../package.json", import.meta.url),
);
const React = frontendRequire("react");
const { renderToReadableStream } = frontendRequire("react-dom/server");

const root = fileURLToPath(new URL("..", import.meta.url));
// Exercise the actual metadata/schema/route exports without needing a database or Next server.
function modules(overrides = {}, env = {}) {
  const cache = new Map();
  function load(file) {
    file = resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    const require = (name) => {
      if (name in overrides) return overrides[name];
      if (name === "server-only") return {};
      if (name.endsWith(".css"))
        return {
          __esModule: true,
          default: new Proxy({}, { get: (_, key) => String(key) }),
        };
      if (
        ["react", "react-dom", "react/jsx-runtime", "lucide-react"].includes(
          name,
        )
      )
        return frontendRequire(name);
      if (name === "next/link")
        return {
          __esModule: true,
          default: ({ children, prefetch, replace, scroll, ...props }) =>
            React.createElement("a", props, children),
        };
      if (name === "next/navigation")
        return {
          usePathname: () => "/",
          useSearchParams: () => new URLSearchParams(),
          useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
          notFound: () => {
            throw new Error("NOT_FOUND");
          },
          redirect: () => {
            throw new Error("REDIRECT");
          },
          permanentRedirect: () => {
            throw new Error("REDIRECT");
          },
        };
      const target = name.startsWith("@/")
        ? resolve(root, name.slice(2))
        : resolve(dirname(file), name);
      return load(
        existsSync(target + ".ts") ? target + ".ts" : target + ".tsx",
      );
    };
    new Function("require", "module", "exports", "process", source)(
      require,
      module,
      module.exports,
      { env: { NEXT_PUBLIC_SITE_URL: "https://ncrwheelz.com/", ...env } },
    );
    return module.exports;
  }
  return load;
}

test("public pages have unique descriptions, canonical URLs and matching social metadata", () => {
  const { publicPages, pageMetadata, pageSchema } = modules()("lib/seo.ts");
  const titles = new Set(),
    descriptions = new Set();
  for (const path of Object.keys(publicPages)) {
    const m = pageMetadata(path);
    assert.equal(
      m.alternates.canonical,
      new URL(path, "https://ncrwheelz.com").href,
    );
    assert.equal(m.openGraph.url, m.alternates.canonical);
    assert.equal(m.description, m.twitter.description);
    assert.match(m.openGraph.images[0].url, /\.png$/);
    assert.ok(m.description.length >= 70 && m.description.length <= 180);
    const graph = pageSchema(path)["@graph"];
    assert.equal(graph[0].url, m.alternates.canonical);
    assert.equal(graph[0].description, m.description);
    if (path !== "/")
      assert.equal(
        graph[1].itemListElement.at(-1).item,
        m.alternates.canonical,
      );
    titles.add(publicPages[path].title);
    descriptions.add(m.description);
  }
  assert.equal(titles.size, Object.keys(publicPages).length);
  assert.equal(descriptions.size, titles.size);
});

test("business markup respects intentionally removed contact data and never invents reviews or hours", () => {
  const { businessSchema } = modules()("lib/seo.ts");
  const defaultBusiness = businessSchema()["@graph"][0];
  assert.equal(defaultBusiness["@type"], "AutoDealer");
  assert.equal(defaultBusiness.telephone, "+919958125967");
  const saved = businessSchema({
    contact_customized: true,
    business_name: "NCR Wheelz",
    email: "",
    address: "",
    phone: "",
  })["@graph"][0];
  for (const field of [
    "telephone",
    "address",
    "email",
    "hasMap",
    "aggregateRating",
    "review",
    "openingHoursSpecification",
  ])
    assert.equal(saved[field], undefined, field);
});

const vehicle = {
  id: 7,
  slug: "swift",
  type: "passenger",
  make: "Maruti Suzuki",
  model: "Swift",
  variant: "VXi",
  year: 2020,
  price: 500000,
  mileage: 40000,
  fuel: "Petrol",
  transmission: "Manual",
  owners: 1,
  seats: 5,
  description: "A used car",
  status: "published",
  images: [{ url: "/api/v1/media/8", alt_text: "Front view" }],
  location: "New Delhi",
  body_type: "Hatchback",
  features: [],
  created_at: "2026-10-25T12:00:00Z",
};
const blogPost = {
  id: 3,
  slug: "choosing-a-used-car",
  title: "Choosing your next used car",
  excerpt:
    "Practical questions to help you choose a used car for your next chapter.",
  category: "buying",
  author_name: "NCR Wheelz",
  seo_title: "",
  seo_description: "",
  cover_alt: "A car parked outside the showroom",
  cover: { id: 2, url: "/api/v1/blog-media/2" },
  body: [
    { type: "heading", text: "Start with your needs" },
    {
      type: "paragraph",
      text: "Think about your budget and daily route before comparing vehicles.",
    },
  ],
  reading_minutes: 1,
  published_at: "2026-10-26T10:00:00.000Z",
  updated_at: "2026-10-26T11:00:00.000Z",
};
test("blog articles have canonical sharing metadata, matching article schema and escaped content", async () => {
  const load = modules();
  const { blogMetadata, blogSchema } = load("lib/blog.ts");
  const metadata = blogMetadata(blogPost);
  assert.equal(
    metadata.alternates.canonical,
    "https://ncrwheelz.com/blog/choosing-a-used-car",
  );
  assert.equal(metadata.openGraph.type, "article");
  assert.deepEqual(metadata.authors, [
    { name: "NCR Wheelz", url: "https://ncrwheelz.com/about" },
  ]);
  assert.deepEqual(metadata.openGraph.authors, [blogPost.author_name]);
  assert.equal(metadata.robots.googleBot["max-image-preview"], "large");
  assert.equal(metadata.openGraph.publishedTime, blogPost.published_at);
  assert.equal(metadata.twitter.description, blogPost.excerpt);
  assert.equal(
    metadata.openGraph.images[0].url,
    "https://ncrwheelz.com/api/v1/blog-media/2",
  );
  assert.equal(blogSchema(blogPost)["@graph"][0]["@type"], "BlogPosting");
  assert.equal(blogSchema(blogPost)["@graph"][0].headline, blogPost.title);
  const overridden = blogMetadata({
    ...blogPost,
    seo_title: "Custom search title",
    seo_description: "Custom description",
    cover: null,
  });
  assert.equal(overridden.title, "Custom search title");
  assert.match(overridden.openGraph.images[0].url, /ncr-wheelz-og\.png$/);
  assert.equal(
    blogSchema({ ...blogPost, cover: null })["@graph"][0].image,
    undefined,
  );
  assert.equal(
    blogSchema(blogPost)["@graph"][0].author.url,
    "https://ncrwheelz.com/about",
  );
  const person = blogMetadata({ ...blogPost, author_name: "Asha Sharma" });
  assert.deepEqual(person.authors, [{ name: "Asha Sharma" }]);
  const stream = await renderToReadableStream(
    React.createElement(load("components/blog-content.tsx").BlogContent, {
      blocks: [
        { type: "paragraph", text: '<script>alert("unsafe")</script>' },
        { type: "bullets", text: "Budget\nCondition" },
        { type: "numbered", text: "Shortlist\nVisit" },
        { type: "quote", text: "Ask before you decide." },
      ],
    }),
  );
  await stream.allReady;
  const html = await new Response(stream).text();
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.match(html, /<ul>[\s\S]*Budget/);
  assert.match(html, /<ol>[\s\S]*Shortlist/);
  assert.match(html, /<blockquote/);
});
test("blog pagination has its own canonical URL while search filters remain noindex", () => {
  const { blogIndexMetadata } = modules()("lib/blog.ts");
  const second = blogIndexMetadata({ page: "2" });
  assert.equal(
    second.alternates.canonical,
    "https://ncrwheelz.com/blog?page=2",
  );
  assert.equal(second.openGraph.url, second.alternates.canonical);
  assert.equal(second.robots.index, true);
  assert.match(second.title, /Page 2$/);
  assert.equal(
    blogIndexMetadata({ page: "1" }).alternates.canonical,
    "https://ncrwheelz.com/blog",
  );
  assert.equal(
    blogIndexMetadata({ utm_source: "newsletter" }).robots.index,
    true,
  );
  for (const params of [
    { q: "car" },
    { category: "buying" },
    { page: "0" },
    { page: ["1", "2"] },
    { page: "10001" },
  ])
    assert.equal(blogIndexMetadata(params).robots.index, false);
});
test("vehicle collection pagination remains discoverable without indexing filtered copies", () => {
  const { collectionMetadata } = modules()("lib/seo.ts");
  for (const path of ["/cars", "/commercial"]) {
    const page = collectionMetadata(path, { page: "2", utm_source: "social" });
    assert.equal(
      page.alternates.canonical,
      `https://ncrwheelz.com${path}?page=2`,
    );
    assert.equal(page.robots.index, true);
    assert.equal(
      collectionMetadata(path, { fuel: "Petrol", page: "2" }).robots.index,
      false,
    );
    assert.equal(
      collectionMetadata(path, { max_price: "800000" }).robots.index,
      false,
    );
    assert.equal(
      collectionMetadata(path, {}).robots.googleBot["max-image-preview"],
      "large",
    );
  }
});
test("vehicle markup uses live fields, distinguishes reserved inventory and excludes sample products", () => {
  const { vehicleSchema } = modules()("lib/seo.ts");
  const v = vehicleSchema(vehicle)["@graph"][0];
  assert.deepEqual(v["@type"], ["Product", "Car"]);
  assert.equal(v.offers.price, vehicle.price);
  assert.equal(v.offers.priceCurrency, "INR");
  assert.equal(v.mileageFromOdometer.value, 40000);
  assert.equal(v.offers.availability, "https://schema.org/InStock");
  assert.equal(v.image[0], "https://ncrwheelz.com/api/v1/media/8");
  assert.equal(
    vehicleSchema({ ...vehicle, status: "reserved" })["@graph"][0].offers
      .availability,
    "https://schema.org/OutOfStock",
  );
  assert.equal(vehicleSchema({ ...vehicle, is_sample: true }), null);
  assert.equal(v.aggregateRating, undefined);
});

test("JSON-LD cannot terminate its script and sitemap dates accept SQL UTC and ISO values", () => {
  const { jsonLd, sitemapDate } = modules()("lib/seo.ts");
  const payload = { name: '</script><script>alert("unsafe")</script>' };
  assert.ok(!jsonLd(payload).includes("<"));
  assert.deepEqual(JSON.parse(jsonLd(payload)), payload);
  for (const date of [
    "2026-10-25 12:00:00",
    "2026-10-25T12:00:00Z",
    "2026-10-25T17:30:00+05:30",
  ])
    assert.equal(sitemapDate(date).toISOString(), "2026-10-25T12:00:00.000Z");
  assert.equal(sitemapDate("invalid"), undefined);
});

test("robots allow the selling guide and public photos while excluding private areas and API endpoints", () => {
  const { rules, sitemap } = modules()("app/robots.ts").default();
  const match = (path, rule) =>
    new RegExp(
      "^" + rule.replace(/[.*+?^{}()|[\]\\]/g, "\\$&").replace(/\$$/, "$"),
    ).test(path);
  const allowed = (path) => {
    const candidates = [
      ...rules.allow.map((rule) => ({ rule, allow: true })),
      ...rules.disallow.map((rule) => ({ rule, allow: false })),
    ]
      .filter(({ rule }) => match(path, rule))
      .sort(
        (a, b) =>
          b.rule.replace(/\$$/, "").length - a.rule.replace(/\$$/, "").length ||
          Number(b.allow) - Number(a.allow),
      );
    return candidates[0]?.allow ?? true;
  };
  for (const path of [
    "/",
    "/cars",
    "/selling-guide",
    "/blog",
    "/api/v1/blog-media/2",
    "/api/v1/media/8",
  ])
    assert.equal(allowed(path), true, path);
  for (const path of [
    "/sell",
    "/account",
    "/account/submissions/1",
    "/admin/offers",
    "/api/v1/auth/me",
    "/api/v1/private-images/1",
  ])
    assert.equal(allowed(path), false, path);
  assert.equal(sitemap, "https://ncrwheelz.com/sitemap.xml");
});

test("sitemap uses the canonical inventory feed and refuses a misleading partial sitemap on API failure", async () => {
  const load = modules({
    "@/lib/server": {
      site: "https://ncrwheelz.com",
      serverApi: async (path) => ({
        data:
          path === "/seo/blog"
            ? {
                items: [
                  {
                    slug: blogPost.slug,
                    updated_at: blogPost.updated_at,
                    images: [blogPost.cover.url],
                  },
                ],
              }
            : {
                items: [
                  {
                    id: 7,
                    slug: "swift",
                    updated_at: "2026-10-25T12:00:00Z",
                    images: ["/api/v1/media/3", "/api/v1/media/4"],
                  },
                  {
                    id: 9,
                    slug: "no-photos",
                    updated_at: "2026-10-25T12:00:00Z",
                  },
                ],
              },
      }),
    },
  });
  const result = await load("app/sitemap.ts").default();
  const listing = result.at(-2);
  assert.equal(listing.url, "https://ncrwheelz.com/vehicles/7/swift");
  assert.equal(listing.lastModified.toISOString(), "2026-10-25T12:00:00.000Z");
  // Image sitemap entries must be absolute, crawlable public media URLs.
  assert.deepEqual(listing.images, [
    "https://ncrwheelz.com/api/v1/media/3",
    "https://ncrwheelz.com/api/v1/media/4",
  ]);
  assert.equal("images" in result.at(-1), false);
  assert.ok(result.some((item) => item.url.endsWith("/selling-guide")));
  const article = result.find((item) =>
    item.url.endsWith("/blog/" + blogPost.slug),
  );
  assert.equal(article.lastModified.toISOString(), blogPost.updated_at);
  assert.deepEqual(article.images, [
    "https://ncrwheelz.com/api/v1/blog-media/2",
  ]);
  assert.ok(
    !result.some((item) =>
      /\/(admin|account|policies|compare)(\/|$)/.test(
        new URL(item.url).pathname,
      ),
    ),
  );
  const unavailable = modules({
    "@/lib/server": { serverApi: async () => ({ data: null }) },
  });
  await assert.rejects(
    unavailable("app/sitemap.ts").default(),
    /API is unavailable/,
  );
});

test("manifest and IndexNow key file expose only configured, valid values", async () => {
  const manifest = modules()("app/manifest.ts").default();
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.lang, "en-IN");
  for (const icon of manifest.icons)
    assert.ok(existsSync(resolve(root, "public", icon.src.slice(1))));
  const missing = modules()("app/indexnow-key.txt/route.ts").GET();
  assert.equal(missing.status, 404);
  const invalid = modules(
    {},
    { INDEXNOW_KEY: "bad key!" },
  )("app/indexnow-key.txt/route.ts").GET();
  assert.equal(invalid.status, 404);
  const valid = modules(
    {},
    { INDEXNOW_KEY: " ncr-wheelz-key-2026 " },
  )("app/indexnow-key.txt/route.ts").GET();
  assert.equal(valid.status, 200);
  assert.equal(await valid.text(), "ncr-wheelz-key-2026");
});

test("photo alt text is described from current vehicle details unless staff wrote their own", () => {
  const { photoAlt, isAutomaticAlt, vehicleTitle } =
    modules()("lib/photo-alt.ts");
  const sonet = { year: 2019, make: "Kia", model: "Sonet", variant: "HTX" };
  assert.equal(vehicleTitle(sonet), "2019 Kia Sonet HTX");
  assert.equal(vehicleTitle({ ...sonet, variant: " " }), "2019 Kia Sonet");
  // New uploads (blank) and every legacy upload default are automatic.
  for (const legacy of [
    "",
    "  ",
    "Kia Sonet",
    "kia sonet vehicle photo",
    "Old Make Old Model vehicle photo",
  ])
    assert.equal(isAutomaticAlt(legacy, sonet), true, legacy);
  assert.equal(photoAlt("", sonet), "2019 Kia Sonet HTX");
  assert.equal(
    photoAlt("kia Sonet vehicle photo", sonet, 1, 5),
    "2019 Kia Sonet HTX — photo 2 of 5",
  );
  // Staff-written descriptions are kept exactly (trimmed).
  assert.equal(
    photoAlt("  Front view with alloy wheels ", sonet, 0, 5),
    "Front view with alloy wheels",
  );
  assert.equal(isAutomaticAlt("Kia Sonet interior", sonet), false);
});

test("llms.txt returns readable canonical links without private accounts or invented guarantees", async () => {
  const llms = (settings) =>
    modules({
      "@/lib/server": { serverApi: async () => ({ data: settings }) },
    })("app/llms.txt/route.ts").GET();
  const response = await llms(null);
  assert.equal(
    response.headers.get("content-type"),
    "text/plain; charset=utf-8",
  );
  const content = await response.text();
  assert.match(content, /^# NCR Wheelz\n/);
  assert.match(content, /https:\/\/ncrwheelz.com\/cars/);
  assert.ok(!content.includes("localhost"));
  assert.ok(!content.includes("/account"));
  assert.match(content, /not guaranteed offers/);
  // Services and contact details mirror the visible site and its settings.
  assert.match(content, /## Services[\s\S]*Corporate cab attachment/);
  assert.match(content, /commercial#corporate-cab-attachment/);
  assert.match(content, /- Phone: 99581 25967 \(tel:\+919958125967\)/);
  assert.match(content, /- Email: ncrwheelz@gmail.com/);
  assert.match(content, /- WhatsApp: https:\/\/wa.me\/919958125967/);
  assert.match(
    content,
    /- Instagram: https:\/\/www.instagram.com\/ncrwheels2026/,
  );
  const customized = await (
    await llms({
      contact_customized: true,
      phone: "98100 00000",
      email: "",
      whatsapp: "",
    })
  ).text();
  assert.match(customized, /- Phone: 98100 00000/);
  assert.ok(!customized.includes("- Email:"));
  assert.ok(!customized.includes("- WhatsApp:"));
  const withArticles = modules({
    "@/lib/server": {
      serverApi: async (path) => ({
        data: path.startsWith("/blog?")
          ? {
              items: [
                {
                  ...blogPost,
                  title: "Guide [one]\nwith a heading",
                  excerpt: "A practical guide.",
                },
              ],
            }
          : {},
      }),
    },
  })("app/llms.txt/route.ts");
  const latest = await (await withArticles.GET()).text();
  assert.match(latest, /## Recent articles/);
  assert.ok(latest.includes("Guide \\[one\\] with a heading"));
  assert.ok(latest.includes("https://ncrwheelz.com/blog/" + blogPost.slug));
  assert.match(latest, /https:\/\/ncrwheelz.com\/sitemap.xml/);
  const { policyOrder } = modules()("lib/policies.ts");
  for (const slug of policyOrder)
    assert.ok(latest.includes(`/policies/${slug}`));
});

test("business markup links the real Instagram profile and the cab attachment service", () => {
  const { businessSchema, pageSchema } = modules()("lib/seo.ts");
  const graph = businessSchema({})["@graph"];
  const business = graph.find((node) => node["@type"] === "AutoDealer");
  const service = graph.find((node) => node["@type"] === "Service");
  assert.deepEqual(business.sameAs, [
    "https://www.instagram.com/ncrwheels2026",
  ]);
  assert.deepEqual(
    business.contactPoint.map((point) => point.telephone),
    ["+919958125967", "+919650201495"],
  );
  assert.equal(service["@type"], "Service");
  assert.equal(service.provider["@id"], business["@id"]);
  assert.equal(business.makesOffer.itemOffered["@id"], service["@id"]);
  assert.match(service.url, /\/commercial#corporate-cab-attachment$/);
  const commercial = pageSchema("/commercial")["@graph"][0];
  assert.ok(commercial.about.some((node) => node["@id"] === service["@id"]));
  // No invented reviews, ratings or opening days.
  for (const key of ["aggregateRating", "review", "openingHoursSpecification"])
    assert.equal(key in business, false);
});

test("public images decode as WebP/PNG and supplied ICO files contain valid icon frames", async () => {
  function files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(resolve(directory, entry.name))
        : [resolve(directory, entry.name)],
    );
  }
  for (const file of files(resolve(root, "public"))) {
    if (file.endsWith(".webmanifest")) continue;
    if (/\/google[0-9a-f]+\.html$/.test(file)) {
      assert.equal(
        readFileSync(file, "utf8").trim(),
        `google-site-verification: ${file.split("/").at(-1)}`,
      );
      continue;
    }
    if (file.endsWith(".ico")) {
      const bytes = readFileSync(file);
      assert.equal(bytes.readUInt16LE(0), 0);
      assert.equal(bytes.readUInt16LE(2), 1);
      const count = bytes.readUInt16LE(4);
      assert.ok(count > 0 && bytes.length >= 6 + count * 16, file);
      for (let i = 0; i < count; i++) {
        const entry = 6 + i * 16;
        assert.ok(bytes.readUInt32LE(entry + 8) > 0);
        assert.ok(
          bytes.readUInt32LE(entry + 12) + bytes.readUInt32LE(entry + 8) <=
            bytes.length,
          file,
        );
      }
      continue;
    }
    assert.match(file, /\.(webp|png)$/);
    const metadata = await sharp(file).metadata();
    assert.ok(["webp", "png"].includes(metadata.format), file);
    assert.ok(metadata.width > 0 && metadata.width <= 1800, file);
  }
});

test("favicon, manifest and sharing metadata reference the supplied brand assets with correct sizes", async () => {
  const load = modules();
  const { metadata } = load("app/layout.tsx");
  assert.ok(
    metadata.icons.icon.some((icon) => icon.url === "/brandings/favicon.ico"),
  );
  for (const icon of [...metadata.icons.icon, ...metadata.icons.apple].filter(
    (icon) => icon.type === "image/png",
  )) {
    const image = await sharp(
      resolve(root, "public", icon.url.slice(1)),
    ).metadata();
    assert.equal(`${image.width}x${image.height}`, icon.sizes);
  }
  const manifest = load("app/manifest.ts").default();
  const uploaded = JSON.parse(
    readFileSync(resolve(root, "public/brandings/site.webmanifest"), "utf8"),
  );
  assert.deepEqual(uploaded.icons, manifest.icons);
  for (const icon of manifest.icons) {
    const image = await sharp(
      resolve(root, "public", icon.src.slice(1)),
    ).metadata();
    assert.equal(`${image.width}x${image.height}`, icon.sizes);
  }
  const { shareImage } = load("lib/seo.ts");
  const path = resolve(
    root,
    "public",
    new URL(shareImage.url).pathname.slice(1),
  );
  const image = await sharp(path).metadata();
  assert.equal(image.format, "png");
  assert.equal(image.width, shareImage.width);
  assert.equal(image.height, shareImage.height);
  assert.deepEqual(
    readFileSync(resolve(root, "public/images/logo.png")),
    readFileSync(resolve(root, "public/brandings/android-chrome-512x512.png")),
  );
});

test("public page components render one H1, image alternatives and parseable matching schemas", async () => {
  // Real React SSR with deterministic public API fixtures, not a running browser or Next HTTP server.
  const load = modules({
    "@/lib/server": {
      site: "https://ncrwheelz.com",
      serverApi: async (path) => ({
        data:
          path === "/settings"
            ? {}
            : path.startsWith("/facets")
              ? { makes: [] }
              : path === "/valuation/options"
                ? { items: [] }
                : path === "/offers"
                  ? { items: [] }
                  : path.startsWith("/blog/")
                    ? blogPost
                    : path.startsWith("/blog?")
                      ? { items: [blogPost], total: 1, page: 1, pages: 1 }
                      : path.startsWith("/vehicles/")
                        ? vehicle
                        : { items: [vehicle], total: 1, page: 1, pages: 1 },
        error: null,
      }),
    },
  });
  const { publicPages } = load("lib/seo.ts");
  const { policyOrder } = load("lib/policies.ts");
  const entries = [
    {
      path: "/blog/" + blogPost.slug,
      file: "app/blog/[slug]/page.tsx",
      params: { slug: blogPost.slug },
    },
    ...Object.keys(publicPages).map((path) => ({
      path,
      file: `app/${path === "/" ? "" : path.slice(1) + "/"}page.tsx`,
      params: {},
    })),
    ...policyOrder.map((slug) => ({
      path: `/policies/${slug}`,
      file: "app/policies/[slug]/page.tsx",
      params: { slug },
    })),
    {
      path: "/vehicles/7/swift",
      file: "app/vehicles/[id]/[slug]/page.tsx",
      params: { id: "7", slug: "swift" },
    },
    { path: "/test-drive", file: "app/test-drive/page.tsx", params: {} },
  ];
  for (const { path, file, params } of entries) {
    const page = React.createElement(load(file).default, {
      params: Promise.resolve(params),
      searchParams: Promise.resolve({}),
    });
    const stream = await renderToReadableStream(
      React.createElement(load("app/layout.tsx").default, null, page),
    );
    await stream.allReady;
    const html = await new Response(stream).text();
    assert.equal(
      [...html.matchAll(/<h1(?:\s[^>]*)?>/g)].length,
      1,
      `${path}: exactly one H1`,
    );
    for (const image of html.matchAll(/<img\b[^>]*>/g))
      assert.match(image[0], /\balt="[^"]*"/, path);
    const schemas = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ].map((match) => JSON.parse(match[1]));
    if (path in publicPages)
      assert.ok(
        schemas.some((schema) =>
          schema["@graph"]?.some(
            (entry) => entry.url === "https://ncrwheelz.com" + path,
          ),
        ),
        `${path}: page schema`,
      );
    const faq = schemas.find((schema) => schema["@type"] === "FAQPage");
    if (faq)
      for (const entry of faq.mainEntity) {
        // Every marked-up answer comes from the same array rendered in the visible accordion.
        assert.ok(
          html.includes(
            entry.acceptedAnswer.text
              .replaceAll("&", "&amp;")
              .replaceAll("'", "&#x27;")
              .replaceAll('"', "&quot;"),
          ),
          `${path}: visible FAQ answer`,
        );
      }
  }
});
