import {
  BlobAccessError,
  BlobClientTokenExpiredError,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  BlobRequestAbortedError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
} from "@vercel/blob";
import { OperationTimeoutError } from "./operation-timeout.ts";

export function describeBlobFailure(error: unknown): { code: string; message: string } {
  const detail = error instanceof Error ? error.message : "";
  if (detail === "Missing BLOB_READ_WRITE_TOKEN.") {
    return { code: "BLOB_TOKEN_MISSING", message: "Photo storage is not configured for this deployment. Set BLOB_READ_WRITE_TOKEN in Vercel's Production environment and redeploy." };
  }
  if (error instanceof BlobAccessError || error instanceof BlobClientTokenExpiredError) {
    return { code: "BLOB_ACCESS_DENIED", message: "Photo storage rejected the credentials. Connect the Blob store to this Vercel project and check its Production read-write token, then redeploy." };
  }
  if (error instanceof BlobStoreNotFoundError) {
    return { code: "BLOB_STORE_NOT_FOUND", message: "The configured photo store no longer exists. Connect an active public Blob store and redeploy." };
  }
  if (error instanceof BlobStoreSuspendedError) {
    return { code: "BLOB_STORE_SUSPENDED", message: "Photo storage is suspended. Check the store's usage limits and billing in Vercel." };
  }
  if (/private|public/i.test(detail) && /access|store/i.test(detail)) {
    return { code: "BLOB_STORE_ACCESS_MISMATCH", message: "This app requires a public Blob store for spreadsheet photo previews. Check the connected store's access setting and use its read-write token." };
  }
  if (error instanceof OperationTimeoutError || error instanceof BlobRequestAbortedError || error instanceof BlobServiceNotAvailable || error instanceof BlobServiceRateLimited) {
    return { code: "BLOB_UNAVAILABLE", message: "Photo storage did not respond in time or is temporarily unavailable. Try again later." };
  }
  return { code: "BLOB_UPLOAD_FAILED", message: "The photo could not be uploaded. Check the connected public Blob store and this deployment's read-write token in Vercel." };
}