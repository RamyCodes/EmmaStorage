"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import type { SheetItem, LogEntry } from "@/lib/sheets";

type Tab = "discrepancies" | "stock" | "logs";

function getAdminUnlockedSnapshot() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("storage_admin_unlocked") === "true";
}

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export default function DashboardView({
  initialItems,
  initialLogs,
}: {
  initialItems: SheetItem[];
  initialLogs: LogEntry[];
}) {
  const [items, setItems] = useState<SheetItem[]>(initialItems);
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [activeTab, setActiveTab] = useState<Tab>("discrepancies");

  const isStorageUnlocked = useSyncExternalStore(
    subscribeToStorage,
    getAdminUnlockedSnapshot,
    () => false
  );
  const [isUnlockedDirect, setIsUnlockedDirect] = useState(false);
  const isUnlocked = isStorageUnlocked || isUnlockedDirect;

  const [adminPassword, setAdminPassword] = useState("");
  const [loginPasswordInput, setLoginPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Adjust stock modal state
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState("");
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustName, setAdjustName] = useState("Admin");
  const [adjustStatus, setAdjustStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [adjustMessage, setAdjustMessage] = useState("");

  async function handleUnlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loginPasswordInput.trim()) return;

    setIsVerifying(true);
    setLoginError("");

    try {
      const res = await fetch("/api/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginPasswordInput }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Incorrect password.");
      }

      sessionStorage.setItem("storage_admin_unlocked", "true");
      sessionStorage.setItem("storage_admin_password", loginPasswordInput);
      setAdminPassword(loginPasswordInput);
      setIsUnlockedDirect(true);
      setLoginError("");
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Incorrect password.");
    } finally {
      setIsVerifying(false);
    }
  }

  const discrepancies = useMemo(
    () => logs.filter((l) => l.stockFlag === "Discrepancy"),
    [logs]
  );

  const lowStockItems = useMemo(
    () =>
      items.filter(
        (i) =>
          i.quantity <= 0 ||
          (i.lowStockThreshold !== undefined && i.quantity <= i.lowStockThreshold)
      ),
    [items]
  );

  async function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustItem || !adjustReason) return;

    setAdjustStatus("submitting");
    setAdjustMessage("");

    try {
      const activePassword =
        adminPassword || sessionStorage.getItem("storage_admin_password") || "";

      const res = await fetch("/api/adjust-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: adjustItem,
          newQuantity: adjustQty,
          reason: adjustReason,
          adminPassword: activePassword,
          adminName: adjustName,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to adjust stock.");
      }

      // Update in-memory items
      setItems((prev) =>
        prev.map((i) => (i.name === adjustItem ? { ...i, quantity: adjustQty } : i))
      );

      // Prepend to local log
      const newLogEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        person: adjustName || "Admin",
        action: "StockAdjustment",
        item: adjustItem,
        qty: adjustQty,
        note: `Stock Adjustment: ${adjustReason}`,
        photoUrl: "",
        batchId: `adj_${Date.now()}`,
        stockFlag: "",
      };
      setLogs((prev) => [newLogEntry, ...prev]);

      setAdjustStatus("success");
      setAdjustMessage(`✓ Successfully adjusted stock for "${adjustItem}" to ${adjustQty}.`);
      setTimeout(() => {
        setIsAdjustOpen(false);
        setAdjustStatus("idle");
        setAdjustMessage("");
        setAdjustReason("");
      }, 1500);
    } catch (err) {
      setAdjustStatus("error");
      setAdjustMessage(err instanceof Error ? err.message : "Error adjusting stock.");
    }
  }

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          <span className="text-4xl" aria-hidden>
            🔒
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Admin Password Required
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              The storage dashboard is reserved for authorized admins.
            </p>
          </div>

          <form onSubmit={handleUnlockSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              required
              autoFocus
              value={loginPasswordInput}
              onChange={(e) => setLoginPasswordInput(e.target.value)}
              placeholder="Enter admin password…"
              className="h-12 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
            />

            {loginError && (
              <p className="text-xs font-bold text-rose-600">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="h-12 rounded-2xl bg-slate-900 text-sm font-bold text-white transition active:scale-95 disabled:opacity-40"
            >
              {isVerifying ? "Verifying…" : "Unlock Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Discrepancies
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-600">
              {discrepancies.length}
            </span>
            <span className="text-xs text-slate-500">flagged</span>
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Low Stock
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-600">
              {lowStockItems.length}
            </span>
            <span className="text-xs text-slate-500">items</span>
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Total Catalog
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-800">
              {items.length}
            </span>
            <span className="text-xs text-slate-500">items</span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        {/* Navigation Tabs */}
        <div className="flex gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("discrepancies")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 transition ${
              activeTab === "discrepancies"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>⚠️</span>
            <span>Discrepancies</span>
            {discrepancies.length > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] text-amber-800">
                {discrepancies.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("stock")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 transition ${
              activeTab === "stock"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📦</span>
            <span>Live Stock</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 transition ${
              activeTab === "logs"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📜</span>
            <span>Activity Log</span>
          </button>
        </div>

        {/* Adjust Stock Button */}
        <button
          type="button"
          onClick={() => {
            if (items.length > 0 && !adjustItem) {
              setAdjustItem(items[0].name);
              setAdjustQty(items[0].quantity);
            }
            setIsAdjustOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-2xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
        >
          <span>⚖️</span>
          <span>Adjust Stock</span>
        </button>
      </div>

      {/* Tab 1: Discrepancies View */}
      {activeTab === "discrepancies" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              ⚠️ Filtered Stock Discrepancy Log
            </h2>
            <span className="text-xs text-slate-400">
              Rows submitted past soft stock warning
            </span>
          </div>

          {discrepancies.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white py-12 text-center text-slate-400">
              <span className="text-3xl" aria-hidden>
                ✨
              </span>
              <p className="mt-2 text-sm font-bold text-slate-700">
                No Stock Discrepancies!
              </p>
              <p className="text-xs text-slate-400">
                All checkout quantities have stayed within expected stock limits.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {discrepancies.map((d, i) => (
                <div
                  key={`${d.batchId || i}-${d.timestamp}-${d.item}`}
                  className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-slate-800"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {d.person}
                        </span>
                        <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-900">
                          Discrepancy
                        </span>
                      </div>
                      <p className="mt-0.5 text-slate-600">
                        {d.action}: <strong className="text-slate-900">{d.qty} × {d.item}</strong>
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {d.timestamp ? new Date(d.timestamp).toLocaleString() : ""}
                    </span>
                  </div>

                  {d.note && (
                    <p className="rounded-xl bg-amber-100/60 p-2 text-amber-900">
                      <span className="font-semibold">Note:</span> {d.note}
                    </p>
                  )}

                  {d.photoUrl && (
                    <div className="mt-1">
                      <span className="text-[10px] text-slate-500">Photo attached to batch</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live Stock View */}
      {activeTab === "stock" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            📦 Live Catalog &amp; Current Stock
          </h2>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3">Item</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Stock</th>
                  <th className="p-3 text-right">Low Threshold</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const isLow =
                    item.quantity <= 0 ||
                    (item.lowStockThreshold !== undefined &&
                      item.quantity <= item.lowStockThreshold);

                  return (
                    <tr key={item.name} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-900">
                        {item.name}
                      </td>
                      <td className="p-3 text-slate-500">{item.type}</td>
                      <td className="p-3 text-right">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-bold ${
                            item.quantity <= 0
                              ? "bg-rose-100 text-rose-700"
                              : isLow
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {item.quantity}
                        </span>
                      </td>
                      <td className="p-3 text-right text-slate-400 font-mono">
                        {item.lowStockThreshold !== undefined
                          ? item.lowStockThreshold
                          : "—"}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustItem(item.name);
                            setAdjustQty(item.quantity);
                            setIsAdjustOpen(true);
                          }}
                          className="rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-700 hover:bg-slate-200"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Recent Activity Logs */}
      {activeTab === "logs" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            📜 Recent Activity (Audit Log)
          </h2>
          <div className="flex flex-col gap-2.5">
            {logs.map((l, i) => (
              <div
                key={`${l.batchId || i}-${l.timestamp}-${l.item}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-xs shadow-sm"
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{l.person}</span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                        l.action === "Return"
                          ? "bg-emerald-100 text-emerald-800"
                          : l.action === "Used Up"
                            ? "bg-rose-100 text-rose-800"
                            : l.action === "StockAdjustment"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {l.action}
                    </span>
                    {l.stockFlag === "Discrepancy" && (
                      <span className="rounded bg-amber-200 px-1.5 py-0.2 text-[10px] font-bold text-amber-900">
                        ⚠ Discrepancy
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600">
                    <strong className="text-slate-900">{l.qty} × {l.item}</strong>
                    {l.note && <span className="text-slate-500"> — {l.note}</span>}
                  </p>
                  <span className="font-mono text-[10px] text-slate-400">
                    {l.timestamp ? new Date(l.timestamp).toLocaleString() : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {isAdjustOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                ⚖️ Adjust Stock Count
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Directly corrects the item stock count in the Sheet and records an
              official `StockAdjustment` audit row.
            </p>

            <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-700">Item</span>
                <select
                  required
                  value={adjustItem}
                  onChange={(e) => {
                    setAdjustItem(e.target.value);
                    const it = items.find((i) => i.name === e.target.value);
                    if (it) setAdjustQty(it.quantity);
                  }}
                  className="h-12 rounded-2xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800"
                >
                  {items.map((i) => (
                    <option key={i.name} value={i.name}>
                      {i.name} (Current: {i.quantity})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-700">
                  New Corrected Stock Count
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value) || 0)}
                  className="h-12 rounded-2xl border-2 border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-700">
                  Required Reason Note
                </span>
                <textarea
                  required
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Physical inventory recount / damaged items discarded"
                  className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-3 text-xs text-slate-800"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-700">
                  Admin Name / Identifier
                </span>
                <input
                  type="text"
                  value={adjustName}
                  onChange={(e) => setAdjustName(e.target.value)}
                  placeholder="Admin"
                  className="h-12 rounded-2xl border-2 border-slate-200 bg-slate-50 px-3 text-sm text-slate-800"
                />
              </label>

              {adjustMessage && (
                <div
                  className={`rounded-2xl p-3 text-xs font-bold ${
                    adjustStatus === "success"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {adjustMessage}
                </div>
              )}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustStatus === "submitting"}
                  className="rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-40"
                >
                  {adjustStatus === "submitting" ? "Saving..." : "Save Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
