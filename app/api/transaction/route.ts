import { NextResponse } from "next/server";
import {
  appendLogBatch,
  updateItemQuantities,
  uploadPhotoToBlob,
  type ActionType,
  type LogEntry,
} from "@/lib/sheets";

const VALID_ACTIONS: ActionType[] = ["Take Out", "Return", "Used Up"];

interface CartItemPayload {
  item: string;
  qty: number;
  stockFlag?: "Discrepancy" | "";
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let action: string = "";
    let person: string = "";
    let note: string = "";
    let items: CartItemPayload[] = [];
    let photoFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      action = String(formData.get("action") || "").trim();
      person = String(formData.get("person") || "").trim();
      note = String(formData.get("note") || "").trim();

      const itemsRaw = formData.get("items");
      if (typeof itemsRaw === "string") {
        try {
          items = JSON.parse(itemsRaw);
        } catch {
          return NextResponse.json(
            { success: false, error: "Invalid items JSON payload." },
            { status: 400 }
          );
        }
      }

      const fileEntry = formData.get("photo");
      if (fileEntry instanceof File && fileEntry.size > 0) {
        photoFile = fileEntry;
      }
    } else {
      const body = (await request.json()) as Record<string, unknown>;
      action = String(body.action || "").trim();
      person = String(body.person || "").trim();
      note = String(body.note || "").trim();

      if (Array.isArray(body.items)) {
        items = body.items as CartItemPayload[];
      } else if (typeof body.item === "string" && body.qty !== undefined) {
        items = [
          {
            item: body.item,
            qty: Number(body.qty),
            stockFlag:
              body.stockFlag === "Discrepancy" ? "Discrepancy" : "",
          },
        ];
      }
    }

    if (!VALID_ACTIONS.includes(action as ActionType)) {
      return NextResponse.json(
        { success: false, error: "Please choose a valid action." },
        { status: 400 }
      );
    }
    if (!person) {
      return NextResponse.json(
        { success: false, error: "Please select who you are." },
        { status: 400 }
      );
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please add at least one item to your list." },
        { status: 400 }
      );
    }

    const validAction = action as ActionType;

    // A photo is required for Returns
    if (validAction === "Return" && !photoFile) {
      return NextResponse.json(
        {
          success: false,
          error: "A photo of the returned items is required when performing a Return.",
        },
        { status: 400 }
      );
    }

    // Validate all items in the batch
    for (const item of items) {
      if (!item.item || !item.item.trim()) {
        return NextResponse.json(
          { success: false, error: "Every list entry must have a valid item name." },
          { status: 400 }
        );
      }
      const quantity = Number(item.qty);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Quantity for "${item.item}" must be a positive whole number.`,
          },
          { status: 400 }
        );
      }
    }

    const timestamp = new Date().toISOString();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Prepare deltas for stock mutation
    const deltas = items.map((i) => ({
      itemName: i.item,
      delta: validAction === "Return" ? Number(i.qty) : -Number(i.qty),
    }));

    // Run photo upload to Vercel Blob and Sheet quantity updates in parallel
    const photoUploadPromise = (async () => {
      if (!photoFile) return "";
      try {
        console.log(`[API] Uploading photo (${photoFile.size} bytes) to Vercel Blob...`);
        const buffer = Buffer.from(await photoFile.arrayBuffer());
        const fileName = `${batchId}_${photoFile.name || "checkout.jpg"}`;
        const uploadResult = await uploadPhotoToBlob({
          file: buffer,
          fileName,
        });
        console.log(`[API] Blob upload success: ${uploadResult.url}`);
        return uploadResult.formula;
      } catch (uploadErr) {
        console.warn("[API] Vercel Blob photo upload skipped/failed:", uploadErr instanceof Error ? uploadErr.message : uploadErr);
        return "";
      }
    })();

    console.log(`[API] Updating stock and appending log for batch ${batchId}...`);
    const [photoUrl, updatedQuantities] = await Promise.all([
      photoUploadPromise,
      updateItemQuantities(deltas),
    ]);

    // Prepare log rows for batch
    const logEntries: LogEntry[] = items.map((i) => ({
      timestamp,
      person,
      action: validAction,
      item: i.item,
      qty: Number(i.qty),
      note,
      photoUrl,
      batchId,
      stockFlag: i.stockFlag === "Discrepancy" ? "Discrepancy" : "",
    }));

    // Append batch to Log tab
    await appendLogBatch(logEntries);
    console.log(`[API] Batch ${batchId} recorded successfully!`);

    return NextResponse.json({
      success: true,
      batchId,
      updatedQuantities,
      count: items.length,
    });
  } catch (error) {
    console.error("Transaction failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json(
      { success: false, error: `Could not save to Google Sheets: ${message}` },
      { status: 500 }
    );
  }
}
