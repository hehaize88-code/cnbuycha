const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/.{2}/g), (part) => Number.parseInt(part, 16));
}

function base64UrlEncode(input) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function hashPassword(password, iterations = 100000, saltBytes = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2_sha256$${iterations}$${bytesToHex(saltBytes)}$${bytesToHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, rawIterations, saltHex, expectedHex] = String(encoded || "").split("$");
  if (algorithm !== "pbkdf2_sha256") return false;
  const iterations = Number.parseInt(rawIterations, 10);
  const salt = hexToBytes(saltHex);
  const expected = hexToBytes(expectedHex);
  if (!salt || !expected || !Number.isInteger(iterations) || iterations < 10000 || iterations > 1000000) return false;
  const actualEncoded = await hashPassword(password, iterations, salt);
  const actual = hexToBytes(actualEncoded.split("$")[3]);
  if (!actual || actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i += 1) difference |= actual[i] ^ expected[i];
  return difference === 0;
}

export function randomToken(bytes = 24) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function createSession(username, secret, ttlSeconds = 60 * 60 * 12) {
  const payload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    csrf: randomToken(18),
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(await hmac(secret, body));
  return `${body}.${signature}`;
}

export async function readSession(token, secret) {
  try {
    const [body, signature] = String(token || "").split(".");
    if (!body || !signature || !secret) return null;
    const expected = await hmac(secret, body);
    const supplied = base64UrlDecode(signature);
    if (supplied.length !== expected.length) return null;
    let difference = 0;
    for (let i = 0; i < expected.length; i += 1) difference |= supplied[i] ^ expected[i];
    if (difference !== 0) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function sessionCookie(value, maxAge = 60 * 60 * 12) {
  return `cnbuycha_admin=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return "cnbuycha_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}
