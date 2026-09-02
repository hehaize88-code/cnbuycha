import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { File } from "node:buffer";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/index.js";
import { hashPassword } from "../src/security.js";

class D1Statement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.bindings = [];
  }

  bind(...values) {
    const statement = new D1Statement(this.database, this.sql);
    statement.bindings = values;
    return statement;
  }

  async all() {
    const results = this.database.prepare(this.sql).all(...this.bindings);
    return { success: true, results };
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.bindings) || null;
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.bindings);
    return { success: true, meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } };
  }
}

class D1Mock {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new D1Statement(this.database, sql);
  }

  async batch(statements) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

function testDatabase() {
  const database = new DatabaseSync(":memory:");
  const migrationsDir = path.resolve("migrations");
  for (const filename of fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
    database.exec(fs.readFileSync(path.join(migrationsDir, filename), "utf8"));
  }
  return database;
}

test("restored storefront and admin product workflow", async () => {
  const database = testDatabase();
  const password = "LocalTest-Cnbuycha-2026!";
  const env = {
    DB: new D1Mock(database),
    ASSETS: { fetch: async () => new Response("asset", { status: 200 }) },
    MEDIA: { fetch: async () => new Response("legacy-image", { headers: { "Content-Type": "image/jpeg" } }) },
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD_HASH: await hashPassword(password, 10000, new Uint8Array(16).fill(3)),
    SESSION_SECRET: "integration-test-session-secret-32-characters",
  };
  const pending = [];
  const ctx = { waitUntil: (promise) => pending.push(promise) };

  let response = await worker.fetch(new Request("https://www.cnbuycha.com/app.js?v=5"), env, ctx);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /application\/javascript/);
  assert.match(await response.text(), /data-product-gallery/);

  response = await worker.fetch(new Request("https://www.cnbuycha.com/site.css?v=5"), env, ctx);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /text\/css/);
  const siteCss = await response.text();
  assert.match(siteCss, /\.gallery-track/);
  assert.match(siteCss, /grid-template-columns: repeat\(3, minmax\(0,1fr\)\)/);

  response = await worker.fetch(new Request("https://www.cnbuycha.com/"), env, ctx);
  assert.equal(response.status, 200);
  let body = await response.text();
  assert.match(body, /Latest Products/);
  assert.match(body, /Cnbuy/);
  const latest = database.prepare("SELECT main_image, price FROM products WHERE status = 1 ORDER BY created_at DESC, id DESC LIMIT 1").get();
  assert.ok(body.includes(`src="${latest.main_image}"`));
  assert.ok(body.includes(`>${(Number(latest.price) / 7.2).toFixed(2)}<`));
  assert.doesNotMatch(body, /data-src=/);

  const sample = database.prepare("SELECT p.id, p.price, p.main_image, c.slug FROM products p JOIN categories c ON c.id = p.category_id WHERE p.status = 1 ORDER BY p.id DESC LIMIT 1").get();
  response = await worker.fetch(new Request(`https://www.cnbuycha.com/${sample.slug}/${sample.id}.html`), env, ctx);
  assert.equal(response.status, 200);
  body = await response.text();
  assert.match(body, /Select Purchase Platform/);
  assert.match(body, /data-product-gallery/);
  assert.match(body, /data-gallery-track/);
  assert.match(body, /data-gallery-slide/);
  assert.match(body, /data-gallery-index="0"/);
  assert.match(body, /aria-label="Previous product image"/);
  assert.match(body, /Swipe or drag/);
  assert.match(body, /\/app\.js\?v=5/);
  assert.ok(body.includes(`>${(Number(sample.price) / 7.2).toFixed(2)}<`));
  await Promise.all(pending);

  response = await worker.fetch(new Request("https://www.cnbuycha.com/yc.php"), env, ctx);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /后台登录/);

  const loginBody = new URLSearchParams({ username: "admin", password });
  response = await worker.fetch(new Request("https://www.cnbuycha.com/yc.php/login", { method: "POST", body: loginBody }), env, ctx);
  assert.equal(response.status, 303);
  const cookie = response.headers.get("Set-Cookie").split(";")[0];

  response = await worker.fetch(new Request("https://www.cnbuycha.com/yc.php/products/new", { headers: { Cookie: cookie } }), env, ctx);
  body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /价格（人民币 ¥）/);
  const csrf = body.match(/name="csrf" value="([^"]+)"/)?.[1];
  assert.ok(csrf);

  response = await worker.fetch(new Request("https://www.cnbuycha.com/yc.php/settings/currency", {
    method: "POST",
    headers: { Cookie: cookie },
    body: new URLSearchParams({ csrf, cny_per_usd: "7.00" }),
  }), env, ctx);
  assert.equal(response.status, 303);
  assert.equal(database.prepare("SELECT value FROM settings WHERE key = 'cny_per_usd'").get().value, "7.00");

  const form = new FormData();
  form.set("csrf", csrf);
  form.set("title", "Integration Test Product");
  form.set("category_id", "4");
  form.set("status", "1");
  form.set("price", "19.99");
  form.set("crossed_price", "25.00");
  form.set("source_id", "1234567890");
  form.set("seo_description", "A test product");
  form.append("images", new File([new Uint8Array([137, 80, 78, 71])], "test.png", { type: "image/png" }));
  response = await worker.fetch(new Request("https://www.cnbuycha.com/yc.php/products/save", { method: "POST", headers: { Cookie: cookie }, body: form }), env, ctx);
  assert.equal(response.status, 303);
  assert.match(response.headers.get("Location"), /saved=1/);
  const added = database.prepare("SELECT * FROM products WHERE source_id = ?").get("1234567890");
  assert.equal(added.title, "Integration Test Product");
  assert.match(added.main_image, /^\/media\/products\//);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?").get(added.id).count, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM uploaded_files").get().count, 1);

  response = await worker.fetch(new Request(`https://www.cnbuycha.com/shoes/${added.id}.html`), env, ctx);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Integration Test Product/);

  database.close();
});
