import { wordFile } from "../fixtures/blog-docx.mjs";
import { test, expect } from "../../../scripts/playwright.mjs";
import { createRequire } from "node:module";
const requireBackend = createRequire(
  new URL("../../../backend/package.json", import.meta.url),
);
const sharp = requireBackend("sharp");
const origin = "http://localhost:3100",
  headers = { "X-NCR-Request": "1", Origin: origin };
const serial = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
async function staff(browser) {
  const context = await browser.newContext({ baseURL: origin });
  const login = await context.request.post("/api/v1/auth/login", {
    headers,
    data: { email: "admin@example.test", password: "browser-qa-password-123" },
  });
  expect(login.status()).toBe(200);
  return context;
}
async function png() {
  return {
    name: "editor-fixture.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 600, height: 400, channels: 3, background: "#245b66" },
    })
      .png()
      .toBuffer(),
  };
}
async function selectText(body, text) {
  await body.evaluate((element, text) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT),
      nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    const complete = nodes.map((node) => node.textContent).join(""),
      start = complete.indexOf(text);
    if (start < 0) throw new Error("Cannot select " + text);
    let offset = 0,
      from,
      to;
    for (const node of nodes) {
      const length = node.textContent.length;
      if (!from && offset + length > start)
        from = { node, offset: start - offset };
      if (offset + length >= start + text.length) {
        to = { node, offset: start + text.length - offset };
        break;
      }
      offset += length;
    }
    const range = document.createRange();
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    element.focus();
    document.dispatchEvent(new Event("selectionchange"));
  }, text);
  await expect
    .poll(() => body.evaluate(() => window.getSelection()?.toString()))
    .toBe(text);
}
async function describe(page, text) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Alternative text (alt text)", { exact: true })
    .fill(text);
  await dialog
    .getByRole("button", { name: "Insert Image", exact: true })
    .click();
}
async function createDraft(page) {
  await page.goto("/admin/blog/new");
  await page
    .getByLabel("Post title", { exact: true })
    .fill("Rich blog " + serial());
  await page
    .getByLabel("Short introduction", { exact: true })
    .fill(
      "Practical automotive advice with accessible photos and useful links.",
    );
  const body = page.getByRole("textbox", { name: "Article body", exact: true });
  await body.fill(
    "Choose a reliable car. Plan your maintenance budget before buying.",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/blog\/\d+$/);
  await expect(body).toContainText("Choose a reliable car.");
  return { body, id: page.url().split("/").at(-1) };
}

test("rich blog editor preserves selection formatting, links, individual image alt text and publication metadata", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const admin = await staff(browser),
    visitor = await browser.newContext({ baseURL: origin });
  try {
    const page = await admin.newPage(),
      { body, id } = await createDraft(page),
      photo = await png();
    await page
      .getByLabel("Author / team name", { exact: true })
      .fill("NCR Editorial Desk");
    await selectText(body, "Choose a reliable car.");
    for (const name of [
      "Bold (Ctrl/⌘ B)",
      "Italic (Ctrl/⌘ I)",
      "Underline (Ctrl/⌘ U)",
    ])
      await page.getByRole("button", { name, exact: true }).click();
    // Only article formatting is offered (owner request, 26 Oct 2026).
    for (const removed of ["Strikethrough", "Text colour", "Align left"])
      await expect(page.getByRole("button", { name: removed })).toHaveCount(0);
    await expect(
      page.getByRole("combobox", { name: "Text colour" }),
    ).toHaveCount(0);
    await expect(body.locator("strong")).toContainText(
      "Choose a reliable car.",
    );
    await expect(body.locator("em")).toContainText("Choose a reliable car.");
    await expect(body.locator("u")).toContainText("Choose a reliable car.");
    await page.getByRole("button", { name: "Heading 1", exact: true }).click();
    await expect(body.locator("h1")).toHaveCount(1);
    await expect(
      page.getByText("Your body headings will each move down one level", {
        exact: false,
      }),
    ).toBeVisible();
    await body.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page
      .getByRole("button", { name: "Normal text", exact: true })
      .click();
    await page.keyboard.type(
      "Review the service history and inspect the car before making a decision.",
    );
    await selectText(body, "maintenance budget");
    await page
      .getByRole("button", { name: "Add or edit link", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Display text")).toHaveValue(
      "maintenance budget",
    );
    await dialog.getByLabel("Destination URL").fill("/contact");
    await dialog
      .getByRole("button", { name: "Save link", exact: true })
      .click();
    await expect(body.locator('a[href="/contact"]')).toHaveText(
      "maintenance budget",
    );
    await body
      .getByRole("link", { name: "maintenance budget", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Destination URL")
      .fill("https://example.com/guide");
    await dialog.getByRole("checkbox", { name: "Open in a new tab" }).check();
    await dialog
      .getByRole("button", { name: "Save link", exact: true })
      .click();
    await expect(body.locator("a")).toHaveAttribute("target", "_blank");
    await body.locator("a").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove link", exact: true })
      .click();
    await expect(body.locator("a")).toHaveCount(0);
    await expect(body).toContainText("maintenance budget");
    await selectText(body, "maintenance budget");
    await page
      .getByRole("button", { name: "Add or edit link", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Destination URL")
      .fill("/contact");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save link", exact: true })
      .click();
    await page
      .getByLabel("Upload blog cover photo", { exact: true })
      .setInputFiles(photo);
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Alternative text (alt text)", { exact: true })
      .fill(" ");
    await dialog
      .getByRole("button", { name: "Insert Image", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await describe(page, "A blue car shown as the article cover");
    await body.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page
      .getByLabel("Upload article image", { exact: true })
      .setInputFiles(photo);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(body.locator("img")).toHaveCount(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(body.locator("img")).toHaveCount(0);
    await page
      .getByLabel("Upload article image", { exact: true })
      .setInputFiles(photo);
    await describe(page, "The engine bay during a condition check");
    await expect(body.locator("img")).toHaveCount(1);
    await body.locator("img").click();
    await page
      .getByRole("button", { name: "Edit alternative text", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog")
        .getByLabel("Alternative text (alt text)", { exact: true }),
    ).toHaveValue("The engine bay during a condition check");
    await describe(page, "A mechanic inspecting the engine bay");
    await page
      .getByLabel("Image caption", { exact: true })
      .fill("Inspect service records alongside the vehicle.");
    await page.getByLabel("Image width", { exact: true }).selectOption("75");
    await page
      .getByRole("button", { name: "Image library", exact: true })
      .click();
    const library = page.getByRole("dialog");
    await expect(
      library.getByRole("button", { name: /Select image/ }).first(),
    ).toBeVisible();
    await library
      .getByRole("button", { name: /Select image/ })
      .first()
      .click();
    await describe(page, "The same asset used to explain another car detail");
    await expect(body.locator("img")).toHaveCount(2);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Draft saved" }),
    ).toBeVisible();
    const saved = await (
      await admin.request.get(`/api/v1/admin/blog/${id}`)
    ).json();
    expect(saved.body.type).toBe("doc");
    expect(saved.author_name).toBe("NCR Editorial Desk");
    const imageNodes = saved.body.content.filter(
      (node) => node.type === "blogImage",
    );
    expect(imageNodes).toHaveLength(2);
    expect(imageNodes[0].attrs.alt).not.toBe(imageNodes[1].attrs.alt);
    await page.reload();
    await expect(body.locator("strong")).toContainText(
      "Choose a reliable car.",
    );
    await expect(
      body.getByRole("img", {
        name: "A mechanic inspecting the engine bay",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Preview post", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Private blog preview" })
        .getByRole("img", {
          name: "A mechanic inspecting the engine bay",
          exact: true,
        }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Back to writing", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Publish post", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Update published post", exact: true }),
    ).toBeVisible();
    const live = await (
        await visitor.request.get("/api/v1/blog/" + saved.slug)
      ).json(),
      read = await visitor.newPage();
    await read.goto("/blog/" + saved.slug);
    await expect(read.locator("h1")).toHaveCount(1);
    await expect(
      read.getByText("By NCR Editorial Desk", { exact: true }),
    ).toBeVisible();
    await expect(
      read.getByRole("img", {
        name: "A mechanic inspecting the engine bay",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      read.locator('article a[href="/contact"]').first(),
    ).toBeVisible();
    // Playwright's hasText filter intentionally excludes script contents.
    const schema = await read
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) =>
        scripts
          .map((script) => JSON.parse(script.textContent || "{}"))
          .flatMap((data) => data["@graph"] || [data])
          .find((data) => data["@type"] === "BlogPosting"),
      );
    expect(schema).toBeTruthy();
    expect(schema.author.name).toBe("NCR Editorial Desk");
    expect(schema.datePublished).toBe(live.published_at);
    await page
      .getByLabel("Short introduction", { exact: true })
      .fill(
        "Updated practical advice with the original publication date preserved.",
      );
    await page
      .getByRole("button", { name: "Update published post", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await (
              await visitor.request.get("/api/v1/blog/" + saved.slug)
            ).json()
          ).excerpt,
      )
      .toContain("Updated practical advice");
    const updated = await (
      await visitor.request.get("/api/v1/blog/" + saved.slug)
    ).json();
    expect(updated.published_at).toBe(live.published_at);
    expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(live.published_at).getTime(),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("textbox", { name: "Article body", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  } finally {
    await admin.close();
    await visitor.close();
  }
});

test("rich blog Word import and pasted Docs content require image reviews, clean unsafe markup and support scheduling", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const admin = await staff(browser);
  try {
    const page = await admin.newPage(),
      { body, id } = await createDraft(page),
      photo = await png(),
      word = await wordFile(photo);
    page.on("dialog", (dialog) => dialog.accept());
    await page
      .getByLabel("Import Word document", { exact: true })
      .setInputFiles(word);
    await expect(
      page
        .getByRole("dialog")
        .getByLabel("Alternative text (alt text)", { exact: true }),
    ).toHaveValue("Original imported image description");
    await describe(page, "A hatchback shown in the imported guide");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(body).toContainText("Choose a reliable car.");
    await expect(body.locator("img")).toHaveCount(0);
    await page
      .getByLabel("Import Word document", { exact: true })
      .setInputFiles(word);
    await describe(page, "The first imported car image");
    await describe(page, "The second imported car image");
    await expect(body).toContainText("Imported automotive guide");
    await expect(body.locator("table")).toHaveCount(1);
    await expect(body.locator("strong")).toContainText(
      "Useful imported advice",
    );
    await expect(body.locator('a[href="/contact"]')).toHaveText(
      "Contact our team",
    );
    await expect(body.locator("img")).toHaveCount(2);
    await body.click();
    await page.keyboard.press("ControlOrMeta+End");
    await body.evaluate((element) => {
      const data = new DataTransfer();
      data.setData(
        "text/html",
        '<p><span style="font-weight:700;font-style:italic;text-decoration:underline;font-family:Comic Sans">Pasted Docs advice</span><a href="https://example.com/guide">External reference</a><a href="javascript:window.blogAttack=1">Unsafe reference</a><script>window.blogAttack=1</script></p>',
      );
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      );
    });
    await expect(body.locator("strong")).toContainText([
      "Useful imported advice",
      "Pasted Docs advice",
    ]);
    await expect(
      body.locator('a[href="javascript:window.blogAttack=1"]'),
    ).toHaveCount(0);
    expect(await page.evaluate(() => window.blogAttack)).toBeUndefined();
    await expect(body.locator("img")).toHaveCount(2);
    await body.evaluate((element, base64) => {
      const bytes = Uint8Array.from(atob(base64), (character) =>
          character.charCodeAt(0),
        ),
        data = new DataTransfer();
      data.items.add(
        new File([bytes], "pasted-car.png", { type: "image/png" }),
      );
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      );
    }, photo.buffer.toString("base64"));
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(body.locator("img")).toHaveCount(2);
    await describe(page, "A car photo pasted from the clipboard");
    await expect(body.locator("img")).toHaveCount(3);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.reload();
    await expect(body.locator("img")).toHaveCount(3);
    await expect(
      body.getByRole("img", {
        name: "The second imported car image",
        exact: true,
      }),
    ).toBeVisible();
    const scheduled = new Date(Date.now() + 86400000 + 330 * 60000)
      .toISOString()
      .slice(0, 16);
    await page
      .getByLabel("Publication date and time (IST)", { exact: true })
      .fill(scheduled);
    await page
      .getByRole("button", { name: "Schedule post", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Cancel schedule & save draft",
        exact: true,
      }),
    ).toBeVisible();
    const record = await (
      await admin.request.get(`/api/v1/admin/blog/${id}`)
    ).json();
    expect(record.is_scheduled).toBe(true);
    expect(
      (await admin.request.get("/api/v1/blog/" + record.slug)).status(),
    ).toBe(404);
    const sitemap = await (await admin.request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/blog/" + record.slug);
    expect(
      (
        await admin.request.get(
          "/api/v1/blog-media/" +
            record.body.content.find((node) => node.type === "blogImage").attrs
              .mediaId,
        )
      ).status(),
    ).toBe(404);
    await page
      .getByRole("button", {
        name: "Cancel schedule & save draft",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Save draft", exact: true }),
    ).toBeVisible();
  } finally {
    await admin.close();
  }
});

test("a new article accepts images and Word import before its first save and stores its SEO fields", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const admin = await staff(browser),
    visitor = await browser.newContext({ baseURL: origin });
  try {
    const page = await admin.newPage(),
      photo = await png(),
      title = "Before the first save " + serial();
    await page.goto("/admin/blog/new");
    await page.getByLabel("Post title", { exact: true }).fill(title);
    await page
      .getByLabel("Short introduction", { exact: true })
      .fill("An article whose first action is adding a photo.");
    const body = page.getByRole("textbox", {
      name: "Article body",
      exact: true,
    });
    await body.fill("A reliable family car deserves a careful inspection.");
    // No "save the draft first" step: the image creates the draft itself.
    await page
      .getByLabel("Upload article image", { exact: true })
      .setInputFiles(photo);
    await describe(page, "A teal family car parked outside the showroom");
    await expect(page).toHaveURL(/\/admin\/blog\/\d+$/);
    await expect(body.locator("img")).toHaveCount(1);
    await expect(body).toContainText("careful inspection");
    const id = page.url().split("/").at(-1);
    await page
      .getByLabel("Meta title", { exact: true })
      .fill("Family car checks");
    await page
      .getByLabel("Meta description", { exact: true })
      .fill("What to inspect before buying a used family car in Delhi NCR.");
    await page
      .getByLabel("Meta keywords", { exact: true })
      .fill("used family car, Used Family Car, inspection checklist");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Draft saved" }),
    ).toBeVisible();
    const saved = await (
      await admin.request.get(`/api/v1/admin/blog/${id}`)
    ).json();
    expect(saved.title).toBe(title);
    expect(saved.seo_title).toBe("Family car checks");
    expect(saved.seo_keywords).toBe("used family car, inspection checklist");
    expect(
      saved.body.content.filter((node) => node.type === "blogImage"),
    ).toHaveLength(1);
    await page
      .getByRole("button", { name: "Publish post", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Update published post", exact: true }),
    ).toBeVisible();
    const read = await visitor.newPage();
    await read.goto("/blog/" + saved.slug);
    await expect(read).toHaveTitle(/Family car checks/);
    await expect(read.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "What to inspect before buying a used family car in Delhi NCR.",
    );
    await expect(read.locator('meta[name="keywords"]')).toHaveAttribute(
      "content",
      /used family car,\s?inspection checklist/,
    );

    // Word import with images also works on a brand-new, unsaved article.
    const fresh = await admin.newPage();
    fresh.on("dialog", (dialog) => dialog.accept());
    await fresh.goto("/admin/blog/new");
    await fresh
      .getByLabel("Import Word document", { exact: true })
      .setInputFiles(await wordFile(photo));
    await describe(fresh, "The first imported car image");
    await describe(fresh, "The second imported car image");
    const freshBody = fresh.getByRole("textbox", {
      name: "Article body",
      exact: true,
    });
    await expect(freshBody).toContainText("Imported automotive guide");
    await expect(freshBody.locator("img")).toHaveCount(2);
    await expect(fresh).toHaveURL(/\/admin\/blog\/\d+$/);
  } finally {
    await admin.close();
    await visitor.close();
  }
});
