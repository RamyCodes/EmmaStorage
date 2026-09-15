import { getItems, getLogRows } from "@/lib/sheets";
import DashboardView from "./dashboard-view";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let items: Awaited<ReturnType<typeof getItems>> = [];
  let logs: Awaited<ReturnType<typeof getLogRows>> = [];
  let loadError: string | null = null;

  try {
    [items, logs] = await Promise.all([getItems(), getLogRows(200)]);
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Failed to load dashboard data from Google Sheets.";
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            📊 Storage Dashboard
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Stock levels, discrepancy alerts, and adjustment audit
          </p>
        </div>
        <Link
          href="/"
          className="rounded-2xl border-2 border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-900 hover:text-slate-900 active:scale-95"
        >
          ← Back to Tracker
        </Link>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <p className="font-semibold">⚠️ Couldn&apos;t load data from Google Sheets</p>
          <p className="mt-1">{loadError}</p>
        </div>
      ) : (
        <DashboardView initialItems={items} initialLogs={logs} />
      )}
    </main>
  );
}
