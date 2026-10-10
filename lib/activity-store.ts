import "server-only";
import { JWT } from "google-auth-library";
import { put } from "@vercel/blob";
import type { ActivityAction, ActivityRecord } from "./activity";

let authClient: JWT | undefined;

function getGoogleAuth() {
  if (authClient) return authClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) throw new Error("Missing Google service account credentials.");
  key = key.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  authClient = new JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return authClient;
}

async function sheetRequest(path: string, method = "GET", body?: unknown) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEET_ID.");
  const { token } = await getGoogleAuth().getAccessToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}${path}`,
    {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    }
  );
  if (!response.ok) throw new Error(`Google Sheets request failed (${response.status}).`);
  return response.json();
}

export async function prepareActivitySheet() {
  const metadata = await sheetRequest("?fields=sheets.properties");
  const exists = (data: { sheets?: { properties?: { title?: string } }[] }) =>
    data.sheets?.some((sheet) => sheet.properties?.title === "Activity");
  if (exists(metadata)) return;
  try {
    await sheetRequest(":batchUpdate", "POST", {
      requests: [{ addSheet: { properties: { title: "Activity", gridProperties: { frozenRowCount: 1 } } } }],
    });
  } catch (error) {
    if (!exists(await sheetRequest("?fields=sheets.properties.title"))) throw error;
  }
  await sheetRequest("/values/Activity!A1:F1?valueInputOption=RAW", "PUT", {
    values: [["Time (UTC)", "Name", "Action", "Photo", "Photo URL", "Entry ID"]],
  });
}

export async function appendActivity(entry: {
  timestamp: string;
  person: string;
  action: ActivityAction;
  photoUrl: string;
  id: string;
}) {
  await sheetRequest("/values/Activity!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS", "POST", {
    values: [[entry.timestamp, `'${entry.person}`, entry.action, `=IMAGE("${entry.photoUrl}")`, entry.photoUrl, entry.id]],
  });
}

export async function uploadPhotoToBlob({ file, fileName }: { file: Buffer; fileName: string }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) throw new Error("Missing BLOB_READ_WRITE_TOKEN.");
  return put(fileName, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN.trim(),
    abortSignal: AbortSignal.timeout(20000),
  });
}

export async function getActivities(): Promise<ActivityRecord[]> {
  const metadata = await sheetRequest("?fields=sheets.properties.title");
  if (!metadata.sheets?.some((sheet: { properties?: { title?: string } }) => sheet.properties?.title === "Activity")) return [];
  const data = await sheetRequest("/values/Activity!A2:F?valueRenderOption=FORMATTED_VALUE");
  const rows: unknown[][] = data.values ?? [];
  return rows.filter((row) => row[0] && ["Take", "Return", "Consume"].includes(String(row[2]))).slice(-500).reverse().map((row, index) => {
    const rawUrl = String(row[4] ?? "");
    let photoUrl = "";
    try {
      const url = new URL(rawUrl);
      if (url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com")) photoUrl = url.href;
    } catch {}
    return {
      timestamp: String(row[0]),
      person: String(row[1] ?? ""),
      action: row[2] as ActivityAction,
      photoUrl,
      id: String(row[5] ?? "") || `row-${index}`,
    };
  });
}