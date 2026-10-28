import { NextRequest, NextResponse } from "next/server";
import { fetchRead } from "./lib/fetch-read";
import { getPolicy } from "./lib/policies";
const api = process.env.API_URL || "http://127.0.0.1:5001";
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path === "/admin/login") return NextResponse.next();
  const destination = path + req.nextUrl.search;
  const unavailable = (
    message = "We couldn’t check your session. Please retry this page when the connection is available.",
  ) => {
    const retry = new URL(req.url);
    retry.searchParams.delete("_rsc");
    const href = (retry.pathname + retry.search).replace(
      /[&<>"']/g,
      (value) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[value]!,
    );
    return new NextResponse(
      `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Connection interrupted | NCR Wheelz</title></head><body style="font:16px/1.6 system-ui,sans-serif;background:#f7f8fa;color:#172b3a;padding:10vh 24px"><main style="max-width:560px;margin:auto"><h1>Connection interrupted.</h1><p>${message}</p><a href="${href}" style="display:inline-block;background:#245b66;color:white;padding:12px 22px;border-radius:10px">Try again</a></main></body></html>`,
      {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Retry-After": "5",
        },
      },
    );
  };
  // Unknown policy pages: a real 404 before the root loading boundary streams.
  const policy = path.match(/^\/policies\/([^/]+)\/?$/);
  if (policy)
    return getPolicy(decodeURIComponent(policy[1]))
      ? NextResponse.next()
      : NextResponse.rewrite(new URL("/policy-unavailable", req.url));
  const article = path.match(/^\/blog\/([^/]+)\/?$/);
  if (article) {
    // Resolve availability before the root loading boundary streams a 200.
    // Draft, scheduled and archived articles all return 404 from this public API.
    try {
      const r = await fetchRead(
        `${api}/api/v1/blog/${encodeURIComponent(article[1])}`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
      if (r.status === 404 || r.status === 422)
        return NextResponse.rewrite(new URL("/article-unavailable", req.url));
      if (!r.ok)
        return unavailable(
          "We couldn’t load this article. Please retry shortly.",
        );
      const post = await r.json();
      if (!Number.isInteger(post?.id) || post.slug !== article[1])
        return unavailable(
          "We couldn’t load this article. Please retry shortly.",
        );
      return NextResponse.next();
    } catch {
      return unavailable(
        "We couldn’t load this article. Please retry shortly.",
      );
    }
  }
  const listing = path.match(/^\/(?:vehicles\/(\d+)\/([^/]+)|cars\/(\d+))\/?$/);
  if (listing) {
    // The root loading UI starts streaming with 200 before a page can call
    // notFound() or redirect(). Check public listings first so crawlers get
    // a real 404 for removed vehicles and a 308 to the current canonical slug.
    try {
      const r = await fetchRead(
        `${api}/api/v1/seo/listings/${listing[1] || listing[3]}`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
      if (r.status === 404 || r.status === 422)
        return NextResponse.rewrite(new URL("/listing-unavailable", req.url));
      if (!r.ok)
        return unavailable(
          "We couldn’t load this vehicle listing. Please retry shortly.",
        );
      const v = await r.json();
      if (!Number.isInteger(v?.id) || typeof v?.slug !== "string")
        return unavailable(
          "We couldn’t load this vehicle listing. Please retry shortly.",
        );
      if (listing[2] === v.slug) return NextResponse.next();
      const canonical = new URL(`/vehicles/${v.id}/${v.slug}`, req.url);
      canonical.search = req.nextUrl.search;
      return NextResponse.redirect(canonical, 308);
    } catch {
      return unavailable(
        "We couldn’t load this vehicle listing. Please retry shortly.",
      );
    }
  }
  const signIn = () => {
    const url = new URL(
      path.startsWith("/admin") ? "/admin/login" : "/login",
      req.url,
    );
    url.searchParams.set("next", destination);
    return NextResponse.redirect(url);
  };
  try {
    const r = await fetchRead(api + "/api/v1/auth/me", {
      headers: { cookie: req.headers.get("cookie") || "" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (r.status === 401) {
      if (req.cookies.has("nw_refresh")) {
        const url = new URL("/session", req.url);
        url.searchParams.set("next", destination);
        return NextResponse.redirect(url);
      }
      return signIn();
    }
    if (!r.ok) return unavailable();
    const { user } = await r.json();
    if (
      !user ||
      !["customer", "admin", "sales", "reviewer"].includes(user.role) ||
      !Array.isArray(user.permissions)
    )
      return unavailable();
    if (path.startsWith("/admin")) {
      if (user.role === "customer")
        return NextResponse.redirect(new URL("/account", req.url));
      const area = path.split("/")[2];
      const permission: Record<string, string> = {
        inventory: "inventory",
        "inventory-reviews": "reviews",
        publishing: "inventory",
        submissions: "reviews",
        leads: "leads",
        "test-drives": "leads",
        customers: "customers",
        users: "users",
        settings: "settings",
        offers: "settings",
        blog: "settings",
        reports: "reports",
        audit: "audit",
      };
      if (permission[area] && !user.permissions.includes(permission[area]))
        return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  } catch {
    return unavailable();
  }
}
export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/saved",
    "/sell",
    "/test-drive",
    "/vehicles/:id/:slug",
    "/cars/:id",
    "/blog/:slug",
    "/policies/:slug",
  ],
};
