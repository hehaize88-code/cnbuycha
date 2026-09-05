import {
  addProductImage,
  getCategories,
  getProduct,
  getSettings,
  listProducts,
  relatedProducts,
  saveProduct,
} from "./db.js";
import { APP_JS, SITE_CSS } from "./client-assets.js";
import { ANALYTICS_JS } from "./analytics.js";
import {
  renderAdminProducts,
  renderErrorPage,
  renderHome,
  renderLogin,
  renderProductDetail,
  renderProductForm,
  renderProductList,
  renderSeoGuide,
  safeUrl,
  SEO_GUIDES,
} from "./html.js";
import {
  clearSessionCookie,
  createSession,
  getCookie,
  readSession,
  sessionCookie,
  verifyPassword,
} from "./security.js";

const DEFAULT_SETTINGS = {
  web_name: "Kakobuy Spreadsheet Finds",
  web_title: "Kakobuy",
  web_description: "China shopping spreadsheet finds",
  web_keywords: "kakobuy,chinabuy,spreadsheet",
  brand_first: "Cnbuy",
  brand_second: "Sheet",
  contact_url: "#",
  cny_per_usd: "7.20",
};

const CANONICAL_ORIGIN = "https://cnbuycha.com";
const GTAG_INLINE_HASH = "'sha256-uAswmpdXrX64y9duzhrxzSbktnhjti1w1qv9esUsOFQ='";

const securityHeaders = {
  "Content-Security-Policy": `default-src 'self'; style-src 'self' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data: https:; script-src 'self' ${GTAG_INLINE_HASH} https://www.googletagmanager.com https://static.cloudflareinsights.com; connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://cloudflareinsights.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`,
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
      ...securityHeaders,
      ...extraHeaders,
    },
  });
}

function adminHtml(body, status = 200, extraHeaders = {}) {
  return html(body, status, { "Cache-Control": "no-store", ...extraHeaders });
}

function redirect(location, headers = {}) {
  return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store", ...headers } });
}

function permanentRedirect(location) {
  return new Response(null, { status: 301, headers: { Location: location, "Cache-Control": "public, max-age=3600" } });
}

function integer(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function decimal(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function currentSession(request, env) {
  if (!env.SESSION_SECRET) return null;
  const session = await readSession(getCookie(request, "cnbuycha_admin"), env.SESSION_SECRET);
  if (!session || session.sub !== (env.ADMIN_USERNAME || "admin")) return null;
  return session;
}

function csrfValid(form, session) {
  const supplied = String(form.get("csrf") || "");
  return Boolean(supplied && session?.csrf && supplied === session.csrf);
}

function imageExtension(type) {
  return ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  })[type] || "";
}

async function serveStoredImage(env, path) {
  const key = decodeURIComponent(path.slice("/media/".length));
  if (!key || key.includes("..") || key.startsWith("/")) return new Response("Not found", { status: 404 });
  const value = await env.DB.prepare("SELECT content_type, data FROM uploaded_files WHERE key = ?").bind(key).first();
  if (!value?.data) return new Response("Not found", { status: 404 });
  const bytes = Array.isArray(value.data) ? new Uint8Array(value.data) : value.data;
  return new Response(bytes, {
    headers: {
      "Content-Type": value.content_type || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function serveLegacyImage(request, env) {
  const pathname = new URL(request.url).pathname;
  let hash = 2166136261;
  for (let index = 0; index < pathname.length; index += 1) {
    hash = Math.imul(hash ^ pathname.charCodeAt(index), 16777619);
  }
  const media = (hash >>> 0) % 2 === 0 ? env.MEDIA_A : env.MEDIA_B;
  if (media?.fetch) return media.fetch(request);
  if (env.MEDIA?.fetch) return env.MEDIA.fetch(request);
  if (env.LEGACY_MEDIA_ORIGIN) {
    const incoming = new URL(request.url);
    return fetch(new Request(new URL(incoming.pathname, env.LEGACY_MEDIA_ORIGIN), request));
  }
  return new Response("Legacy media service is not connected", { status: 503 });
}

async function login(request, env) {
  if (!env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET) return adminHtml(renderLogin({ configured: false }), 503);
  const form = await request.formData();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const usernameOk = username === (env.ADMIN_USERNAME || "admin");
  const passwordOk = usernameOk && await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  if (!passwordOk) {
    return adminHtml(renderLogin({ error: "用户名或密码错误。" }), 401);
  }
  const token = await createSession(username, env.SESSION_SECRET);
  return redirect("/yc.php", { "Set-Cookie": sessionCookie(token) });
}

async function uploadProductImages(env, db, productId, title, files, startSort = 0) {
  if (!files.length) return [];
  const uploaded = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const extension = imageExtension(file.type);
    if (!extension) throw new Error(`${file.name || "图片"} 的格式不支持`);
    if (file.size > 1.5 * 1024 * 1024) throw new Error(`${file.name || "图片"} 超过 1.5MB`);
    if (file.size < 1) continue;
    const key = `products/${productId}/${crypto.randomUUID()}.${extension}`;
    await db.prepare("INSERT INTO uploaded_files(key, content_type, data, size, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(key, file.type, new Uint8Array(await file.arrayBuffer()), file.size, Math.floor(Date.now() / 1000)).run();
    const url = `/media/${key}`;
    await addProductImage(db, { productId, url, alt: title, sortOrder: startSort + index, storage: "d1", storageKey: key });
    uploaded.push(url);
  }
  return uploaded;
}

async function saveProductRequest(request, env, session) {
  const form = await request.formData();
  if (!csrfValid(form, session)) return new Response("Invalid CSRF token", { status: 403 });
  const id = integer(form.get("id"), 0);
  const existing = id ? await getProduct(env.DB, id, true) : null;
  if (id && !existing) return new Response("Product not found", { status: 404 });
  const categories = await getCategories(env.DB, true);
  const categoryId = integer(form.get("category_id"), 0);
  const title = String(form.get("title") || "").trim().slice(0, 200);
  const category = categories.find((item) => Number(item.id) === categoryId && Number(item.id) > 3);
  const files = form.getAll("images").filter((item) => item && typeof item.arrayBuffer === "function" && item.size > 0);
  let error = "";
  if (!title) error = "请填写产品标题。";
  else if (!category) error = "请选择有效分类。";
  else if (files.length > 10) error = "一次最多上传 10 张图片。";
  else {
    const badFile = files.find((file) => !imageExtension(file.type) || file.size > 1.5 * 1024 * 1024);
    if (badFile) error = `${badFile.name || "图片"} 格式不支持或超过 1.5MB。`;
  }
  const mainImageInput = String(form.get("main_image") || "").trim();
  const mainImage = safeUrl(mainImageInput, "");
  const values = {
    id,
    categoryId,
    title,
    subtitle: String(form.get("subtitle") || "").trim().slice(0, 200),
    mainImage,
    price: decimal(form.get("price")),
    crossedPrice: decimal(form.get("crossed_price")),
    status: String(form.get("status")) === "0" ? 0 : 1,
    seoTitle: String(form.get("seo_title") || "").trim().slice(0, 200),
    seoKeywords: String(form.get("seo_keywords") || "").trim().slice(0, 300),
    seoDescription: String(form.get("seo_description") || "").trim().slice(0, 1000),
    description: String(form.get("description") || "").trim().slice(0, 20000),
    sourceId: String(form.get("source_id") || "").trim().slice(0, 100),
    sourceUrl: safeUrl(String(form.get("source_url") || "").trim(), ""),
  };
  if (error) {
    const draft = { ...(existing || {}), ...values, category_id: categoryId };
    return adminHtml(renderProductForm({ session, categories, product: id ? draft : null, error }), 400);
  }

  const productId = await saveProduct(env.DB, values);
  const deleteIds = form.getAll("delete_image").map((value) => integer(value, 0)).filter(Boolean);
  if (deleteIds.length) {
    const placeholders = deleteIds.map(() => "?").join(",");
    const rows = await env.DB.prepare(`SELECT id, storage, storage_key FROM product_images WHERE product_id = ? AND id IN (${placeholders})`).bind(productId, ...deleteIds).all();
    for (const row of rows.results || []) {
      if (row.storage === "d1" && row.storage_key) await env.DB.prepare("DELETE FROM uploaded_files WHERE key = ?").bind(row.storage_key).run();
    }
    await env.DB.prepare(`DELETE FROM product_images WHERE product_id = ? AND id IN (${placeholders})`).bind(productId, ...deleteIds).run();
  }

  const imageUrls = String(form.get("image_urls") || "").split(/\r?\n/).map((value) => safeUrl(value.trim(), "")).filter(Boolean).slice(0, 20);
  let sortOrder = 1000;
  for (const url of imageUrls) {
    await addProductImage(env.DB, { productId, url, alt: title, sortOrder });
    sortOrder += 1;
  }
  const uploaded = await uploadProductImages(env, env.DB, productId, title, files, 2000);
  const firstImage = mainImage || imageUrls[0] || uploaded[0] || existing?.main_image || "";
  if (firstImage !== mainImage) {
    await env.DB.prepare("UPDATE products SET main_image = ? WHERE id = ?").bind(firstImage, productId).run();
  }
  return redirect(`/yc.php?saved=1&id=${productId}`);
}

async function deleteProductRequest(request, env, session, id) {
  const form = await request.formData();
  if (!csrfValid(form, session)) return new Response("Invalid CSRF token", { status: 403 });
  const images = await env.DB.prepare("SELECT storage, storage_key FROM product_images WHERE product_id = ?").bind(id).all();
  for (const image of images.results || []) {
    if (image.storage === "d1" && image.storage_key) await env.DB.prepare("DELETE FROM uploaded_files WHERE key = ?").bind(image.storage_key).run();
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(id),
    env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id),
  ]);
  return redirect("/yc.php?deleted=1");
}

async function saveCurrencyRate(request, env, session) {
  const form = await request.formData();
  if (!csrfValid(form, session)) return new Response("Invalid CSRF token", { status: 403 });
  const rate = Number.parseFloat(String(form.get("cny_per_usd") || ""));
  if (!Number.isFinite(rate) || rate < 1 || rate > 20) {
    return redirect("/yc.php?rate_error=1");
  }
  await env.DB.prepare(
    "INSERT INTO settings(key, value) VALUES ('cny_per_usd', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).bind(rate.toFixed(2)).run();
  return redirect("/yc.php?rate_saved=1");
}

async function adminRoute(request, env, url) {
  if (request.method === "POST" && url.pathname === "/yc.php/login") return login(request, env);
  const session = await currentSession(request, env);
  if (!session) return adminHtml(renderLogin({ configured: Boolean(env.ADMIN_PASSWORD_HASH && env.SESSION_SECRET) }), 200);
  if (request.method === "POST" && url.pathname === "/yc.php/logout") {
    const form = await request.formData();
    if (!csrfValid(form, session)) return new Response("Invalid CSRF token", { status: 403 });
    return redirect("/yc.php", { "Set-Cookie": clearSessionCookie() });
  }
  if (request.method === "POST" && url.pathname === "/yc.php/products/save") return saveProductRequest(request, env, session);
  if (request.method === "POST" && url.pathname === "/yc.php/settings/currency") return saveCurrencyRate(request, env, session);
  const deleteMatch = url.pathname.match(/^\/yc\.php\/products\/(\d+)\/delete$/);
  if (request.method === "POST" && deleteMatch) return deleteProductRequest(request, env, session, Number(deleteMatch[1]));
  const categories = await getCategories(env.DB, true);
  if (request.method === "GET" && url.pathname === "/yc.php/products/new") {
    return adminHtml(renderProductForm({ session, categories }));
  }
  const editMatch = url.pathname.match(/^\/yc\.php\/products\/(\d+)\/edit$/);
  if (request.method === "GET" && editMatch) {
    const product = await getProduct(env.DB, Number(editMatch[1]), true);
    if (!product) return adminHtml(renderErrorPage(404, "Product not found", DEFAULT_SETTINGS), 404);
    return adminHtml(renderProductForm({ session, categories, product }));
  }
  if (request.method === "GET" && url.pathname === "/yc.php") {
    const page = integer(url.searchParams.get("page"), 1, 1, 100000);
    const query = String(url.searchParams.get("q") || "").trim().slice(0, 100);
    const [result, settings] = await Promise.all([
      listProducts(env.DB, { query, page, pageSize: 60, includeHidden: true }),
      getSettings(env.DB),
    ]);
    const notice = url.searchParams.has("saved") ? "产品已保存。"
      : url.searchParams.has("deleted") ? "产品已删除。"
        : url.searchParams.has("rate_saved") ? "美元换算汇率已保存。"
          : url.searchParams.has("rate_error") ? "汇率无效，请填写 1 到 20 之间的数字。"
            : "";
    return adminHtml(renderAdminProducts({
      session,
      products: result.products,
      total: result.total,
      page,
      query,
      cnyPerUsd: settings.cny_per_usd || DEFAULT_SETTINGS.cny_per_usd,
      notice,
    }));
  }
  return adminHtml(renderErrorPage(404, "Page not found", DEFAULT_SETTINGS), 404);
}

async function sitemap(env, origin) {
  const [categories, products] = await Promise.all([
    env.DB.prepare("SELECT slug FROM categories WHERE enabled = 1 AND id > 3 ORDER BY id").all(),
    env.DB.prepare("SELECT p.id, p.updated_at, c.slug FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.status = 1 ORDER BY p.id").all(),
  ]);
  const urls = [
    `<url><loc>${origin}/</loc></url>`,
    `<url><loc>${origin}/AllProducts/</loc></url>`,
    ...Object.keys(SEO_GUIDES).map((pathname) => `<url><loc>${origin}${pathname}</loc><lastmod>2026-09-02</lastmod></url>`),
    ...(categories.results || []).map((row) => `<url><loc>${origin}/${row.slug}/</loc></url>`),
    ...(products.results || []).map((row) => `<url><loc>${origin}/${row.slug || "AllProducts"}/${row.id}.html</loc><lastmod>${new Date(Number(row.updated_at || 0) * 1000).toISOString().slice(0, 10)}</lastmod></url>`),
  ];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

async function publicRoute(request, env, ctx, url) {
  const origin = CANONICAL_ORIGIN;
  const settings = { ...DEFAULT_SETTINGS, ...await getSettings(env.DB) };
  if (url.pathname === "/robots.txt") {
    return new Response(`User-agent: *\nAllow: /\nDisallow: /yc.php\nSitemap: ${origin}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (url.pathname === "/sitemap.xml") return sitemap(env, origin);
  if (url.pathname === "/index.php") return permanentRedirect(`${origin}/`);
  if (url.pathname === "/") {
    const [categories, latest] = await Promise.all([
      getCategories(env.DB),
      listProducts(env.DB, { pageSize: 24 }),
    ]);
    return html(renderHome({ settings, categories, products: latest.products, origin }));
  }
  const guide = SEO_GUIDES[url.pathname];
  if (guide) return html(renderSeoGuide({ settings, guide, origin, pathname: url.pathname }));
  const productMatch = url.pathname.match(/^\/(?:AllProducts\/)?(?:[A-Za-z0-9-]+\/)?(\d+)\.html$/i);
  if (productMatch) {
    const product = await getProduct(env.DB, Number(productMatch[1]));
    if (!product) return html(renderErrorPage(404, "Product not found", settings), 404);
    const canonicalPath = `/${String(product.category_slug || "AllProducts").replace(/[^a-z0-9-]/gi, "") || "AllProducts"}/${Number(product.id)}.html`;
    if (url.pathname !== canonicalPath) return permanentRedirect(`${origin}${canonicalPath}`);
    if (ctx?.waitUntil) ctx.waitUntil(env.DB.prepare("UPDATE products SET views = views + 1 WHERE id = ?").bind(product.id).run());
    const related = await relatedProducts(env.DB, product);
    return html(renderProductDetail({ settings, product, related, origin }));
  }
  const cleanPath = url.pathname.replace(/^\/+|\/+$/g, "");
  const segments = cleanPath.split("/").filter(Boolean);
  const categories = await getCategories(env.DB);
  let currentCategory = null;
  if (segments[0]?.toLowerCase() === "allproducts" && segments[1]) currentCategory = categories.find((item) => item.slug.toLowerCase() === segments[1].toLowerCase());
  else if (segments.length === 1 && segments[0]?.toLowerCase() !== "allproducts") currentCategory = categories.find((item) => item.slug.toLowerCase() === segments[0].toLowerCase());
  const isList = cleanPath.toLowerCase() === "allproducts" || Boolean(currentCategory);
  if (isList) {
    const canonicalPath = currentCategory ? `/${currentCategory.slug}/` : "/AllProducts/";
    if (url.pathname !== canonicalPath) return permanentRedirect(`${origin}${canonicalPath}${url.search}`);
    const page = integer(url.searchParams.get("page"), 1, 1, 100000);
    const query = String(url.searchParams.get("q") || url.searchParams.get("keywords") || "").trim().slice(0, 100);
    const sort = ["new", "click", "price"].includes(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "new";
    const pageSize = 60;
    const result = await listProducts(env.DB, { categoryId: Number(currentCategory?.id || 0), query, sort, page, pageSize });
    return html(renderProductList({ settings, categories, currentCategory, products: result.products, total: result.total, page, pageSize, query, sort, origin, pathname: url.pathname }));
  }
  if (url.pathname === "/video" || url.pathname === "/video/") return redirect("https://chromewebstore.google.com/detail/risk-reminder-remover/afgegfoedkeffjkkkjkbpnegceleakeo");
  return html(renderErrorPage(404, "Page not found", settings), 404);
}

async function cachedPublicRoute(request, env, ctx, url) {
  const cacheable = request.method === "GET" && !url.search;
  const edgeCache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = cacheable && edgeCache ? new Request(`${CANONICAL_ORIGIN}${url.pathname}`, request) : null;
  if (cacheKey) {
    const cached = await edgeCache.match(cacheKey);
    if (cached) return cached;
  }
  const response = await publicRoute(request, env, ctx, url);
  if (cacheKey && response.status === 200 && !response.headers.get("Cache-Control")?.includes("no-store")) {
    const write = edgeCache.put(cacheKey, response.clone());
    if (ctx?.waitUntil) ctx.waitUntil(write);
    else await write;
  }
  return response;
}

function isStaticPath(pathname) {
  return pathname === "/favicon.ico" || pathname.startsWith("/template/") || pathname.startsWith("/public/") || /\.(?:css|js|svg|png|jpe?g|gif|webp|ico|woff2?)$/i.test(pathname);
}

function serveEmbeddedAsset(request, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  let body;
  let contentType;
  if (pathname === "/app.js") {
    body = `${ANALYTICS_JS}\n${APP_JS}`;
    contentType = "application/javascript; charset=utf-8";
  } else if (pathname === "/site.css") {
    body = SITE_CSS;
    contentType = "text/css; charset=utf-8";
  } else {
    return null;
  }
  return new Response(request.method === "HEAD" ? null : body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/uploads/")) return serveLegacyImage(request, env);
      if (url.pathname.startsWith("/media/")) return serveStoredImage(env, url.pathname);
      const embeddedAsset = serveEmbeddedAsset(request, url.pathname);
      if (embeddedAsset) return embeddedAsset;
      if (isStaticPath(url.pathname)) return env.ASSETS.fetch(request);
      if (url.pathname === "/health") return Response.json({ ok: true, service: "cnbuycha" });
      if (url.pathname === "/yc.php" || url.pathname.startsWith("/yc.php/")) return adminRoute(request, env, url);
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
      return cachedPublicRoute(request, env, ctx, url);
    } catch (error) {
      console.error("Request failed", error);
      if (url.pathname === "/yc.php" || url.pathname.startsWith("/yc.php/")) {
        return adminHtml(renderLogin({ error: "服务暂时不可用，请稍后重试。" }), 500);
      }
      return html(renderErrorPage(500, "The site is temporarily unavailable", DEFAULT_SETTINGS), 500);
    }
  },
};
