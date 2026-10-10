import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "emmanuel_admin";
export const SESSION_SECONDS = 60 * 60 * 8;

export function isSameOrigin(request: Request) {
  try {
    const origin = new URL(request.headers.get("origin") || "");
    return (origin.protocol === "https:" || origin.protocol === "http:") && origin.host === request.headers.get("host");
  } catch {
    return false;
  }
}

function secret() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("Admin access is not configured.");
  return password;
}

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function verifyAdminPassword(password: unknown) {
  if (typeof password !== "string" || password.length > 1024 || !isAdminConfigured()) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(password), digest(secret()));
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(`emmanuel-admin:${payload}`).digest("base64url");
}

export function createAdminSession(now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${signature(payload)}`;
}

export function verifyAdminSession(token: string | undefined, now = Date.now()) {
  if (!token || !isAdminConfigured() || token.length > 200) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false;
  const expires = Number(parts[0]);
  const current = Math.floor(now / 1000);
  if (expires <= current || expires > current + SESSION_SECONDS) return false;
  const actual = Buffer.from(parts[2], "base64url");
  const expected = Buffer.from(signature(`${parts[0]}.${parts[1]}`), "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const attempts = new Map<string, { count: number; until: number }>();

export function allowLoginAttempt(address: string, now = Date.now()) {
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const record = attempts.get(address);
  if (record) {
    if (record.count >= 5) return false;
    record.count += 1;
    return true;
  }
  if (attempts.size >= 1000) return false;
  attempts.set(address, { count: 1, until: now + 15 * 60 * 1000 });
  return true;
}