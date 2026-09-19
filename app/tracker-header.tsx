"use client";

import { useState, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function getAdminUnlockedSnapshot() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("storage_admin_unlocked") === "true";
}

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export default function TrackerHeader() {
  const router = useRouter();
  const isAdminUnlocked = useSyncExternalStore(
    subscribeToStorage,
    getAdminUnlockedSnapshot,
    () => false
  );

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "verifying" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);

  function handleEasterEggTap() {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setShowPasswordModal(true);
      return;
    }

    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 2500);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setVerifyStatus("verifying");
    setErrorMessage("");

    try {
      const res = await fetch("/api/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Incorrect password.");
      }

      sessionStorage.setItem("storage_admin_unlocked", "true");
      sessionStorage.setItem("storage_admin_password", passwordInput);
      setShowPasswordModal(false);
      setPasswordInput("");
      setVerifyStatus("idle");
      router.push("/dashboard");
    } catch (err) {
      setVerifyStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Incorrect password");
    }
  }

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <div
          onClick={handleEasterEggTap}
          className="cursor-pointer select-none text-left active:opacity-80"
          title="Storage Check-Out Tracker"
        >
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            📦 EmmaStorage Tracker
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Tracker for Emmanuel's Storage
          </p>
        </div>

        {/* Dashboard button only appears if admin is unlocked */}
        {isAdminUnlocked && (
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
          >
            <span>📊</span>
            <span>Dashboard</span>
          </Link>
        )}
      </header>

      {/* Secret Admin Unlock Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔒</span>
                <h3 className="text-lg font-bold text-slate-900">Admin Access</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordInput("");
                  setErrorMessage("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Enter the admin password to unlock the dashboard and stock
              management tools.
            </p>

            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
              <input
                type="password"
                required
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter admin password…"
                className="h-12 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
              />

              {errorMessage && (
                <p className="text-xs font-bold text-rose-600">{errorMessage}</p>
              )}

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordInput("");
                    setErrorMessage("");
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyStatus === "verifying"}
                  className="rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-40"
                >
                  {verifyStatus === "verifying" ? "Verifying…" : "Unlock Dashboard"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
