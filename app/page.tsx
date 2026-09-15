import { getItems, getPeople } from "@/lib/sheets";
import TransactionForm from "./transaction-form";
import TrackerHeader from "./tracker-header";

// Always render fresh — the Items/People dropdowns must reflect live sheet data.
export const dynamic = "force-dynamic";

export default async function Home() {
  let items: Awaited<ReturnType<typeof getItems>> = [];
  let people: string[] = [];
  let loadError: string | null = null;

  try {
    [items, people] = await Promise.all([getItems(), getPeople()]);
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Failed to load data from Google Sheets.";
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <TrackerHeader />

      {loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p className="font-semibold">⚠️ Couldn&apos;t load the sheet data</p>
          <p className="mt-1">{loadError}</p>
          <p className="mt-2 text-red-600">
            Check the server&apos;s Google Sheets credentials and try reloading
            the page.
          </p>
        </div>
      ) : (
        <TransactionForm items={items} people={people} />
      )}
    </main>
  );
}
