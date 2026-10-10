import { NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_SECONDS, allowLoginAttempt, createAdminSession, isAdminConfigured, isSameOrigin, verifyAdminPassword } from "@/lib/admin-auth";

const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }
  if (!isAdminConfigured()) return NextResponse.json({ error: "Admin access is not configured. Set ADMIN_PASSWORD on the server." }, { status: 503 });
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowLoginAttempt(address)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  let body;
  try {
    if (Number(request.headers.get("content-length")) > 4096) throw new Error("Too large");
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!verifyAdminPassword(body?.password)) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_COOKIE, createAdminSession(), { ...options, maxAge: SESSION_SECONDS });
  return response;
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_COOKIE, "", { ...options, maxAge: 0 });
  return response;
}