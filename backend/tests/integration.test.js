const { test, before, after } = require("node:test");
process.env.SCRAPPA_ENABLED = "false";
process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
// Never send real password reset mail from tests, whatever backend/.env says.
process.env.RESET_DELIVERY = "disabled";
const assert = require("node:assert/strict");
const mysql = require("mysql2/promise");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const bcrypt = require("bcryptjs");
const sharp = require("sharp");
const request = require("supertest");
const dotenv = require("dotenv");
const localEnvironment = dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
}).parsed;
const original = { ...localEnvironment, ...process.env };
const testDatabase = "ncrwheelz_test_" + crypto.randomBytes(8).toString("hex");
process.env.DB_NAME = testDatabase;
process.env.STORAGE_DIR = path.join(os.tmpdir(), testDatabase);
let databaseCreated = false;
let root,
  server,
  pool,
  query,
  admin,
  seller,
  other,
  reviewer,
  sales,
  picture,
  submissionId,
  vehicleId;
const protect = (req) =>
  req.set("X-NCR-Request", "1").set("Origin", "http://localhost:3000");
async function checkQueued(kind, entityId, customer, expected = 3) {
  const rows = await query(
    "SELECT recipient,status,data FROM nw_email_outbox WHERE kind=? AND entity_id=? ORDER BY id",
    [kind, entityId],
  );
  assert.equal(rows.length, expected);
  assert.ok(rows.every((row) => row.status === "pending"));
  for (const address of [
    "ncrwheelz@gmail.com",
    "shivamchaudhary2667@gmail.com",
    customer,
  ])
    assert.equal(
      rows.filter((row) => row.recipient === address).length,
      expected / 3,
    );
  return rows;
}
const fixture = {
  type: "passenger",
  make: "TEST ONLY",
  model: "Integration Fixture",
  variant: "",
  year: 2024,
  price: 600000,
  mileage: 20000,
  fuel_economy: 18.5,
  fuel: "Petrol",
  transmission: "Manual",
  location: "Delhi",
  body_type: "Hatchback",
  owners: 1,
  description: "Temporary integration test fixture; not real inventory",
  features: [],
};
before(async () => {
  root = await mysql.createConnection({
    host: original.DB_HOST,
    port: Number(original.DB_PORT || 3306),
    user: original.DB_USER,
    password: original.DB_PASSWORD,
  });
  await root.query(
    "CREATE DATABASE `" + testDatabase + "` CHARACTER SET utf8mb4",
  );
  databaseCreated = true;
  ({ pool, query } = require("../src/config/db"));
  await require("../scripts/database").migrate();
  const { app } = require("../src/app");
  // Own the server for the whole suite. A nested request can otherwise close
  // a Supertest-managed agent server before an already-created request starts.
  server = http.createServer(app);
  await new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", onError);
      resolve();
    });
  });
  for (const role of ["admin", "reviewer", "sales"])
    await query(
      "INSERT INTO nw_users(name,email,phone,password_hash,role,consent_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP())",
      [
        role,
        role + "@example.test",
        "9999999999",
        await bcrypt.hash("integration-password-123", 12),
        role,
      ],
    );
  admin = request.agent(server);
  seller = request.agent(server);
  other = request.agent(server);
  reviewer = request.agent(server);
  sales = request.agent(server);
  for (const [agent, role] of [
    [admin, "admin"],
    [reviewer, "reviewer"],
    [sales, "sales"],
  ])
    await protect(agent.post("/api/v1/auth/login"))
      .send({
        email: role + "@example.test",
        password: "integration-password-123",
        scope: "admin",
      })
      .expect(200);
  for (const [agent, name] of [
    [seller, "seller"],
    [other, "other"],
  ])
    await protect(agent.post("/api/v1/auth/register"))
      .send({
        name,
        email: name + "@example.test",
        phone: "9999999999",
        password: "integration-password-123",
        consent: true,
      })
      .expect(201);
  picture = await sharp({
    create: { width: 40, height: 30, channels: 3, background: "#244d70" },
  })
    .jpeg()
    .toBuffer();
});
after(async () => {
  if (server?.listening)
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  if (pool) await pool.end();
  if (root && databaseCreated) {
    if (!/^ncrwheelz_test_[a-f0-9]{16}$/.test(testDatabase))
      throw new Error("Unsafe test database name");
    await root.query("DROP DATABASE IF EXISTS `" + testDatabase + "`");
    await root.end();
  }
  if (root && !databaseCreated) await root.end();
  await fs.rm(process.env.STORAGE_DIR, { recursive: true, force: true });
});
test("admin offers enforce permissions, scheduling, versions and public visibility in MySQL", async () => {
  for (const agent of [seller, reviewer, sales]) {
    await agent.get("/api/v1/admin/offers").expect(403);
    await protect(agent.post("/api/v1/admin/offers"))
      .send({ title: "Denied" })
      .expect(403);
  }
  await request(server).get("/api/v1/admin/offers").expect(401);
  const content = {
    title: "Integration offer",
    benefit: "₹10,000 off",
    description: "Disposable offer",
    eligibility: "Test vehicles",
    terms: "Test-only conditions",
    starts_at: new Date(Date.now() - 60000).toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    theme: "midnight",
    pattern: "rings",
    icon: "sparkles",
    featured: true,
  };
  let offer = (
    await protect(admin.post("/api/v1/admin/offers")).send(content).expect(201)
  ).body;
  const path = `/api/v1/admin/offers/${offer.id}`;
  const publicOffers = async () =>
    (await request(server).get("/api/v1/offers").expect(200)).body.items;
  assert.equal(
    (await publicOffers()).some((item) => item.id === offer.id),
    false,
  );
  offer = (
    await protect(admin.patch(path + "/status"))
      .send({ version: offer.version, status: "published" })
      .expect(200)
  ).body;
  const visible = (await publicOffers()).find((item) => item.id === offer.id);
  assert.equal(visible.theme, "midnight");
  assert.equal(visible.pattern, "rings");
  assert.equal(visible.version, undefined);
  assert.equal(visible.status, undefined);
  await protect(admin.delete(path)).send({ version: 1 }).expect(409);
  await protect(admin.put(path))
    .send({ ...content, status: "published", version: 1 })
    .expect(409);
  const { id: offerId, version, updated_at, ...savedContent } = offer;
  offer = (
    await protect(admin.put(path))
      .send({ ...savedContent, title: "Changed offer", version })
      .expect(200)
  ).body;
  assert.equal(
    (await publicOffers()).find((item) => item.id === offer.id).title,
    "Changed offer",
  );
  const scheduled = (
    await protect(admin.post("/api/v1/admin/offers"))
      .send({
        ...content,
        title: "Future offer",
        status: "published",
        starts_at: "2090-01-01T00:00:00Z",
        expires_at: "2090-02-01T00:00:00Z",
      })
      .expect(201)
  ).body;
  assert.equal(
    (await publicOffers()).some((item) => item.id === scheduled.id),
    false,
  );
  const listing = (
    await admin.get("/api/v1/admin/offers?status=scheduled").expect(200)
  ).body;
  assert.equal(
    listing.items.some((item) => item.id === scheduled.id),
    true,
  );
  assert.equal(listing.stats.active, 1);
  await query(
    "UPDATE nw_offers SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=?",
    [offer.id],
  );
  assert.equal(
    (await publicOffers()).some((item) => item.id === offer.id),
    false,
  );
  offer = (
    await protect(admin.patch(path + "/status"))
      .send({ version: offer.version, status: "draft" })
      .expect(200)
  ).body;
  await protect(admin.patch(path + "/status"))
    .send({ version: offer.version, status: "published" })
    .expect(422);
  await protect(admin.delete(path))
    .send({ version: offer.version })
    .expect(200);
  await protect(admin.delete(`/api/v1/admin/offers/${scheduled.id}`))
    .send({ version: scheduled.version })
    .expect(200);
  await admin.get(path).expect(404);
  assert.equal(
    (
      await query(
        "SELECT COUNT(*) AS total FROM nw_audit WHERE target_type='offer' AND target_id=?",
        [String(offer.id)],
      )
    )[0].total >= 5,
    true,
  );
});
test("admin blog drafts, covers, publication and archives enforce permissions and public visibility in MySQL", async () => {
  const content = {
    title: "Temporary blog integration article",
    slug: "integration-blog-" + crypto.randomBytes(6).toString("hex"),
    excerpt:
      "An isolated test article about choosing a used car for your daily journeys.",
    category: "buying",
    author_name: "NCR Wheelz",
    body: [
      { type: "heading", text: "Build a useful shortlist" },
      {
        type: "paragraph",
        text: "Compare vehicle condition, running costs and your daily route before deciding which used cars to visit.",
      },
    ],
  };
  await request(server).get("/api/v1/admin/blog").expect(401);
  for (const user of [seller, sales, reviewer]) {
    await user.get("/api/v1/admin/blog").expect(403);
    await protect(user.post("/api/v1/admin/blog")).send(content).expect(403);
  }
  await admin.post("/api/v1/admin/blog").send(content).expect(403);
  const created = (
    await protect(admin.post("/api/v1/admin/blog")).send(content).expect(201)
  ).body;
  const endpoint = `/api/v1/admin/blog/${created.id}`;
  const publicPath = `/api/v1/blog/${content.slug}`;
  await request(server).get(publicPath).expect(404);
  await protect(admin.post("/api/v1/admin/blog")).send(content).expect(409);
  const image = (
    await protect(admin.post(endpoint + "/media"))
      .attach("file", picture, {
        filename: "blog.png",
        contentType: "image/png",
      })
      .expect(201)
  ).body;
  await request(server).get(`/api/v1/blog-media/${image.id}`).expect(404);
  await request(server).get(image.url).expect(401);
  const privateImage = await admin.get(image.url).expect(200);
  assert.match(privateImage.headers["content-type"], /^image\/webp/);
  await protect(admin.put(endpoint))
    .send({
      ...content,
      status: "published",
      version: created.version,
      cover_id: image.id,
    })
    .expect(422);
  const draft = (
    await protect(admin.put(endpoint))
      .send({
        ...content,
        version: created.version,
        cover_id: image.id,
        cover_alt: "A car outside a showroom",
      })
      .expect(200)
  ).body;
  await request(server).get(`/api/v1/blog-media/${image.id}`).expect(404);
  const published = (
    await protect(admin.patch(endpoint + "/status"))
      .send({ status: "published", version: draft.version })
      .expect(200)
  ).body;
  const publicPost = (await request(server).get(publicPath).expect(200)).body;
  assert.equal(publicPost.title, content.title);
  for (const key of [
    "version",
    "created_by",
    "cover_id",
    "storage_key",
    "status",
  ])
    assert.equal(key in publicPost, false);
  await request(server).get(publicPost.cover.url).expect(200);
  const listing = (await request(server).get("/api/v1/blog").expect(200)).body;
  assert.equal(
    listing.items.find((post) => post.id === created.id).body,
    undefined,
  );
  assert.ok(
    (await request(server).get("/api/v1/seo/blog").expect(200)).body.items.some(
      (post) => post.slug === content.slug,
    ),
  );
  await protect(admin.put(endpoint))
    .send({ ...content, version: draft.version })
    .expect(409);
  await protect(admin.put(endpoint))
    .send({
      ...content,
      slug: "changed-public-address",
      version: published.version,
    })
    .expect(422);
  const unpublished = (
    await protect(admin.patch(endpoint + "/status"))
      .send({ status: "draft", version: published.version })
      .expect(200)
  ).body;
  await request(server).get(publicPath).expect(404);
  await request(server).get(publicPost.cover.url).expect(404);
  const restored = (
    await protect(admin.patch(endpoint + "/status"))
      .send({ status: "published", version: unpublished.version })
      .expect(200)
  ).body;
  assert.equal(restored.published_at, published.published_at);
  await protect(admin.patch(endpoint + "/status"))
    .send({ status: "archived", version: restored.version })
    .expect(200);
  await request(server).get(publicPath).expect(404);
  assert.ok(
    !(
      await request(server).get("/api/v1/seo/blog").expect(200)
    ).body.items.some((post) => post.slug === content.slug),
  );
});
test("rich blog JSON, per-use image metadata and scheduling remain consistent in MySQL", async () => {
  const content = {
    title: "Rich automotive integration article",
    slug: "integration-rich-blog-" + crypto.randomBytes(6).toString("hex"),
    excerpt: "Practical advice about inspecting a used car before a purchase.",
    author_name: "NCR Editorial Desk",
    category: "buying",
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Inspect the condition and service records before choosing a used car.",
            },
          ],
        },
      ],
    },
  };
  const create = async (data) =>
    (await protect(admin.post("/api/v1/admin/blog")).send(data).expect(201))
      .body;
  let post = await create(content);
  const endpoint = `/api/v1/admin/blog/${post.id}`;
  const publicPath = `/api/v1/blog/${content.slug}`;
  const upload = async (target) =>
    (
      await protect(admin.post(target + "/media"))
        .attach("file", picture, {
          filename: "car.jpg",
          contentType: "image/jpeg",
        })
        .expect(201)
    ).body;
  const image = await upload(endpoint);
  const otherPost = await create({ ...content, slug: content.slug + "-other" });
  const foreign = await upload(`/api/v1/admin/blog/${otherPost.id}`);
  const imageNode = (alt, mediaId = image.id) => ({
    type: "blogImage",
    attrs: {
      mediaId,
      alt,
      decorative: false,
      reviewed: true,
      caption: "An inspection guide",
      width: 75,
      align: "center",
    },
  });
  const body = {
    ...content.body,
    content: [
      ...content.body.content,
      imageNode("The car's engine bay"),
      imageNode("The inspected car from the front"),
    ],
  };
  const future = new Date(Date.now() + 86400000).toISOString();
  const save = (data, expected = 200) =>
    protect(admin.put(endpoint))
      .send({ ...content, body, version: post.version, ...data })
      .expect(expected);
  await save(
    {
      body: {
        type: "doc",
        content: [imageNode("A car uploaded to another article", foreign.id)],
      },
    },
    422,
  );
  const unreviewed = imageNode("A car awaiting review");
  unreviewed.attrs.reviewed = false;
  await save({ body: { type: "doc", content: [unreviewed] } }, 422);
  assert.equal(
    (await query("SELECT * FROM nw_blog_media_refs WHERE post_id=?", [post.id]))
      .length,
    0,
  );
  post = (await save({ status: "published", publish_at: future })).body;
  assert.equal(post.is_scheduled, true);
  assert.equal(
    (await query("SELECT * FROM nw_blog_media_refs WHERE post_id=?", [post.id]))
      .length,
    1,
  );
  assert.equal(post.body.content[1].attrs.alt, "The car's engine bay");
  assert.equal(
    post.body.content[2].attrs.alt,
    "The inspected car from the front",
  );
  await request(server).get(publicPath).expect(404);
  await request(server).get(`/api/v1/blog-media/${image.id}`).expect(404);
  const scheduled = (
    await admin.get("/api/v1/admin/blog?status=scheduled").expect(200)
  ).body;
  assert.ok(scheduled.items.some((item) => item.id === post.id));
  assert.ok(
    !(
      await request(server).get("/api/v1/seo/blog").expect(200)
    ).body.items.some((item) => item.slug === content.slug),
  );
  await query(
    "UPDATE nw_blog_posts SET published_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE),scheduled_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE id=?",
    [post.id],
  );
  const live = (await request(server).get(publicPath).expect(200)).body;
  assert.equal(live.author_name, "NCR Editorial Desk");
  assert.equal(
    live.word_count,
    require("../src/lib/blog-document").readingStats(body).words,
  );
  assert.equal(live.reading_minutes, 1);
  await request(server).get(`/api/v1/blog-media/${image.id}`).expect(200);
  await save(
    {
      version: post.version - 1,
      status: "published",
      publish_at: live.published_at,
    },
    409,
  );
  const changed = await save({
    status: "published",
    publish_at: live.published_at,
    body: content.body,
    author_name: "NCR Car Care Team",
  });
  post = changed.body;
  const updated = (await request(server).get(publicPath).expect(200)).body;
  assert.equal(updated.author_name, "NCR Car Care Team");
  assert.equal(updated.published_at, live.published_at);
  assert.ok(new Date(updated.updated_at) >= new Date(live.published_at));
  assert.equal(
    (await query("SELECT * FROM nw_blog_media_refs WHERE post_id=?", [post.id]))
      .length,
    0,
  );
  await request(server).get(`/api/v1/blog-media/${image.id}`).expect(404);
  await admin.get(image.url).expect(200);
  const library = (await admin.get(endpoint + "/media").expect(200)).body;
  assert.ok(library.items.some((asset) => asset.id === image.id));
  await protect(admin.patch(endpoint + "/status"))
    .send({ status: "archived", version: post.version })
    .expect(200);
});
test("end-to-end marketplace access and seller lifecycle", async (t) => {
  await t.test(
    "database defaults use UTC for reliable event and booking times",
    async () => {
      const [row] = await query(
        "SELECT TIMESTAMPDIFF(SECOND,NOW(),UTC_TIMESTAMP()) AS offset_seconds",
      );
      assert.equal(row.offset_seconds, 0);
    },
  );
  await t.test("CSRF and anonymous admin access are blocked", async () => {
    await request(server).post("/api/v1/auth/logout").expect(403);
    await protect(request(server).post("/api/v1/auth/logout"))
      .set("Origin", "https://evil.example")
      .expect(403);
    await request(server).get("/api/v1/admin/dashboard").expect(401);
    await seller.get("/api/v1/admin/dashboard").expect(403);
  });
  await t.test("invalid vehicle fields are rejected", async () => {
    await protect(seller.post("/api/v1/account/submissions"))
      .send({
        vehicle: { ...fixture, price: -1 },
        contact: {
          name: "Test Seller",
          email: "seller@example.test",
          phone: "9999999999",
        },
      })
      .expect(422);
  });
  await t.test(
    "seller can create private draft and another owner cannot access it",
    async () => {
      const r = await protect(seller.post("/api/v1/account/submissions"))
        .send({
          vehicle: fixture,
          contact: {
            name: "Test Seller",
            email: "seller@example.test",
            phone: "9999999999",
          },
        })
        .expect(201);
      submissionId = r.body.id;
      assert.equal(
        (
          await query(
            "SELECT COUNT(*) AS total FROM nw_email_outbox WHERE kind='seller_submission' AND entity_id=?",
            [submissionId],
          )
        )[0].total,
        0,
        "draft saves do not email anyone",
      );
      await other
        .get("/api/v1/account/submissions/" + submissionId)
        .expect(404);
      await request(server)
        .get("/api/v1/vehicles/" + submissionId)
        .expect(404);
      const list = await request(server).get("/api/v1/vehicles").expect(200);
      assert.equal(list.body.total, 0);
    },
  );
  await t.test(
    "saved seller drafts notify staff and contact tracking preserves the private editable draft",
    async () => {
      const path = `/api/v1/admin/submissions/${submissionId}/contacted`;
      await request(server).get("/api/v1/admin/seller-drafts").expect(401);
      for (const user of [seller, sales]) {
        await user.get("/api/v1/admin/seller-drafts").expect(403);
        await protect(user.post(path)).send({}).expect(403);
      }
      const queue = await admin.get("/api/v1/admin/seller-drafts").expect(200);
      assert.ok(queue.body.items.some((item) => item.id === submissionId));
      const dashboard = await admin.get("/api/v1/admin/dashboard").expect(200);
      assert.equal(dashboard.body.seller_drafts.total, queue.body.total);
      const pending = await reviewer
        .get("/api/v1/admin/submissions?status=draft&follow_up=pending")
        .expect(200);
      assert.ok(pending.body.items.some((item) => item.id === submissionId));
      await Promise.all([
        protect(admin.post(path)).send({}).expect(200),
        protect(reviewer.post(path)).send({}).expect(200),
      ]);
      const after = await admin.get("/api/v1/admin/seller-drafts").expect(200);
      assert.equal(after.body.total, queue.body.total - 1);
      const detail = await seller
        .get(`/api/v1/account/submissions/${submissionId}`)
        .expect(200);
      assert.equal(detail.body.status, "draft");
      assert.ok(detail.body.draft_contacted_at);
      assert.equal(
        detail.body.history.filter(
          (event) => event.status === "draft_contacted",
        ).length,
        1,
      );
      await protect(seller.patch(`/api/v1/account/submissions/${submissionId}`))
        .send({
          vehicle: detail.body.data,
          contact: detail.body.seller_contact,
          expected_version: detail.body.expected_version,
        })
        .expect(200);
      assert.equal(
        (await admin.get("/api/v1/admin/seller-drafts").expect(200)).body.total,
        after.body.total,
      );
      assert.equal(
        (
          await query(
            "SELECT COUNT(*) AS total FROM nw_email_outbox WHERE kind='seller_submission' AND entity_id=?",
            [submissionId],
          )
        )[0].total,
        0,
      );
    },
  );
  await t.test(
    "submission requires documents and photos; unsafe uploads fail",
    async () => {
      await protect(
        seller.post(`/api/v1/account/submissions/${submissionId}/submit`),
      )
        .send({ consent: true })
        .expect(422);
      await protect(
        seller.post(`/api/v1/account/submissions/${submissionId}/images`),
      )
        .attach("file", Buffer.from("<script>evil</script>"), {
          filename: "fake.jpg",
          contentType: "image/jpeg",
        })
        .expect(422);
      await protect(
        seller.post(`/api/v1/account/submissions/${submissionId}/images`),
      )
        .attach("file", picture, {
          filename: "test.jpg",
          contentType: "image/jpeg",
        })
        .expect(201);
      for (const type of ["rc", "ownership_authority", "insurance", "puc"])
        await protect(
          seller.post(`/api/v1/account/submissions/${submissionId}/documents`),
        )
          .field("type", type)
          .attach("file", picture, {
            filename: "test.jpg",
            contentType: "image/jpeg",
          })
          .expect(201);
    },
  );
  await t.test(
    "photo reorder is atomic across SQL failures, normalizes gaps and rejects stale photo lists",
    async () => {
      const draft = await protect(seller.post("/api/v1/account/submissions"))
        .send({
          vehicle: fixture,
          contact: {
            name: "Test",
            email: "seller@example.test",
            phone: "9999999999",
          },
        })
        .expect(201);
      const submission = draft.body.id;
      const ids = [];
      for (const order of [0, 3, 4, 5]) {
        const result = await query(
          "INSERT INTO nw_images(submission_id,storage_key,alt_text,sort_order) VALUES (?,?,?,?)",
          [submission, "reorder-test.webp", "Test photo", order],
        );
        ids.push(result.insertId);
      }
      const order = [ids[0], ids[1], ids[3], ids[2]];
      // Force the third update to fail after the second has changed order 3 to 1.
      await pool.query(
        `CREATE TRIGGER nw_reorder_failure BEFORE UPDATE ON nw_images FOR EACH ROW BEGIN IF OLD.id=${ids[3]} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Simulated reorder failure'; END IF; END`,
      );
      try {
        await protect(
          seller.patch(
            `/api/v1/account/submissions/${submission}/images/reorder`,
          ),
        )
          .send({ image_ids: order })
          .expect(500);
        assert.deepEqual(
          (
            await query(
              "SELECT sort_order FROM nw_images WHERE submission_id=? ORDER BY id",
              [submission],
            )
          ).map((image) => image.sort_order),
          [0, 3, 4, 5],
        );
      } finally {
        await pool.query("DROP TRIGGER nw_reorder_failure");
      }
      await protect(
        seller.patch(
          `/api/v1/account/submissions/${submission}/images/reorder`,
        ),
      )
        .send({ image_ids: order })
        .expect(200);
      assert.deepEqual(
        (
          await query(
            "SELECT id,sort_order FROM nw_images WHERE submission_id=? ORDER BY sort_order,id",
            [submission],
          )
        ).map((image) => [image.id, image.sort_order]),
        order.map((id, index) => [id, index]),
      );
      await protect(
        other.patch(`/api/v1/account/submissions/${submission}/images/reorder`),
      )
        .send({ image_ids: order })
        .expect(404);
      await protect(
        seller.patch(
          `/api/v1/account/submissions/${submission}/images/reorder`,
        ),
      )
        .send({ image_ids: order.slice(1) })
        .expect(409);
      await query("DELETE FROM nw_images WHERE submission_id=?", [submission]);
      await query(
        "DELETE FROM nw_history WHERE entity_type='submission' AND entity_id=?",
        [submission],
      );
      await query("DELETE FROM nw_submissions WHERE id=?", [submission]);
    },
  );
  await t.test(
    "document replacement records its latest upload without changing original creation",
    async () => {
      await query(
        "UPDATE nw_documents SET created_at='2000-01-01 00:00:00',status='accepted',reviewed_by=1 WHERE submission_id=? AND type='rc'",
        [submissionId],
      );
      await protect(
        seller.post(`/api/v1/account/submissions/${submissionId}/documents`),
      )
        .field("type", "rc")
        .attach("file", picture, {
          filename: "replacement.jpg",
          contentType: "image/jpeg",
        })
        .expect(201);
      const view = await seller
        .get(`/api/v1/account/submissions/${submissionId}`)
        .expect(200);
      const rc = view.body.documents.find((document) => document.type === "rc");
      assert.equal(rc.status, "pending");
      assert.equal(rc.created_at, "2000-01-01 00:00:00");
      assert.ok(rc.uploaded_at > "2000-01-01 00:00:00");
    },
  );
  await t.test(
    "private photos and documents cannot leak through public media or other accounts",
    async () => {
      const r = await seller
        .get(`/api/v1/account/submissions/${submissionId}`)
        .expect(200);
      const photo = r.body.images[0].id,
        doc = r.body.documents[0].id;
      await request(server)
        .get("/api/v1/media/" + photo)
        .expect(404);
      await other.get("/api/v1/private-images/" + photo).expect(404);
      await sales.get("/api/v1/private-images/" + photo).expect(404);
      await other
        .get(`/api/v1/account/submissions/${submissionId}/documents/${doc}`)
        .expect(404);
      await seller
        .get(`/api/v1/account/submissions/${submissionId}/documents/${doc}`)
        .expect(200);
      await sales
        .get(`/api/v1/account/submissions/${submissionId}/documents/${doc}`)
        .expect(404);
    },
  );
  await t.test(
    "submitted vehicle remains private and cannot be edited or published",
    async () => {
      await protect(
        seller.post(`/api/v1/account/submissions/${submissionId}/submit`),
      )
        .send({ consent: true })
        .expect(200);
      await checkQueued(
        "seller_submission",
        submissionId,
        "seller@example.test",
      );
      await protect(
        seller.post(`/api/v1/account/submissions/${submissionId}/submit`),
      )
        .send({ consent: true })
        .expect(409);
      await checkQueued(
        "seller_submission",
        submissionId,
        "seller@example.test",
      );
      await protect(seller.patch(`/api/v1/account/submissions/${submissionId}`))
        .send({
          vehicle: fixture,
          contact: {
            name: "Test",
            email: "seller@example.test",
            phone: "9999999999",
          },
        })
        .expect(409);
      await protect(
        admin.post(`/api/v1/admin/submissions/${submissionId}/publish`),
      )
        .send({})
        .expect(409);
      await protect(
        reviewer.post(`/api/v1/admin/submissions/${submissionId}/review`),
      )
        .send({
          status: "approved",
          note: "Review",
          expected_version: (
            await reviewer.get(`/api/v1/admin/submissions/${submissionId}`)
          ).body.expected_version,
        })
        .expect(409);
    },
  );
  await t.test(
    "request more information and resubmit the same submission",
    async () => {
      await protect(
        reviewer.post(`/api/v1/admin/submissions/${submissionId}/review`),
      )
        .send({
          status: "information_required",
          note: "Please provide a clearer RC",
          expected_version: (
            await reviewer.get(`/api/v1/admin/submissions/${submissionId}`)
          ).body.expected_version,
        })
        .expect(200);
      await protect(
        seller.post(`/api/v1/account/submissions/${submissionId}/documents`),
      )
        .field("type", "rc")
        .attach("file", picture, {
          filename: "test.jpg",
          contentType: "image/jpeg",
        })
        .expect(201);
      await protect(
        seller.post(`/api/v1/account/submissions/${submissionId}/submit`),
      )
        .send({ consent: true })
        .expect(200);
      await checkQueued(
        "seller_submission",
        submissionId,
        "seller@example.test",
        6,
      );
      const r = await seller.get("/api/v1/account/submissions").expect(200);
      assert.equal(r.body.items.length, 1);
    },
  );
  await t.test(
    "document acceptance permits approval but does not publish",
    async () => {
      const r = await reviewer
        .get(`/api/v1/admin/submissions/${submissionId}`)
        .expect(200);
      for (const d of r.body.documents)
        await protect(reviewer.post(`/api/v1/admin/documents/${d.id}/review`))
          .send({
            status: "accepted",
            note: "Manual review completed in test fixture",
          })
          .expect(200);
      await protect(
        reviewer.post(`/api/v1/admin/submissions/${submissionId}/review`),
      )
        .send({
          status: "approved",
          note: "Approved for publication",
          expected_version: (
            await reviewer.get(`/api/v1/admin/submissions/${submissionId}`)
          ).body.expected_version,
        })
        .expect(200);
      assert.equal(
        (await request(server).get("/api/v1/vehicles")).body.total,
        0,
      );
      await protect(
        reviewer.post(`/api/v1/admin/submissions/${submissionId}/publish`),
      )
        .send({})
        .expect(403);
    },
  );
  await t.test(
    "admin corrects seller price before publication and stale reviews cannot approve the old details",
    async () => {
      const original = (
        await admin.get(`/api/v1/admin/submissions/${submissionId}`).expect(200)
      ).body;
      const body = {
        vehicle: {
          ...fixture,
          price: 450000,
          description: "Adjusted after condition inspection",
        },
        expected_version: original.expected_version,
      };
      for (const agent of [seller, other, sales, reviewer])
        await protect(agent.patch(`/api/v1/admin/submissions/${submissionId}`))
          .send(body)
          .expect(403);
      await protect(admin.patch(`/api/v1/admin/submissions/${submissionId}`))
        .send(body)
        .expect(200);
      const owner = (
        await seller
          .get(`/api/v1/account/submissions/${submissionId}`)
          .expect(200)
      ).body;
      assert.equal(owner.data.price, 450000);
      assert.equal(owner.status, "under_review");
      assert.equal(owner.approved_by, null);
      assert.match(owner.history.at(-1).note, /450,000|4,50,000/);
      await protect(admin.patch(`/api/v1/admin/submissions/${submissionId}`))
        .send(body)
        .expect(409);
      await protect(
        reviewer.post(`/api/v1/admin/submissions/${submissionId}/review`),
      )
        .send({
          status: "approved",
          note: "Old review",
          expected_version: original.expected_version,
        })
        .expect(409);
      await protect(
        admin.post(`/api/v1/admin/submissions/${submissionId}/publish`),
      )
        .send({})
        .expect(409);
      await protect(
        reviewer.post(`/api/v1/admin/submissions/${submissionId}/review`),
      )
        .send({
          status: "approved",
          note: "Rechecked adjusted price and details",
          expected_version: owner.expected_version,
        })
        .expect(200);
    },
  );
  await t.test(
    "sales can inspect approved publication candidates without private seller data",
    async () => {
      const queue = await sales.get("/api/v1/admin/publishing").expect(200);
      assert.equal(queue.body.items.length, 1);
      const candidate = queue.body.items[0];
      assert.equal(candidate.id, submissionId);
      assert.equal(candidate.data.make, fixture.make);
      assert.doesNotMatch(
        JSON.stringify(candidate),
        /seller_contact|seller_id|documents|storage_key/,
      );
      await sales.get(candidate.images[0].url).expect(200);
      const details = await reviewer
        .get(`/api/v1/admin/submissions/${submissionId}`)
        .expect(200);
      await sales
        .get(
          `/api/v1/account/submissions/${submissionId}/documents/${details.body.documents[0].id}`,
        )
        .expect(404);
      await seller.get("/api/v1/admin/publishing").expect(403);
      await reviewer.get("/api/v1/admin/publishing").expect(403);
    },
  );
  await t.test(
    "deliberate admin publication exposes only approved public fields and media",
    async () => {
      const r = await protect(
        admin.post(`/api/v1/admin/submissions/${submissionId}/publish`),
      )
        .send({})
        .expect(200);
      vehicleId = r.body.id;
      const v = await request(server)
        .get("/api/v1/vehicles/" + vehicleId)
        .expect(200);
      assert.equal(v.body.make, "TEST ONLY");
      assert.equal(v.body.price, 450000);
      assert.equal(v.body.mileage, 20000);
      assert.equal(v.body.fuel_economy, 18.5);
      assert.equal(v.body.seller_contact, undefined);
      assert.equal(v.body.documents, undefined);
      assert.ok(!JSON.stringify(v.body).includes("storage_key"));
      await request(server).get(v.body.images[0].url).expect(200);
      const s = await seller
        .get("/api/v1/account/submissions/" + submissionId)
        .expect(200);
      assert.equal(s.body.status, "published");
      assert.ok(s.body.history.length >= 7);
    },
  );
  await t.test(
    "edited seller-linked inventory requires a fresh approval",
    async () => {
      await protect(admin.post(`/api/v1/admin/vehicles/${vehicleId}/status`))
        .send({ status: "draft" })
        .expect(200);
      await protect(sales.patch(`/api/v1/admin/vehicles/${vehicleId}`))
        .send({ ...fixture, price: 650000 })
        .expect(200);
      await protect(
        sales.post(`/api/v1/admin/submissions/${submissionId}/publish`),
      )
        .send({})
        .expect(409);
      const originalPhotos = (
        await sales.get(`/api/v1/admin/vehicles/${vehicleId}`)
      ).body.images;
      for (const image of originalPhotos)
        await protect(
          sales.delete(
            `/api/v1/admin/vehicles/${vehicleId}/images/${image.id}`,
          ),
        ).expect(200);
      await protect(sales.post(`/api/v1/admin/vehicles/${vehicleId}/images`))
        .attach("file", picture, {
          filename: "replacement.jpg",
          contentType: "image/jpeg",
        })
        .expect(201);
      const ownerView = (
        await seller.get(`/api/v1/account/submissions/${submissionId}`)
      ).body;
      assert.equal(ownerView.data.price, 650000);
      assert.equal(ownerView.images.length, 1);
      await seller.get(ownerView.images[0].url).expect(200);
      await other.get(ownerView.images[0].url).expect(404);
      await protect(admin.post(`/api/v1/admin/vehicles/${vehicleId}/approve`))
        .send({
          expected_version: (
            await sales.get(`/api/v1/admin/vehicles/${vehicleId}`)
          ).body.expected_version,
        })
        .expect(200);
      await protect(
        admin.post(`/api/v1/admin/submissions/${submissionId}/publish`),
      )
        .send({})
        .expect(200);
    },
  );
  await t.test("filters use parameters and match vehicle types", async () => {
    const r = await request(server)
      .get("/api/v1/vehicles?type=commercial")
      .expect(200);
    assert.equal(r.body.total, 0);
    const attack = await request(server)
      .get("/api/v1/vehicles")
      .query({ q: "' OR 1=1 --" })
      .expect(200);
    assert.equal(attack.body.total, 0);
    await request(server).get("/api/v1/vehicles?sort=sql").expect(422);
  });
  await t.test(
    "favourites, enquiries and test drives persist with owner isolation",
    async () => {
      await protect(seller.put("/api/v1/account/favourites/" + vehicleId))
        .send({})
        .expect(200);
      assert.equal(
        (await seller.get("/api/v1/account/favourites")).body.items.length,
        1,
      );
      assert.equal(
        (await other.get("/api/v1/account/favourites")).body.items.length,
        0,
      );
      const emailedEnquiry = await protect(seller.post("/api/v1/enquiries"))
        .send({
          name: "Test",
          email: "seller@example.test",
          phone: "9999999999",
          message: "Fixture enquiry",
          consent: true,
          consent_version: "contact-2026-10-21",
          vehicle_id: vehicleId,
        })
        .expect(201);
      await checkQueued(
        "enquiry",
        emailedEnquiry.body.id,
        "seller@example.test",
      );
      const emailedDrive = await protect(
        seller.post("/api/v1/account/test-drives"),
      )
        .send({
          name: "Test",
          email: "seller@example.test",
          phone: "9999999999",
          vehicle_id: vehicleId,
          preferred_at: new Date(Date.now() + 864e5).toISOString(),
          notes: "Fixture drive",
          consent: true,
          consent_version: "contact-2026-10-21",
        })
        .expect(201);
      await checkQueued(
        "test_drive",
        emailedDrive.body.id,
        "seller@example.test",
      );
      assert.equal(
        (await seller.get("/api/v1/account/enquiries")).body.items.length,
        1,
      );
      assert.equal(
        (await other.get("/api/v1/account/enquiries")).body.items.length,
        0,
      );
      assert.equal(
        (await other.get("/api/v1/account/test-drives")).body.items.length,
        0,
      );
    },
  );
  await t.test(
    "roles restrict review, settings and staff management",
    async () => {
      await sales.get("/api/v1/admin/submissions").expect(403);
      await reviewer.get("/api/v1/admin/leads").expect(403);
      await sales.get("/api/v1/admin/users").expect(403);
      await sales.get("/api/v1/admin/settings").expect(403);
      const r = await admin.get("/api/v1/admin/dashboard").expect(200);
      assert.equal(r.body.inventory.available, 1);
      assert.equal(r.body.leads.new_leads, 1);
    },
  );
  await t.test(
    "sold listings leave public API and saved vehicles show unavailable",
    async () => {
      await protect(admin.post(`/api/v1/admin/vehicles/${vehicleId}/status`))
        .send({ status: "sold" })
        .expect(200);
      await request(server)
        .get("/api/v1/vehicles/" + vehicleId)
        .expect(404);
      assert.equal(
        (await seller.get("/api/v1/account/favourites")).body.items[0]
          .unavailable,
        true,
      );
      await protect(admin.post(`/api/v1/admin/vehicles/${vehicleId}/status`))
        .send({ status: "published" })
        .expect(409);
    },
  );
  await t.test(
    "consent is enforced and an expired access session cannot create an anonymous enquiry",
    async () => {
      const payload = {
        name: "Test",
        email: "seller@example.test",
        phone: "9999999999",
        message: "Linked enquiry",
        consent: true,
        consent_version: "contact-2026-10-21",
      };
      await protect(request(server).post("/api/v1/enquiries"))
        .send({ ...payload, consent: false })
        .expect(422);
      const login = await protect(request(server).post("/api/v1/auth/login"))
        .send({
          email: "seller@example.test",
          password: "integration-password-123",
        })
        .expect(200);
      const refresh = login.headers["set-cookie"]
        .find((cookie) => cookie.startsWith("nw_refresh="))
        .split(";")[0];
      const missingAccess = await protect(
        request(server).post("/api/v1/enquiries"),
      )
        .set("Cookie", refresh)
        .send(payload)
        .expect(401);
      assert.equal(missingAccess.body.error.code, "SESSION_EXPIRED");
      const rotated = await protect(
        request(server).post("/api/v1/auth/refresh"),
      )
        .set("Cookie", refresh)
        .send({})
        .expect(200);
      const cookies = rotated.headers["set-cookie"]
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
      const enquiry = await protect(request(server).post("/api/v1/enquiries"))
        .set("Cookie", cookies)
        .send(payload)
        .expect(201);
      await checkQueued("contact", enquiry.body.id, "seller@example.test");
      const [row] = await query(
        "SELECT user_id,consent_at,consent_version FROM nw_leads WHERE id=?",
        [enquiry.body.id],
      );
      assert.ok(row.user_id);
      assert.ok(row.consent_at);
      assert.equal(row.consent_version, payload.consent_version);
    },
  );
  await t.test(
    "reviewer inventory queue supports sales drafts and protects live photos",
    async () => {
      const created = await protect(sales.post("/api/v1/admin/vehicles"))
        .send({ ...fixture, model: "Review queue fixture" })
        .expect(201);
      const id = created.body.id;
      const upload = () =>
        protect(sales.post(`/api/v1/admin/vehicles/${id}/images`)).attach(
          "file",
          picture,
          { filename: "fixture.jpg", contentType: "image/jpeg" },
        );
      await upload().expect(201);
      const queue = await reviewer
        .get("/api/v1/admin/inventory-reviews")
        .expect(200);
      assert.ok(queue.body.items.some((item) => item.id === id));
      await reviewer.get("/api/v1/admin/vehicles").expect(403);
      const inspected = queue.body.items.find(
        (item) => item.id === id,
      ).expected_version;
      await protect(sales.patch(`/api/v1/admin/vehicles/${id}`))
        .send({ ...fixture, model: "Changed after inspection" })
        .expect(200);
      await protect(reviewer.post(`/api/v1/admin/vehicles/${id}/approve`))
        .send({ expected_version: inspected })
        .expect(409);
      await protect(reviewer.post(`/api/v1/admin/vehicles/${id}/approve`))
        .send({
          expected_version: (await sales.get(`/api/v1/admin/vehicles/${id}`))
            .body.expected_version,
        })
        .expect(200);
      await upload().expect(201);
      assert.equal(
        (await sales.get(`/api/v1/admin/vehicles/${id}`)).body.approved,
        0,
      );
      await protect(sales.post(`/api/v1/admin/vehicles/${id}/status`))
        .send({ status: "published" })
        .expect(409);
      await protect(reviewer.post(`/api/v1/admin/vehicles/${id}/approve`))
        .send({
          expected_version: (await sales.get(`/api/v1/admin/vehicles/${id}`))
            .body.expected_version,
        })
        .expect(200);
      await protect(sales.post(`/api/v1/admin/vehicles/${id}/status`))
        .send({ status: "published" })
        .expect(200);
      const listing = (await sales.get(`/api/v1/admin/vehicles/${id}`)).body;
      const firstImage = listing.images[0].id;
      await protect(
        sales.delete(`/api/v1/admin/vehicles/${id}/images/${firstImage}`),
      ).expect(409);
      await protect(
        sales.patch(`/api/v1/admin/vehicles/${id}/images/${firstImage}`),
      )
        .send({ alt_text: "Updated", sort_order: 0 })
        .expect(409);
      await upload().expect(409);
      await protect(sales.post(`/api/v1/admin/vehicles/${id}/status`))
        .send({ status: "reserved" })
        .expect(200);
      await protect(sales.post(`/api/v1/admin/vehicles/${id}/status`))
        .send({ status: "draft" })
        .expect(200);
      for (const image of listing.images)
        await protect(
          sales.delete(`/api/v1/admin/vehicles/${id}/images/${image.id}`),
        ).expect(200);
      await protect(reviewer.post(`/api/v1/admin/vehicles/${id}/approve`))
        .send({
          expected_version: (await sales.get(`/api/v1/admin/vehicles/${id}`))
            .body.expected_version,
        })
        .expect(422);
    },
  );
  await t.test(
    "confirmed appointments accept note-only updates without losing their schedule",
    async () => {
      const [drive] = (await sales.get("/api/v1/admin/test-drives")).body.items;
      const confirmed = new Date(Date.now() + 86400000).toISOString();
      await protect(sales.patch(`/api/v1/admin/test-drives/${drive.id}`))
        .send({
          status: "confirmed",
          confirmed_at: confirmed,
          internal_note: "Confirmed",
        })
        .expect(200);
      await protect(sales.patch(`/api/v1/admin/test-drives/${drive.id}`))
        .send({
          status: "confirmed",
          confirmed_at: null,
          internal_note: "Note only",
        })
        .expect(200);
      const updated = (await seller.get("/api/v1/account/test-drives")).body
        .items[0];
      assert.equal(
        updated.confirmed_at,
        confirmed.slice(0, 19).replace("T", " "),
      );
      assert.equal(updated.internal_note, undefined);
      await protect(sales.patch(`/api/v1/admin/test-drives/${drive.id}`))
        .send({
          status: "rescheduled",
          confirmed_at: null,
          internal_note: "Missing new time",
        })
        .expect(422);
    },
  );
  await t.test(
    "staff reset accepts six characters, rejects five and preserves the token after validation failure",
    async () => {
      const [user] = await query(
        "SELECT * FROM nw_users WHERE email='reviewer@example.test'",
      );
      const link = await require("../src/routes/auth").createReset(user);
      const token = new URL(link).searchParams.get("token");
      await protect(request(server).post("/api/v1/auth/reset-password"))
        .send({ token, password: "five5" })
        .expect(422);
      await protect(request(server).post("/api/v1/auth/reset-password"))
        .send({ token, password: "six123" })
        .expect(200);
      await reviewer.get("/api/v1/auth/me").expect(401);
    },
  );
  await t.test(
    "public settings save explicitly activates contact overrides",
    async () => {
      const current = (await admin.get("/api/v1/admin/settings")).body;
      await protect(admin.put("/api/v1/admin/settings"))
        .send({
          ...current,
          phone: "9999999999",
          phone_secondary: "8888888888",
          email: "updated@example.test",
          hours: "10 AM to 6 PM",
          map_embed: "",
        })
        .expect(200);
      const settings = (await request(server).get("/api/v1/settings")).body;
      assert.equal(settings.contact_customized, true);
      assert.equal(settings.email, "updated@example.test");
    },
  );
  await t.test(
    "refresh tokens rotate and replay revokes the token family",
    async () => {
      const r = await protect(request(server).post("/api/v1/auth/login"))
        .send({
          email: "other@example.test",
          password: "integration-password-123",
        })
        .expect(200);
      const old = r.headers["set-cookie"]
        .find((c) => c.startsWith("nw_refresh="))
        .split(";")[0];
      const n = await protect(request(server).post("/api/v1/auth/refresh"))
        .set("Cookie", old)
        .send({})
        .expect(200);
      const fresh = n.headers["set-cookie"]
        .find((c) => c.startsWith("nw_refresh="))
        .split(";")[0];
      assert.notEqual(old, fresh);
      assert.ok(n.headers["set-cookie"].every((c) => c.includes("Path=/;")));
      await protect(request(server).post("/api/v1/auth/refresh"))
        .set("Cookie", old)
        .send({})
        .expect(401);
      await protect(request(server).post("/api/v1/auth/refresh"))
        .set("Cookie", fresh)
        .send({})
        .expect(401);
    },
  );
  await t.test(
    "password reset is single use and revokes sessions",
    async () => {
      const [u] = await query(
        "SELECT * FROM nw_users WHERE email='seller@example.test'",
      );
      const link = await require("../src/routes/auth").createReset(u);
      const token = new URL(link).searchParams.get("token");
      await protect(request(server).post("/api/v1/auth/reset-password"))
        .send({ token, password: "new-integration-password" })
        .expect(200);
      await protect(request(server).post("/api/v1/auth/reset-password"))
        .send({ token, password: "new-integration-password" })
        .expect(400);
      await seller.get("/api/v1/auth/me").expect(401);
      await protect(request(server).post("/api/v1/auth/forgot-password"))
        .send({ email: "unknown@example.test" })
        .expect(503);
    },
  );
  await t.test(
    "explicit sample inventory is repeatable, visible locally and reversible without deleting real records",
    async () => {
      const { manageSamples } = require("../src/lib/sample-inventory");
      const connection = await pool.getConnection();
      try {
        const {
          nonSampleWhere,
          publicPredicate,
        } = require("../src/routes/public");
        for (const [data, expected] of [
          [{}, 1],
          [{ is_sample: false }, 1],
          [{ is_sample: true }, 0],
        ]) {
          const [flag] = await query(
            `SELECT ${nonSampleWhere} AS visible FROM (SELECT CAST(? AS JSON) AS data) AS sample_flag`,
            [JSON.stringify(data)],
            connection,
          );
          assert.equal(
            Number(flag.visible),
            expected,
            `Sample filter failed for ${JSON.stringify(data)}`,
          );
        }
        const controlData = require("../src/lib/core").vehicleSchema.parse({
          ...fixture,
          model: "Ordinary SEO control",
        });
        const controlId = await require("../src/routes/admin").saveVehicle(
          controlData,
          connection,
        );
        await query(
          "UPDATE nw_vehicles SET approved=TRUE,status='published' WHERE id=?",
          [controlId],
          connection,
        );
        const result = await manageSamples(connection, {
          action: "add",
          storage: process.env.STORAGE_DIR,
        });
        assert.equal(result.added.length, 6);
        const inventory = await request(server)
          .get("/api/v1/vehicles?limit=24")
          .expect(200);
        assert.equal(
          inventory.body.items.filter((vehicle) => vehicle.is_sample).length,
          6,
        );
        const sample = inventory.body.items.find(
          (vehicle) => vehicle.is_sample,
        );
        assert.equal(sample.images.length, 2);
        await request(server).get(sample.images[0].url).expect(200);
        const rerun = await manageSamples(connection, {
          action: "add",
          storage: process.env.STORAGE_DIR,
        });
        assert.equal(rerun.added.length, 0);
        const seo = await request(server)
          .get("/api/v1/seo/listings")
          .expect(200);
        const sampleIds = new Set(result.added.map((sample) => sample.id));
        assert.ok(
          seo.body.items.some((vehicle) => vehicle.id === controlId),
          "SEO feed must retain ordinary published inventory",
        );
        assert.deepEqual(
          seo.body.items
            .filter((vehicle) => sampleIds.has(vehicle.id))
            .map((vehicle) => vehicle.id),
          [],
          "Sample vehicles must not appear in the SEO feed",
        );
        const control = seo.body.items.find(
          (vehicle) => vehicle.id === controlId,
        );
        assert.ok(Array.isArray(control.images));
        assert.ok(
          control.images.every((url) => /^\/api\/v1\/media\/\d+$/.test(url)),
          "Sitemap image URLs must be public media routes",
        );
        const lookup = await request(server)
          .get(`/api/v1/seo/listings/${controlId}`)
          .expect(200);
        assert.deepEqual(lookup.body, { id: controlId, slug: control.slug });
        await request(server).get("/api/v1/seo/listings/999999999").expect(404);
        const productionInventory = await query(
          "SELECT id FROM nw_vehicles WHERE " + publicPredicate(true),
          [],
          connection,
        );
        assert.ok(
          productionInventory.some((vehicle) => vehicle.id === controlId),
          "Production filter must retain ordinary published inventory",
        );
        assert.deepEqual(
          productionInventory.filter((vehicle) => sampleIds.has(vehicle.id)),
          [],
          "Production filter must exclude samples",
        );
        const archived = await manageSamples(connection, {
          action: "archive",
          storage: process.env.STORAGE_DIR,
        });
        assert.equal(archived.archived.length, 6);
        await request(server).get(`/api/v1/vehicles/${sample.id}`).expect(404);
        const [original] = await query(
          "SELECT status FROM nw_vehicles WHERE id=?",
          [vehicleId],
        );
        assert.equal(original.status, "sold");
        const [controlStatus] = await query(
          "SELECT status FROM nw_vehicles WHERE id=?",
          [controlId],
          connection,
        );
        assert.equal(controlStatus.status, "published");
      } finally {
        connection.release();
      }
    },
  );
});

test("valuation uses only real recent comparable public inventory and does not require an account", async () => {
  const { saveVehicle } = require("../src/routes/admin");
  const { vehicleSchema } = require("../src/lib/core");
  const details = vehicleSchema.parse({
    ...fixture,
    model: "Valuation integration fixture",
    variant: "VXi",
    year: 2020,
    mileage: 40000,
    location: "New Delhi",
  });
  const ids = [];
  for (const price of [400000, 450000, 500000]) {
    const id = await saveVehicle({ ...details, price });
    ids.push(id);
    await query(
      "UPDATE nw_vehicles SET approved=TRUE,status='published' WHERE id=?",
      [id],
    );
  }
  const input = Object.fromEntries(
    [
      "make",
      "model",
      "variant",
      "year",
      "mileage",
      "fuel",
      "transmission",
      "owners",
      "location",
    ].map((key) => [key, details[key]]),
  );
  const check = (purpose = "sell") =>
    protect(request(server).post("/api/v1/valuation")).send({
      ...input,
      purpose,
    });
  let result = (await check().expect(200)).body;
  assert.deepEqual(result.range, { low: 400000, high: 500000, median: 450000 });
  assert.equal(result.count, 3);
  assert.deepEqual((await check("buy").expect(200)).body.range, result.range);
  const catalogue = (
    await request(server).get("/api/v1/valuation/options").expect(200)
  ).body;
  assert.ok(catalogue.items.some((item) => item.model === details.model));
  const carOption = catalogue.items.find(
    (item) => item.model === details.model,
  );
  assert.equal(carOption.fuel, details.fuel);
  assert.equal(carOption.transmission, details.transmission);
  const privateModel = "Unpublished taxonomy fixture";
  await saveVehicle({ ...details, model: privateModel });
  const sellerOptions = (
    await request(server)
      .get("/api/v1/vehicle-options?type=passenger")
      .expect(200)
  ).body;
  assert.ok(
    sellerOptions.items.some(
      (item) => item.model === details.model && item.year === details.year,
    ),
  );
  assert.ok(!sellerOptions.items.some((item) => item.model === privateModel));
  for (const item of sellerOptions.items)
    assert.deepEqual(Object.keys(item).sort(), [
      "make",
      "model",
      "variant",
      "year",
    ]);
  const commercialOptions = (
    await request(server)
      .get("/api/v1/vehicle-options?type=commercial")
      .expect(200)
  ).body;
  assert.ok(
    !commercialOptions.items.some((item) => item.model === details.model),
  );
  assert.equal(commercialOptions.market_enabled, false);
  await request(server).get("/api/v1/vehicle-options?type=invalid").expect(422);
  await query(
    "UPDATE nw_vehicles SET data=JSON_SET(data,'$.is_sample',TRUE) WHERE id=?",
    [ids[0]],
  );
  result = (await check().expect(200)).body;
  assert.equal(result.status, "available");
  assert.equal(result.count, 2);
  assert.equal(result.minimum_comparables, 1);
  assert.equal(result.range_method, "estimated_band");
  assert.deepEqual(result.range, { low: 427000, high: 523000, median: 475000 });
  await query(
    "UPDATE nw_vehicles SET updated_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 100 DAY) WHERE id=?",
    [ids[1]],
  );
  result = (await check().expect(200)).body;
  assert.equal(result.count, 1);
  assert.deepEqual(result.range, { low: 450000, high: 550000, median: 500000 });
  await query("UPDATE nw_vehicles SET status='draft' WHERE id=?", [ids[2]]);
  result = (await check().expect(200)).body;
  assert.equal(result.count, 0);
  assert.deepEqual(result.comparables, []);
  await protect(request(server).post("/api/v1/valuation"))
    .send({ ...input, purpose: "sell", mileage: -1 })
    .expect(422);
  for (const [index, id] of ids.entries()) {
    await query(
      "UPDATE nw_vehicles SET data=JSON_REMOVE(JSON_SET(data,'$.owners',?),'$.is_sample'),status='published',updated_at=UTC_TIMESTAMP() WHERE id=?",
      [4 + index, id],
    );
  }
  const grouped = await protect(request(server).post("/api/v1/valuation"))
    .send({ ...input, purpose: "sell", owners: 4, owners_at_least: true })
    .expect(200);
  assert.equal(grouped.body.count, 3);
  assert.deepEqual(grouped.body.range, {
    low: 400000,
    high: 500000,
    median: 450000,
  });
  const exact = await protect(request(server).post("/api/v1/valuation"))
    .send({ ...input, purpose: "sell", owners: 4 })
    .expect(200);
  assert.equal(exact.body.count, 3);
  assert.equal(exact.body.comparables[0].owners, 4);
  assert.deepEqual(exact.body.range, grouped.body.range);
});

test("email outbox and its request roll back together without dispatching mail", async () => {
  const [beforeLeads] = await query("SELECT COUNT(*) AS total FROM nw_leads");
  const [beforeMail] = await query(
    "SELECT COUNT(*) AS total FROM nw_email_outbox",
  );
  const failure = new Error("Roll back queued notification");
  await assert.rejects(
    require("../src/config/db").transaction(async (connection) => {
      const result = await query(
        "INSERT INTO nw_leads(name,email,phone,message) VALUES (?,?,?,?)",
        [
          "Rollback fixture",
          "rollback@example.test",
          "9999999999",
          "Never send this",
        ],
        connection,
      );
      await require("../src/lib/notifications").enqueueNotification(
        {
          kind: "contact",
          id: result.insertId,
          contact: {
            name: "Rollback fixture",
            email: "rollback@example.test",
            phone: "9999999999",
          },
          message: "Never send this",
        },
        connection,
      );
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.equal(
    (await query("SELECT COUNT(*) AS total FROM nw_leads"))[0].total,
    beforeLeads.total,
  );
  assert.equal(
    (await query("SELECT COUNT(*) AS total FROM nw_email_outbox"))[0].total,
    beforeMail.total,
  );
  assert.equal(
    (
      await query(
        "SELECT COUNT(*) AS total FROM nw_email_outbox WHERE status='sent'",
      )
    )[0].total,
    0,
    "integration tests never start SMTP delivery",
  );
});
