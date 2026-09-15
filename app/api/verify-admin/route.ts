import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const password = String(body.password || "").trim();
    const correctPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (!password) {
      return NextResponse.json(
        { success: false, error: "Please enter the admin password." },
        { status: 400 }
      );
    }

    if (password !== correctPassword) {
      return NextResponse.json(
        { success: false, error: "Incorrect admin password." },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to verify password." },
      { status: 500 }
    );
  }
}
