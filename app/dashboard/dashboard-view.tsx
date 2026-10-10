"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, LoaderCircle, LogOut, RefreshCw, Search } from "lucide-react";
import { ACTIONS, type ActivityRecord } from "@/lib/activity";

export default function DashboardView({ initialActivities, initialError }: { initialActivities: ActivityRecord[]; initialError: string }) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityRecord[]>(initialActivities);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("All");
  const [signingOut, setSigningOut] = useState(false);
  const refreshRef = useRef<AbortController | null>(null);

  async function load(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/admin/activities", { cache: "no-store", signal });
      if (signal?.aborted) return;
      if (response.status === 401) { router.refresh(); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load activities.");
      if (!signal?.aborted) setActivities(result.activities);
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : "Could not load activities.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    return () => { refreshRef.current?.abort(); };
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/admin/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      setActivities([]);
      router.replace("/");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign out.");
      setSigningOut(false);
    }
  }

  const filtered = activities.filter((entry) => (action === "All" || entry.action === action) && entry.person.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <header className="dashboard-heading">
        <div><p className="eyebrow">Emmanuel Egypt</p><h1>Activity log</h1></div>
        <div className="dashboard-tools">
          <button className="icon-button" type="button" title="Refresh activities" aria-label="Refresh activities" disabled={loading} onClick={() => { setLoading(true); setError(""); refreshRef.current?.abort(); const controller = new AbortController(); refreshRef.current = controller; void load(controller.signal); }}><RefreshCw size={18} className={loading ? "spin" : ""} /></button>
          <button className="icon-button" type="button" title="Sign out" aria-label="Sign out" disabled={signingOut} onClick={signOut}><LogOut size={18} /></button>
        </div>
      </header>
      <div className="activity-totals" aria-label="Activity totals">
        {ACTIONS.map((option) => <div key={option}><span>{option}</span><strong>{activities.filter((entry) => entry.action === option).length}</strong></div>)}
      </div>
      <div className="log-filters">
        <label className="log-search"><Search size={16} aria-hidden="true" /><span className="visually-hidden">Search by name</span><input type="search" placeholder="Search by name" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="log-action"><span className="visually-hidden">Filter by action</span><select value={action} onChange={(event) => setAction(event.target.value)}>{["All", ...ACTIONS].map((option) => <option key={option} value={option}>{option === "All" ? "All activities" : option}</option>)}</select></label>
      </div>
      <p className="log-count">{filtered.length} {filtered.length === 1 ? "activity" : "activities"} / Latest 500 entries</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="log-empty" role="status"><LoaderCircle size={18} className="spin" aria-hidden="true" /> Loading activities...</p>}
      {!loading && !error && filtered.length === 0 && <p className="log-empty">{activities.length ? "No matching activities." : "No activities recorded yet."}</p>}
      {filtered.length > 0 && (
        <div className="log-table-wrap">
          <table className="log-table">
            <thead><tr><th scope="col">Person</th><th scope="col">Action</th><th scope="col">When</th><th scope="col">Photo</th></tr></thead>
            <tbody>{filtered.map((entry, index) => {
              const date = new Date(entry.timestamp);
              const validDate = !Number.isNaN(date.getTime());
              return <tr key={`${entry.id}-${index}`}><td>{entry.person}</td><td><span className={`log-badge badge-${entry.action.toLowerCase()}`}>{entry.action}</span></td><td>{validDate ? <time dateTime={entry.timestamp}>{date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time> : entry.timestamp}</td><td>{entry.photoUrl ? <a className="photo-link" href={entry.photoUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open photo for ${entry.person}`} title="Open photo"><ExternalLink size={17} aria-hidden="true" /></a> : <span className="missing-photo">None</span>}</td></tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </>
  );
}