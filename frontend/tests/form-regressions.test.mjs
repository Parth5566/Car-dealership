import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "../node_modules/typescript/lib/typescript.js";
import { emptyOffer, offerState, offerDate } from "../lib/offers.ts";
import { fuelEconomy, fuelEconomyUnit } from "../lib/types.ts";
import * as React from "../node_modules/react/index.js";
import * as jsxRuntime from "../node_modules/react/jsx-runtime.js";
import { valuationMessage } from "../lib/valuation.ts";
import * as photoAltLib from "../lib/photo-alt.ts";
import * as blogDocument from "../lib/blog-document.ts";
import "./blog-editor.test.mjs";

// Execute the real component handlers with deterministic hooks and deferred APIs.
// This verifies state/async behavior; it is not a DOM or browser acceptance test.
async function component(file, name, overrides = {}, globals = {}) {
  let index = 0,
    pending = [];
  const slots = [];
  const equal = (a, b) =>
    a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    useState(initial) {
      const key = index++;
      if (!(key in slots))
        slots[key] = typeof initial === "function" ? initial() : initial;
      return [
        slots[key],
        (value) => {
          slots[key] = typeof value === "function" ? value(slots[key]) : value;
        },
      ];
    },
    useRef(initial) {
      const key = index++;
      return (slots[key] ||= { current: initial });
    },
    useCallback(fn, deps) {
      const key = index++;
      if (!equal(slots[key]?.deps, deps)) slots[key] = { deps, fn };
      return slots[key].fn;
    },
    useEffect(fn, deps) {
      const key = index++;
      if (!equal(slots[key]?.deps, deps)) {
        pending.push(() => {
          slots[key]?.cleanup?.();
          slots[key] = { deps, cleanup: fn() };
        });
      }
    },
  };
  const params = new URLSearchParams();
  const providers = {
    useToast: () => () => {},
    useAuth: () => ({ user: { id: 1, permissions: [] } }),
    useSaved: () => ({ update() {} }),
    AuthGate: "AuthGate",
  };
  const stubs = {
    react: hooks,
    "react/jsx-runtime": {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
      Fragment: "Fragment",
    },
    "next/navigation": { useSearchParams: () => params },
    "next/link": { default: "Link", __esModule: true },
    "@/lib/api": {
      api: async () => ({ items: [], total: 0, page: 1 }),
      send: (method, data) => ({ method, body: JSON.stringify(data) }),
    },
    "@/lib/types": {
      date: String,
      label: String,
      money: String,
      fuelEconomy,
      fuelEconomyUnit,
    },
    "@/lib/datetime": { localDateTime: String },
    "@/lib/photo-alt": photoAltLib,
    "@/lib/site": {
      site: "https://ncrwheelz.com",
      absoluteUrl: (path) => new URL(path, "https://ncrwheelz.com").href,
    },
    "./providers": providers,
    "@/components/providers": providers,
    "./ui": Object.fromEntries(
      ["Field", "Status", "Notice", "ErrorBox", "Empty", "SubmitButton"].map(
        (key) => [key, key],
      ),
    ),
    "@/components/ui": Object.fromEntries(
      ["VehicleCard", "Empty", "ErrorBox"].map((key) => [key, key]),
    ),
    "./admin-inventory": { AdminPagination: "AdminPagination" },
    "./vehicle-editor": { VehicleEditor: "VehicleEditor" },
    "./choice-field": { ChoiceField: "ChoiceField" },
    "./vehicle-identity-fields": {
      VehicleIdentityFields: "VehicleIdentityFields",
    },
    ...overrides,
  };
  if (overrides.react) stubs.react = { ...hooks, ...overrides.react };
  const source = await readFile(new URL("../" + file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: (key) => {
      if (!(key in stubs)) throw new Error("Unmocked import " + key);
      return stubs[key];
    },
    setTimeout: (fn) => fn(),
    document: { getElementById: () => null },
    console,
    FormData,
    AbortSignal,
    AbortController,
    URL,
    URLSearchParams,
    ...globals,
  });
  return {
    render(props = {}) {
      index = 0;
      const tree = module.exports[name](props);
      const effects = pending;
      pending = [];
      effects.forEach((run) => run());
      return tree;
    },
    unmount() {
      slots.forEach((slot) => slot?.cleanup?.());
    },
  };
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
function content(tree) {
  if (tree == null || tree === false) return "";
  if (Array.isArray(tree)) return tree.map(content).join("");
  if (typeof tree !== "object") return String(tree);
  return content(tree.props?.children);
}
function button(tree, text) {
  return nodes(tree).find(
    (n) => n.type === "button" && content(n).includes(text),
  );
}
test("blog editor preserves unsaved writing on conflicts, previews privately and submits one versioned publication", async () => {
  const saved = {
    id: 5,
    title: "A saved story",
    slug: "saved-story",
    excerpt: "A saved introduction",
    category: "buying",
    author_name: "NCR Wheelz",
    body: [
      {
        type: "paragraph",
        text: "A paragraph with useful advice about choosing a car.",
      },
    ],
    cover: null,
    cover_id: null,
    cover_alt: "",
    seo_title: "",
    seo_description: "",
    status: "draft",
    version: 2,
    published_at: null,
  };
  let fail = true;
  const writes = [],
    listeners = new Map();
  const view = await component(
    "components/admin-blog-editor.tsx",
    "AdminBlogEditor",
    {
      "lucide-react": Object.fromEntries(
        [
          "ArrowLeft",
          "ArrowUp",
          "ArrowDown",
          "Eye",
          "ImagePlus",
          "Plus",
          "Trash2",
        ].map((key) => [key, key]),
      ),
      "@/lib/blog": {
        blogCategories: { buying: "Buying advice" },
        blogDate: String,
      },
      "@/lib/blog-document": blogDocument,
      "./blog-rich-editor": { BlogRichEditor: "BlogRichEditor" },
      "./blog-editor-dialog": { ImageAltDialog: "ImageAltDialog" },
      "./blog-document-editor.module.css": { __esModule: true, default: {} },
      "./blog-content": { BlogContent: "BlogContent" },
      "./admin-blog.module.css": { __esModule: true, default: {} },
      "./providers": {
        useAuth: () => ({ user: { permissions: ["settings"] } }),
        useToast: () => () => {},
      },
      "next/navigation": { useRouter: () => ({ replace() {} }) },
      "@/lib/api": {
        api: async (path, options) => {
          if (!options) return saved;
          const body = JSON.parse(options.body);
          writes.push({ path, body });
          if (fail) throw new Error("Post changed in another session");
          return { ...saved, ...body, version: 3 };
        },
        send: (method, body) => ({ method, body: JSON.stringify(body) }),
      },
    },
    {
      window: {
        addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: (name) => listeners.delete(name),
        confirm: () => false,
      },
      document: {
        addEventListener: (name, fn) => listeners.set("document-" + name, fn),
        removeEventListener: (name) => listeners.delete("document-" + name),
      },
    },
  );
  view.render({ id: "5" });
  await settle();
  let tree = view.render({ id: "5" });
  nodes(tree)
    .find((node) => node.props?.name === "title")
    .props.onChange({ target: { value: "My unsaved improved story" } });
  tree = view.render({ id: "5" });
  button(tree, "Preview post").props.onClick();
  tree = view.render({ id: "5" });
  assert.match(content(tree), /PRIVATE PREVIEW/);
  assert.match(content(tree), /My unsaved improved story/);
  assert.equal(writes.length, 0);
  button(tree, "Back to writing").props.onClick();
  tree = view.render({ id: "5" });
  await button(tree, "Publish post").props.onClick();
  tree = view.render({ id: "5" });
  assert.ok(
    nodes(tree).some(
      (node) => node.props?.message === "Post changed in another session",
    ),
  );
  assert.equal(
    nodes(tree).find((node) => node.props?.name === "title").props.value,
    "My unsaved improved story",
  );
  assert.equal(writes[0].body.version, 2);
  assert.equal(writes[0].body.status, "published");
  assert.equal(writes[0].body.body.type, "doc");
  assert.equal("key" in writes[0].body.body.content[0], false);
  fail = false;
  const publish = button(tree, "Publish post").props.onClick();
  const duplicate = button(tree, "Publish post").props.onClick();
  await Promise.all([publish, duplicate]);
  tree = view.render({ id: "5" });
  assert.equal(writes.length, 2, "one failed attempt and one successful retry");
  assert.ok(button(tree, "Update published post"));
  assert.ok(!content(tree).includes("You have unsaved changes."));
  view.unmount();
  assert.equal(listeners.size, 0);
});
test("blog post lists discard previous-filter results and reject management for staff without content permission", async () => {
  let params = new URLSearchParams("q=old"),
    allowed = true;
  const requests = [];
  const view = await component(
    "components/admin-blog-list.tsx",
    "AdminBlogList",
    {
      "lucide-react": {
        Plus: "Plus",
        BookOpen: "BookOpen",
        ArrowUpRight: "ArrowUpRight",
      },
      "@/lib/blog": {
        blogCategories: { buying: "Buying advice" },
        blogDate: String,
      },
      "./admin-blog.module.css": { __esModule: true, default: {} },
      "./providers": {
        useAuth: () => ({ user: { permissions: allowed ? ["settings"] : [] } }),
        useToast: () => () => {},
      },
      "next/navigation": { useSearchParams: () => params },
      "@/lib/api": {
        api: () => {
          const request = deferred();
          requests.push(request);
          return request.promise;
        },
      },
    },
  );
  view.render();
  params = new URLSearchParams("q=new");
  view.render();
  const result = (title) => ({
    items: [
      {
        id: 1,
        title,
        excerpt: "Article introduction",
        category: "buying",
        status: "draft",
        updated_at: "2026-10-26",
        cover: null,
      },
    ],
    total: 1,
    page: 1,
    pages: 1,
  });
  requests[1].resolve(result("New result"));
  await settle();
  requests[0].reject(new Error("Old request failed"));
  await settle();
  let tree = view.render();
  assert.match(content(tree), /New result/);
  assert.ok(
    !nodes(tree).some((node) => node.props?.message === "Old request failed"),
  );
  allowed = false;
  tree = view.render();
  assert.match(tree.props.message, /permission/);
  assert.equal(requests.length, 2);
  view.unmount();
});
test("draft confirmation offers completion or staff contact, and staff record contact only after a successful request", async () => {
  let record = {
    id: 17,
    status: "draft",
    type: "passenger",
    data: {
      make: "Test",
      model: "Car",
      year: 2024,
      price: 500000,
      mileage: 20000,
      features: [],
    },
    seller_contact: {
      name: "Owner",
      phone: "9999999999",
      email: "owner@example.test",
    },
    required_documents: ["rc"],
    documents: [],
    images: [],
    history: [],
  };
  let fail = true;
  const writes = [];
  const overrides = {
    "./providers": {
      useAuth: () => ({ user: { permissions: ["reviews"] } }),
      useToast: () => () => {},
    },
    "@/lib/api": {
      api: async (path, options) => {
        if (options) {
          writes.push(path);
          if (fail) throw new Error("Contact record failed");
          record = { ...record, draft_contacted_at: "2026-10-26 10:00:00" };
          return { message: "Seller contact recorded" };
        }
        return record;
      },
      send: (method, body) => ({ method, body: JSON.stringify(body) }),
    },
  };
  const seller = await component(
    "components/submission-detail.tsx",
    "SubmissionDetail",
    overrides,
  );
  seller.render({ id: "17" });
  await settle();
  const sellerTree = seller.render({ id: "17" });
  assert.match(content(sellerTree), /Your draft is submitted to our team/);
  assert.ok(
    nodes(sellerTree).some((node) => node.props?.href === "#vehicle-photos"),
  );
  assert.ok(
    nodes(sellerTree).some(
      (node) =>
        node.props?.href === "/account/submissions" &&
        /wait for the team/.test(content(node)),
    ),
  );
  assert.ok(
    nodes(sellerTree).some((node) => node.props?.id === "vehicle-photos"),
  );
  assert.equal(button(sellerTree, "Mark contacted"), undefined);
  const staff = await component(
    "components/submission-detail.tsx",
    "SubmissionDetail",
    overrides,
  );
  staff.render({ id: "17", admin: true });
  await settle();
  let tree = staff.render({ id: "17", admin: true });
  await button(tree, "Mark contacted").props.onClick();
  tree = staff.render({ id: "17", admin: true });
  assert.ok(
    nodes(tree).some((node) => node.props?.message === "Contact record failed"),
  );
  assert.ok(button(tree, "Mark contacted"));
  fail = false;
  await button(tree, "Mark contacted").props.onClick();
  tree = staff.render({ id: "17", admin: true });
  assert.equal(button(tree, "Mark contacted"), undefined);
  assert.match(content(tree), /Contact recorded on/);
  assert.equal(record.status, "draft");
  assert.deepEqual(writes, Array(2).fill("/admin/submissions/17/contacted"));
});
test("admin draft notice refreshes in the background and ignores requests after permissions are removed", async () => {
  let allowed = true,
    tick;
  const requests = [],
    listeners = new Map();
  const view = await component(
    "components/admin-draft-notice.tsx",
    "AdminDraftNotice",
    {
      "lucide-react": { BellRing: "BellRing", ArrowRight: "ArrowRight" },
      "./admin-draft-notice.module.css": {
        __esModule: true,
        default: { banner: "banner", copy: "copy" },
      },
      "./providers": {
        useAuth: () => ({
          user: { id: 1, permissions: allowed ? ["reviews"] : [] },
        }),
      },
      "@/lib/api": {
        api: (path) => {
          assert.equal(path, "/admin/seller-drafts");
          const request = deferred();
          requests.push(request);
          return request.promise;
        },
      },
    },
    {
      window: {
        setInterval: (fn, delay) => {
          assert.equal(delay, 30000);
          tick = fn;
          return 1;
        },
        clearInterval: () => {
          tick = null;
        },
        addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: (name) => listeners.delete(name),
      },
      document: {
        visibilityState: "visible",
        addEventListener() {},
        removeEventListener() {},
      },
    },
  );
  view.render({ refreshKey: "/admin" });
  requests[0].resolve({ total: 1 });
  await settle();
  let tree = view.render({ refreshKey: "/admin" });
  assert.match(content(tree), /1 seller draft needs/);
  tick();
  requests[1].resolve({ total: 2 });
  await settle();
  tree = view.render({ refreshKey: "/admin" });
  assert.match(content(tree), /2 seller drafts need/);
  assert.ok(
    nodes(tree).some(
      (node) =>
        node.props?.href ===
        "/admin/submissions?status=draft&follow_up=pending",
    ),
  );
  listeners.get("seller-drafts-updated")();
  requests[2].resolve({ total: 0 });
  await settle();
  assert.equal(view.render({ refreshKey: "/admin" }), null);
  tick();
  allowed = false;
  assert.equal(view.render({ refreshKey: "/admin" }), null);
  requests[3].resolve({ total: 9 });
  await settle();
  assert.equal(view.render({ refreshKey: "/admin" }), null);
  assert.equal(tick, null);
  assert.equal(listeners.size, 0);
  view.unmount();
});
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("homepage buying and selling tabs switch guides and support keyboard selection", async () => {
  const icons = [
    "ArrowUpRight",
    "ClipboardCheck",
    "CarFront",
    "Calculator",
    "MessagesSquare",
    "BadgeIndianRupee",
    "LockKeyhole",
    "Images",
    "ListChecks",
  ];
  const view = await component(
    "components/home-experience.tsx",
    "HomeExperience",
    {
      react: { useId: () => "home-experience-test" },
      "lucide-react": Object.fromEntries(icons.map((name) => [name, name])),
      "./process-art": { ProcessArt: "ProcessArt" },
      "./home-experience.module.css": { default: {}, __esModule: true },
    },
  );
  let tree = view.render();
  const tab = (label) =>
    nodes(tree).find((n) => n.props?.role === "tab" && content(n) === label);
  assert.equal(tab("Buy a car").props["aria-selected"], true);
  assert.equal(tab("Sell a vehicle").props.tabIndex, -1);
  assert.ok(content(tree).includes("Find your shortlist"));
  tab("Sell a vehicle").props.onClick();
  tree = view.render();
  assert.equal(tab("Sell a vehicle").props["aria-selected"], true);
  assert.ok(content(tree).includes("Start a private draft"));
  assert.ok(!content(tree).includes("Find your shortlist"));
  assert.ok(nodes(tree).some((n) => n.props?.href === "/selling-guide"));
  assert.equal(nodes(tree).filter((n) => n.type === "img").length, 4);
  assert.equal(nodes(tree).filter((n) => n.type === "li").length, 3);
  let focused,
    prevented = 0;
  let list = nodes(tree).find((n) => n.props?.role === "tablist");
  list.props.ref.current = {
    querySelector(selector) {
      return {
        focus() {
          focused = selector;
        },
      };
    },
  };
  for (const [key, selected] of [
    ["Home", "buy"],
    ["ArrowRight", "sell"],
    ["ArrowLeft", "buy"],
    ["End", "sell"],
  ]) {
    list = nodes(tree).find((n) => n.props?.role === "tablist");
    list.props.onKeyDown({
      key,
      preventDefault() {
        prevented++;
      },
    });
    tree = view.render();
    const active = nodes(tree).find(
      (n) => n.props?.role === "tab" && n.props["aria-selected"],
    );
    const panel = nodes(tree).find((n) => n.props?.role === "tabpanel");
    assert.equal(active.props["data-mode"], selected);
    assert.equal(active.props.tabIndex, 0);
    assert.equal(panel.props["aria-labelledby"], active.props.id);
    assert.equal(active.props["aria-controls"], panel.props.id);
    assert.equal(focused, `[data-mode="${selected}"]`);
  }
  assert.equal(prevented, 4);
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}

const filterIcons = {
  "lucide-react": {
    SlidersHorizontal: "SlidersHorizontal",
    ChevronDown: "ChevronDown",
    Search: "Search",
    X: "X",
  },
};
const studioStubs = {
  "lucide-react": Object.fromEntries(
    [
      "ArrowUpRight",
      "BadgePercent",
      "CalendarDays",
      "Check",
      "Copy",
      "Eye",
      "Gift",
      "LoaderCircle",
      "Monitor",
      "Palette",
      "Pencil",
      "Plus",
      "Save",
      "Search",
      "Send",
      "Smartphone",
      "Sparkles",
      "Star",
      "Trash2",
      "CarFront",
      "X",
    ].map((name) => [name, name]),
  ),
  "./offer-card": { OfferCard: "OfferCard" },
  "@/lib/offers": { emptyOffer, offerState, offerDate },
  "./providers": {
    useAuth: () => ({ user: { role: "admin", permissions: ["settings"] } }),
  },
};
const studioGlobals = {
  requestAnimationFrame: (fn) => fn(),
  window: {
    confirm: () => true,
    addEventListener() {},
    removeEventListener() {},
  },
};
test("auth provider preserves known identity on outages, rejects true sign-out and ignores obsolete checks", async () => {
  let auth = deferred();
  const user = { id: 1, role: "customer", permissions: [] };
  const view = await component("components/providers.tsx", "Providers", {
    react: { createContext: () => ({ Provider: "Provider" }) },
    "./comparison-provider": { ComparisonProvider: "ComparisonProvider" },
    "@/lib/api": {
      api: (path) =>
        path === "/auth/me" ? auth.promise : Promise.resolve({ items: [] }),
    },
  });
  view.render();
  auth.resolve({ user });
  await settle();
  let context = view.render().props.value;
  assert.equal(context.user, user);
  auth = deferred();
  const outage = context.reload();
  auth.reject(
    Object.assign(new Error("Connection interrupted"), { status: 503 }),
  );
  await assert.rejects(outage, { status: 503 });
  context = view.render().props.value;
  assert.equal(context.user, user);
  assert.equal(context.connectionError, "Connection interrupted");
  const old = deferred();
  auth = old;
  const stale = context.reload();
  auth = deferred();
  const current = context.reload();
  const newer = { ...user, id: 2 };
  auth.resolve({ user: newer });
  await current;
  old.reject(Object.assign(new Error("Old outage"), { status: 503 }));
  await assert.rejects(stale);
  context = view.render().props.value;
  assert.equal(context.user, newer);
  assert.equal(context.connectionError, "");
  auth = deferred();
  const denied = context.reload();
  auth.reject(Object.assign(new Error("Sign in required"), { status: 401 }));
  assert.equal(await denied, null);
  context = view.render().props.value;
  assert.equal(context.user, null);
  assert.equal(context.connectionError, "");
  view.unmount();
});
test("session restore retries connection failures without redirecting a valid user to sign-in", async () => {
  let calls = 0;
  const redirects = [];
  const reload = async () => {
    if (++calls === 1)
      throw Object.assign(new Error("Connection interrupted"), { status: 503 });
    return { id: 1, role: "customer" };
  };
  const view = await component(
    "components/session-restore.tsx",
    "SessionRestore",
    {
      "next/navigation": {
        useSearchParams: () => new URLSearchParams("next=%2Fsaved"),
      },
      "./providers": { useAuth: () => ({ reload }) },
      "./auth-form": { safeNext: (value) => value },
    },
    { window: { location: { replace: (path) => redirects.push(path) } } },
  );
  view.render();
  await settle();
  let tree = view.render();
  assert.match(content(tree), /Connection interrupted/);
  assert.deepEqual(redirects, []);
  button(tree, "Try again").props.onClick();
  view.render();
  await settle();
  assert.deepEqual(redirects, ["/saved"]);
  view.unmount();
});
test("auth gate blocks cached private content during an outage and offers a retry", async () => {
  let retries = 0;
  const view = await component("components/providers.tsx", "AuthGate", {
    react: {
      createContext: () => ({}),
      useContext: () => ({
        user: { id: 1 },
        loading: false,
        connectionError: "Offline",
        reload: async () => {
          retries++;
        },
      }),
    },
    "./comparison-provider": {},
  });
  const tree = view.render({ children: "PRIVATE DATA" });
  assert.doesNotMatch(content(tree), /PRIVATE DATA|Sign in/);
  assert.match(content(tree), /Connection interrupted/);
  button(tree, "Try again").props.onClick();
  await settle();
  assert.equal(retries, 1);
});
test("car valuation preserves details on failure, prevents duplicate checks and clears old results when details change", async () => {
  let request = deferred();
  const requests = [];
  const view = await component(
    "components/car-valuation.tsx",
    "CarValuation",
    {
      "lucide-react": {},
      "@/lib/valuation": { valuationMessage },
      "./valuation-car-picker": {
        ValuationCarPicker: "ValuationCarPicker",
        emptyValuationCar: {
          make: "",
          model: "",
          variant: "",
          fuel: "Petrol",
          transmission: "Manual",
        },
      },
      "@/lib/api": {
        api: (path, options) => {
          requests.push({ path, ...options });
          return request.promise;
        },
        send: (method, body) => ({ method, body }),
      },
    },
    { AbortController },
  );
  const props = {
    options: [
      { make: "Test", model: "Car", variant: "VXi", location: "New Delhi" },
    ],
    currentYear: 2026,
  };
  let tree = view.render(props);
  function fill(name, value) {
    nodes(tree)
      .find((node) => node.props.name === name)
      .props.onChange({ target: { value } });
    tree = view.render(props);
  }
  nodes(tree)
    .find((node) => node.type === "ValuationCarPicker")
    .props.onChange({
      make: "Test",
      model: "Car",
      variant: "VXi",
      fuel: "Petrol",
      transmission: "Manual",
    });
  tree = view.render(props);
  fill("year", "2020");
  fill("mileage", "40000");
  fill("location", "__other__");
  fill("custom_location", "New Delhi");
  const submit = nodes(tree).find((node) => node.type === "form").props
    .onSubmit;
  const work = submit({ preventDefault() {} });
  await submit({ preventDefault() {} });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.mileage, 40000);
  assert.equal(requests[0].body.purpose, "sell");
  assert.equal(requests[0].body.owners_at_least, false);
  request.reject(new Error("Temporarily unavailable"));
  await work;
  tree = view.render(props);
  assert.ok(
    nodes(tree).some(
      (node) => node.props.message === "Temporarily unavailable",
    ),
  );
  assert.equal(
    nodes(tree).find((node) => node.props.name === "mileage").props.value,
    "40000",
  );
  request = deferred();
  const retry = nodes(tree)
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} });
  const report = {
    status: "available",
    basis: "ncr_wheelz_asking_prices",
    as_of: "2026-10-25T09:00:00Z",
    count: 3,
    minimum_comparables: 1,
    range: { low: 400000, high: 500000, median: 450000 },
    matching: {
      year_from: 2019,
      year_to: 2021,
      kilometres_from: 30000,
      kilometres_to: 50000,
      updated_within_days: 90,
    },
    comparables: [],
  };
  request.resolve(report);
  await retry;
  tree = view.render(props);
  assert.match(content(tree), /Indicative price range/);
  assert.equal(
    nodes(tree).some(
      (node) =>
        node.type === "details" && node.props.className === "valuation-method",
    ),
    false,
  );
  const contact = nodes(tree).find((node) =>
    node.props.href?.startsWith("/contact?"),
  );
  assert.match(
    new URL("http://example.test" + contact.props.href).searchParams.get(
      "valuation",
    ),
    /2020 Test Car VXi/,
  );
  fill("mileage", "60000");
  assert.doesNotMatch(content(tree), /Indicative price range/);
  request = deferred();
  nodes(tree)
    .find((node) => node.props.name === "owners" && node.props.value === "4")
    .props.onChange();
  tree = view.render(props);
  const grouped = nodes(tree)
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} });
  request.resolve({
    ...report,
    status: "insufficient_data",
    count: 1,
    range: { low: 360000, high: 440000, median: 400000 },
    range_method: "estimated_band",
    approximation_percent: 10,
    matching: { ...report.matching, broad_matches: true },
  });
  await grouped;
  tree = view.render(props);
  assert.match(content(tree), /Approximate price range/);
  assert.match(content(tree), /1 similar listing/);
  assert.match(content(tree), /10% allowance/);
  assert.match(
    content(tree),
    /range endpoints are estimated, not advertised prices/,
  );
  assert.match(content(tree), /Variants and owner counts may differ/);
  assert.doesNotMatch(content(tree), /1 similar listings/);
  assert.equal(requests.at(-1).body.location, "New Delhi");
  assert.equal(requests.at(-1).body.owners, 4);
  assert.equal(requests.at(-1).body.owners_at_least, true);
  request = deferred();
  const empty = nodes(tree)
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} });
  request.resolve({
    ...report,
    status: "insufficient_data",
    count: 0,
    range: null,
  });
  await empty;
  tree = view.render(props);
  assert.match(content(tree), /We found 0 matching listings/);
  assert.match(content(tree), /needs at least 1/);
  assert.doesNotMatch(content(tree), /Approximate price range/);
  view.unmount();
});
test("valuation car selector clears dependent choices, trims values and keeps its submit out of the outer form", async () => {
  const choices = [];
  const view = await component(
    "components/valuation-car-picker.tsx",
    "ValuationCarPicker",
    {
      "lucide-react": {},
      "react-dom": { createPortal: (node) => node },
    },
    { document: { body: { style: { overflow: "auto" } } } },
  );
  const props = {
    value: {
      make: "Maruti Suzuki",
      model: "Swift",
      variant: "VXi",
      fuel: "Petrol",
      transmission: "Manual",
    },
    options: [],
    onChange: (car) => choices.push(car),
  };
  let tree = view.render(props);
  nodes(tree)
    .find((node) => node.props["aria-haspopup"] === "dialog")
    .props.onClick();
  tree = view.render(props);
  function fill(name, value) {
    nodes(tree)
      .find((node) => node.props.name === name)
      .props.onChange({ target: { value } });
    tree = view.render(props);
  }
  const brand = nodes(tree).find((node) => node.props.name === "make");
  const pattern = new RegExp("^(?:" + brand.props.pattern + ")$", "v");
  assert.equal(pattern.test("Maruti Suzuki"), true);
  assert.equal(pattern.test("   "), false);
  fill("make", " Honda ");
  assert.equal(
    nodes(tree).find((node) => node.props.name === "model").props.value,
    "",
  );
  assert.equal(
    nodes(tree).find((node) => node.props.name === "variant").props.value,
    "",
  );
  fill("model", " City ");
  fill("variant", " V ");
  fill("fuel", "Petrol");
  fill("transmission", "Manual");
  let prevented = false,
    stopped = false;
  nodes(tree)
    .find((node) => node.type === "form")
    .props.onSubmit({
      preventDefault() {
        prevented = true;
      },
      stopPropagation() {
        stopped = true;
      },
    });
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(choices.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(choices[0])), {
    make: "Honda",
    model: "City",
    variant: "V",
    fuel: "Petrol",
    transmission: "Manual",
  });
  assert.equal(
    nodes(view.render(props)).some((node) => node.type === "dialog"),
    false,
  );
  view.unmount();
});
test("valuation dropdowns chain brand, model, Variant and fuel without retaining stale combinations", async () => {
  const choices = [];
  const view = await component(
    "components/valuation-car-picker.tsx",
    "ValuationCarPicker",
    {
      "lucide-react": {},
      "react-dom": { createPortal: (node) => node },
    },
    { document: { body: { style: { overflow: "auto" } } } },
  );
  const props = {
    value: { make: "", model: "", variant: "", fuel: "", transmission: "" },
    options: [
      {
        make: "Maruti Suzuki",
        model: "Swift",
        variant: "VXi",
        fuel: "Petrol",
        transmission: "Manual",
      },
      {
        make: "maruti suzuki",
        model: "Swift",
        variant: "VXi",
        fuel: "CNG",
        transmission: "Manual",
      },
      {
        make: "Maruti Suzuki",
        model: "Swift",
        variant: "ZXi",
        fuel: "Petrol",
        transmission: "Automatic",
      },
      {
        make: "Honda",
        model: "City",
        variant: "V",
        fuel: "Diesel",
        transmission: "Automatic",
      },
    ],
    onChange: (car) => choices.push(car),
  };
  let tree = view.render(props);
  nodes(tree)
    .find((node) => node.props["aria-haspopup"] === "dialog")
    .props.onClick();
  tree = view.render(props);
  const control = (name) =>
    nodes(tree).find((node) => node.props.name === name);
  const options = (name) =>
    nodes(control(name))
      .filter((node) => node.type === "option")
      .map((node) => content(node));
  function select(name, value) {
    control(name).props.onChange({ target: { value } });
    tree = view.render(props);
  }
  assert.equal(control("model").props.disabled, true);
  assert.equal(control("variant").props.disabled, true);
  assert.equal(
    options("make").filter((label) => /maruti/i.test(label)).length,
    1,
  );
  select("make", "Maruti Suzuki");
  assert.equal(control("make").type, "select");
  assert.ok(options("model").includes("Swift"));
  assert.ok(!options("model").includes("City"));
  select("model", "Swift");
  assert.ok(options("variant").includes("VXi"));
  assert.ok(!options("variant").includes("V"));
  select("variant", "VXi");
  assert.equal(control("fuel").props.value, "");
  assert.equal(control("transmission").props.disabled, true);
  assert.deepEqual(options("fuel"), ["Select fuel", "CNG", "Petrol"]);
  select("fuel", "Petrol");
  assert.equal(control("transmission").props.value, "Manual");
  select("variant", "ZXi");
  assert.equal(control("fuel").props.value, "Petrol");
  assert.equal(control("transmission").props.value, "Automatic");
  select("make", "Honda");
  for (const key of ["model", "variant", "fuel", "transmission"])
    assert.equal(control(key).props.value, "");
  select("model", "City");
  select("variant", "V");
  nodes(tree)
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(JSON.parse(JSON.stringify(choices[0])), {
    make: "Honda",
    model: "City",
    variant: "V",
    fuel: "Diesel",
    transmission: "Automatic",
  });
  view.unmount();
});
test("market catalog loads beyond local stock and ignores responses after disabling the provider", async () => {
  const first = deferred(),
    stale = deferred();
  let calls = 0;
  const view = await component(
    "components/car-valuation.tsx",
    "CarValuation",
    {
      "lucide-react": {},
      "@/lib/valuation": { valuationMessage },
      "./valuation-car-picker": {
        ValuationCarPicker: "Picker",
        emptyValuationCar: {
          make: "",
          model: "",
          variant: "",
          fuel: "",
          transmission: "",
        },
      },
      "@/lib/api": {
        api: (path) => {
          assert.equal(path, "/valuation/catalog");
          return ++calls === 1 ? first.promise : stale.promise;
        },
      },
    },
    { AbortController },
  );
  const props = { options: [], currentYear: 2026, marketEnabled: true };
  let tree = view.render(props);
  tree = view.render(props);
  assert.match(content(tree), /Loading car brands/);
  first.resolve({ makes: [{ name: "Honda", models: ["City", "Jazz"] }] });
  await settle();
  tree = view.render(props);
  const picker = nodes(tree).find((node) => node.type === "Picker");
  assert.deepEqual(
    JSON.parse(JSON.stringify(picker.props.options.map((row) => row.model))),
    ["City", "Jazz"],
  );
  assert.equal(picker.props.marketEnabled, true);
  assert.doesNotMatch(content(tree), /Loading car brands/);
  view.render({ ...props, marketEnabled: false });
  view.render(props);
  view.render({ ...props, marketEnabled: false });
  stale.resolve({ makes: [{ name: "Wrong", models: ["Stale"] }] });
  await settle();
  tree = view.render({ ...props, marketEnabled: false });
  assert.equal(
    nodes(tree).find((node) => node.type === "Picker").props.options.length,
    0,
  );
  view.unmount();
});
test("market car selection retains brand/model dropdowns when reopening a manually entered Variant", async () => {
  const view = await component(
    "components/valuation-car-picker.tsx",
    "ValuationCarPicker",
    {
      "lucide-react": {},
      "react-dom": { createPortal: (node) => node },
    },
    { document: { body: { style: { overflow: "auto" } } } },
  );
  const props = {
    marketEnabled: true,
    value: {
      make: "Honda",
      model: "City",
      variant: "V",
      fuel: "Diesel",
      transmission: "Automatic",
    },
    options: [
      { make: "Honda", model: "City", variant: null, location: "" },
      {
        make: "Honda",
        model: "City",
        variant: "V",
        fuel: "Petrol",
        transmission: "Manual",
        location: "Delhi",
      },
      { make: "Honda", model: "Jazz", variant: null, location: "" },
    ],
    onChange() {},
  };
  let tree = view.render(props);
  nodes(tree)
    .find((node) => node.props["aria-haspopup"] === "dialog")
    .props.onClick();
  tree = view.render(props);
  const control = (name) =>
    nodes(tree).find((node) => node.props.name === name);
  assert.equal(control("make").type, "select");
  assert.equal(control("model").type, "select");
  assert.ok(
    nodes(control("fuel")).some(
      (node) => node.type === "option" && content(node) === "Diesel",
    ),
    "a local petrol listing must not restrict the broader market car",
  );
  control("variant").props.onChange({ target: { value: "__other__" } });
  tree = view.render(props);
  control("variant").props.onChange({ target: { value: "VX" } });
  tree = view.render(props);
  nodes(tree)
    .find((node) => node.props["aria-label"] === "Close car selector")
    .props.onClick();
  tree = view.render({ ...props, value: { ...props.value, variant: "VX" } });
  nodes(tree)
    .find((node) => node.props["aria-haspopup"] === "dialog")
    .props.onClick();
  tree = view.render({ ...props, value: { ...props.value, variant: "VX" } });
  assert.equal(control("make").type, "select");
  assert.equal(control("model").type, "select");
  assert.equal(control("variant").type, "select");
  assert.equal(control("variant").props.value, "VX");
  view.unmount();
});
test("market Variants load by model/year, discard stale choices and retain a manual fallback on failure", async () => {
  const requests = [],
    first = deferred(),
    second = deferred(),
    failed = deferred();
  const view = await component(
    "components/valuation-car-picker.tsx",
    "ValuationCarPicker",
    {
      "lucide-react": {},
      "react-dom": { createPortal: (node) => node },
      "@/lib/api": {
        api: (path, options) => {
          requests.push({ path, options });
          return [first, second, failed][requests.length - 1].promise;
        },
      },
    },
    { document: { body: { style: { overflow: "auto" } } } },
  );
  const props = {
    marketEnabled: true,
    year: 2020,
    value: { make: "", model: "", variant: "", fuel: "", transmission: "" },
    options: [
      { make: "Honda", model: "City", variant: null, location: "" },
      { make: "Honda", model: "Jazz", variant: null, location: "" },
    ],
    onChange() {},
  };
  let tree = view.render(props);
  nodes(tree)
    .find((node) => node.props["aria-haspopup"] === "dialog")
    .props.onClick();
  tree = view.render(props);
  const control = (name) =>
    nodes(tree).find((node) => node.props.name === name);
  const select = (name, value) => {
    control(name).props.onChange({ target: { value } });
    tree = view.render(props);
  };
  select("make", "Honda");
  select("model", "City");
  tree = view.render(props);
  assert.equal(requests.length, 1);
  assert.equal(
    new URL("http://example.test" + requests[0].path).searchParams.get("year"),
    "2020",
  );
  assert.match(content(control("variant")), /Loading Variants/);
  assert.equal(control("variant").type, "select");
  select("model", "Jazz");
  assert.equal(requests[0].options.signal.aborted, true);
  first.resolve({
    items: [{ variant: "Old City V", fuel: "Petrol", transmission: "Manual" }],
  });
  second.resolve({
    items: [{ variant: "VX", fuel: "Diesel", transmission: "Automatic" }],
  });
  await settle();
  tree = view.render(props);
  assert.doesNotMatch(content(control("variant")), /Old City/);
  assert.match(content(control("variant")), /VX/);
  select("variant", "VX");
  assert.equal(control("fuel").props.value, "Diesel");
  assert.equal(control("transmission").props.value, "Automatic");
  assert.equal(
    requests.length,
    2,
    "choosing a Variant does not trigger another provider request",
  );
  const next = { ...props, year: 2021 };
  tree = view.render(next);
  assert.equal(requests.length, 3);
  failed.reject(new Error("Unavailable"));
  await settle();
  tree = view.render(next);
  assert.match(content(tree), /Variant choices are temporarily unavailable/);
  control("variant").props.onChange({ target: { value: "__other__" } });
  tree = view.render(next);
  assert.equal(control("variant").type, "input");
  assert.equal(control("variant").props.value, "");
  view.unmount();
});
test("field labels and hints target nested password controls without naming their wrapper or toggle", async () => {
  const view = await component("components/ui.tsx", "Field", {
    react: {
      useId: () => "field-test",
      Children: React.Children,
      isValidElement: React.isValidElement,
      cloneElement: React.cloneElement,
    },
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": {},
    "./comparison-provider": {},
  });
  const tree = view.render({
    label: "Password",
    hint: "At least 6 characters.",
    children: React.createElement(
      "span",
      { className: "password-input" },
      React.createElement("input", {
        type: "password",
        "aria-label": "Password",
        "aria-describedby": "existing-hint",
      }),
      React.createElement("button", { "aria-label": "Show password" }),
    ),
  });
  const wrapper = nodes(tree).find(
    (node) => node.props.className === "password-input",
  );
  const input = nodes(tree).find((node) => node.type === "input");
  const toggle = nodes(tree).find((node) => node.type === "button");
  assert.equal(wrapper.props["aria-labelledby"], undefined);
  assert.equal(input.props["aria-label"], "Password");
  assert.equal(
    input.props["aria-describedby"],
    "existing-hint field-test-hint",
  );
  assert.equal(toggle.props["aria-label"], "Show password");
  assert.equal(toggle.props["aria-describedby"], undefined);
  const select = nodes(
    view.render({
      label: "Fuel type",
      children: React.createElement("select", { name: "fuel" }),
    }),
  ).find((node) => node.type === "select");
  assert.equal(select.props["aria-labelledby"], "field-test-label");
});
test("admins edit private seller details while reviewers remain read-only and linked cars open inventory", async () => {
  let record = {
    id: 13,
    type: "passenger",
    status: "submitted",
    expected_version: "a".repeat(64),
    data: {
      make: "Test",
      model: "Car",
      year: 2024,
      price: 500000,
      mileage: 42000,
      fuel: "Petrol",
      features: [],
    },
    seller_contact: { name: "Owner" },
    required_documents: [],
    documents: [],
    images: [],
    history: [],
  };
  const requests = [];
  const view = await component(
    "components/submission-detail.tsx",
    "SubmissionDetail",
    {
      "./providers": {
        useAuth: () => ({ user: { permissions: ["inventory", "reviews"] } }),
        useToast: () => () => {},
      },
      "@/lib/api": {
        api: async (path, options) => {
          if (options) {
            const body = JSON.parse(options.body);
            requests.push({ path, body });
            record = {
              ...record,
              data: body.vehicle,
              status: "under_review",
              expected_version: "b".repeat(64),
            };
          }
          return record;
        },
        send: (method, body) => ({ method, body: JSON.stringify(body) }),
      },
    },
  );
  view.render({ id: "13", admin: true });
  await settle();
  let tree = view.render({ id: "13", admin: true });
  button(tree, "Edit details").props.onClick();
  tree = view.render({ id: "13", admin: true });
  const editor = nodes(tree).find((node) => node.type === "VehicleEditor");
  assert.equal(editor.props.seller, false);
  assert.equal(editor.props.typeLocked, false);
  await editor.props.onSave({ ...record.data, price: 450000 });
  tree = view.render({ id: "13", admin: true });
  assert.equal(requests[0].path, "/admin/submissions/13");
  assert.equal(requests[0].body.vehicle.price, 450000);
  assert.equal(requests[0].body.expected_version, "a".repeat(64));
  assert.equal(requests[0].body.contact, undefined);
  assert.match(content(tree), /450000/);
  for (const permissions of [["reviews"], ["inventory", "reviews"]]) {
    const linked = permissions.length > 1;
    const alternate = await component(
      "components/submission-detail.tsx",
      "SubmissionDetail",
      {
        "./providers": {
          useAuth: () => ({ user: { permissions } }),
          useToast: () => () => {},
        },
        "@/lib/api": {
          api: async () => ({ ...record, listing: linked ? { id: 42 } : null }),
        },
      },
    );
    alternate.render({ id: "13", admin: true });
    await settle();
    const tree = alternate.render({ id: "13", admin: true });
    assert.equal(button(tree, "Edit details"), undefined);
    assert.equal(
      nodes(tree).some(
        (node) =>
          node.type === "Link" && node.props.href === "/admin/inventory/42",
      ),
      linked,
    );
  }
});
test("inventory editor unpublishes a live car before enabling price and specification changes", async () => {
  let current = {
    id: 42,
    make: "Test",
    model: "Car",
    status: "published",
    approved: true,
    images: [],
    expected_version: "a".repeat(64),
    data: { make: "Test", model: "Car", price: 500000 },
  };
  const requests = [];
  let fail = true;
  const view = await component(
    "components/admin-inventory.tsx",
    "AdminInventoryEditor",
    {
      "next/navigation": {
        useRouter: () => ({ push() {} }),
        useSearchParams: () => new URLSearchParams(),
      },
      "@/lib/api": {
        api: async (path, options) => {
          if (options) {
            const body = JSON.parse(options.body);
            requests.push({ path, method: options.method, body });
            if (fail) throw new Error("Could not unpublish");
            if (options.method === "POST")
              current = {
                ...current,
                status: "draft",
                expected_version: "b".repeat(64),
              };
            else
              current = {
                ...current,
                data: body,
                approved: false,
                expected_version: "c".repeat(64),
              };
          }
          return current;
        },
        send: (method, body) => ({ method, body: JSON.stringify(body) }),
      },
    },
  );
  view.render({ id: "42" });
  await settle();
  let tree = view.render({ id: "42" });
  assert.equal(
    nodes(tree).some((node) => node.type === "VehicleEditor"),
    false,
  );
  await button(tree, "Unpublish & edit vehicle").props.onClick();
  tree = view.render({ id: "42" });
  assert.ok(
    nodes(tree).some((node) => node.props?.message === "Could not unpublish"),
  );
  assert.equal(
    nodes(tree).some((node) => node.type === "VehicleEditor"),
    false,
  );
  fail = false;
  await button(tree, "Unpublish & edit vehicle").props.onClick();
  tree = view.render({ id: "42" });
  const editor = nodes(tree).find((node) => node.type === "VehicleEditor");
  await editor.props.onSave({ ...current.data, price: 450000 });
  assert.equal(requests.at(-1).method, "PATCH");
  assert.equal(requests.at(-1).body.price, 450000);
  assert.equal(requests.at(-1).body.expected_version, "b".repeat(64));
  assert.equal(current.approved, false);
});
test("session restoration and sign-in redirects verify fresh identity instead of cached users", async () => {
  for (const [file, name, props] of [
    ["components/session-restore.tsx", "SessionRestore", {}],
    ["components/auth-form.tsx", "AuthForm", { mode: "login", admin: true }],
  ]) {
    for (const current of [null, { id: 2, role: "admin" }]) {
      const refreshed = deferred(),
        redirects = [];
      let checks = 0;
      const router = {
        replace: (path) => {
          assert.notEqual(
            name,
            "SessionRestore",
            "refresh must bypass cached route redirects",
          );
          redirects.push(path);
        },
      };
      const reload = () => {
        checks++;
        return refreshed.promise;
      };
      const view = await component(
        file,
        name,
        {
          "next/navigation": {
            useRouter: () => router,
            useSearchParams: () =>
              new URLSearchParams("next=%2Fadmin%2Finventory"),
          },
          "./providers": {
            useAuth: () => ({
              user: { id: 1, role: "admin" },
              loading: false,
              reload,
            }),
          },
          "./auth-form": { safeNext: (value) => value || "/account" },
          "lucide-react": { Eye: "Eye", EyeOff: "EyeOff" },
        },
        { window: { location: { replace: (path) => redirects.push(path) } } },
      );
      view.render(props);
      assert.equal(checks, 1);
      assert.equal(
        redirects.length,
        0,
        "cached identity cannot start another protected navigation",
      );
      refreshed.resolve(current);
      await settle();
      assert.deepEqual(
        redirects,
        current
          ? ["/admin/inventory"]
          : name === "SessionRestore"
            ? ["/admin/login?next=%2Fadmin%2Finventory"]
            : [],
      );
      view.render(props);
      await settle();
      assert.equal(checks, 1, "rerenders do not restart session restoration");
      view.unmount();
    }
    const refreshed = deferred(),
      redirects = [];
    const router = { replace: (path) => redirects.push(path) };
    const reload = () => refreshed.promise;
    const view = await component(
      file,
      name,
      {
        "next/navigation": {
          useRouter: () => router,
          useSearchParams: () => new URLSearchParams("next=%2Fadmin"),
        },
        "./providers": {
          useAuth: () => ({ user: null, loading: false, reload }),
        },
        "./auth-form": { safeNext: (value) => value || "/account" },
        "lucide-react": { Eye: "Eye", EyeOff: "EyeOff" },
      },
      { window: { location: { replace: (path) => redirects.push(path) } } },
    );
    view.render(props);
    view.unmount();
    refreshed.resolve({ id: 2, role: "admin" });
    await settle();
    assert.equal(
      redirects.length,
      0,
      "a completed old session check cannot redirect after unmount",
    );
  }
});
test("vehicle editor saves distance and fuel economy separately and clears economy when units change", async () => {
  const saves = [];
  const view = await component(
    "components/vehicle-editor.tsx",
    "VehicleEditor",
    {},
    {
      FormData: class {
        constructor(fields) {
          this.fields = fields;
        }
        [Symbol.iterator]() {
          return Object.entries(this.fields)[Symbol.iterator]();
        }
      },
    },
  );
  const props = {
    initial: { fuel: "Petrol", mileage: 42000, fuel_economy: 18.75 },
    onSave: async (value) => saves.push(value),
  };
  const input = (tree) =>
    nodes(tree).find((n) => n.props?.name === "fuel_economy");
  const fuel = (tree) => nodes(tree).find((n) => n.props?.name === "fuel");
  const submit = (tree, fuelType) =>
    nodes(tree)
      .find((n) => n.type === "form")
      .props.onSubmit({
        preventDefault() {},
        currentTarget: { mileage: "42000", fuel: fuelType },
      });
  let tree = view.render(props);
  assert.equal(
    nodes(tree).find((n) => n.props?.name === "mileage").props.defaultValue,
    42000,
  );
  assert.equal(input(tree).props.value, "18.75");
  await submit(tree, "Petrol");
  assert.equal(saves[0].mileage, "42000");
  assert.equal(saves[0].fuel_economy, 18.75);
  fuel(tree).props.onChange({ target: { value: "Diesel" } });
  tree = view.render(props);
  assert.equal(
    input(tree).props.value,
    "18.75",
    "same units preserve the draft value",
  );
  fuel(tree).props.onChange({ target: { value: "CNG" } });
  tree = view.render(props);
  assert.equal(input(tree).props.value, "");
  assert.ok(
    nodes(tree).some((n) => n.props?.label === "Mileage (km/kg, optional)"),
  );
  input(tree).props.onChange({ target: { value: "25" } });
  tree = view.render(props);
  await submit(tree, "CNG");
  assert.equal(saves[1].fuel_economy, 25);
  assert.equal(saves[1].mileage, "42000");
  fuel(tree).props.onChange({ target: { value: "Electric" } });
  tree = view.render(props);
  assert.equal(input(tree).props.value, "");
  assert.ok(
    nodes(tree).some((n) => n.props?.label === "Mileage (km/kWh, optional)"),
  );
  await submit(tree, "Electric");
  assert.equal(
    saves[2].fuel_economy,
    null,
    "blank mileage clears the optional saved value",
  );
});

test("dropdown manual entry uses the actual field name and preserves custom text when choices arrive", async () => {
  let value = "";
  const view = await component("components/choice-field.tsx", "ChoiceField");
  const props = () => ({
    name: "model",
    label: "Model name",
    value,
    options: ["Swift"],
    required: true,
    maxLength: 100,
    onChange: (next) => {
      value = next;
    },
  });
  let tree = view.render(props());
  nodes(tree)
    .find((node) => node.type === "select")
    .props.onChange({ target: { value: "__enter_manually__" } });
  tree = view.render(props());
  assert.equal(
    nodes(tree).some((node) => node.type === "select"),
    false,
  );
  const input = nodes(tree).find((node) => node.type === "input");
  assert.equal(input.props.name, "model");
  assert.equal(input.props.required, true);
  input.props.onChange({ target: { value: "Unlisted custom model" } });
  tree = view.render({ ...props(), options: ["Swift", "Another model"] });
  assert.equal(
    nodes(tree).find((node) => node.type === "input").props.value,
    "Unlisted custom model",
  );
  button(tree, "Choose from list").props.onClick();
  tree = view.render(props());
  const select = nodes(tree).find((node) => node.type === "select");
  assert.equal(select.props.value, "Unlisted custom model");
  assert.ok(
    nodes(select).some(
      (node) =>
        node.type === "option" && node.props.value === "Unlisted custom model",
    ),
  );
  assert.notEqual(value, "__enter_manually__");
});

test("seller catalog merges API choices without changing the draft and discards obsolete Variant responses", async () => {
  const local = deferred(),
    catalog = deferred(),
    first = deferred(),
    second = deferred();
  const calls = [];
  const view = await component(
    "components/vehicle-identity-fields.tsx",
    "VehicleIdentityFields",
    {
      "@/lib/api": {
        api: (path) => {
          calls.push(path);
          if (path.startsWith("/vehicle-options")) return local.promise;
          if (path === "/valuation/catalog") return catalog.promise;
          return path.includes("model=Swift") ? first.promise : second.promise;
        },
      },
    },
  );
  const props = { type: "passenger" };
  const field = (tree, name) =>
    nodes(tree).find(
      (node) => node.type === "ChoiceField" && node.props.name === name,
    );
  let tree = view.render(props);
  field(tree, "make").props.onChange("Maruti Suzuki");
  local.resolve({
    items: [
      {
        make: "Local brand",
        model: "Local model",
        year: 2020,
        variant: "Base",
      },
    ],
    market_enabled: true,
  });
  await settle();
  catalog.resolve({
    makes: [
      { name: "Maruti Suzuki", models: ["Swift", "Baleno"] },
      { name: "Honda", models: ["City"] },
    ],
  });
  await settle();
  tree = view.render(props);
  assert.equal(field(tree, "make").props.value, "Maruti Suzuki");
  assert.ok(field(tree, "make").props.options.includes("Local brand"));
  assert.ok(field(tree, "make").props.options.includes("Honda"));
  assert.deepEqual(Array.from(field(tree, "model").props.options), [
    "Baleno",
    "Swift",
  ]);
  field(tree, "model").props.onChange("Swift");
  tree = view.render(props);
  assert.equal(
    calls.filter((path) => path.startsWith("/valuation/variants")).length,
    0,
    "wait for year before a provider request",
  );
  field(tree, "year").props.onChange("2020");
  tree = view.render(props);
  assert.ok(calls.at(-1).includes("year=2020"));
  field(tree, "variant").props.onChange("My exact trim");
  tree = view.render(props);
  field(tree, "model").props.onChange("Baleno");
  tree = view.render(props);
  assert.equal(field(tree, "variant").props.value, "");
  first.resolve({ items: [{ variant: "Stale Swift Variant" }] });
  await settle();
  tree = view.render(props);
  assert.ok(
    !field(tree, "variant").props.options.includes("Stale Swift Variant"),
  );
  field(tree, "variant").props.onChange("Custom Baleno trim");
  second.resolve({ items: [{ variant: "Delta" }, { variant: "delta" }] });
  await settle();
  tree = view.render(props);
  assert.equal(
    field(tree, "variant").props.value,
    "Custom Baleno trim",
    "late suggestions cannot overwrite manual details",
  );
  assert.deepEqual(Array.from(field(tree, "variant").props.options), ["Delta"]);
  field(tree, "year").props.onChange("2021");
  tree = view.render(props);
  assert.equal(field(tree, "variant").props.value, "");
  field(tree, "make").props.onChange("Honda");
  tree = view.render(props);
  assert.equal(field(tree, "model").props.value, "");
  assert.equal(field(tree, "variant").props.value, "");
  view.unmount();
});

test("seller and yellow-plate cab dropdowns load the catalog even when stock suggestions fail or are empty", async () => {
  for (const type of ["passenger", "commercial"]) {
    for (const localState of [
      "missing-endpoint",
      "empty",
      "malformed",
      "pending",
    ]) {
      const stock = deferred();
      const calls = [];
      const view = await component(
        "components/vehicle-identity-fields.tsx",
        "VehicleIdentityFields",
        {
          "@/lib/api": {
            api: async (path) => {
              calls.push(path);
              if (path.startsWith("/vehicle-options")) {
                if (localState === "missing-endpoint")
                  throw new Error("Endpoint not found");
                if (localState === "malformed") return { items: null };
                if (localState === "pending") return stock.promise;
                // A stale or absent local capability flag must not disable catalog loading.
                return { items: [], market_enabled: false };
              }
              if (path === "/valuation/catalog")
                return {
                  makes: [
                    { name: "Maruti Suzuki", models: ["Swift", "Dzire"] },
                  ],
                };
              return { items: [{ variant: "VXi" }] };
            },
          },
        },
      );
      const props = { type };
      const field = (tree, name) =>
        nodes(tree).find(
          (node) => node.type === "ChoiceField" && node.props.name === name,
        );
      view.render(props);
      await settle();
      let tree = view.render(props);
      assert.ok(
        field(tree, "make").props.options.includes("Maruti Suzuki"),
        `${type}: ${localState}`,
      );
      field(tree, "make").props.onChange("Maruti Suzuki");
      tree = view.render(props);
      assert.ok(field(tree, "model").props.options.includes("Dzire"));
      field(tree, "model").props.onChange("Dzire");
      tree = view.render(props);
      field(tree, "year").props.onChange("2020");
      view.render(props);
      await settle();
      tree = view.render(props);
      assert.ok(field(tree, "variant").props.options.includes("VXi"));
      assert.ok(calls.some((path) => path.startsWith("/valuation/variants?")));
      view.unmount();
      stock.resolve({ items: [] });
      await settle();
    }
  }
});

test("seller suggestions preserve manual details during an outage and support retrying the catalog", async () => {
  for (const type of ["passenger", "commercial"]) {
    const calls = [];
    let recovering = false;
    const view = await component(
      "components/vehicle-identity-fields.tsx",
      "VehicleIdentityFields",
      {
        "@/lib/api": {
          api: async (path) => {
            calls.push(path);
            if (!recovering) throw new Error("Unavailable");
            return path === "/valuation/catalog"
              ? { makes: [{ name: "Honda", models: ["City"] }] }
              : { items: [] };
          },
        },
      },
    );
    const props = { type };
    const field = (tree, name) =>
      nodes(tree).find(
        (node) => node.type === "ChoiceField" && node.props.name === name,
      );
    view.render(props);
    await settle();
    let tree = view.render(props);
    assert.match(content(tree), /Brand suggestions are unavailable/);
    field(tree, "make").props.onChange("My unlisted brand");
    tree = view.render(props);
    field(tree, "model").props.onChange("My unlisted model");
    tree = view.render(props);
    field(tree, "year").props.onChange("2020");
    tree = view.render(props);
    assert.equal(field(tree, "variant").props.disabled, false);
    assert.equal(field(tree, "year").props.min, 1950);
    assert.equal(
      field(tree, "year").props.max,
      new Date().getUTCFullYear() + 1,
    );
    assert.deepEqual(calls, [
      "/vehicle-options?type=" + type,
      "/valuation/catalog",
    ]);
    recovering = true;
    button(tree, "Retry loading brands").props.onClick();
    view.render(props);
    await settle();
    tree = view.render(props);
    assert.ok(field(tree, "make").props.options.includes("Honda"));
    assert.equal(field(tree, "make").props.value, "My unlisted brand");
    assert.equal(field(tree, "model").props.value, "My unlisted model");
    view.unmount();
  }
});

test("seller form saves custom dropdown values with its normal private contact and submission fields", async () => {
  const saves = [];
  const view = await component(
    "components/vehicle-editor.tsx",
    "VehicleEditor",
    {},
    {
      FormData: class {
        constructor(data) {
          this.data = data;
        }
        [Symbol.iterator]() {
          return Object.entries(this.data)[Symbol.iterator]();
        }
      },
    },
  );
  const tree = view.render({
    seller: true,
    onSave: async (data, contact) => {
      saves.push({ data, contact });
    },
  });
  assert.ok(nodes(tree).some((node) => node.type === "VehicleIdentityFields"));
  for (const name of ["body_type", "location", "owners", "seats"])
    assert.ok(
      nodes(tree).some(
        (node) => node.type === "ChoiceField" && node.props.name === name,
      ),
    );
  await nodes(tree)
    .find((node) => node.type === "form")
    .props.onSubmit({
      preventDefault() {},
      currentTarget: {
        make: "Unlisted brand",
        model: "Unlisted model",
        year: "2020",
        variant: "My exact trim",
        body_type: "Custom crossover",
        location: "Dwarka",
        owners: "6",
        seats: "11",
        price: "500000",
        mileage: "40000",
        features: "Camera, Airbags",
        seller_name: "Seller",
        seller_email: "seller@example.test",
        seller_phone: "9999999999",
      },
    });
  assert.equal(saves[0].data.variant, "My exact trim");
  assert.equal(saves[0].data.year, "2020");
  assert.equal(saves[0].data.seats, 11);
  assert.equal(saves[0].data.owners, "6");
  assert.equal(saves[0].data.type, "passenger");
  assert.equal(saves[0].data.seller_email, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(saves[0].contact)), {
    name: "Seller",
    email: "seller@example.test",
    phone: "9999999999",
  });
  const legacyInitial = {
    make: "Unlisted brand",
    model: "Unlisted model",
    year: 2008,
    variant: "Legacy trim",
  };
  const editing = await component(
    "components/vehicle-editor.tsx",
    "VehicleEditor",
  );
  const editTree = editing.render({
    seller: true,
    initial: legacyInitial,
    onSave: async () => {},
  });
  assert.equal(
    nodes(editTree).find((node) => node.type === "VehicleIdentityFields").props
      .initial,
    legacyInitial,
    "editing an existing private draft preserves unknown catalog details even with a partial initial value",
  );
  const cabView = await component(
    "components/vehicle-editor.tsx",
    "VehicleEditor",
  );
  const cab = cabView.render({
    seller: true,
    initial: { type: "commercial" },
    onSave: async () => {},
  });
  assert.ok(content(cab).includes("Commercial cab (yellow plate)"));
  assert.ok(!nodes(cab).some((node) => node.props?.name === "payload_kg"));
  const styles = nodes(cab).find(
    (node) => node.type === "ChoiceField" && node.props.name === "body_type",
  ).props.options;
  assert.ok(styles.includes("Sedan") && styles.includes("MUV"));
  assert.ok(!styles.some((value) => /truck|pickup|bus/i.test(value)));
  cabView.unmount();
  editing.unmount();
  view.unmount();
});
test("offer editor preserves unsaved styling on failed saves and publishes the exact preview once", async () => {
  const requests = [];
  const saveResult = deferred();
  let fail = true;
  const view = await component(
    "components/admin-offers.tsx",
    "AdminOffers",
    {
      ...studioStubs,
      "@/lib/api": {
        api: async (path, options) => {
          if (!options) return { items: [], total: 0, pages: 0, stats: {} };
          requests.push({ path, ...options });
          if (fail) throw new Error("Offer save failed");
          return saveResult.promise;
        },
        send: (method, body) => ({ method, body: JSON.stringify(body) }),
      },
    },
    studioGlobals,
  );
  let tree = view.render();
  await settle();
  tree = view.render();
  button(tree, "Create offer").props.onClick();
  tree = view.render();
  const headline = nodes(tree).find(
    (n) =>
      n.type === "input" &&
      n.props.maxLength === 100 &&
      n.props.placeholder !== undefined &&
      !n.props["aria-label"],
  );
  headline.props.onChange({ target: { value: "A custom campaign" } });
  tree = view.render();
  button(tree, "Look & feel").props.onClick();
  tree = view.render();
  button(tree, "Midnight").props.onClick();
  tree = view.render();
  await nodes(tree)
    .find((n) => n.type === "form")
    .props.onSubmit({ preventDefault() {} });
  await settle();
  tree = view.render();
  assert.ok(nodes(tree).some((n) => n.props.message === "Offer save failed"));
  let preview = nodes(tree).find((n) => n.type === "OfferCard").props.offer;
  assert.equal(preview.title, "A custom campaign");
  assert.equal(preview.theme, "midnight");
  fail = false;
  const publish = button(tree, "Publish offer").props.onClick;
  const first = publish();
  const second = publish();
  assert.equal(
    requests.length,
    2,
    "one failed draft request and one publish request",
  );
  const sent = JSON.parse(requests[1].body);
  assert.equal(sent.status, "published");
  assert.equal(sent.theme, "midnight");
  assert.equal(sent.title, "A custom campaign");
  saveResult.resolve({
    ...sent,
    id: 9,
    version: 1,
    updated_at: new Date().toISOString(),
  });
  await Promise.all([first, second]);
  tree = view.render();
  assert.ok(button(tree, "Save changes"));
  assert.ok(!button(tree, "Publish offer"));
  view.unmount();
});
test("offer removal waits for explicit confirmation and failed removal keeps the offer", async () => {
  const offer = {
    ...emptyOffer,
    id: 7,
    title: "Keep this campaign",
    status: "draft",
    version: 3,
    updated_at: "2026-10-25T00:00:00Z",
  };
  const requests = [];
  const view = await component(
    "components/admin-offers.tsx",
    "AdminOffers",
    {
      ...studioStubs,
      "@/lib/api": {
        api: async (path, options) => {
          if (!options)
            return { items: [offer], total: 1, pages: 1, stats: { draft: 1 } };
          requests.push({ path, ...options });
          throw new Error("Remove failed");
        },
        send: (method, body) => ({ method, body: JSON.stringify(body) }),
      },
    },
    studioGlobals,
  );
  let tree = view.render();
  await settle();
  tree = view.render();
  nodes(tree)
    .find((n) => n.props["aria-label"] === "Remove Keep this campaign")
    .props.onClick();
  tree = view.render();
  assert.equal(requests.length, 0);
  await button(tree, "Remove permanently").props.onClick();
  tree = view.render();
  assert.equal(requests[0].method, "DELETE");
  assert.equal(JSON.parse(requests[0].body).version, 3);
  assert.match(content(tree), /Keep this campaign/);
  assert.ok(nodes(tree).some((n) => n.props.message === "Remove failed"));
  view.unmount();
});
test("sorting uses the same filter form and submits it once with the current criteria", async () => {
  const filters = await component(
    "components/inventory-filters.tsx",
    "InventoryFilters",
    filterIcons,
  );
  const form = filters.render({
    type: "passenger",
    params: { fuel: "Petrol" },
    maxYear: 2027,
  });
  const sorting = await component(
    "components/inventory-filters.tsx",
    "InventorySort",
    filterIcons,
  );
  const tree = sorting.render({ value: "price_desc" });
  const select = nodes(tree).find((node) => node.type === "select");
  const formNode = nodes(form).find((node) => node.type === "form");
  assert.equal(select.props.form, formNode.props.id);
  assert.equal(select.props.name, "sort");
  assert.equal(select.props.defaultValue, "price_desc");
  let submissions = 0;
  select.props.onChange({
    currentTarget: {
      form: {
        requestSubmit() {
          submissions++;
        },
      },
    },
  });
  assert.equal(submissions, 1);
  filters.unmount();
  sorting.unmount();
});
test("inventory budget presets and custom amounts submit one canonical price without losing a draft", async () => {
  const view = await component(
    "components/inventory-filters.tsx",
    "InventoryFilters",
    filterIcons,
  );
  const props = {
    type: "passenger",
    params: { max_price: "750000" },
    maxYear: 2027,
  };
  const render = () => view.render(props);
  const budget = (tree) =>
    nodes(tree).find(
      (node) =>
        node.type === "select" && node.props["aria-label"] === "Maximum budget",
    );
  const price = (tree) => {
    const inputs = nodes(tree).filter(
      (node) => node.type === "input" && node.props.name === "max_price",
    );
    assert.equal(inputs.length, 1);
    return inputs[0];
  };
  let tree = render();
  assert.equal(budget(tree).props.value, "custom");
  assert.equal(price(tree).props.value, "750000");
  price(tree).props.onChange({ target: { value: "625000" } });
  tree = render();
  budget(tree).props.onChange({ target: { value: "500000" } });
  tree = render();
  assert.equal(price(tree).props.type, "hidden");
  assert.equal(price(tree).props.value, "500000");
  budget(tree).props.onChange({ target: { value: "custom" } });
  tree = render();
  assert.equal(price(tree).props.type, "number");
  assert.equal(price(tree).props.value, "625000");
  budget(tree).props.onChange({ target: { value: "" } });
  tree = render();
  assert.equal(price(tree).props.value, "");
  assert.equal(formOf(tree).props.action, "/cars");
  assert.equal(formOf(tree).props.method, "get");
  view.unmount();
});

test("filter removal preserves other criteria, resets pagination and stays in its vehicle category", async () => {
  for (const type of ["passenger", "commercial"]) {
    const view = await component(
      "components/inventory-filters.tsx",
      "InventoryFilters",
      filterIcons,
    );
    const params = {
      fuel: "Diesel",
      min_price: "0",
      max_price: "500000",
      min_year: "2020",
      page: "4",
      sort: "price_asc",
      featured: "true",
    };
    const tree = view.render({ type, params, maxYear: 2027 });
    const base = type === "commercial" ? "/commercial" : "/cars";
    assert.equal(formOf(tree).props.action, base);
    assert.equal(
      nodes(tree).find((node) => node.type === "details").props.open,
      true,
    );
    assert.equal(
      nodes(tree).filter((node) => node.props?.name === "min_payload").length,
      0,
    );
    assert.equal(
      nodes(tree).filter((node) => node.props?.name === "page").length,
      0,
    );
    const removeFuel = nodes(tree).find(
      (node) =>
        node.type === "Link" &&
        node.props["aria-label"] === "Remove Fuel type: Diesel",
    );
    const url = new URL(removeFuel.props.href, "http://localhost:3000");
    assert.equal(url.pathname, base);
    assert.equal(url.searchParams.get("fuel"), null);
    assert.equal(url.searchParams.get("page"), null);
    assert.equal(url.searchParams.get("max_price"), "500000");
    assert.equal(url.searchParams.get("min_price"), "0");
    assert.equal(url.searchParams.get("sort"), "price_asc");
    assert.equal(url.searchParams.get("featured"), "true");
    assert.equal(
      nodes(tree).find(
        (node) => node.type === "Link" && content(node) === "Clear all",
      ).props.href,
      base,
    );
    view.unmount();
  }
});

const galleryIcons = {
  "lucide-react": Object.fromEntries(
    ["CarFront", "ChevronLeft", "ChevronRight", "Expand", "X"].map((name) => [
      name,
      name,
    ]),
  ),
};
const galleryImages = [
  { id: 1, url: "/first.webp", alt_text: "Front view", sort_order: 0 },
  { id: 2, url: "/second.webp", alt_text: "Rear view", sort_order: 1 },
];
// The filter form sits inside the phone search bar wrapper.
const formOf = (tree) => nodes(tree).find((node) => node.type === "form");
const namedButton = (tree, name) =>
  nodes(tree).find(
    (node) => node.type === "button" && node.props["aria-label"] === name,
  );

test("gallery describes automatic photos from the vehicle and keeps staff alt text", async () => {
  const view = await component(
    "components/gallery.tsx",
    "Gallery",
    galleryIcons,
  );
  const tree = view.render({
    images: [
      { id: 1, url: "/a.webp", alt_text: "", sort_order: 0 },
      { id: 2, url: "/b.webp", alt_text: "Boot space", sort_order: 1 },
    ],
    vehicle: { year: 2019, make: "Kia", model: "Sonet", variant: "HTX" },
  });
  const alts = nodes(tree)
    .filter((node) => node.type === "img")
    .map((node) => node.props.alt);
  assert.ok(alts.includes("2019 Kia Sonet HTX — photo 1 of 2"));
  assert.ok(alts.includes("Boot space"));
  assert.ok(!alts.some((alt) => /vehicle photo/i.test(alt)));
});
test("gallery arrows, thumbnails and keyboard stay in sync and wrap at both ends", async () => {
  const view = await component(
    "components/gallery.tsx",
    "Gallery",
    galleryIcons,
  );
  const render = (images = galleryImages) => view.render({ images });
  const mainImage = (tree) => nodes(tree).find((node) => node.type === "img");
  let tree = render();
  assert.equal(mainImage(tree).props.src, "/first.webp");
  namedButton(tree, "Previous photo").props.onClick();
  tree = render();
  assert.equal(mainImage(tree).props.src, "/second.webp");
  assert.equal(namedButton(tree, "Show photo 2").props["aria-pressed"], true);
  namedButton(tree, "Next photo").props.onClick();
  tree = render();
  assert.equal(mainImage(tree).props.src, "/first.webp");
  namedButton(tree, "Show photo 2").props.onClick();
  tree = render();
  assert.equal(mainImage(tree).props.src, "/second.webp");
  let prevented = 0;
  tree.props.onKeyDown({
    key: "ArrowRight",
    preventDefault() {
      prevented++;
    },
  });
  tree = render();
  assert.equal(mainImage(tree).props.src, "/first.webp");
  assert.equal(prevented, 1);
  tree.props.onKeyDown({
    key: "ArrowLeft",
    metaKey: true,
    preventDefault() {
      prevented++;
    },
  });
  assert.equal(prevented, 1);
  tree = render(galleryImages.slice(0, 1));
  assert.equal(namedButton(tree, "Next photo"), undefined);
  assert.ok(namedButton(tree, "Open photo 1 in full-screen viewer"));
  tree = render([]);
  assert.match(content(tree), /No photos available/);
  assert.equal(nodes(tree).filter((node) => node.type === "button").length, 0);
  view.unmount();
});

test("photo viewer restores scrolling and focus on cancel, close and unmount", async () => {
  const body = { style: { overflow: "auto" } };
  const view = await component(
    "components/gallery.tsx",
    "Gallery",
    galleryIcons,
    { document: { body } },
  );
  const render = () => view.render({ images: galleryImages });
  let opened = 0,
    closed = 0,
    focused = 0;
  const dialog = {
    showModal() {
      opened++;
    },
    close() {
      closed++;
    },
  };
  let tree = render();
  nodes(tree).find((node) => node.type === "dialog").props.ref.current = dialog;
  namedButton(tree, "Open photo 1 in full-screen viewer").props.ref.current = {
    focus() {
      focused++;
    },
  };
  for (const method of ["cancel", "button", "unmount"]) {
    namedButton(tree, "Open photo 1 in full-screen viewer").props.onClick();
    tree = render();
    assert.equal(body.style.overflow, "hidden");
    if (method === "unmount") view.unmount();
    else {
      if (method === "cancel") {
        let prevented = false;
        nodes(tree)
          .find((node) => node.type === "dialog")
          .props.onCancel({
            preventDefault() {
              prevented = true;
            },
          });
        assert.equal(prevented, true);
      } else namedButton(tree, "Close photo viewer").props.onClick();
      tree = render();
    }
    assert.equal(body.style.overflow, "auto");
  }
  assert.equal(opened, 3);
  assert.equal(closed, 3);
  assert.equal(focused, 6);
});

test("photo viewer cycles Tab and Shift+Tab inside the dialog, including a single photo", async () => {
  const document = { activeElement: null };
  const view = await component(
    "components/gallery.tsx",
    "Gallery",
    galleryIcons,
    { document },
  );
  const tree = view.render({ images: galleryImages });
  const dialog = nodes(tree).find((node) => node.type === "dialog");
  for (const count of [3, 1]) {
    const buttons = Array.from({ length: count }, () => ({
      focus() {
        document.activeElement = this;
      },
    }));
    const currentTarget = { querySelectorAll: () => buttons };
    for (const shiftKey of [false, true]) {
      document.activeElement = null;
      for (let step = 0; step < count + 2; step++) {
        const current = buttons.indexOf(document.activeElement);
        let prevented = false;
        dialog.props.onKeyDown({
          key: "Tab",
          shiftKey,
          currentTarget,
          preventDefault() {
            prevented = true;
          },
        });
        assert.equal(prevented, true);
        const expected =
          current < 0
            ? shiftKey
              ? count - 1
              : 0
            : (current + (shiftKey ? -1 : 1) + count) % count;
        assert.equal(document.activeElement, buttons[expected]);
      }
    }
    let prevented = false;
    dialog.props.onKeyDown({
      key: "Escape",
      currentTarget,
      preventDefault() {
        prevented = true;
      },
    });
    assert.equal(prevented, false, "Escape keeps the native close behavior");
  }
});

test("cookie preferences remain usable when storage reads and writes throw", async () => {
  const view = await component(
    "components/cookie-preferences.tsx",
    "CookiePreferences",
    {},
    {
      localStorage: {
        getItem() {
          throw new Error("denied");
        },
        setItem() {
          throw new Error("denied");
        },
      },
    },
  );
  view.render();
  let tree = view.render();
  assert.match(content(tree), /Browser storage is unavailable/);
  button(tree, "Keep essential").props.onClick();
  tree = view.render();
  assert.match(content(tree), /applied for this page/);
  assert.doesNotMatch(content(tree), /preference saved in this browser/);
});
test(
  "late admin histories and customer details cannot replace a newer selection or reopen a closed record",
  { timeout: 10000 },
  async () => {
    for (const kind of ["leads", "customers"]) {
      const requests = new Map();
      const items = [1, 2].map((id) => ({
        id,
        name: "Customer " + id,
        email: "test@example.test",
        status: "new",
        role: "customer",
        active: true,
        created_at: "2026-01-01",
      }));
      const view = await component(
        "components/admin-collection.tsx",
        "AdminCollection",
        {
          "@/lib/api": {
            api: (path) => {
              if (path.includes("?"))
                return Promise.resolve({ items, total: 2, page: 1 });
              const request = deferred();
              requests.set(path, request);
              return request.promise;
            },
          },
        },
      );
      view.render({ kind });
      await settle();
      let tree = view.render({ kind });
      const manage = nodes(tree).filter(
        (n) => n.type === "button" && content(n).includes("Manage"),
      );
      const first = manage[0].props.onClick(),
        second = manage[1].props.onClick();
      const firstRequest = [...requests.values()][0],
        secondRequest = [...requests.values()][1];
      secondRequest.resolve(
        kind === "leads"
          ? {
              items: [
                {
                  id: 2,
                  status: "new",
                  note: "History B",
                  created_at: "2026-01-01",
                },
              ],
            }
          : { activity: { enquiries: 22 } },
      );
      await second;
      firstRequest.resolve(
        kind === "leads"
          ? {
              items: [
                {
                  id: 1,
                  status: "new",
                  note: "History A",
                  created_at: "2026-01-01",
                },
              ],
            }
          : { activity: { enquiries: 11 } },
      );
      await first;
      tree = view.render({ kind });
      const panel = nodes(tree).find((n) => n.props?.id === "record-detail");
      assert.match(content(panel), /Customer 2/);
      assert.doesNotMatch(content(panel), /History A|Customer 1|Enquiries: 11/);
      const pending = manage[0].props.onClick();
      tree = view.render({ kind });
      button(tree, "Close").props.onClick();
      requests
        .get(kind === "leads" ? "/admin/history/lead/1" : "/admin/customers/1")
        .resolve(
          kind === "leads" ? { items: [] } : { activity: { enquiries: 99 } },
        );
      await pending;
      tree = view.render({ kind });
      assert.equal(
        nodes(tree).some((n) => n.props?.id === "record-detail"),
        false,
      );
      view.unmount();
    }
  },
);
test("unavailable saved-listing removal catches failures, prevents overlap and updates shared state only on success", async () => {
  let request = deferred();
  const messages = [],
    updates = [];
  const api = (path, options) =>
    options?.method === "DELETE"
      ? request.promise
      : Promise.resolve({ items: [{ id: 42, unavailable: true }] });
  const view = await component("app/saved/page.tsx", "default", {
    "@/lib/api": { api, send: (method) => ({ method }) },
    "@/components/providers": {
      AuthGate: "AuthGate",
      useSaved: () => ({ update: (...args) => updates.push(args) }),
      useToast: () => (message) => messages.push(message),
    },
  });
  view.render();
  await settle();
  let tree = view.render();
  const work = button(tree, "Remove from saved").props.onClick();
  tree = view.render();
  assert.equal(button(tree, "Remove from saved").props.disabled, true);
  request.reject(new Error("Delete failed"));
  await work;
  tree = view.render();
  assert.equal(button(tree, "Remove from saved").props.disabled, false);
  assert.match(content(tree), /Listing #42/);
  assert.deepEqual(messages, ["Delete failed"]);
  assert.deepEqual(updates, []);
  request = deferred();
  const retry = button(tree, "Remove from saved").props.onClick();
  request.resolve({ ok: true });
  await retry;
  tree = view.render();
  assert.doesNotMatch(content(tree), /Listing #42/);
  assert.deepEqual(updates, [[42, false]]);
});
test("submission photo movement submits a complete adjacent swap once and offers only valid review decisions", async () => {
  const updates = [],
    downloads = [];
  let state = "draft";
  const sample = () => ({
    id: 1,
    status: state,
    type: "passenger",
    data: {
      make: "Test",
      model: "Car",
      year: 2024,
      mileage: 1,
      price: 1,
      features: [],
    },
    seller_contact: {},
    required_documents: [],
    documents: [
      {
        id: 7,
        type: "rc",
        mime: "application/pdf",
        created_at: "2020-01-01",
        uploaded_at: "2026-10-21",
        status: "pending",
      },
    ],
    history: [],
    images: [0, 3, 4, 5].map((order, index) => ({
      id: index + 10,
      sort_order: order,
      alt_text: "Test",
      url: "test",
    })),
  });
  const view = await component(
    "components/submission-detail.tsx",
    "SubmissionDetail",
    {
      "@/lib/api": {
        api: async (path, options) => {
          if (options) updates.push({ path, ...options });
          return sample();
        },
        send: (method, body) => ({ method, body }),
        download: async (...args) => {
          downloads.push(args);
        },
      },
    },
  );
  view.render({ id: "1" });
  await settle();
  let tree = view.render({ id: "1" });
  const moves = nodes(tree).filter(
    (n) => n.type === "button" && content(n).includes("Move earlier"),
  );
  const work = moves[3].props.onClick();
  tree = view.render({ id: "1" });
  assert.ok(
    nodes(tree)
      .filter(
        (n) => n.type === "button" && /Move earlier|Remove/.test(content(n)),
      )
      .every((n) => n.props.disabled),
  );
  await work;
  assert.equal(updates.length, 1);
  assert.equal(updates[0].path, "/account/submissions/1/images/reorder");
  assert.deepEqual(Array.from(updates[0].body.image_ids), [10, 11, 13, 12]);
  state = "under_review";
  view.render({ id: "1", admin: true });
  await settle();
  tree = view.render({ id: "1", admin: true });
  assert.equal(
    nodes(tree).some(
      (n) => n.type === "option" && n.props.value === "under_review",
    ),
    false,
  );
  assert.ok(
    nodes(tree).some(
      (n) => n.type === "option" && n.props.value === "approved",
    ),
  );
  assert.match(content(tree), /Last uploaded: 2026-10-21/);
  await button(tree, "Download privately").props.onClick();
  assert.deepEqual(downloads, [
    ["/account/submissions/1/documents/7", "rc.pdf"],
  ]);
});

test(
  "admin inventory, collections and review queues ignore previous-filter results and errors",
  { timeout: 10000 },
  async () => {
    for (const [file, name, props] of [
      ["components/admin-inventory.tsx", "AdminInventoryList", {}],
      ["components/admin-collection.tsx", "AdminCollection", { kind: "leads" }],
      ["components/inventory-work-queue.tsx", "InventoryWorkQueue", {}],
    ]) {
      for (const failOld of [false, true]) {
        let params = new URLSearchParams("q=old");
        const requests = [];
        const view = await component(file, name, {
          "next/navigation": { useSearchParams: () => params },
          "@/lib/api": {
            api: () => {
              const request = deferred();
              requests.push(request);
              return request.promise;
            },
          },
        });
        view.render(props);
        params = new URLSearchParams("q=new");
        view.render(props);
        const result = (name) => ({
          total: 1,
          page: 1,
          items: [
            {
              id: 2,
              name,
              make: name,
              model: "Test",
              year: 2024,
              price: 1,
              type: "passenger",
              status: "draft",
              images: [],
              created_at: "2026-10-21",
              data: {
                make: name,
                model: "Test",
                year: 2024,
                price: 1,
                type: "passenger",
              },
            },
          ],
        });
        requests[1].resolve(result("New result"));
        await settle();
        if (failOld) requests[0].reject(new Error("Old filter failed"));
        else requests[0].resolve(result("Old result"));
        await settle();
        const tree = view.render(props);
        assert.match(content(tree), /New result/, name);
        assert.doesNotMatch(content(tree), /Old result/, name);
        assert.ok(
          !nodes(tree).some(
            (node) => node.props?.message === "Old filter failed",
          ),
          name,
        );
        view.unmount();
      }
    }
  },
);
test(
  "a slow report request cannot overwrite the most recently applied date range",
  { timeout: 10000 },
  async () => {
    const requests = [];
    const view = await component("app/admin/reports/page.tsx", "default", {
      "@/lib/api": {
        api: (path) => {
          const request = deferred();
          requests.push({ path, ...request });
          return request.promise;
        },
      },
    });
    let tree = view.render();
    const from = nodes(tree).find(
      (node) => node.type === "input" && node.props.type === "date",
    );
    from.props.onChange({ target: { value: "2025-01-01" } });
    tree = view.render();
    nodes(tree)
      .find((node) => node.type === "form")
      .props.onSubmit({ preventDefault() {} });
    const result = (note) => ({
      inventory: [],
      leads: [],
      test_drives: [],
      submissions: [],
      performance: [],
      note,
    });
    assert.match(requests[1].path, /from=2025-01-01/);
    requests[1].resolve(result("Latest range"));
    await settle();
    requests[0].resolve(result("Old range"));
    await settle();
    tree = view.render();
    assert.match(content(tree), /Latest range/);
    assert.doesNotMatch(content(tree), /Old range/);
    view.unmount();
  },
);

test("blog image preparation serializes uploads, requires a separate review per use and leaves writing unchanged on cancel", async () => {
  const saved = {
    id: 7,
    title: "Image review",
    slug: "image-review",
    excerpt: "A useful article introduction.",
    category: "buying",
    author_name: "NCR Wheelz",
    body: [
      {
        type: "paragraph",
        text: "Existing writing must stay intact during image review.",
      },
    ],
    cover: null,
    cover_id: null,
    cover_alt: "",
    seo_title: "",
    seo_description: "",
    status: "draft",
    version: 1,
    published_at: null,
  };
  let uploads = 0;
  const view = await component(
    "components/admin-blog-editor.tsx",
    "AdminBlogEditor",
    {
      "lucide-react": {
        ArrowLeft: "ArrowLeft",
        Eye: "Eye",
        ImagePlus: "ImagePlus",
      },
      "@/lib/blog": {
        blogCategories: { buying: "Buying advice" },
        blogDate: String,
      },
      "@/lib/blog-document": blogDocument,
      "./blog-rich-editor": { BlogRichEditor: "BlogRichEditor" },
      "./blog-editor-dialog": { ImageAltDialog: "ImageAltDialog" },
      "./blog-content": { BlogContent: "BlogContent" },
      "./blog-document-editor.module.css": { __esModule: true, default: {} },
      "./providers": {
        useAuth: () => ({ user: { permissions: ["settings"] } }),
        useToast: () => () => {},
      },
      "next/navigation": { useRouter: () => ({ replace() {} }) },
      "@/lib/api": {
        api: async (path, options) => {
          if (!options) return saved;
          uploads++;
          return { id: 42, url: "/api/v1/admin/blog/7/media/42" };
        },
        send: (method, body) => ({ method, body: JSON.stringify(body) }),
      },
    },
    {
      window: { addEventListener() {}, removeEventListener() {} },
      document: { addEventListener() {}, removeEventListener() {} },
    },
  );
  view.render({ id: "7" });
  await settle();
  let tree = view.render({ id: "7" });
  const editor = nodes(tree).find((node) => node.type === "BlogRichEditor"),
    original = editor.props.value;
  const file = new File(["safe fixture"], "car.png", { type: "image/png" }),
    first = editor.props.prepareImage({ file }),
    duplicate = editor.props.prepareImage({ file });
  assert.equal(await duplicate, null);
  await settle();
  tree = view.render({ id: "7" });
  let modal = nodes(tree).find((node) => node.type === "ImageAltDialog");
  assert.ok(modal);
  assert.equal(uploads, 1);
  assert.deepEqual(
    nodes(tree).find((node) => node.type === "BlogRichEditor").props.value,
    original,
  );
  modal.props.onComplete(null);
  assert.equal(await first, null);
  tree = view.render({ id: "7" });
  assert.deepEqual(
    nodes(tree).find((node) => node.type === "BlogRichEditor").props.value,
    original,
  );
  const second = editor.props.prepareImage({
    asset: { id: 42, url: "/api/v1/admin/blog/7/media/42" },
    initial: { alt: "Old description", decorative: false },
  });
  tree = view.render({ id: "7" });
  modal = nodes(tree).find((node) => node.type === "ImageAltDialog");
  assert.equal(modal.props.initial.alt, "Old description");
  modal.props.onComplete({
    alt: "A different description for this use",
    decorative: false,
  });
  const result = await second;
  assert.equal(result.alt, "A different description for this use");
  assert.equal(result.reviewed, true);
  assert.equal(
    uploads,
    1,
    "selecting a library image does not upload it again",
  );
  view.unmount();
});

test("blog image dialog rejects whitespace and filenames, supports intentional decorative images and cancels without insertion", async () => {
  const completed = [];
  const view = await component(
    "components/blog-editor-dialog.tsx",
    "ImageAltDialog",
    {
      "@/lib/blog-document": blogDocument,
      "./blog-document-editor.module.css": { __esModule: true, default: {} },
    },
  );
  const props = {
    image: { id: 1, url: "/private-image" },
    onComplete: (value) => completed.push(value),
  };
  let tree = view.render(props);
  let input = nodes(tree).find(
    (node) => node.type === "input" && node.props.maxLength === 200,
  );
  input.props.onChange({ target: { value: "   " } });
  tree = view.render(props);
  nodes(tree)
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} });
  assert.equal(completed.length, 0);
  assert.match(content(view.render(props)), /at least 3 characters/);
  input = nodes(view.render(props)).find(
    (node) => node.type === "input" && node.props.maxLength === 200,
  );
  input.props.onChange({ target: { value: "car.png" } });
  tree = view.render(props);
  nodes(tree)
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} });
  assert.equal(completed.length, 0);
  const checkbox = nodes(tree).find(
    (node) => node.type === "input" && node.props.type === "checkbox",
  );
  checkbox.props.onChange({ target: { checked: true } });
  tree = view.render(props);
  nodes(tree)
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} });
  assert.deepEqual({ ...completed[0] }, { alt: "", decorative: true });
  button(tree, "Cancel").props.onClick();
  assert.equal(completed[1], null);
  view.unmount();
});

test("draft auto-save serializes versions, retains edits arriving during a save and pauses after a conflict", async () => {
  const saved = {
    id: 9,
    title: "Autosave story",
    slug: "autosave-story",
    excerpt: "A useful article introduction.",
    category: "buying",
    author_name: "NCR Wheelz",
    body: [
      { type: "paragraph", text: "Original saved automotive article content." },
    ],
    cover: null,
    cover_id: null,
    cover_alt: "",
    seo_title: "",
    seo_description: "",
    status: "draft",
    version: 1,
    published_at: null,
  };
  const writes = [];
  let timer;
  const view = await component(
    "components/admin-blog-editor.tsx",
    "AdminBlogEditor",
    {
      "lucide-react": {
        ArrowLeft: "ArrowLeft",
        Eye: "Eye",
        ImagePlus: "ImagePlus",
      },
      "@/lib/blog": {
        blogCategories: { buying: "Buying advice" },
        blogDate: String,
      },
      "@/lib/blog-document": blogDocument,
      "./blog-rich-editor": { BlogRichEditor: "BlogRichEditor" },
      "./blog-editor-dialog": { ImageAltDialog: "ImageAltDialog" },
      "./blog-content": { BlogContent: "BlogContent" },
      "./blog-document-editor.module.css": { __esModule: true, default: {} },
      "./providers": {
        useAuth: () => ({ user: { permissions: ["settings"] } }),
        useToast: () => () => {},
      },
      "next/navigation": { useRouter: () => ({ replace() {} }) },
      "@/lib/api": {
        api: (path, options) => {
          if (!options) return Promise.resolve(saved);
          const pending = deferred();
          writes.push({ body: JSON.parse(options.body), pending });
          return pending.promise;
        },
        send: (method, body) => ({ method, body: JSON.stringify(body) }),
      },
    },
    {
      window: {
        addEventListener() {},
        removeEventListener() {},
        setTimeout(fn, delay) {
          assert.equal(delay, 4000);
          timer = fn;
          return 1;
        },
        clearTimeout() {
          timer = null;
        },
      },
      document: { addEventListener() {}, removeEventListener() {} },
    },
  );
  view.render({ id: "9" });
  await settle();
  let tree = view.render({ id: "9" });
  nodes(tree)
    .find((node) => node.type === "input" && node.props.type === "checkbox")
    .props.onChange({ target: { checked: true } });
  nodes(tree)
    .find((node) => node.props?.name === "title")
    .props.onChange({ target: { value: "First local change" } });
  tree = view.render({ id: "9" });
  assert.ok(timer);
  timer();
  tree = view.render({ id: "9" });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].body.version, 1);
  assert.equal(writes[0].body.status, "draft");
  nodes(tree)
    .find((node) => node.props?.name === "title")
    .props.onChange({ target: { value: "Newer writing during request" } });
  tree = view.render({ id: "9" });
  writes[0].pending.resolve({ ...saved, ...writes[0].body, version: 2 });
  await settle();
  tree = view.render({ id: "9" });
  assert.equal(
    nodes(tree).find((node) => node.props?.name === "title").props.value,
    "Newer writing during request",
  );
  assert.ok(timer);
  timer();
  tree = view.render({ id: "9" });
  assert.equal(writes.length, 2);
  assert.equal(writes[1].body.version, 2);
  assert.equal(writes[1].body.title, "Newer writing during request");
  writes[1].pending.reject(new Error("Post changed in another session"));
  await settle();
  tree = view.render({ id: "9" });
  assert.equal(
    nodes(tree).find(
      (node) => node.type === "input" && node.props.type === "checkbox",
    ).props.checked,
    false,
  );
  assert.equal(
    nodes(tree).find((node) => node.props?.name === "title").props.value,
    "Newer writing during request",
  );
  assert.equal(timer, null);
  view.unmount();
});
