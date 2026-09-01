import test from "node:test";
import assert from "node:assert/strict";
import { createSession, hashPassword, readSession, verifyPassword } from "../src/security.js";

test("password hashes verify only the correct password", async () => {
  const hash = await hashPassword("correct horse battery staple", 10000, new Uint8Array(16).fill(7));
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("signed sessions reject tampering", async () => {
  const token = await createSession("admin", "a-long-test-secret", 60);
  const session = await readSession(token, "a-long-test-secret");
  assert.equal(session.sub, "admin");
  assert.ok(session.csrf.length > 20);
  assert.equal(await readSession(`${token}x`, "a-long-test-secret"), null);
});
