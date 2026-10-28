import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import ts from "../node_modules/typescript/lib/typescript.js";
import { localDateTime } from "../lib/datetime.ts";
import { business, resolveBusiness } from "../lib/business.ts";

test("datetime-local formatting uses the user's timezone for both minimum and stored times", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Asia/Kolkata";
    assert.equal(localDateTime("2026-10-20 04:30:00"), "2026-10-20T10:00");
    assert.equal(
      localDateTime(new Date("2026-10-20T04:30:00Z")),
      "2026-10-20T10:00",
    );
    process.env.TZ = "America/New_York";
    assert.equal(localDateTime("2026-07-01 12:00:00"), "2026-07-01T08:00");
    assert.equal(localDateTime("2026-01-01 12:00:00"), "2026-01-01T07:00");
    assert.equal(localDateTime("invalid"), "");
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
test("public settings preserve owner defaults until explicitly saved and support intentional removal", () => {
  assert.equal(
    resolveBusiness({ email: "legacy@example.test" }).email,
    business.email,
  );
  const saved = resolveBusiness({
    contact_customized: true,
    business_name: "Updated showroom",
    email: "new@example.test",
    phone: "99999 99999",
    phone_secondary: "+91 88888 88888",
    hours: "10 AM–6 PM",
    address: "Updated address",
    map_embed: "",
  });
  assert.equal(saved.email, "new@example.test");
  assert.equal(saved.name, "Updated showroom");
  assert.equal(saved.phones[0].href, "tel:+919999999999");
  assert.equal(saved.phones[1].href, "tel:+918888888888");
  assert.equal(saved.mapEmbed, "");
  assert.ok(saved.mapsUrl.includes("Updated%20address"));
  assert.deepEqual(
    resolveBusiness({
      contact_customized: true,
      phone: "",
      phone_secondary: "",
    }).phones,
    [],
  );
});

// Each VM has its own module globals, like two browser tabs, but shares cookies and locks.
async function tabApi(
  fetch,
  navigator,
  extras = {},
  entry = "api",
  exported = "api",
) {
  const context = vm.createContext({
    fetch,
    navigator,
    Headers,
    URL,
    FormData,
    AbortSignal,
    console,
    setTimeout,
    clearTimeout,
    ...extras,
  });
  const modules = new Map();
  async function load(name) {
    if (modules.has(name)) return modules.get(name);
    if (name === "server-only")
      return new vm.SyntheticModule([], () => {}, { context });
    const source = await readFile(
      new URL(`../lib/${name}.ts`, import.meta.url),
      "utf8",
    );
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const module = new vm.SourceTextModule(outputText, {
      context,
      identifier: name,
    });
    modules.set(name, module);
    await module.link((specifier) => load(specifier.replace("./", "")));
    return module;
  }
  const module = await load(entry);
  await module.evaluate();
  return module.namespace[exported];
}
function sharedSession() {
  let valid = false,
    rotations = 0,
    tail = Promise.resolve();
  return {
    get rotations() {
      return rotations;
    },
    navigator: {
      locks: {
        request(_name, _options, work) {
          const result = tail.then(work);
          tail = result.catch(() => {});
          return result;
        },
      },
    },
    async fetch(url) {
      await Promise.resolve();
      if (url === "/api/v1/auth/refresh") {
        rotations++;
        if (rotations > 1)
          return Response.json(
            { error: { message: "Replay" } },
            { status: 401 },
          );
        valid = true;
        return Response.json({ ok: true });
      }
      return valid
        ? Response.json({ ok: true })
        : Response.json({ error: { message: "Expired" } }, { status: 401 });
    },
  };
}
test("safe reads retry one reset or gateway error; writes, auth rejection and cancelled reads are never replayed", async () => {
  for (const gateway of [false, true]) {
    let calls = 0;
    const read = await tabApi(
      async () => {
        if (++calls === 1) {
          if (gateway)
            return new Response("Temporary gateway failure", { status: 502 });
          throw new TypeError("ECONNRESET");
        }
        return Response.json({ ok: true });
      },
      {},
      {},
      "fetch-read",
      "fetchRead",
    );
    assert.equal((await read("/read")).status, 200);
    assert.equal(calls, 2);
  }
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
    let calls = 0;
    const read = await tabApi(
      async () => {
        calls++;
        throw new TypeError("ECONNRESET");
      },
      {},
      {},
      "fetch-read",
      "fetchRead",
    );
    await assert.rejects(read("/write", { method }));
    assert.equal(calls, 1);
  }
  for (const status of [401, 403, 429]) {
    let calls = 0;
    const read = await tabApi(
      async () => {
        calls++;
        return new Response(null, { status });
      },
      {},
      {},
      "fetch-read",
      "fetchRead",
    );
    assert.equal((await read("/read")).status, status);
    assert.equal(calls, 1);
  }
  let calls = 0;
  const failed = await tabApi(
    async () => {
      calls++;
      throw new TypeError("ECONNRESET");
    },
    {},
    {},
    "fetch-read",
    "fetchRead",
  );
  await assert.rejects(failed("/read"));
  assert.equal(calls, 2, "read retries are bounded");
  calls = 0;
  await assert.rejects(failed("/read", { signal: AbortSignal.abort() }));
  assert.equal(calls, 1, "an exhausted deadline cannot trigger another read");
});
test("transient refresh failures remain service errors and never replay token rotation", async () => {
  for (const status of [503, 401]) {
    let rotations = 0;
    const api = await tabApi(
      async (url) => {
        if (url.endsWith("/auth/refresh")) {
          rotations++;
          return Response.json(
            { error: { message: "Refresh failed" } },
            { status },
          );
        }
        return Response.json(
          { error: { code: "SESSION_EXPIRED", message: "Expired" } },
          { status: 401 },
        );
      },
      { locks: { request: (_name, _options, work) => work() } },
    );
    await assert.rejects(api("/auth/me"), { status });
    assert.equal(rotations, 1);
  }
});

async function proxyWith(fetch) {
  const fetchRead = await tabApi(fetch, {}, {}, "fetch-read", "fetchRead");
  class NextResponse extends Response {
    static next() {
      return new Response(null, { status: 204 });
    }
    static redirect(url, status = 307) {
      return new Response(null, {
        status,
        headers: { Location: String(url) },
      });
    }
    static rewrite(url) {
      return new Response(null, {
        status: 200,
        headers: { "X-Rewrite": String(url) },
      });
    }
  }
  const source = await readFile(
    new URL("../proxy.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    URL,
    AbortSignal,
    process: { env: {} },
    require: (name) => {
      if (name === "next/server") return { NextResponse };
      if (name === "./lib/fetch-read") return { fetchRead };
      if (name === "./lib/policies")
        return {
          getPolicy: (slug) =>
            ["privacy", "terms"].includes(slug) ? { title: slug } : undefined,
        };
      throw new Error("Unexpected proxy import " + name);
    },
  });
  return (path, refresh = false) =>
    module.exports.proxy({
      url: "http://localhost:3000" + path,
      nextUrl: new URL("http://localhost:3000" + path),
      headers: new Headers(),
      cookies: { has: () => refresh },
    });
}
test("protected-page proxy distinguishes connection outages from sign-out and retains role enforcement", async () => {
  let calls = 0;
  const recovered = await proxyWith(async () => {
    if (++calls === 1) throw new TypeError("ECONNRESET");
    return Response.json({
      user: { role: "admin", permissions: ["inventory"] },
    });
  });
  assert.equal((await recovered("/admin/inventory")).status, 204);
  assert.equal(calls, 2);
  for (const response of [
    () => {
      throw new TypeError("ECONNRESET");
    },
    () => new Response(null, { status: 503 }),
    () => Response.json({ user: {} }),
  ]) {
    const proxy = await proxyWith(response);
    const result = await proxy("/account?tab=1&_rsc=internal");
    assert.equal(result.status, 503);
    assert.equal(result.headers.get("Location"), null);
    assert.equal(result.headers.get("Cache-Control"), "no-store");
    const html = await result.text();
    assert.match(html, /Connection interrupted/);
    assert.match(html, /href="\/account\?tab=1"/);
    assert.doesNotMatch(html, /internal|ECONNRESET/);
  }
  const expired = await proxyWith(
    async () => new Response(null, { status: 401 }),
  );
  assert.match(
    (await expired("/account")).headers.get("Location"),
    /\/login\?next=/,
  );
  assert.match(
    (await expired("/account", true)).headers.get("Location"),
    /\/session\?next=/,
  );
  const customer = await proxyWith(async () =>
    Response.json({ user: { role: "customer", permissions: [] } }),
  );
  assert.equal(
    (await customer("/admin")).headers.get("Location"),
    "http://localhost:3000/account",
  );
  const sales = await proxyWith(async () =>
    Response.json({ user: { role: "sales", permissions: ["inventory"] } }),
  );
  assert.equal(
    (await sales("/admin/users")).headers.get("Location"),
    "http://localhost:3000/admin",
  );
});
test("listing proxy gives crawlers real 404, 308 and 503 statuses before the page streams", async () => {
  const requested = [];
  const listings = await proxyWith(async (url) => {
    requested.push(String(url));
    return String(url).endsWith("/8")
      ? Response.json({ id: 8, slug: "2024-maruti-suzuki-swift" })
      : Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  });
  assert.equal(
    (await listings("/vehicles/8/2024-maruti-suzuki-swift")).status,
    204,
  );
  // The cheap SEO lookup is used, never the view-counting vehicle endpoint.
  assert.match(requested[0], /\/api\/v1\/seo\/listings\/8$/);
  for (const path of ["/vehicles/8/old-slug?utm_source=x", "/cars/8"]) {
    const moved = await listings(path);
    assert.equal(moved.status, 308);
    assert.equal(
      moved.headers.get("Location"),
      "http://localhost:3000/vehicles/8/2024-maruti-suzuki-swift" +
        (path.includes("?") ? "?utm_source=x" : ""),
    );
  }
  for (const path of ["/vehicles/99/sold-car", "/cars/99"]) {
    const gone = await listings(path);
    assert.match(gone.headers.get("X-Rewrite"), /\/listing-unavailable$/);
  }
  for (const response of [
    () => {
      throw new TypeError("ECONNRESET");
    },
    () => new Response(null, { status: 429 }),
    () => Response.json({ slug: 42 }),
  ]) {
    const result = await (await proxyWith(response))("/vehicles/8/a");
    assert.equal(result.status, 503);
    assert.equal(result.headers.get("Retry-After"), "5");
    assert.match(await result.text(), /load this vehicle listing/);
  }
});
test("article proxy checks public availability before streaming and does not require a session", async () => {
  const requests = [];
  const live = await proxyWith(async (url) => {
    requests.push(String(url));
    return Response.json({ id: 3, slug: "buying-checklist" });
  });
  assert.equal((await live("/blog/buying-checklist")).status, 204);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /\/api\/v1\/blog\/buying-checklist$/);
  for (const slug of ["missing", "draft", "scheduled", "archived"]) {
    const unavailable = await proxyWith(
      async () => new Response(null, { status: 404 }),
    );
    const result = await unavailable(`/blog/${slug}`);
    assert.match(result.headers.get("X-Rewrite"), /\/article-unavailable$/);
    assert.equal(result.headers.get("Location"), null);
  }
  for (const response of [
    () => new Response(null, { status: 500 }),
    () => {
      throw new TypeError("ECONNRESET");
    },
    () => Response.json({ id: 3, slug: "different-article" }),
  ]) {
    const result = await (await proxyWith(response))("/blog/buying-checklist");
    assert.equal(result.status, 503);
    assert.equal(result.headers.get("Retry-After"), "5");
  }
  const sales = await proxyWith(async () =>
    Response.json({ user: { role: "sales", permissions: ["inventory"] } }),
  );
  assert.equal(
    (await sales("/admin/blog/new")).headers.get("Location"),
    "http://localhost:3000/admin",
  );
});
test("policy proxy returns a real 404 for unknown policy pages without an API call", async () => {
  let calls = 0;
  const policies = await proxyWith(async () => {
    calls++;
    return new Response(null, { status: 500 });
  });
  assert.equal((await policies("/policies/privacy")).status, 204);
  const missing = await policies("/policies/does-not-exist");
  assert.match(missing.headers.get("X-Rewrite"), /\/policy-unavailable$/);
  assert.equal(calls, 0);
});
test("two independent tabs rotate a shared refresh cookie only once", async () => {
  const session = sharedSession();
  const first = await tabApi(session.fetch, session.navigator);
  const second = await tabApi(session.fetch, session.navigator);
  assert.deepEqual(
    await Promise.all([
      first("/account/favourites"),
      second("/account/favourites"),
    ]),
    [{ ok: true }, { ok: true }],
  );
  assert.equal(session.rotations, 1);
});
test("concurrent calls in one tab share a refresh operation", async () => {
  const session = sharedSession();
  const api = await tabApi(session.fetch, session.navigator);
  await Promise.all([
    api("/account/favourites"),
    api("/account/enquiries"),
    api("/account/test-drives"),
  ]);
  assert.equal(session.rotations, 1);
});
test("failed logins and forbidden requests do not rotate sessions", async () => {
  const calls = [];
  const api = await tabApi(async (url) => {
    calls.push(url);
    return Response.json(
      { error: { message: "Denied" } },
      { status: url.endsWith("login") ? 401 : 403 },
    );
  }, {});
  await assert.rejects(api("/auth/login", { method: "POST" }), { status: 401 });
  await assert.rejects(api("/admin/users"), { status: 403 });
  assert.equal(calls.length, 2);
});

function testIndexedDB() {
  const records = new Map();
  let tail = Promise.resolve();
  const db = {
    createObjectStore() {},
    close() {},
    transaction() {
      const tx = {};
      const store = {
        get(key) {
          const request = {};
          tail = tail
            .then(() => {
              request.result = records.get(key);
              request.onsuccess();
            })
            .then(() => tx.oncomplete());
          return request;
        },
        put(value, key) {
          records.set(key, value);
        },
        delete(key) {
          records.delete(key);
        },
      };
      tx.objectStore = () => store;
      return tx;
    },
  };
  return {
    open() {
      const request = { result: db };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  };
}
test("IndexedDB fallback coordinates independent tabs when Web Locks is absent", async () => {
  const session = sharedSession();
  const extras = {
    indexedDB: testIndexedDB(),
    crypto: { randomUUID },
    setInterval,
    clearInterval,
  };
  const first = await tabApi(session.fetch, {}, extras);
  const second = await tabApi(session.fetch, {}, extras);
  await Promise.all([
    first("/account/favourites"),
    second("/account/enquiries"),
  ]);
  assert.equal(session.rotations, 1);
});
test("unavailable coordination storage never triggers an unsafe refresh", async () => {
  const session = sharedSession();
  const api = await tabApi(
    session.fetch,
    {},
    {
      indexedDB: {
        open() {
          throw new Error("Storage denied");
        },
      },
    },
  );
  await assert.rejects(api("/account/favourites"), { status: 503 });
  assert.equal(session.rotations, 0);
});
test("anonymous auth checks never attempt refresh while eligible enquiries retry with the same payload", async () => {
  let calls = [];
  const api = await tabApi(async (url) => {
    calls.push(url);
    return Response.json(
      { error: { code: "AUTH_REQUIRED", message: "Please sign in" } },
      { status: 401 },
    );
  }, {});
  await assert.rejects(api("/auth/me"), { status: 401 });
  assert.deepEqual(calls, ["/api/v1/auth/me"]);
  const session = sharedSession();
  const retry = await tabApi(async (url, options) => {
    if (url.endsWith("/enquiries")) {
      calls.push(options.body);
      if (session.rotations)
        return Response.json({ id: 42, message: "Received" });
    }
    return session.fetch(url, options);
  }, session.navigator);
  const body = JSON.stringify({
    consent: true,
    message: "Keep linked to my account",
  });
  await retry("/enquiries", { method: "POST", body });
  assert.equal(session.rotations, 1);
  assert.deepEqual(calls.slice(1), [body, body]);
});
test("API rejects malformed success bodies and missing persisted IDs", async () => {
  for (const body of [
    "<html>proxy page</html>",
    "null",
    "[]",
    '{"message":"Received"}',
    '{"id":42}',
  ]) {
    const api = await tabApi(
      async () =>
        new Response(body, { headers: { "content-type": "application/json" } }),
      {},
    );
    await assert.rejects(api("/enquiries", { method: "POST" }), {
      status: 502,
      code: "INVALID_RESPONSE",
    });
  }
});
test("API rejects non-JSON content and incomplete sign-in/reset responses", async () => {
  const wrongType = await tabApi(
    async () =>
      new Response('{"id":42,"message":"OK"}', {
        headers: { "content-type": "text/html" },
      }),
    {},
  );
  await assert.rejects(wrongType("/enquiries", { method: "POST" }), {
    code: "INVALID_RESPONSE",
  });
  for (const path of ["/auth/me", "/auth/login", "/auth/forgot-password"]) {
    const api = await tabApi(async () => Response.json({}), {});
    await assert.rejects(api(path), { code: "INVALID_RESPONSE" });
  }
});
test("reset delivery configuration errors survive 503 mapping but generic gateway errors do not leak HTML", async () => {
  const api = await tabApi(
    async () =>
      Response.json(
        {
          error: {
            code: "DELIVERY_UNAVAILABLE",
            message: "Hidden upstream text",
          },
        },
        { status: 503 },
      ),
    {},
  );
  await assert.rejects(
    api("/auth/forgot-password", { method: "POST" }),
    (error) =>
      error.status === 503 &&
      error.code === "DELIVERY_UNAVAILABLE" &&
      /Email delivery is not configured/.test(error.message),
  );
  const gateway = await tabApi(
    async () => new Response("<html>Bad gateway</html>", { status: 502 }),
    {},
  );
  await assert.rejects(
    gateway("/auth/forgot-password", { method: "POST" }),
    (error) =>
      !error.message.includes("<html>") && /connect/.test(error.message),
  );
});
test("invalid inventory filters preserve their validation status and message", async () => {
  const serverApi = await tabApi(
    async () =>
      Response.json(
        { error: { message: "sort: Invalid option" } },
        { status: 422 },
      ),
    {},
    { process: { env: {} } },
    "server",
    "serverApi",
  );
  const result = await serverApi("/vehicles?sort=wrong");
  assert.equal(result.status, 422);
  assert.equal(result.error, "sort: Invalid option");
});
test("protected downloads refresh expired sessions and only save actual document/report content", async () => {
  const session = sharedSession();
  let clicks = 0,
    removed = 0,
    revoked = 0;
  const link = {
    click() {
      clicks++;
    },
    remove() {
      removed++;
    },
  };
  const extras = {
    URL: {
      createObjectURL: () => "blob:test",
      revokeObjectURL() {
        revoked++;
      },
    },
    document: { createElement: () => link, body: { appendChild() {} } },
    setTimeout(fn) {
      fn();
    },
  };
  const download = await tabApi(
    async (url, options) => {
      if (url.includes("/reports/export") && session.rotations) {
        assert.equal(options.credentials, "same-origin");
        return new Response("status,count\nnew,2", {
          headers: { "content-type": "text/csv; charset=utf-8" },
        });
      }
      return session.fetch(url, options);
    },
    session.navigator,
    extras,
    "api",
    "download",
  );
  await download("/admin/reports/export", "lead-status.csv");
  assert.equal(session.rotations, 1);
  assert.equal(clicks, 1);
  assert.equal(removed, 1);
  assert.equal(revoked, 1);
  assert.equal(link.download, "lead-status.csv");
  const invalid = await tabApi(
    async () =>
      new Response("<html>Sign in</html>", {
        headers: { "content-type": "text/html" },
      }),
    {},
    extras,
    "api",
    "download",
  );
  await assert.rejects(
    invalid("/account/submissions/1/documents/2", "rc.pdf"),
    { code: "INVALID_RESPONSE" },
  );
  assert.equal(clicks, 1);
});

test("market service errors retain actionable pricing messages without replaying the valuation POST", async () => {
  let calls = 0;
  const message =
    "Market checks have reached the site's request allowance. Please request a price review.";
  const api = await tabApi(async () => {
    calls++;
    return Response.json(
      { error: { code: "MARKET_BUDGET", message } },
      { status: 503 },
    );
  }, {});
  await assert.rejects(
    api("/valuation", { method: "POST" }),
    (error) => error.code === "MARKET_BUDGET" && error.message === message,
  );
  assert.equal(calls, 1);
});
