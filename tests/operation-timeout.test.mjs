import assert from "node:assert/strict";
import { test } from "node:test";
import { OperationTimeoutError, withDeadline } from "../lib/operation-timeout.ts";

test("deadline releases a stalled operation even if it ignores abort", async () => {
  let signal;
  await assert.rejects(withDeadline("Photo upload", (value) => {
    signal = value;
    return new Promise(() => {});
  }, 5), OperationTimeoutError);
  assert.equal(signal.aborted, true);
});

test("deadline preserves successes and original failures", async () => {
  assert.equal(await withDeadline("Upload", async () => "uploaded", 100), "uploaded");
  const failure = new Error("storage rejected");
  await assert.rejects(withDeadline("Upload", async () => { throw failure; }, 100), (error) => error === failure);
});