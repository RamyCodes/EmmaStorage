import { NextResponse } from "next/server";
import { adjustItemStock, appendLogBatch } from "@/lib/sheets";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const item = String(body.item || "").trim();
    const newQuantity = Number(body.newQuantity);
    const reason = String(body.reason || "").trim();
    const adminPassword = String(body.adminPassword || "").trim();
    const adminName = String(body.adminName || "Admin").trim();

    const correctPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (adminPassword !== correctPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Incorrect admin password.",
        },
        { status: 401 }
      );
    }

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Please choose an item to adjust." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(newQuantity) || newQuantity < 0) {
      return NextResponse.json(
        { success: false, error: "New quantity must be a non-negative whole number (0 or more)." },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { success: false, error: "A reason note is required for stock adjustments." },
        { status: 400 }
      );
    }

    // Mutate the Items tab stock directly
    await adjustItemStock(item, newQuantity);

    // Record the adjustment in the Log tab
    const timestamp = new Date().toISOString();
    await appendLogBatch([
      {
        timestamp,
        person: adminName || "Admin",
        action: "StockAdjustment",
        item,
        qty: newQuantity,
        note: `Stock Adjustment: ${reason}`,
        photoUrl: "",
        batchId: `adj_${Date.now()}`,
        stockFlag: "",
      },
    ]);

    return NextResponse.json({
      success: true,
      item,
      newQuantity,
    });
  } catch (error) {
    console.error("Stock adjustment failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json(
      { success: false, error: `Could not perform stock adjustment: ${message}` },
      { status: 500 }
    );
  }
}
