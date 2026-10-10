import assert from "node:assert/strict";
import { test } from "node:test";
import { JWT } from "google-auth-library";
import { appendActivity, prepareActivitySheet } from "../lib/activity-store.ts";

function setup(context, responses) {
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "test@example.invalid";
  process.env.GOOGLE_PRIVATE_KEY = "'test\\nkey'";
  process.env.GOOGLE_SHEET_ID = "test-sheet";
  context.mock.method(JWT.prototype, "getAccessToken", async () => ({ token: "test-token" }));
  const calls = [];
  context.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    const next = responses.shift();
    assert.ok(next, "No unexpected network requests");
    return Response.json(next.body, { status: next.status || 200 });
  });
  return calls;
}

test("an existing Activity tab does not change old sheets", async (context) => {
  const calls = setup(context, [{ body: { sheets: [{ properties: { title: "Activity" } }, { properties: { title: "Log" } }] } }]);
  await prepareActivitySheet();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");
});

test("first use creates Activity with the six-column header", async (context) => {
  const calls = setup(context, [{ body: { sheets: [{ properties: { title: "Items" } }] } }, { body: {} }, { body: {} }]);
  await prepareActivitySheet();
  assert.equal(calls.length, 3);
  assert.equal(JSON.parse(calls[1].options.body).requests[0].addSheet.properties.title, "Activity");
  assert.deepEqual(JSON.parse(calls[2].options.body).values[0], ["Time (UTC)", "Name", "Action", "Photo", "Photo URL", "Entry ID"]);
});

test("concurrent first submissions tolerate another request creating the tab", async (context) => {
  setup(context, [{ body: { sheets: [] } }, { status: 400, body: {} }, { body: { sheets: [{ properties: { title: "Activity" } }] } }, { body: {} }]);
  await prepareActivitySheet();
});

test("every activity writes one row and treats a formula-like name as text", async (context) => {
  const calls = setup(context, [{ body: { updates: { updatedRows: 1 } } }]);
  await appendActivity({ timestamp: "2026-10-10T12:00:00.000Z", person: '=IMAGE("bad")', action: "Take", photoUrl: "https://example.public.blob.vercel-storage.com/activity/test.jpg", id: "test-id" });
  const rows = JSON.parse(calls[0].options.body).values;
  assert.equal(rows.length, 1);
  assert.equal(rows[0][1], "'=IMAGE(\"bad\")");
  assert.equal(rows[0][2], "Take");
  assert.equal(rows[0][3], '=IMAGE("https://example.public.blob.vercel-storage.com/activity/test.jpg")');
  assert.equal(rows[0][5], "test-id");
  assert.ok(calls[0].url.includes("Activity!A:F:append"));
  assert.equal(calls.some((call) => call.url.includes("Items!")), false);
});

test("spreadsheet errors are not reported as successful writes", async (context) => {
  setup(context, [{ status: 403, body: {} }]);
  await assert.rejects(appendActivity({ timestamp: "now", person: "Ramy", action: "Return", photoUrl: "https://example.com/photo.jpg", id: "test-id" }), /403/);
});