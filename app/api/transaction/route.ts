import { NextResponse } from "next/server";
import { appendActivity, prepareActivitySheet, uploadPhotoToBlob } from "@/lib/activity-store";
import { matchesPhotoType, validateActivity, type ActivityAction } from "@/lib/activity";
import { describeBlobFailure } from "@/lib/blob-errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 4 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: "Your photo is too large. Choose a smaller photo." }, { status: 413 });
  }
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return NextResponse.json({ success: false, error: "Send a name, action, and photo." }, { status: 415 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Could not read the photo. Please try again." }, { status: 400 });
  }
  const action = form.get("action");
  const person = form.get("person");
  const photo = form.get("photo");
  const error = validateActivity(action, person, photo);
  if (error) return NextResponse.json({ success: false, error }, { status: 400 });
  const file = photo as File;
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!matchesPhotoType(bytes, file.type)) {
    return NextResponse.json({ success: false, error: "This file is not a supported photo." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  let stage: "sheet" | "photo" | "log" = "sheet";
  try {
    await prepareActivitySheet();
    stage = "photo";
    const photoResult = await uploadPhotoToBlob({ file: bytes, fileName: `activity/${id}.${extension}` });
    stage = "log";
    await appendActivity({ timestamp, person: (person as string).trim(), action: action as ActivityAction, photoUrl: photoResult.url, id });
    return NextResponse.json({ success: true, id, timestamp });
  } catch (error) {
    const diagnostic = stage === "photo" ? describeBlobFailure(error) : null;
    console.error("Activity save failed:", { id, stage, errorType: error instanceof Error ? error.constructor.name : "UnknownError", code: diagnostic?.code });
    const message = stage === "sheet"
      ? "Could not connect to the activity spreadsheet. Ask the administrator to check Google Sheets access. Your activity was not recorded."
      : stage === "photo"
        ? `${diagnostic?.message} Your activity was not recorded. Code: ${diagnostic?.code}. Reference: ${id}.`
        : `The photo uploaded, but the activity log could not be confirmed. Ask the administrator to check entry ${id} before retrying to avoid a duplicate.`;
    return NextResponse.json({ success: false, error: message, reference: id, code: diagnostic?.code }, { status: 503 });
  }
}
