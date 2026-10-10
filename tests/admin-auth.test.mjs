import assert from "node:assert/strict";
import { test } from "node:test";
import { SESSION_SECONDS, allowLoginAttempt, createAdminSession, isSameOrigin, verifyAdminPassword, verifyAdminSession } from "../lib/admin-auth.ts";

test("same-origin login uses the public host and rejects cross-site or missing origins", () => {
  const request = (origin) => new Request("http://localhost:3101/api/admin/session", { headers: { host: "127.0.0.1:3101", ...(origin ? { origin } : {}) } });
  assert.equal(isSameOrigin(request("http://127.0.0.1:3101")), true);
  assert.equal(isSameOrigin(request("https://attacker.invalid")), false);
  assert.equal(isSameOrigin(request()), false);
});

test("admin has no default password and requires configured credentials", () => {
  delete process.env.ADMIN_PASSWORD;
  assert.equal(verifyAdminPassword("admin123"), false);
  assert.equal(verifyAdminSession("anything"), false);
  process.env.ADMIN_PASSWORD = "test-only-secret";
  assert.equal(verifyAdminPassword("wrong"), false);
  assert.equal(verifyAdminPassword("test-only-secret"), true);
  assert.equal(verifyAdminPassword(null), false);
});

test("signed sessions expire and reject changes or password rotation", () => {
  process.env.ADMIN_PASSWORD = "test-only-secret";
  const now = 1800000000000;
  const token = createAdminSession(now);
  assert.equal(verifyAdminSession(token, now), true);
  assert.equal(verifyAdminSession(token, now + SESSION_SECONDS * 1000), false);
  assert.equal(verifyAdminSession(token + "bad", now), false);
  assert.equal(verifyAdminSession("invalid", now), false);
  assert.equal(verifyAdminSession(undefined, now), false);
  process.env.ADMIN_PASSWORD = "rotated-test-secret";
  assert.equal(verifyAdminSession(token, now), false);
});

test("login attempt limiter blocks after five attempts and resets after cooldown", () => {
  for (let index = 0; index < 5; index++) assert.equal(allowLoginAttempt("test-address", 1000), true);
  assert.equal(allowLoginAttempt("test-address", 1000), false);
  assert.equal(allowLoginAttempt("test-address", 1000 + 15 * 60 * 1000), true);
});