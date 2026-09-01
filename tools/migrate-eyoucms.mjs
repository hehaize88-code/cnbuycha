import fs from "node:fs";
import path from "node:path";

const dumpPath = process.argv[2];
const outputDir = process.argv[3] || path.resolve("migrations");
if (!dumpPath) {
  console.error("Usage: node tools/migrate-eyoucms.mjs <eyoucms.sql> [migrations-dir]");
  process.exit(1);
}

const sql = fs.readFileSync(dumpPath, "utf8");

function columnsFor(table) {
  const marker = `CREATE TABLE \`${table}\` (`;
  const start = sql.indexOf(marker);
  if (start < 0) throw new Error(`Missing schema for ${table}`);
  const end = sql.indexOf(") ENGINE=", start);
  if (end < 0) throw new Error(`Incomplete schema for ${table}`);
  return sql.slice(start + marker.length, end).split(/\r?\n/)
    .map((line) => line.match(/^\s*`([^`]+)`/i)?.[1])
    .filter(Boolean);
}

function parseValues(source) {
  const values = [];
  let index = source.indexOf("(") + 1;
  while (index > 0 && index < source.length) {
    while (/[\s,]/.test(source[index])) index += 1;
    if (source[index] === ")") break;
    if (source[index] === "'") {
      index += 1;
      let value = "";
      while (index < source.length) {
        const char = source[index];
        if (char === "\\") {
          const next = source[index + 1];
          const escaped = { 0: "\0", b: "\b", n: "\n", r: "\r", t: "\t", Z: "\x1a" }[next];
          value += escaped ?? next ?? "";
          index += 2;
        } else if (char === "'" && source[index + 1] === "'") {
          value += "'";
          index += 2;
        } else if (char === "'") {
          index += 1;
          break;
        } else {
          value += char;
          index += 1;
        }
      }
      values.push(value);
    } else {
      const start = index;
      while (index < source.length && source[index] !== "," && source[index] !== ")") index += 1;
      const token = source.slice(start, index).trim();
      values.push(/^null$/i.test(token) ? null : token);
    }
    while (/\s/.test(source[index])) index += 1;
    if (source[index] === ",") index += 1;
  }
  return values;
}

function rowsFor(table) {
  const columns = columnsFor(table);
  const prefix = `INSERT INTO \`${table}\` VALUES `;
  const rows = [];
  for (const line of sql.split(/\r?\n/)) {
    if (!line.startsWith(prefix)) continue;
    const values = parseValues(line.slice(prefix.length));
    if (values.length !== columns.length) {
      throw new Error(`${table}: expected ${columns.length} values, found ${values.length}`);
    }
    rows.push(Object.fromEntries(columns.map((column, index) => [column, values[index]])));
  }
  return rows;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value, max = 1000000) {
  return String(value ?? "").replaceAll("\0", "").slice(0, max);
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insertSql(table, columns, rows, batchSize = 100) {
  const statements = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const values = batch.map((row) => `(${columns.map((column) => sqlValue(row[column])).join(",")})`).join(",\n");
    statements.push(`INSERT OR REPLACE INTO ${table} (${columns.join(",")}) VALUES\n${values};`);
  }
  return `${statements.join("\n\n")}\n`;
}

function writeChunks(prefix, table, columns, rows, rowsPerFile) {
  let files = 0;
  for (let index = 0; index < rows.length; index += rowsPerFile) {
    files += 1;
    const filename = `${prefix}_${String(files).padStart(2, "0")}.sql`;
    fs.writeFileSync(path.join(outputDir, filename), insertSql(table, columns, rows.slice(index, index + rowsPerFile)));
  }
  return files;
}

fs.mkdirSync(outputDir, { recursive: true });
for (const file of fs.readdirSync(outputDir)) {
  if (/^000[2-9]_seed_.*\.sql$/.test(file)) fs.rmSync(path.join(outputDir, file));
}

const rawCategories = rowsFor("ey_arctype");
const rawArchives = rowsFor("ey_archives");
const rawContents = rowsFor("ey_product_content");
const rawImages = rowsFor("ey_product_img");
const rawSettings = rowsFor("ey_config");

const categories = rawCategories
  .filter((row) => number(row.current_channel) === 2 || number(row.channeltype) === 2)
  .map((row) => ({
    id: number(row.id),
    name: text(row.typename, 200),
    slug: text(row.dirname, 120).toLowerCase(),
    parent_id: number(row.parent_id),
    legacy_path: text(row.dirpath || row.diy_dirpath, 300),
    seo_title: text(row.seo_title, 200),
    seo_description: text(row.seo_description, 1000),
    sort_order: number(row.sort_order, 100),
    enabled: number(row.status, 1),
  }))
  .filter((row) => row.id > 0 && row.slug);

const validCategoryIds = new Set(categories.map((row) => row.id));
const contentByAid = new Map(rawContents.map((row) => [number(row.aid), row]));
const products = rawArchives
  .filter((row) => number(row.channel) === 2 && number(row.is_del) === 0 && validCategoryIds.has(number(row.typeid)))
  .map((row) => {
    const content = contentByAid.get(number(row.aid)) || {};
    const sourceId = text(content.weidianiD, 100);
    const jump = text(row.jumplinks, 1000);
    return {
      id: number(row.aid),
      category_id: number(row.typeid),
      title: text(row.title, 200),
      subtitle: text(row.subtitle, 200),
      main_image: text(row.litpic, 1000),
      price: number(row.users_price),
      crossed_price: number(row.crossed_price),
      views: number(row.click),
      status: number(row.status, 1),
      sort_order: number(row.sort_order, 100),
      seo_title: text(row.seo_title, 200),
      seo_keywords: text(row.seo_keywords, 300),
      seo_description: text(row.seo_description, 1000),
      description: text(content.content, 20000),
      source_id: sourceId,
      source_url: /^https?:\/\//i.test(jump) ? jump : (sourceId ? `https://weidian.com/item.html?itemID=${encodeURIComponent(sourceId)}` : ""),
      created_at: number(row.add_time),
      updated_at: number(row.update_time),
    };
  });

const productIds = new Set(products.map((row) => row.id));
const productImages = rawImages
  .filter((row) => productIds.has(number(row.aid)) && text(row.image_url, 1000))
  .map((row) => ({
    id: number(row.img_id),
    product_id: number(row.aid),
    url: text(row.image_url, 1000),
    alt: text(row.title, 300),
    sort_order: number(row.sort_order),
    storage: "legacy",
    storage_key: "",
    created_at: number(row.add_time),
  }));

const publicSettingMap = new Map(rawSettings.map((row) => [row.name, text(row.value, 5000)]));
const settings = [
  ["web_name", publicSettingMap.get("web_name")],
  ["web_title", publicSettingMap.get("web_title")],
  ["web_description", publicSettingMap.get("web_description")],
  ["web_keywords", publicSettingMap.get("web_keywords")],
  ["web_logo", publicSettingMap.get("web_logo")],
  ["contact_url", publicSettingMap.get("web_attr_1")],
  ["brand_first", publicSettingMap.get("web_attr_2")],
  ["brand_second", publicSettingMap.get("web_attr_3")],
].filter(([, value]) => value).map(([key, value]) => ({ key, value }));

const categoryColumns = ["id", "name", "slug", "parent_id", "legacy_path", "seo_title", "seo_description", "sort_order", "enabled"];
const productColumns = ["id", "category_id", "title", "subtitle", "main_image", "price", "crossed_price", "views", "status", "sort_order", "seo_title", "seo_keywords", "seo_description", "description", "source_id", "source_url", "created_at", "updated_at"];
const imageColumns = ["id", "product_id", "url", "alt", "sort_order", "storage", "storage_key", "created_at"];

fs.writeFileSync(path.join(outputDir, "0002_seed_categories.sql"), insertSql("categories", categoryColumns, categories));
const productFiles = writeChunks("0003_seed_products", "products", productColumns, products, 500);
const imageFiles = writeChunks("0004_seed_images", "product_images", imageColumns, productImages, 2000);
fs.writeFileSync(path.join(outputDir, "0005_seed_settings.sql"), insertSql("settings", ["key", "value"], settings));

console.log(JSON.stringify({
  categories: categories.length,
  products: products.length,
  productImages: productImages.length,
  settings: settings.length,
  migrationFiles: 2 + productFiles + imageFiles,
}, null, 2));
