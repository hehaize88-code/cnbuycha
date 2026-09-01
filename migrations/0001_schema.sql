PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id INTEGER NOT NULL DEFAULT 0,
  legacy_path TEXT NOT NULL DEFAULT '',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  main_image TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  crossed_price REAL NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  status INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_keywords TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  source_id TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  storage TEXT NOT NULL DEFAULT 'legacy',
  storage_key TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_latest ON products(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_views ON products(status, views DESC);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order, id);

INSERT OR IGNORE INTO settings(key, value) VALUES
  ('web_name', 'Kakobuy Spreadsheet Finds'),
  ('web_title', 'Kakobuy'),
  ('web_description', 'Cnbuycha.com collects Chinese shopping agent spreadsheet links and product finds.'),
  ('web_keywords', 'kakobuy,chinabuy,kakobuy spreadsheet,chinabuy spreadsheet'),
  ('brand_first', 'Cnbuy'),
  ('brand_second', 'Sheet'),
  ('contact_url', 'https://wa.me/message/B4CE54NRMF7IO1'),
  ('web_logo', '/public/upload/system/2018/05/24/8c675d3dae162ebc1936f3ab43d58960.png');
