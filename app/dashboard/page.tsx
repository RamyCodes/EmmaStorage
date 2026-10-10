import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import { getActivities } from "@/lib/activity-store";
import type { ActivityRecord } from "@/lib/activity";
import AdminLogin from "../admin-login";
import DashboardView from "./dashboard-view";

export default async function Dashboard() {
  const authorized = verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
  let activities: ActivityRecord[] = [];
  let error = "";
  if (authorized) {
    try {
      activities = await getActivities();
    } catch (cause) {
      console.error("Activity dashboard read failed:", cause);
      error = "Could not load activities. Please try again.";
    }
  }
  return (
    <main className="dashboard-shell">
      <Link className="back-link" href="/"><ArrowLeft size={16} aria-hidden="true" /> Storage activity</Link>
      {authorized ? <DashboardView initialActivities={activities} initialError={error} /> : (
        <section className="dashboard-login"><h1>Admin access</h1><AdminLogin /></section>
      )}
    </main>
  );
}