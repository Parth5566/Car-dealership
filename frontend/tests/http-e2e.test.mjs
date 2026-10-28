import { test } from "node:test";
import assert from "node:assert/strict";
const origin = "http://localhost:3100";
class BrowserSession {
  cookies = new Map();
  async request(path, body, method = body ? "POST" : "GET") {
    const headers = {
      "X-NCR-Request": "1",
      Origin: origin,
      "Content-Type": "application/json",
    };
    if (this.cookies.size)
      headers.Cookie = [...this.cookies]
        .map(([k, v]) => k + "=" + v)
        .join("; ");
    const response = await fetch(origin + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const pos = pair.indexOf("=");
      const key = pair.slice(0, pos),
        value = pair.slice(pos + 1);
      if (value) this.cookies.set(key, value);
      else this.cookies.delete(key);
    }
    return response;
  }
}
const customer = new BrowserSession(),
  admin = new BrowserSession();
const data = {
  name: "HTTP E2E Fixture",
  email: "http-e2e@example.test",
  phone: "9999999999",
  password: "six123",
  consent: true,
};
test("HTTP end-to-end across Next.js, Express and disposable MySQL", async (t) => {
  await t.test(
    "public pages and SEO routes render through the frontend",
    async () => {
      for (const route of [
        "/",
        "/cars",
        "/commercial",
        "/about",
        "/contact",
        "/finance",
        "/selling-guide",
        "/emi-calculator",
        "/car-valuation",
        "/discounts",
        "/blog",
        "/compare",
        "/signup",
        "/policies/privacy",
        "/policies/terms",
        "/policies/verification",
        "/policies/seller-agreement",
        "/policies/buyer-agreement",
        "/policies/condition",
        "/policies/cancellation-refund",
        "/policies/finance",
        "/policies/cookies",
        "/robots.txt",
        "/sitemap.xml",
        "/llms.txt",
      ]) {
        const r = await fetch(origin + route);
        assert.equal(r.status, 200, route);
        const html = await r.text();
        assert.ok(html.length > 20, route);
        if (!/\.(txt|xml)$/.test(route)) {
          assert.equal(
            [...html.matchAll(/<h1(?:\s[^>]*)?>/g)].length,
            1,
            `${route}: one main heading`,
          );
          for (const image of html.matchAll(/<img\b[^>]*>/g))
            assert.match(image[0], /\balt="[^"]*"/, `${route}: alt attribute`);
          assert.match(html, /<title>[^<]+<\/title>/, `${route}: title`);
          for (const script of html.matchAll(
            /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
          ))
            assert.doesNotThrow(
              () => JSON.parse(script[1]),
              `${route}: valid JSON-LD`,
            );
        }
      }
      const sitemap = await (await fetch(origin + "/sitemap.xml")).text();
      assert.ok(sitemap.includes("/vehicles/1/"));
      assert.ok(!sitemap.includes("/account"));
      assert.ok(sitemap.includes("/selling-guide"));
      assert.ok(!sitemap.includes("/policies/"));
      const listing = sitemap.match(
        /<loc>([^<]*\/vehicles\/1\/[^<]+)<\/loc>/,
      )?.[1];
      assert.ok(listing);
      const html = await (await fetch(listing)).text();
      assert.match(html, /"@type":\["Product","Car"\]/);
      assert.match(html, /"priceCurrency":"INR"/);
      const robots = await (await fetch(origin + "/robots.txt")).text();
      assert.match(robots, /Allow: \/api\/v1\/media\//);
      assert.match(robots, /Disallow: \/sell\$/);
      const llms = await (await fetch(origin + "/llms.txt")).text();
      assert.match(llms, /^# NCR Wheelz/);
      for (const [path, mime] of [
        ["/hero.webp", "image/webp"],
        ["/icon.png", "image/png"],
        ["/brandings/ncr-wheelz-og.png", "image/png"],
        ["/brandings/favicon-32x32.png", "image/png"],
        ["/brandings/apple-touch-icon.png", "image/png"],
      ]) {
        const response = await fetch(origin + path);
        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type"), new RegExp(mime));
      }
    },
  );
  await t.test(
    "passenger and commercial pages keep their inventories and make counts separate",
    async () => {
      const home = await (await fetch(origin + "/")).text();
      assert.ok(home.includes('id="passenger-cars"'));
      assert.ok(home.includes('id="commercial-vehicles"'));
      for (const [route, title, ownId, otherId, oppositeType] of [
        ["/cars", "Passenger cars", 1, 2, "commercial"],
        ["/commercial", "Commercial cabs", 2, 1, "passenger"],
      ]) {
        const response = await fetch(`${origin}${route}?type=${oppositeType}`);
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.ok(html.includes(`<h1>${title}</h1>`));
        assert.ok(html.includes(`href="/vehicles/${ownId}/`));
        assert.ok(!html.includes(`href="/vehicles/${otherId}/`));
      }
      for (const type of ["passenger", "commercial"]) {
        const response = await fetch(`${origin}/api/v1/facets?type=${type}`);
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(data.makes.length, 1);
        assert.equal(data.makes[0].count, type === "passenger" ? 3 : 1);
      }
      const all = await (await fetch(origin + "/api/v1/facets")).json();
      assert.equal(all.makes[0].count, 4);
      assert.equal(
        (await fetch(origin + "/api/v1/facets?type=invalid")).status,
        422,
      );
    },
  );
  await t.test(
    "anonymous protected page navigation redirects to sign in",
    async () => {
      const r = await fetch(origin + "/account", { redirect: "manual" });
      assert.equal(r.status, 307);
      assert.ok(r.headers.get("location").includes("/login"));
    },
  );
  await t.test(
    "registration through the frontend proxy returns usable HttpOnly sessions",
    async () => {
      const short = await customer.request("/api/v1/auth/register", {
        ...data,
        password: "short",
      });
      assert.equal(short.status, 422);
      assert.match((await short.json()).error.message, /at least 6 characters/);
      const r = await customer.request("/api/v1/auth/register", data);
      assert.equal(r.status, 201);
      assert.ok(
        r.headers
          .getSetCookie()
          .every((c) => c.includes("HttpOnly") && c.includes("Path=/;")),
      );
      const page = await customer.request("/account");
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.ok(html.includes("noindex"));
      const me = await (await customer.request("/api/v1/auth/me")).json();
      assert.equal(me.user.email, data.email);
    },
  );
  await t.test(
    "customer cannot reach administration through pages or APIs",
    async () => {
      const page = await customer.request("/admin");
      assert.equal(page.status, 307);
      assert.ok(page.headers.get("location").endsWith("/account"));
      const r = await customer.request("/api/v1/admin/dashboard");
      assert.equal(r.status, 403);
    },
  );
  await t.test(
    "favourites and customer requests persist through the same-origin proxy",
    async () => {
      assert.equal(
        (await customer.request("/api/v1/account/favourites/1", {}, "PUT"))
          .status,
        200,
      );
      const saved = await (
        await customer.request("/api/v1/account/favourites")
      ).json();
      assert.equal(saved.items.length, 1);
      assert.equal((await customer.request("/saved")).status, 200);
      const enquiry = await customer.request("/api/v1/enquiries", {
        name: data.name,
        email: data.email,
        phone: data.phone,
        message: "Disposable HTTP end-to-end enquiry",
        consent: true,
        consent_version: "contact-2026-10-21",
        vehicle_id: 1,
      });
      assert.equal(enquiry.status, 201);
      const drive = await customer.request("/api/v1/account/test-drives", {
        name: data.name,
        email: data.email,
        phone: data.phone,
        vehicle_id: 1,
        preferred_at: new Date(Date.now() + 864e5).toISOString(),
        notes: "Disposable fixture request",
        consent: true,
        consent_version: "contact-2026-10-21",
      });
      assert.equal(drive.status, 201);
    },
  );
  await t.test(
    "staff dashboard reflects the requests and can confirm the appointment",
    async () => {
      const login = await admin.request("/api/v1/auth/login", {
        email: "admin@example.test",
        password: "browser-qa-password-123",
        scope: "admin",
      });
      assert.equal(login.status, 200);
      assert.equal((await admin.request("/admin")).status, 200);
      const dashboard = await (
        await admin.request("/api/v1/admin/dashboard")
      ).json();
      assert.equal(dashboard.inventory.available, 4);
      assert.equal(dashboard.leads.new_leads, 1);
      assert.equal(dashboard.test_drives.open, 1);
      const drives = await (
        await admin.request("/api/v1/admin/test-drives")
      ).json();
      assert.equal(
        (
          await admin.request(
            "/api/v1/admin/test-drives/" + drives.items[0].id,
            {
              status: "confirmed",
              confirmed_at: new Date(Date.now() + 2 * 864e5).toISOString(),
              internal_note: "Fixture confirmation",
            },
            "PATCH",
          )
        ).status,
        200,
      );
      const own = await (
        await customer.request("/api/v1/account/test-drives")
      ).json();
      assert.equal(own.items[0].status, "confirmed");
      assert.equal(own.items[0].internal_note, undefined);
    },
  );
  await t.test("logout revokes API and page access", async () => {
    assert.equal(
      (await customer.request("/api/v1/auth/logout", {})).status,
      200,
    );
    assert.equal((await customer.request("/api/v1/auth/me")).status, 401);
    assert.equal((await customer.request("/account")).status, 307);
  });
  await t.test(
    "six-character customer password works for a new login",
    async () => {
      assert.equal(
        (
          await customer.request("/api/v1/auth/login", {
            email: data.email,
            password: "wrong1",
            scope: "customer",
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await customer.request("/api/v1/auth/login", {
            email: data.email,
            password: data.password,
            scope: "customer",
          })
        ).status,
        200,
      );
      assert.equal((await customer.request("/api/v1/auth/me")).status, 200);
    },
  );
});
