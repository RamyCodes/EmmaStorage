import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import { getActivities } from "@/lib/activity-store";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  if (!verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Sign in to view activities." }, { status: 401, headers });
  }
  try {
    return NextResponse.json({ activities: await getActivities() }, { headers });
  } catch (error) {
    console.error("Activity dashboard read failed:", error);
    return NextResponse.json({ error: "Could not load activities. Please try again." }, { status: 500, headers });
  }
}