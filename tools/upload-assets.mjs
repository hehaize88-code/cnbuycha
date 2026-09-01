import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const [assetDirectory, manifestPath] = process.argv.slice(2);
const accountId = process.env.CF_ASSET_ACCOUNT_ID;

if (!assetDirectory || !manifestPath || !accountId) {
  throw new Error('Usage: CF_ASSET_ACCOUNT_ID=... node tools/upload-assets.mjs <directory> <manifest.json>');
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const byHash = new Map(Object.entries(manifest).map(([name, entry]) => [entry.hash, { name, ...entry }]));
const maxFilesPerBucket = Number(process.env.ASSET_BUCKET_FILES || 100);
const uploadConcurrency = Number(process.env.ASSET_UPLOAD_CONCURRENCY || 2);
const requestTimeout = Number(process.env.ASSET_REQUEST_TIMEOUT_MS || 120000);
const verbose = process.env.ASSET_VERBOSE === '1';

const input = readline.createInterface({ input: process.stdin, terminal: false });
const [line] = await new Promise((resolve) => {
  const lines = [];
  input.on('line', (value) => {
    lines.push(value);
    input.close();
  });
  input.on('close', () => resolve(lines));
});

const session = JSON.parse(line);
if (!session.buckets) {
  const buckets = [];
  let bucket = [];
  let bucketBytes = 0;
  for (const entry of byHash.values()) {
    if (bucket.length >= maxFilesPerBucket || bucketBytes + entry.size > 50 * 1024 * 1024) {
      buckets.push(bucket);
      bucket = [];
      bucketBytes = 0;
    }
    bucket.push(entry.hash);
    bucketBytes += entry.size;
  }
  if (bucket.length) buckets.push(bucket);
  session.buckets = buckets;
}
let uploadedFiles = 0;
let uploadedBytes = 0;
let completionJwt = '';
let nextBucket = 0;

async function uploadBucket(bucket, index) {
  const form = new FormData();

  for (const hash of bucket) {
    const entry = byHash.get(hash);
    if (!entry) throw new Error(`Missing manifest entry for ${hash}`);
    const filePath = path.join(assetDirectory, entry.name.slice(1));
    const base64 = fs.readFileSync(filePath).toString('base64');
    const type = contentTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
    form.append(hash, new Blob([base64], { type }), hash);
  }

  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      if (verbose) process.stderr.write(`starting bucket ${index + 1}/${session.buckets.length}, attempt ${attempt}\n`);
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/assets/upload?base64=true`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.jwt}` },
          body: form,
          signal: AbortSignal.timeout(requestTimeout),
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload.errors || payload)}`);
      }
      completionJwt = payload.result?.jwt || completionJwt;
      uploadedFiles += bucket.length;
      uploadedBytes += bucket.reduce((sum, hash) => sum + byHash.get(hash).size, 0);
      process.stderr.write(`bucket ${index + 1}/${session.buckets.length}: ${uploadedFiles} files\n`);
      return;
    } catch (error) {
      lastError = error;
      if (verbose) process.stderr.write(`bucket ${index + 1} failed: ${error.message}\n`);
      if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
    }
  }
  throw lastError;
}

async function worker() {
  while (true) {
    const index = nextBucket;
    nextBucket += 1;
    if (index >= session.buckets.length) return;
    await uploadBucket(session.buckets[index], index);
  }
}

await Promise.all(Array.from({ length: uploadConcurrency }, worker));

if (!completionJwt) throw new Error('Cloudflare did not return an asset completion token');
process.stdout.write(`${JSON.stringify({ uploadedFiles, uploadedBytes, completionJwt })}\n`);
