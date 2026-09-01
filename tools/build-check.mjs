import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const sourceFiles = ["src/index.js", "src/db.js", "src/html.js", "src/security.js", "src/media.js", "public-app/app.js"];
for (const relative of sourceFiles) {
  const result = spawnSync(process.execPath, ["--check", path.join(root, relative)], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `${relative} failed syntax validation`);
}

function inventory(directory) {
  let count = 0;
  let total = 0;
  let largest = 0;
  const visit = (current) => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) {
        const size = fs.statSync(full).size;
        count += 1;
        total += size;
        largest = Math.max(largest, size);
      }
    }
  };
  visit(directory);
  return { count, total, largest };
}

const appAssets = inventory(path.join(root, "public-app"));
const mediaAssets = inventory(path.join(root, "legacy-assets"));
if (appAssets.count > 20000 || mediaAssets.count > 20000) throw new Error("Cloudflare static asset file limit exceeded");
if (appAssets.largest > 25 * 1024 * 1024 || mediaAssets.largest > 25 * 1024 * 1024) throw new Error("Cloudflare per-file asset limit exceeded");

const migrations = fs.readdirSync(path.join(root, "migrations")).filter((file) => file.endsWith(".sql")).sort();
if (!migrations.includes("0001_schema.sql") || !migrations.some((file) => file.startsWith("0003_seed_products"))) {
  throw new Error("Generated data migrations are missing");
}

const forbidden = /(DB_PASSWORD|database_password|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY)/i;
for (const relative of sourceFiles.concat(["wrangler.jsonc", "wrangler.media.jsonc"])) {
  if (forbidden.test(fs.readFileSync(path.join(root, relative), "utf8"))) throw new Error(`Sensitive value found in ${relative}`);
}

console.log(JSON.stringify({ ok: true, sourceFiles: sourceFiles.length, migrations: migrations.length, appAssets, mediaAssets }, null, 2));
