import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIONS, MAX_PHOTO_BYTES, matchesPhotoType, validateActivity } from "../lib/activity.ts";

const jpeg = new File([new Uint8Array([255, 216, 255, 224])], "items.jpg", { type: "image/jpeg" });

test("each action accepts a name and photo", () => {
  for (const action of ACTIONS) assert.equal(validateActivity(action, "Ramy", jpeg), null);
});

test("stock actions, missing names, and missing photos are rejected", () => {
  assert.ok(validateActivity("StockAdjustment", "Ramy", jpeg));
  assert.ok(validateActivity("Take Out", "Ramy", jpeg));
  assert.ok(validateActivity("Take", "  ", jpeg));
  assert.ok(validateActivity("Take", "a".repeat(101), jpeg));
  for (const action of ACTIONS) assert.ok(validateActivity(action, "Ramy", null));
  assert.ok(validateActivity("Return", "Ramy", new File([], "empty.jpg", { type: "image/jpeg" })));
});

test("unsupported and oversized uploads are rejected", () => {
  assert.ok(validateActivity("Take", "Ramy", new File(["<svg/>"], "image.svg", { type: "image/svg+xml" })));
  assert.ok(validateActivity("Consume", "Ramy", new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "large.jpg", { type: "image/jpeg" })));
});

test("file signatures must match JPEG, PNG, or WebP", async () => {
  assert.equal(matchesPhotoType(new Uint8Array(await jpeg.arrayBuffer()), "image/jpeg"), true);
  assert.equal(matchesPhotoType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"), true);
  assert.equal(matchesPhotoType(new TextEncoder().encode("RIFF0000WEBP"), "image/webp"), true);
  assert.equal(matchesPhotoType(new TextEncoder().encode("<svg/>"), "image/jpeg"), false);
  assert.equal(matchesPhotoType(new Uint8Array(), "image/png"), false);
  assert.equal(matchesPhotoType(new Uint8Array([137]), "image/png"), false);
});