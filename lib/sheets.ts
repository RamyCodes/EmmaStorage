import "server-only";
import { google } from "googleapis";
import { put } from "@vercel/blob";

export type ActionType = "Take Out" | "Return" | "Used Up" | "StockAdjustment";

export type SheetItem = {
  name: string;
  type: string;
  quantity: number;
  imageUrl: string;
  lowStockThreshold?: number;
};

export type LogEntry = {
  timestamp: string;
  person: string;
  action: ActionType;
  item: string;
  qty: number;
  note: string;
  photoUrl: string;
  batchId?: string;
  stockFlag?: "Discrepancy" | "";
};

const ITEMS_RANGE = "Items!A2:E";
const PEOPLE_RANGE = "People!A2:A";
const LOG_RANGE = "Log!A:I";
const LOG_READ_RANGE = "Log!A2:I";

function getGoogleAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error(
      "Missing Google Service Account credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY."
    );
  }

  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// Lazily builds an authenticated Sheets client from service-account env vars.
export function getSheetsClient() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID environment variable.");
  }

  const auth = getGoogleAuth();
  return { sheets: google.sheets({ version: "v4", auth }), spreadsheetId };
}

export async function getItems(): Promise<SheetItem[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: ITEMS_RANGE,
  });

  const rows = res.data.values ?? [];
  return rows
    .filter((row) => row[0])
    .map((row) => {
      const thresholdRaw = row[4];
      const lowStockThreshold =
        thresholdRaw !== undefined && thresholdRaw !== ""
          ? Number(thresholdRaw) || 0
          : undefined;

      return {
        name: String(row[0] ?? "").trim(),
        type: String(row[1] ?? "").trim() || "Item",
        quantity: Number(row[2] ?? 0) || 0,
        imageUrl: String(row[3] ?? "").trim(),
        lowStockThreshold,
      };
    });
}

export async function getPeople(): Promise<string[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: PEOPLE_RANGE,
  });

  const rows = res.data.values ?? [];
  return rows.map((row) => String(row[0] ?? "").trim()).filter(Boolean);
}

export async function getLogRows(limit = 100): Promise<LogEntry[]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: LOG_READ_RANGE,
  });

  const rows = res.data.values ?? [];
  const entries: LogEntry[] = rows
    .filter((row) => row[0] || row[3])
    .map((row) => ({
      timestamp: String(row[0] ?? "").trim(),
      person: String(row[1] ?? "").trim(),
      action: (String(row[2] ?? "").trim() as ActionType) || "Take Out",
      item: String(row[3] ?? "").trim(),
      qty: Number(row[4] ?? 0) || 0,
      note: String(row[5] ?? "").trim(),
      photoUrl: String(row[6] ?? "").trim(),
      batchId: String(row[7] ?? "").trim(),
      stockFlag:
        String(row[8] ?? "").trim() === "Discrepancy" ? "Discrepancy" : "",
    }));

  return entries.slice(-limit).reverse();
}

export async function appendLogBatch(entries: LogEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const { sheets, spreadsheetId } = getSheetsClient();

  const values = entries.map((entry) => [
    entry.timestamp,
    entry.person,
    entry.action,
    entry.item,
    entry.qty,
    entry.note,
    entry.photoUrl,
    entry.batchId || "",
    entry.stockFlag || "",
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: LOG_RANGE,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}

// Updates multiple item quantities in a single fetch-and-update flow.
export async function updateItemQuantities(
  deltas: { itemName: string; delta: number }[]
): Promise<Record<string, number>> {
  if (deltas.length === 0) return {};

  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: ITEMS_RANGE,
  });

  const rows = res.data.values ?? [];
  const updatedQuantities: Record<string, number> = {};
  const updateData: Array<{ range: string; values: number[][] }> = [];

  for (const { itemName, delta } of deltas) {
    const index = rows.findIndex(
      (row) =>
        String(row[0] ?? "")
          .trim()
          .toLowerCase() === itemName.trim().toLowerCase()
    );

    if (index === -1) {
      throw new Error(`Item "${itemName}" was not found in the Items sheet.`);
    }

    const currentQuantity = Number(rows[index][2] ?? 0) || 0;
    const newQuantity = currentQuantity + delta;
    rows[index][2] = newQuantity;
    updatedQuantities[itemName] = newQuantity;

    const rowNumber = index + 2;
    updateData.push({
      range: `Items!C${rowNumber}`,
      values: [[newQuantity]],
    });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: updateData,
    },
  });

  return updatedQuantities;
}

// Adjusts an item's stock directly to a new absolute quantity.
export async function adjustItemStock(
  itemName: string,
  newQuantity: number
): Promise<number> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: ITEMS_RANGE,
  });

  const rows = res.data.values ?? [];
  const index = rows.findIndex(
    (row) =>
      String(row[0] ?? "")
        .trim()
        .toLowerCase() === itemName.trim().toLowerCase()
  );

  if (index === -1) {
    throw new Error(`Item "${itemName}" was not found in the Items sheet.`);
  }

  const rowNumber = index + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Items!C${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[newQuantity]] },
  });

  return newQuantity;
}

// Uploads a batch checkout photo to Vercel Blob and returns a thumbnail formula for Google Sheets.
export async function uploadPhotoToBlob({
  file,
  fileName,
}: {
  file: File | Buffer;
  fileName: string;
}): Promise<{ url: string; formula: string }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token || token.includes("***") || token === "vercel_blob_rw_token_here") {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is missing or contains placeholder asterisks. Please copy the unmasked token from Vercel (click 'Show secret' or 'Copy Snippet')."
    );
  }

  // 12-second safety timeout so a slow blob upload never blocks the entire batch transaction
  const uploadPromise = put(fileName, file, {
    access: "public",
    token,
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Vercel Blob upload timed out after 12s")), 12000)
  );

  const blob = await Promise.race([uploadPromise, timeoutPromise]);
  const formula = `=IMAGE("${blob.url}")`;

  return {
    url: blob.url,
    formula,
  };
}
