import assert from "node:assert/strict";
import { test } from "node:test";
import { BlobAccessError, BlobStoreNotFoundError, BlobStoreSuspendedError, BlobError } from "@vercel/blob";
import { describeBlobFailure } from "../lib/blob-errors.ts";
import { OperationTimeoutError } from "../lib/operation-timeout.ts";

test("upload diagnostics distinguish credential, store, and timeout failures", () => {
  assert.equal(describeBlobFailure(new Error("Missing BLOB_READ_WRITE_TOKEN.")).code, "BLOB_TOKEN_MISSING");
  assert.equal(describeBlobFailure(new BlobAccessError()).code, "BLOB_ACCESS_DENIED");
  assert.equal(describeBlobFailure(new BlobStoreNotFoundError()).code, "BLOB_STORE_NOT_FOUND");
  assert.equal(describeBlobFailure(new BlobStoreSuspendedError()).code, "BLOB_STORE_SUSPENDED");
  assert.equal(describeBlobFailure(new OperationTimeoutError("Photo upload")).code, "BLOB_UNAVAILABLE");
  assert.equal(describeBlobFailure(new BlobError("Cannot use public access on a private store")).code, "BLOB_STORE_ACCESS_MISMATCH");
});

test("unknown storage errors never reveal tokens or raw server messages", () => {
  const result = describeBlobFailure(new Error("invalid token SECRET_TOKEN_VALUE"));
  assert.equal(result.code, "BLOB_UPLOAD_FAILED");
  assert.equal(result.message.includes("SECRET_TOKEN_VALUE"), false);
});

test("production-minified constructor names do not hide Blob error types", () => {
  for (const [ErrorClass, code] of [
    [BlobAccessError, "BLOB_ACCESS_DENIED"],
    [BlobStoreNotFoundError, "BLOB_STORE_NOT_FOUND"],
    [BlobStoreSuspendedError, "BLOB_STORE_SUSPENDED"],
  ]) {
    const error = new ErrorClass();
    Object.defineProperty(error, "constructor", { value: { name: "Y" } });
    assert.equal(describeBlobFailure(error).code, code);
  }
});