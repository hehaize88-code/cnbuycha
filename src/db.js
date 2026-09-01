export async function getSettings(db) {
  const result = await db.prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries((result.results || []).map((row) => [row.key, row.value]));
}

export async function getCategories(db, includeDisabled = false) {
  const where = includeDisabled ? "" : "WHERE enabled = 1";
  const result = await db.prepare(
    `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.status = 1
       ${where}
      GROUP BY c.id
      ORDER BY c.sort_order, c.id`,
  ).all();
  return result.results || [];
}

function productOrder(sort) {
  if (sort === "click") return "p.views DESC, p.id DESC";
  if (sort === "price") return "p.price ASC, p.id DESC";
  return "p.created_at DESC, p.id DESC";
}

export async function listProducts(db, { categoryId = 0, query = "", sort = "new", page = 1, pageSize = 60, includeHidden = false } = {}) {
  const conditions = [];
  const bindings = [];
  if (!includeHidden) conditions.push("p.status = 1");
  if (categoryId) {
    conditions.push("p.category_id = ?");
    bindings.push(categoryId);
  }
  if (query) {
    conditions.push("(p.title LIKE ? OR p.source_id LIKE ?)");
    const value = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    bindings.push(value, value);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = Math.max(0, page - 1) * pageSize;
  const countRow = await db.prepare(`SELECT COUNT(*) AS total FROM products p ${where}`).bind(...bindings).first();
  const result = await db.prepare(
    `SELECT p.*,
            COALESCE(NULLIF(p.main_image, ''),
              (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1),
              '') AS main_image,
            c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
      ORDER BY ${productOrder(sort)}
      LIMIT ? OFFSET ?`,
  ).bind(...bindings, pageSize, offset).all();
  return { products: result.results || [], total: Number(countRow?.total || 0) };
}

export async function getProduct(db, id, includeHidden = false) {
  const status = includeHidden ? "" : "AND p.status = 1";
  const product = await db.prepare(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ? ${status}`,
  ).bind(id).first();
  if (!product) return null;
  const images = await db.prepare(
    "SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order, id",
  ).bind(id).all();
  return { ...product, images: images.results || [] };
}

export async function relatedProducts(db, product, limit = 12) {
  const result = await db.prepare(
    `SELECT p.*,
            COALESCE(NULLIF(p.main_image, ''),
              (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1),
              '') AS main_image,
            c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 1 AND p.category_id = ? AND p.id != ?
      ORDER BY p.created_at DESC
      LIMIT ?`,
  ).bind(product.category_id, product.id, limit).all();
  return result.results || [];
}

export async function saveProduct(db, values) {
  const now = Math.floor(Date.now() / 1000);
  if (values.id) {
    await db.prepare(
      `UPDATE products SET
         category_id = ?, title = ?, subtitle = ?, main_image = ?, price = ?, crossed_price = ?,
         status = ?, seo_title = ?, seo_keywords = ?, seo_description = ?, description = ?,
         source_id = ?, source_url = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(
      values.categoryId, values.title, values.subtitle, values.mainImage, values.price, values.crossedPrice,
      values.status, values.seoTitle, values.seoKeywords, values.seoDescription, values.description,
      values.sourceId, values.sourceUrl, now, values.id,
    ).run();
    return Number(values.id);
  }
  const result = await db.prepare(
    `INSERT INTO products (
       category_id, title, subtitle, main_image, price, crossed_price, views, status, sort_order,
       seo_title, seo_keywords, seo_description, description, source_id, source_url, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 100, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    values.categoryId, values.title, values.subtitle, values.mainImage, values.price, values.crossedPrice,
    values.status, values.seoTitle, values.seoKeywords, values.seoDescription, values.description,
    values.sourceId, values.sourceUrl, now, now,
  ).run();
  return Number(result.meta.last_row_id);
}

export async function addProductImage(db, { productId, url, alt = "", sortOrder = 0, storage = "legacy", storageKey = "" }) {
  await db.prepare(
    "INSERT INTO product_images(product_id, url, alt, sort_order, storage, storage_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(productId, url, alt, sortOrder, storage, storageKey, Math.floor(Date.now() / 1000)).run();
}
