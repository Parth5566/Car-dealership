import { test, expect } from "../../../scripts/playwright.mjs";
const origin = "http://localhost:3100";
const headers = { "X-NCR-Request": "1", Origin: origin };
const serial = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
test("admin writes a private blog draft, adds a cover, publishes and unpublishes it", async ({
  browser,
}) => {
  const admin = await staff(browser, "admin");
  const visitor = await browser.newContext();
  const title = `Browser blog ${serial()}`;
  const slug = `browser-blog-${Date.now()}`;
  try {
    const page = await admin.newPage();
    await page.goto("/admin/blog/new");
    await page.getByLabel("Post title", { exact: true }).fill(title);
    await page
      .getByLabel("Short introduction", { exact: true })
      .fill(
        "Practical ideas for choosing a used car that fits your next chapter.",
      );
    await page.getByLabel("Web address", { exact: true }).fill(slug);
    await page
      .getByRole("textbox", { name: "Article body", exact: true })
      .fill(
        "Start with the journeys you make every day. Consider your budget, the space you need and the running costs before you visit a car.",
      );
    await page
      .getByRole("button", { name: "Preview post", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Private blog preview" }),
    ).toContainText(title);
    await page
      .getByRole("button", { name: "Back to writing", exact: true })
      .click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.waitForURL(/\/admin\/blog\/\d+$/);
    const id = new URL(page.url()).pathname.split("/").at(-1);
    expect(
      (await visitor.request.get(origin + "/api/v1/blog/" + slug)).status(),
    ).toBe(404);
    await page
      .getByLabel("Upload blog cover photo", { exact: true })
      .setInputFiles(await picture(admin));
    await page
      .getByLabel("Alternative text (alt text)", { exact: true })
      .fill("A car outside a showroom");
    await page
      .getByRole("button", { name: "Insert Image", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Remove cover", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Publish post", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Update published post", exact: true }),
    ).toBeVisible();
    const read = await visitor.newPage();
    await read.goto("/blog/" + slug);
    await expect(read.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(
      read.getByText("Start with the journeys you make every day.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      read.getByRole("img", { name: "A car outside a showroom", exact: true }),
    ).toBeVisible();
    expect(
      await read.locator('link[rel="canonical"]').getAttribute("href"),
    ).toBe(origin + "/blog/" + slug);
    await read.goto("/blog?q=" + encodeURIComponent(title));
    await expect(
      read.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Unpublish & save draft", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Publish post", exact: true }),
    ).toBeVisible();
    expect(
      (await visitor.request.get(origin + "/api/v1/blog/" + slug)).status(),
    ).toBe(404);
    await page
      .getByRole("button", { name: "Archive post", exact: true })
      .click();
    // Archiving a once-published post must keep its original publication time.
    await expect(
      page.getByRole("status").filter({ hasText: "Post archived" }),
    ).toBeVisible();
    await page.goto("/admin/blog?status=archived");
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  } finally {
    await admin.close();
    await visitor.close();
  }
});
test("homepage benefits switch buying and selling guides with loaded visuals on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/");
  const mainNavigation = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await expect(
    mainNavigation.getByRole("link", { name: "Home", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect
    .poll(() =>
      page
        .locator(".nav")
        .evaluate((nav) => nav.scrollWidth <= nav.clientWidth),
    )
    .toBe(true);
  const tabs = page.getByRole("tablist", {
    name: "Buying and selling with NCR Wheelz",
  });
  const panel = page.getByRole("tabpanel").filter({
    has: page.getByRole("heading", {
      name: "How NCR Wheelz works",
      exact: true,
    }),
  });
  await tabs.scrollIntoViewIfNeeded();
  await expect(
    tabs.getByRole("tab", { name: "Buy a car", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    panel.getByRole("heading", { name: "Find your shortlist", exact: true }),
  ).toBeVisible();
  await expect(panel.locator("img")).toHaveCount(4);
  for (const image of await panel.locator("img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
  }
  const sell = tabs.getByRole("tab", { name: "Sell a vehicle", exact: true });
  await sell.click();
  await expect(
    panel.getByRole("link", { name: "Start a private draft", exact: true }),
  ).toHaveAttribute("href", "/sell");
  await expect(
    panel.getByRole("heading", { name: "Share the essentials", exact: true }),
  ).toBeVisible();
  await sell.press("Home");
  await expect(
    tabs.getByRole("tab", { name: "Buy a car", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(sell).toBeFocused();
  await expect(sell).toHaveAttribute("aria-selected", "true");
  await page.setViewportSize({ width: 375, height: 812 });
  await tabs.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await expect(panel.locator("li")).toHaveCount(3);
  await panel
    .getByRole("link", { name: "Read the selling guide", exact: true })
    .click();
  await expect(page).toHaveURL(/\/selling-guide$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A simple guide to selling your vehicle.",
  );
  await expect(
    page.getByRole("link", { name: "Start your private draft", exact: false }),
  ).toHaveAttribute("href", "/sell");
});

test("policy documents navigate sections on desktop and mobile and retain cookie controls", async ({
  page,
}) => {
  await page.goto("/policies/terms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Terms & conditions",
  );
  const contents = page.getByRole("navigation", {
    name: "Policy contents",
    exact: true,
  });
  await contents.locator('a[href="#accounts"]').click();
  await expect(page).toHaveURL(/\/policies\/terms#accounts$/);
  await expect(
    page.getByRole("heading", {
      name: "Your account and security",
      exact: true,
    }),
  ).toBeInViewport();
  await page
    .getByRole("navigation", {
      name: "All policies and agreements",
      exact: true,
    })
    .getByRole("link", { name: "Privacy", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Privacy policy",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(contents).not.toBeVisible();
  await page.getByText("In this document", { exact: true }).click();
  await page
    .getByRole("navigation", { name: "Mobile policy contents", exact: true })
    .locator('a[href="#providers"]')
    .click();
  await expect(page).toHaveURL(/\/policies\/privacy#providers$/);
  await expect(
    page.getByRole("heading", {
      name: "Service providers and external destinations",
      exact: true,
    }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/policies/cookies");
  await page
    .getByRole("button", { name: "Keep essential storage only", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Essential-only preference saved in this browser.",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("nw_cookie_preferences")),
  ).toBe("essential-only");
  const missing = await page.goto("/policies/does-not-exist");
  expect(missing.status()).toBe(404);
});

test("admin customizes, saves, publishes, duplicates and removes discounts", async ({
  browser,
}) => {
  const context = await staff(browser, "admin");
  try {
    const page = await context.newPage();
    const title = `Browser offer ${serial()}`;
    // Compile the public routes before editing: dev-server compilation can
    // reload other open tabs and discard their component state.
    await page.goto("/discounts");
    await page.goto("/contact");
    await page.goto("/admin/offers");
    await page
      .getByRole("button", { name: "Create offer", exact: true })
      .click();
    await page.getByLabel("Offer headline", { exact: true }).fill(title);
    await page
      .getByLabel("The saving or benefit", { exact: false })
      .fill("₹12,000 off");
    await page
      .getByLabel("Short description", { exact: true })
      .fill("Disposable browser campaign");
    await page
      .getByLabel("Who or what is eligible?", { exact: true })
      .fill("Browser test vehicles");
    await page
      .getByRole("button", { name: "Look & feel", exact: true })
      .click();
    await page.getByRole("button", { name: "Midnight", exact: true }).click();
    await page
      .getByRole("button", { name: "Orbit rings", exact: true })
      .click();
    await page
      .getByLabel("Badge text", { exact: true })
      .fill("BROWSER SPECIAL");
    await page.getByLabel("Make it a showroom pick", { exact: false }).check();
    await page
      .getByRole("button", { name: "Timing & rules", exact: true })
      .click();
    await page
      .getByLabel("Offer terms", { exact: true })
      .fill("Test campaign, not redeemable.");
    await page
      .getByLabel("Reference code (optional)", { exact: false })
      .fill("BROWSER12");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Draft saved" }),
    ).toBeVisible();
    const publicPage = await context.newPage();
    await publicPage.goto("/discounts");
    await expect(
      publicPage.getByRole("heading", { name: title, exact: true }),
    ).toHaveCount(0);
    // Verify the saved draft survives a reload before publishing it.
    await page.reload();
    await page
      .getByRole("button", { name: "Edit " + title, exact: true })
      .click();
    await expect(
      page.getByLabel("Offer headline", { exact: true }),
    ).toHaveValue(title);
    await page
      .getByRole("button", { name: "Publish offer", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Offer published" }),
    ).toBeVisible();
    await publicPage.reload();
    const card = publicPage.locator(".deal-card").filter({
      has: publicPage.getByRole("heading", { name: title, exact: true }),
    });
    await expect(card).toHaveClass(/deal-midnight/);
    await expect(card).toHaveClass(/deal-pattern-rings/);
    await expect(card).toContainText("BROWSER12");
    await card
      .getByRole("link", { name: "Enquire about this offer", exact: true })
      .click();
    await expect(
      publicPage.getByLabel("Your message", { exact: true }),
    ).toHaveValue(
      `I’m interested in the offer: ${title}. Please share the details.`,
    );
    await page
      .getByRole("button", { name: "The details", exact: true })
      .click();
    await page
      .getByLabel("Offer headline", { exact: true })
      .fill(title + " edited");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Offer published" }),
    ).toBeVisible();
    await publicPage.goto("/discounts");
    await expect(
      publicPage.getByRole("heading", { name: title + " edited", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Duplicate " + title + " edited",
        exact: true,
      })
      .click();
    await expect(
      page.getByLabel("Offer headline", { exact: true }),
    ).toHaveValue(title + " edited (copy)");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Draft saved" }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Remove " + title + " edited (copy)",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Keep offer", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Remove " + title + " edited (copy)",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Remove " + title + " edited (copy)",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Remove permanently", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Offer removed" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Remove " + title + " edited (copy)",
        exact: true,
      }),
    ).toHaveCount(0);
    const row = page
      .locator(".studio-offer-row")
      .filter({ hasText: title + " edited" });
    await row.getByRole("button", { name: "Unpublish", exact: true }).click();
    await expect(row).toContainText("draft");
    await publicPage.reload();
    await expect(
      publicPage.getByRole("heading", { name: title + " edited", exact: true }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await row
      .getByRole("button", { name: "Edit " + title + " edited", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Look & feel", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Midnight", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Remove " + title + " edited", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remove permanently", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Offer removed" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
async function staff(browser, role) {
  const context = await browser.newContext({ baseURL: origin });
  const response = await context.request.post("/api/v1/auth/login", {
    headers,
    data: {
      email: role + "@example.test",
      password: "browser-qa-password-123",
      scope: "admin",
    },
  });
  expect(response.status()).toBe(200);
  return context;
}
async function customer(context) {
  const user = {
    name: "Browser customer",
    email: `browser-${serial()}@example.test`,
    phone: "9999999999",
    password: "six123",
    consent: true,
  };
  const response = await context.request.post(
    origin + "/api/v1/auth/register",
    { headers, data: user },
  );
  expect(response.status()).toBe(201);
  return user;
}
async function picture(context) {
  const response = await context.request.get(origin + "/api/v1/media/1");
  expect(response.status()).toBe(200);
  return {
    name: "fixture.webp",
    mimeType: "image/webp",
    buffer: await response.body(),
  };
}
function vehicle() {
  return {
    type: "passenger",
    make: "BROWSER FIXTURE",
    model: serial(),
    year: 2024,
    price: 600000,
    mileage: 20000,
    fuel: "Petrol",
    transmission: "Manual",
    location: "Delhi",
    body_type: "Hatchback",
    owners: 1,
    description: "Disposable browser-test vehicle",
    features: [],
  };
}
test("customer signup and test-drive forms work with local appointment times", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Full name", { exact: true }).fill("Browser signup");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`signup-${serial()}@example.test`);
  await page.getByLabel("Phone number", { exact: true }).fill("9999999999");
  await page.getByLabel("Password", { exact: true }).fill("six123");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/test-drive?vehicle=1");
  const input = page.getByLabel("Preferred date and time", { exact: false });
  const appointment = await page.evaluate(() => {
    const date = new Date(Date.now() + 86400000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  await input.fill(appointment);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Request a test drive", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Test drive requested" }),
  ).toBeVisible();
});
test("two tabs restore the same expired access session without replay revocation", async ({
  context,
}) => {
  await customer(context);
  const cookies = await context.cookies();
  await context.clearCookies();
  await context.addCookies(
    cookies.filter((cookie) => cookie.name !== "nw_access"),
  );
  let rotations = 0;
  context.on("request", (request) => {
    if (request.url().endsWith("/auth/refresh")) rotations++;
  });
  const first = await context.newPage(),
    second = await context.newPage();
  await Promise.all([first.goto("/account"), second.goto("/account")]);
  await Promise.all([
    expect(first).toHaveURL(/\/account$/),
    expect(second).toHaveURL(/\/account$/),
  ]);
  expect(rotations).toBe(1);
  expect((await context.request.get(origin + "/api/v1/auth/me")).status()).toBe(
    200,
  );
});
test("navigation restores expired access even when shared auth context still has a user", async ({
  context,
  page,
}) => {
  await customer(context);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account$/);
  const cookies = await context.cookies();
  await context.clearCookies();
  await context.addCookies(
    cookies.filter((cookie) => cookie.name !== "nw_access"),
  );
  let rotations = 0;
  context.on("request", (request) => {
    if (request.url().endsWith("/auth/refresh")) rotations++;
  });
  await page
    .getByRole("link", { name: "Saved vehicles", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/saved$/);
  expect((await context.request.get(origin + "/api/v1/auth/me")).status()).toBe(
    200,
  );
  expect(rotations).toBe(1);
});
test("reviewers approve inventory through their queue and sales publish it", async ({
  browser,
}) => {
  const sales = await staff(browser, "sales"),
    reviewer = await staff(browser, "reviewer");
  try {
    const data = vehicle();
    const created = await sales.request.post("/api/v1/admin/vehicles", {
      headers,
      data,
    });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    expect(
      (
        await sales.request.post(`/api/v1/admin/vehicles/${id}/images`, {
          headers,
          multipart: { file: await picture(sales) },
        })
      ).status(),
    ).toBe(201);
    const page = await reviewer.newPage();
    await page.goto("/admin/inventory-reviews");
    const card = page.locator("article.panel").filter({ hasText: data.model });
    await card.getByText("Inspect all vehicle details").click();
    await card
      .getByRole("button", { name: "Approve inventory", exact: true })
      .click();
    await expect(card).toHaveCount(0);
    const manage = await sales.newPage();
    await manage.goto(`/admin/inventory/${id}`);
    await manage
      .getByRole("combobox", { name: "Change status", exact: true })
      .selectOption("published");
    await manage.getByRole("button", { name: "Update listing status" }).click();
    await expect(
      manage.getByText("Move the listing to draft before changing photos.", {
        exact: false,
      }),
    ).toBeVisible();
    const listing = await sales.request.get(`/api/v1/vehicles/${id}`);
    expect(listing.status()).toBe(200);
    const image = (await listing.json()).images[0];
    expect(
      (
        await sales.request.delete(
          `/api/v1/admin/vehicles/${id}/images/${image.id}`,
          { headers },
        )
      ).status(),
    ).toBe(409);
    expect((await reviewer.request.get("/api/v1/admin/leads")).status()).toBe(
      403,
    );
  } finally {
    await sales.close();
    await reviewer.close();
  }
});
test("seller uploads, review and sales publication work without exposing documents", async ({
  browser,
  context,
  page,
}) => {
  // Multiple user contexts and uploads need more time on a busy machine;
  // the isolated build runs before the test and assertions remain bounded.
  test.setTimeout(180000);
  await customer(context);
  const data = vehicle(),
    photo = await picture(context);
  // Deterministic taxonomy fixtures exercise dropdowns without consuming provider credits.
  await page.route("**/api/v1/vehicle-options?*", (route) =>
    route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Endpoint not found" } },
    }),
  );
  await page.route("**/api/v1/valuation/catalog", (route) =>
    route.fulfill({
      json: {
        makes: [
          { name: "Maruti Suzuki", models: ["Swift", "Baleno"] },
          { name: "Honda", models: ["City"] },
        ],
      },
    }),
  );
  await page.route("**/api/v1/valuation/variants?*", (route) =>
    route.fulfill({
      json: { items: [{ variant: "VXi" }, { variant: "ZXi" }] },
    }),
  );
  await page.goto("/sell");
  await expect(
    page.locator('select[name="make"] option[value="Maruti Suzuki"]'),
  ).toHaveCount(1);
  await page.locator('select[name="make"]').selectOption("Maruti Suzuki");
  await page.locator('select[name="model"]').selectOption("Swift");
  await page.locator('select[name="year"]').selectOption("2020");
  await expect(
    page.locator('select[name="variant"] option[value="VXi"]'),
  ).toHaveCount(1);
  await page.locator('select[name="variant"]').selectOption("VXi");
  await page.locator('select[name="make"]').selectOption("Honda");
  await expect(page.locator('select[name="model"]')).toHaveValue("");
  await expect(page.locator('select[name="variant"]')).toHaveValue("");
  // Yellow-plate passenger cabs use the same car catalog, even without local stock.
  await page
    .getByLabel("Vehicle type", { exact: true })
    .selectOption("commercial");
  await expect(
    page.locator('select[name="make"] option[value="Maruti Suzuki"]'),
  ).toHaveCount(1);
  await page.locator('select[name="make"]').selectOption("Maruti Suzuki");
  await expect(
    page.locator('select[name="model"] option[value="Swift"]'),
  ).toHaveCount(1);
  await expect(page.locator('[name="payload_kg"]')).toHaveCount(0);
  await expect(
    page.locator('select[name="body_type"] option[value="Truck"]'),
  ).toHaveCount(0);
  await page
    .getByLabel("Vehicle type", { exact: true })
    .selectOption("passenger");
  // An unlisted vehicle can be entered through each dropdown's manual option.
  for (const name of [
    "make",
    "model",
    "year",
    "variant",
    "body_type",
    "location",
    "owners",
    "seats",
  ]) {
    await page
      .locator(`select[name="${name}"]`)
      .selectOption("__enter_manually__");
    await page
      .locator(`input[name="${name}"]`)
      .fill(
        String(
          name === "variant"
            ? "Custom seller trim"
            : name === "seats"
              ? "11"
              : (data[name] ?? ""),
        ),
      );
  }
  await page.locator('input[name="price"]').fill(String(data.price));
  await page.locator('textarea[name="description"]').fill(data.description);
  await page
    .getByLabel("Kilometres driven (km)", { exact: true })
    .fill(String(data.mileage));
  await page.getByLabel("Fuel type", { exact: true }).selectOption(data.fuel);
  await page
    .getByLabel("Mileage (km/l, optional)", { exact: true })
    .fill("18.5");
  await page
    .getByLabel("Transmission", { exact: true })
    .selectOption(data.transmission);
  await page
    .getByRole("button", { name: "Save draft & notify team", exact: true })
    .click();
  await page.waitForURL(/\/account\/submissions\/\d+$/);
  const id = Number(new URL(page.url()).pathname.split("/").at(-1));
  await expect(
    page.getByRole("heading", {
      name: "Your draft is submitted to our team.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "I’ll wait for the team", exact: false }),
  ).toHaveAttribute("href", "/account/submissions");
  const followUpContext = await staff(browser, "reviewer");
  try {
    const followUp = await followUpContext.newPage();
    await followUp.goto("/admin/submissions?status=draft&follow_up=pending");
    const draftRow = followUp.getByRole("row").filter({ hasText: data.model });
    await expect(draftRow).toContainText("Awaiting first contact");
    await expect(
      followUp.getByRole("complementary", {
        name: "Seller draft notifications",
      }),
    ).toBeVisible();
    await draftRow
      .getByRole("link", { name: "View draft / contact seller", exact: false })
      .click({ timeout: 30000 });
    await expect(followUp).toHaveURL(new RegExp(`/admin/submissions/${id}$`), {
      timeout: 30000,
    });
    await expect(
      followUp.getByRole("heading", {
        name: "Seller draft follow-up",
        exact: true,
      }),
    ).toBeVisible();
    await followUp
      .getByRole("button", { name: "Mark contacted", exact: true })
      .click({ timeout: 15000 });
    await expect(
      followUp.getByText("Contact recorded on", { exact: false }),
    ).toBeVisible();
    await followUp.goto("/admin/submissions?status=draft&follow_up=pending");
    await expect(
      followUp.getByRole("row").filter({ hasText: data.model }),
    ).toHaveCount(0);
  } finally {
    await followUpContext.close();
  }
  await page
    .getByRole("link", { name: "Complete my listing", exact: true })
    .click();
  await expect(page.locator("#vehicle-photos")).toBeInViewport();
  const saved = await context.request.get(`/api/v1/account/submissions/${id}`);
  expect(saved.status()).toBe(200);
  const savedData = (await saved.json()).data;
  expect(savedData.make).toBe(data.make);
  expect(savedData.model).toBe(data.model);
  expect(savedData.variant).toBe("Custom seller trim");
  expect(savedData.year).toBe(data.year);
  expect(savedData.seats).toBe(11);
  expect(savedData.mileage).toBe(data.mileage);
  expect(savedData.fuel_economy).toBe(18.5);
  await expect(page.locator(".detail-specs")).toContainText("18.5 km/l");
  await page
    .getByLabel("Add a vehicle photo", { exact: true })
    .setInputFiles(photo);
  await expect(page.locator(".upload-photo")).toHaveCount(1);
  for (const [index, name] of [
    "Vehicle registration certificate (RC)",
    "Proof of ownership or permission to sell",
    "Insurance document",
    "Pollution certificate (PUC)",
  ].entries()) {
    await page
      .getByLabel("Upload " + name, { exact: true })
      .setInputFiles(photo);
    await expect(
      page.getByRole("button", { name: "Download privately", exact: true }),
    ).toHaveCount(index + 1);
  }
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Submit for manual review", exact: true })
    .click();
  await expect(page.locator(".status-submitted")).toBeVisible();
  const reviewer = await staff(browser, "reviewer"),
    sales = await staff(browser, "sales"),
    admin = await staff(browser, "admin");
  try {
    const adjust = await admin.newPage();
    await adjust.goto(`/admin/submissions/${id}`);
    await adjust
      .getByRole("button", { name: "Edit details", exact: true })
      .click();
    await adjust.locator('[name="price"]').fill("450000");
    await adjust
      .getByRole("button", { name: "Save vehicle details", exact: true })
      .click();
    await expect(adjust.locator(".status-under_review").first()).toBeVisible();
    await page.reload();
    await expect(page.locator(".admin-heading").first()).toContainText(
      "₹4,50,000",
    );
    const review = await reviewer.newPage();
    await review.goto(`/admin/submissions/${id}`);
    for (let index = 0; index < 4; index++) {
      const card = review.locator(".document-card").nth(index);
      await card
        .getByLabel("Review note", { exact: true })
        .fill("Checked disposable test fixture");
      await card
        .getByRole("button", { name: "Record document review" })
        .click();
      await expect(card.locator(".status-accepted")).toBeVisible();
    }
    const decision = review.locator(".panel").filter({
      has: review.getByRole("heading", {
        name: "Review decision",
        exact: true,
      }),
    });
    await decision
      .getByRole("combobox", { name: "Decision", exact: true })
      .selectOption("approved");
    await decision
      .getByLabel("Feedback for the seller")
      .fill("Fixture review approved");
    await decision.getByRole("button", { name: "Record decision" }).click();
    await expect(review.locator(".status-approved")).toBeVisible();
    const privateSubmission = await (
      await context.request.get(origin + `/api/v1/account/submissions/${id}`)
    ).json();
    expect(
      (
        await sales.request.get(
          `/api/v1/account/submissions/${id}/documents/${privateSubmission.documents[0].id}`,
        )
      ).status(),
    ).toBe(404);
    const published =
      await test.step("Sales publishes the approved car and the seller sees the listing", async () => {
        const publish = await sales.newPage();
        await publish.goto("/admin/publishing");
        const card = publish
          .locator("article.panel")
          .filter({ hasText: data.model });
        await expect(card.locator("img")).toBeVisible();
        await card
          .getByRole("button", { name: "Publish approved vehicle" })
          .click();
        await expect(card).toHaveCount(0);
        await page.reload();
        await expect(
          page.getByRole("link", { name: "Open public listing" }),
        ).toBeVisible();
        const published = (
          await (
            await context.request.get(`/api/v1/account/submissions/${id}`)
          ).json()
        ).listing;
        expect(
          (
            await (
              await context.request.get(`/api/v1/vehicles/${published.id}`)
            ).json()
          ).price,
        ).toBe(450000);
        return published;
      });
    await test.step("Admin changes the price and the car requires fresh approval", async () => {
      await adjust.goto(`/admin/inventory/${published.id}`);
      await adjust
        .getByRole("button", { name: "Unpublish & edit vehicle", exact: true })
        .click();
      await adjust.locator('[name="price"]').fill("425000");
      await adjust
        .getByRole("button", { name: "Save vehicle details", exact: true })
        .click();
      await expect(
        adjust.getByText("approval required", { exact: true }),
      ).toBeVisible();
      expect(
        (
          await context.request.get(`/api/v1/vehicles/${published.id}`)
        ).status(),
      ).toBe(404);
      const updated = (
        await (
          await context.request.get(`/api/v1/account/submissions/${id}`)
        ).json()
      ).data;
      expect(updated.price).toBe(425000);
    });
  } finally {
    await reviewer.close();
    await sales.close();
    await admin.close();
  }
});
test("a reset during a session read recovers without signing the customer out", async ({
  context,
  page,
}) => {
  await customer(context);
  let attempts = 0;
  await context.route("**/api/v1/auth/me", async (route) => {
    if (++attempts === 1) await route.abort("connectionreset");
    else await route.continue();
  });
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Hello, Browser.", exact: true }),
  ).toBeVisible();
  expect(attempts).toBeGreaterThanOrEqual(2);
  await expect(page).toHaveURL(/\/account$/);
  expect((await context.request.get(origin + "/api/v1/auth/me")).status()).toBe(
    200,
  );
});
test("mobile navigation, comparison and EMI execute browser JavaScript", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  const mainNavigation = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await mainNavigation.getByRole("link", { name: "Home", exact: true }).click();
  await expect(mainNavigation).not.toBeVisible();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Vehicles", exact: true }).click();
  await page
    .locator("#vehicle-navigation")
    .getByRole("link", { name: "Passenger cars", exact: false })
    .click();
  const comparisons = page.getByRole("button", {
    name: "Compare",
    exact: true,
  });
  await comparisons.nth(0).click();
  await comparisons.nth(0).click();
  await page.getByRole("link", { name: "Compare now" }).click();
  await expect(page.locator(".compare-slot.filled")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".compare-slot.filled")).toHaveCount(2);
  await page.goto("/emi-calculator?price=120000");
  await page.getByLabel("Down payment", { exact: true }).fill("0");
  await page.getByLabel("Annual interest rate", { exact: true }).fill("0");
  await page.getByLabel("Loan tenure (months)", { exact: true }).fill("12");
  await expect(page.locator(".monthly-payment strong")).toHaveText(/10,000/);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});

test("listing photos browse in full view and optional specifications leave no empty row space", async ({
  browser,
  page,
}) => {
  const admin = await staff(browser, "admin");
  try {
    const created = await admin.request.post("/api/v1/admin/vehicles", {
      headers,
      data: { ...vehicle(), seats: 5 },
    });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const photo = await picture(admin);
    for (let index = 0; index < 2; index++) {
      const upload = await admin.request.post(
        `/api/v1/admin/vehicles/${id}/images`,
        {
          headers,
          multipart: { file: photo },
        },
      );
      expect(upload.status()).toBe(201);
    }
    const inspected = await admin.request.get(`/api/v1/admin/vehicles/${id}`);
    expect(inspected.status()).toBe(200);
    const { expected_version } = await inspected.json();
    const approval = await admin.request.post(
      `/api/v1/admin/vehicles/${id}/approve`,
      {
        headers,
        data: { expected_version },
      },
    );
    expect(approval.status()).toBe(200);
    const publication = await admin.request.post(
      `/api/v1/admin/vehicles/${id}/status`,
      {
        headers,
        data: { status: "published" },
      },
    );
    expect(publication.status()).toBe(200);
    const response = await admin.request.get(`/api/v1/vehicles/${id}`);
    expect(response.status()).toBe(200);
    const listing = await response.json();
    await page.goto(`/vehicles/${id}/${listing.slug}`);
    const gallery = page.getByRole("region", {
      name: "Vehicle photos",
      exact: true,
    });
    const main = gallery.locator(".gallery-open img");
    await expect(main).toHaveAttribute("src", listing.images[0].url);
    await expect(main).toHaveCSS("object-fit", "contain");
    await gallery
      .getByRole("button", { name: "Previous photo", exact: true })
      .click();
    await expect(main).toHaveAttribute("src", listing.images[1].url);
    await expect(
      gallery.getByRole("button", { name: "Show photo 2", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await gallery
      .getByRole("button", { name: "Next photo", exact: true })
      .click();
    await expect(main).toHaveAttribute("src", listing.images[0].url);
    const opener = gallery.getByRole("button", {
      name: /Open photo .* in full-screen viewer/,
    });
    const initialOverflow = await page
      .locator("body")
      .evaluate((body) => body.style.overflow);
    await opener.click();
    const viewer = page.getByRole("dialog", {
      name: "Full-screen vehicle photos",
      exact: true,
    });
    await expect(viewer).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    await viewer
      .getByRole("button", { name: "Next photo", exact: true })
      .click();
    await expect(viewer.locator("img")).toHaveAttribute(
      "src",
      listing.images[1].url,
    );
    await page.keyboard.press("ArrowRight");
    await expect(viewer.locator("img")).toHaveAttribute(
      "src",
      listing.images[0].url,
    );
    await page.keyboard.press("ArrowLeft");
    await expect(viewer.locator("img")).toHaveAttribute(
      "src",
      listing.images[1].url,
    );
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let index = 0; index < 5; index++) {
        await page.keyboard.press(key);
        expect(
          await viewer.evaluate((dialog) =>
            dialog.contains(document.activeElement),
          ),
        ).toBe(true);
      }
    }
    await page.keyboard.press("Escape");
    await expect(viewer).not.toBeVisible();
    await expect(opener).toBeFocused();
    expect(
      await page.locator("body").evaluate((body) => body.style.overflow),
    ).toBe(initialOverflow);
    await expect(main).toHaveAttribute("src", listing.images[1].url);
    for (const width of [1440, 1024, 760, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const specs = page.locator(".detail-specs");
      await expect(specs.locator(":scope > div")).toHaveCount(7);
      await expect
        .poll(() =>
          specs.evaluate((element) => {
            const last = element.lastElementChild.getBoundingClientRect();
            const parent = element.getBoundingClientRect();
            return Math.abs(parent.right - 1 - last.right);
          }),
        )
        .toBeLessThan(1.5);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await opener.click();
    await expect(viewer).toBeVisible();
    const bounds = await viewer.boundingBox();
    expect(bounds.width).toBeCloseTo(390, 0);
    expect(bounds.height).toBeCloseTo(900, 0);
    await viewer
      .getByRole("button", { name: "Close photo viewer", exact: true })
      .click();
    await expect(viewer).not.toBeVisible();
    await expect(opener).toBeFocused();
  } finally {
    await admin.close();
  }
});

test("passenger and commercial filters support simple budgets, extra criteria and individual clearing", async ({
  page,
}) => {
  for (const base of ["/cars", "/commercial"]) {
    await page.setViewportSize({
      width: base === "/cars" ? 1440 : 390,
      height: 900,
    });
    await page.goto(base);
    const filters = page.locator(".compact-filters");
    const more = filters.locator(".more-filters");
    // Phones keep the filter form in a bottom sheet behind the Filters button.
    const phone = base !== "/cars";
    const openFilters = async () => {
      if (phone) await page.getByRole("button", { name: /^Filters/ }).click();
    };
    await expect(more).toHaveJSProperty("open", false);
    await expect(
      filters.getByLabel("Vehicle brand", { exact: true }),
    ).toBeHidden();
    await openFilters();
    await filters
      .getByRole("combobox", { name: "Maximum budget", exact: true })
      .selectOption("800000");
    await filters
      .getByRole("combobox", { name: "Fuel type", exact: true })
      .selectOption("Petrol");
    await filters
      .getByRole("button", { name: "Show vehicles", exact: true })
      .click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === base &&
        url.searchParams.get("max_price") === "800000" &&
        url.searchParams.get("fuel") === "Petrol" &&
        !url.searchParams.has("page"),
    );
    await filters.getByRole("link", { name: /Remove Budget up to:/ }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === base &&
        !url.searchParams.has("max_price") &&
        url.searchParams.get("fuel") === "Petrol",
    );
    await openFilters();
    await filters.getByRole("link", { name: "Clear all", exact: true }).click();
    await expect(page).toHaveURL(origin + base);
    await openFilters();
    await more.locator("summary").click();
    await expect(more).toHaveJSProperty("open", true);
    await filters.getByLabel("Built in or after", { exact: true }).fill("2020");
    await filters
      .getByRole("combobox", { name: "Maximum budget", exact: true })
      .selectOption("custom");
    await filters
      .getByLabel("Your maximum budget (₹)", { exact: true })
      .fill("750000");
    await page
      .getByRole("combobox", { name: "Sort results", exact: true })
      .selectOption("price_asc");
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === base &&
        url.searchParams.get("max_price") === "750000" &&
        url.searchParams.get("min_year") === "2020" &&
        url.searchParams.get("sort") === "price_asc",
    );
    await expect(more).toHaveJSProperty("open", true);
    await expect(
      filters.getByLabel("Built in or after", { exact: true }),
    ).toHaveValue("2020");
    await expect(
      filters.getByLabel("Your maximum budget (₹)", { exact: true }),
    ).toHaveValue("750000");
    await expect(filters.locator('[name="min_payload"]')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("car valuation shows observed and single-listing approximate ranges and offers a review when no stock matches", async ({
  browser,
  page,
}) => {
  const admin = await staff(browser, "admin");
  try {
    const data = {
      ...vehicle(),
      make: "VALUATION FIXTURE",
      variant: "VXi",
      year: 2020,
      mileage: 40000,
      location: "New Delhi",
    };
    const photo = await picture(admin),
      ids = [];
    for (const price of [400000, 450000, 500000]) {
      const created = await admin.request.post("/api/v1/admin/vehicles", {
        headers,
        data: { ...data, price },
      });
      expect(created.status()).toBe(201);
      const { id } = await created.json();
      ids.push(id);
      expect(
        (
          await admin.request.post(`/api/v1/admin/vehicles/${id}/images`, {
            headers,
            multipart: { file: photo },
          })
        ).status(),
      ).toBe(201);
      const inspected = await (
        await admin.request.get(`/api/v1/admin/vehicles/${id}`)
      ).json();
      expect(
        (
          await admin.request.post(`/api/v1/admin/vehicles/${id}/approve`, {
            headers,
            data: { expected_version: inspected.expected_version },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await admin.request.post(`/api/v1/admin/vehicles/${id}/status`, {
            headers,
            data: { status: "published" },
          })
        ).status(),
      ).toBe(200);
    }
    await page.goto("/car-valuation");
    await page.getByRole("radio", { name: "Buyer", exact: true }).check();
    await page
      .getByLabel("Manufacturing year", { exact: true })
      .selectOption(String(data.year));
    await page.getByLabel("City", { exact: true }).selectOption("New Delhi");
    let priceChecks = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/v1/valuation"
      )
        priceChecks++;
    });
    await page.getByRole("button", { name: "Select car", exact: true }).click();
    const picker = page.getByRole("dialog", {
      name: "Select your car",
      exact: true,
    });
    await expect(picker).toBeVisible();
    for (const [label, value] of [
      ["Vehicle brand", data.make],
      ["Model", data.model],
      ["Variant", data.variant],
    ])
      await picker.getByLabel(label, { exact: true }).selectOption(value);
    await expect(picker.getByLabel("Fuel type", { exact: true })).toHaveValue(
      "Petrol",
    );
    await expect(
      picker.getByLabel("Transmission", { exact: true }),
    ).toHaveValue("Manual");
    await picker
      .getByRole("button", { name: "Use this car", exact: true })
      .click();
    await expect(picker).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: new RegExp("Change selected car:") }),
    ).toBeFocused();
    expect(priceChecks).toBe(0);
    await page.getByLabel("Kilometres driven", { exact: true }).fill("40000");
    const check = page.getByRole("button", {
      name: "Check Value",
      exact: true,
    });
    await check.click();
    await expect(
      page.getByRole("heading", {
        name: "Indicative price range",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".valuation-range")).toContainText("₹4,00,000");
    await expect(page.locator(".valuation-range")).toContainText("₹5,00,000");
    await expect(page.locator(".valuation-evidence")).toContainText(
      "3 similar listings",
    );
    await expect(page.locator(".valuation-comparables")).toHaveCount(0);
    await page.getByRole("radio", { name: "Seller", exact: true }).check();
    await expect(page.locator(".valuation-range")).toHaveCount(0);
    await check.click();
    await expect(page.locator(".valuation-range")).toContainText("₹4,00,000");
    await expect(page.locator(".valuation-range")).toContainText("₹5,00,000");
    expect(
      (
        await admin.request.post(`/api/v1/admin/vehicles/${ids[0]}/status`, {
          headers,
          data: { status: "draft" },
        })
      ).status(),
    ).toBe(200);
    await page.setViewportSize({ width: 390, height: 844 });
    const changeCar = page.getByRole("button", {
      name: new RegExp("Change selected car:"),
    });
    await changeCar.click();
    await expect(picker).toBeVisible();
    const dialogBox = await picker.boundingBox();
    expect(dialogBox.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(390);
    await page.keyboard.press("Escape");
    await expect(picker).not.toBeVisible();
    await expect(changeCar).toBeFocused();
    await check.click();
    await expect(
      page.getByRole("heading", {
        name: "Approximate price range",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".valuation-evidence")).toContainText(
      "2 similar listings",
    );
    await expect(page.locator(".valuation-range")).toContainText("₹4,27,000");
    await expect(page.locator(".valuation-range")).toContainText("₹5,23,000");
    expect(
      (
        await admin.request.post(`/api/v1/admin/vehicles/${ids[1]}/status`, {
          headers,
          data: { status: "draft" },
        })
      ).status(),
    ).toBe(200);
    await check.click();
    await expect(page.locator(".valuation-evidence")).toContainText(
      "1 similar listing",
    );
    await expect(page.locator(".valuation-range")).toContainText("₹4,50,000");
    await expect(page.locator(".valuation-range")).toContainText("₹5,50,000");
    await expect(
      page.getByText(/range endpoints are estimated, not advertised prices/),
    ).toBeVisible();
    await expect(page.locator(".valuation-comparables")).toHaveCount(0);
    expect(
      (
        await admin.request.post(`/api/v1/admin/vehicles/${ids[2]}/status`, {
          headers,
          data: { status: "draft" },
        })
      ).status(),
    ).toBe(200);
    await check.click();
    await expect(
      page.getByText("An estimate isn’t available for this car yet.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".valuation-range")).toHaveCount(0);
    await expect(page.locator(".valuation-insufficient")).toContainText(
      "We found 0 matching listings",
    );
    await expect(page.locator(".valuation-insufficient")).toContainText(
      "needs at least 1",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("link", { name: "Request a price review", exact: true })
      .click();
    await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
      new RegExp(data.model),
    );
    await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
      /valuing my/,
    );
  } finally {
    await admin.close();
  }
});
