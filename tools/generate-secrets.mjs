import { hashPassword, randomToken } from "../src/security.js";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error("Usage: node tools/generate-secrets.mjs '<password-at-least-12-chars>'");
  process.exit(1);
}
console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
console.log(`SESSION_SECRET=${randomToken(32)}`);
