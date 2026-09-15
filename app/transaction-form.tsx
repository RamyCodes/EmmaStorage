"use client";

import { useMemo, useState, useRef, type FormEvent } from "react";
import type { ActionType, SheetItem } from "@/lib/sheets";

const ACTIONS: Array<{
  value: ActionType;
  label: string;
  emoji: string;
  activeClass: string;
  photoPrompt: string;
}> = [
  {
    value: "Take Out",
    label: "Take Out",
    emoji: "📤",
    activeClass: "border-amber-500 bg-amber-500 text-white shadow-amber-200",
    photoPrompt: "Snap a photo of everything you're taking",
  },
  {
    value: "Return",
    label: "Return",
    emoji: "📥",
    activeClass: "border-emerald-600 bg-emerald-600 text-white shadow-emerald-200",
    photoPrompt: "Snap a photo of everything you're returning",
  },
  {
    value: "Used Up",
    label: "Used Up",
    emoji: "🗑️",
    activeClass: "border-rose-600 bg-rose-600 text-white shadow-rose-200",
    photoPrompt: "Snap a photo of everything you've used up",
  },
];

const ACTION_VERB: Record<ActionType, string> = {
  "Take Out": "took out",
  Return: "returned",
  "Used Up": "used up",
  StockAdjustment: "adjusted stock for",
};

export interface CartItem {
  id: string;
  name: string;
  type: string;
  qty: number;
  imageUrl?: string;
  stockFlag?: "Discrepancy" | "";
}

type Status = "idle" | "submitting" | "success" | "error";

// Fast client-side image downscaler to convert large phone snaps (5-15MB) to lightweight web images (~200KB)
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(file);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxWidth = 1400;
      const maxHeight = 1400;
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(file);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file);
          const compressed = new File(
            [blob],
            file.name.replace(/\.[^/.]+$/, "") + ".jpg",
            {
              type: "image/jpeg",
              lastModified: Date.now(),
            }
          );
          resolve(compressed);
        },
        "image/jpeg",
        0.82
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

export default function TransactionForm({
  items: initialItems,
  people,
}: {
  items: SheetItem[];
  people: string[];
}) {
  const [items, setItems] = useState(initialItems);
  const [action, setAction] = useState<ActionType>("Take Out");
  const [selectedItemName, setSelectedItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [person, setPerson] = useState("");
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [lastBatchSummary, setLastBatchSummary] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = useMemo(
    () => items.find((i) => i.name === selectedItemName),
    [items, selectedItemName]
  );

  const currentActionMeta = useMemo(
    () => ACTIONS.find((a) => a.value === action) || ACTIONS[0],
    [action]
  );

  // Check if adding this item would trigger a soft stock warning
  const stockWarning = useMemo(() => {
    if (!selectedItem || action === "Return") return null;

    // Sum existing cart quantities for this item
    const inCartQty = cart
      .filter((c) => c.name === selectedItem.name)
      .reduce((sum, c) => sum + c.qty, 0);
    const totalRequested = inCartQty + itemQty;
    const currentStock = selectedItem.quantity;

    if (totalRequested > currentStock) {
      return {
        type: "negative",
        message: `System shows only ${currentStock} left (requested ${totalRequested}). Continue anyway?`,
      };
    }

    if (
      selectedItem.lowStockThreshold !== undefined &&
      currentStock - totalRequested < selectedItem.lowStockThreshold
    ) {
      return {
        type: "low-threshold",
        message: `System stock will fall to ${currentStock - totalRequested} (below low threshold of ${selectedItem.lowStockThreshold}). Continue anyway?`,
      };
    }

    return null;
  }, [selectedItem, action, cart, itemQty]);

  function addItemToList(isDiscrepancy = false) {
    if (!selectedItemName || !selectedItem) return;

    const existingIndex = cart.findIndex((c) => c.name === selectedItemName);
    if (existingIndex > -1) {
      // Update quantity on existing line
      setCart((prev) =>
        prev.map((c, idx) =>
          idx === existingIndex
            ? {
                ...c,
                qty: c.qty + itemQty,
                stockFlag:
                  isDiscrepancy || c.stockFlag === "Discrepancy"
                    ? "Discrepancy"
                    : "",
              }
            : c
        )
      );
    } else {
      // Add new cart line
      const newLine: CartItem = {
        id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: selectedItem.name,
        type: selectedItem.type,
        qty: itemQty,
        imageUrl: selectedItem.imageUrl,
        stockFlag: isDiscrepancy ? "Discrepancy" : "",
      };
      setCart((prev) => [...prev, newLine]);
    }

    // Reset picker
    setSelectedItemName("");
    setItemQty(1);
    setStatus("idle");
    setMessage("");
  }

  function updateCartQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.id === id) {
            const newQty = c.qty + delta;
            return newQty > 0 ? { ...c, qty: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function removeCartItem(id: string) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Fast client-side image optimization (resizes raw 10MB phone camera snaps to ~200KB)
        const optimizedFile = await compressImage(file);
        setPhotoFile(optimizedFile);
        const url = URL.createObjectURL(optimizedFile);
        setPhotoPreview(url);
      } catch {
        setPhotoFile(file);
        const url = URL.createObjectURL(file);
        setPhotoPreview(url);
      }
    }
  }

  function clearPhoto() {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const isPhotoRequired = action === "Return";
  const isPhotoMissing = isPhotoRequired && !photoFile;

  const canSubmit =
    cart.length > 0 &&
    person !== "" &&
    !isPhotoMissing &&
    status !== "submitting";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isPhotoRequired && !photoFile) {
      setMessage("A photo is required when returning items.");
      setStatus("error");
      return;
    }
    if (!canSubmit) return;

    setStatus("submitting");
    setMessage("");
    setLastBatchSummary(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s safety timeout

    try {
      const formData = new FormData();
      formData.append("action", action);
      formData.append("person", person);
      formData.append("note", note);
      formData.append(
        "items",
        JSON.stringify(
          cart.map((c) => ({
            item: c.name,
            qty: c.qty,
            stockFlag: c.stockFlag || "",
          }))
        )
      );

      if (photoFile) {
        const fileToUpload = await compressImage(photoFile).catch(() => photoFile);
        formData.append("photo", fileToUpload);
      }

      const res = await fetch("/api/transaction", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      let data: { success?: boolean; error?: string; batchId?: string; updatedQuantities?: Record<string, number> };
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned status ${res.status}. Check server logs for details.`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      // Update in-memory quantities
      if (data.updatedQuantities) {
        setItems((prev) =>
          prev.map((i) =>
            data.updatedQuantities && data.updatedQuantities[i.name] !== undefined
              ? { ...i, quantity: data.updatedQuantities[i.name] }
              : i
          )
        );
      }

      const summaryText = cart
        .map((c) => `${c.qty} × ${c.name}${c.stockFlag ? " ⚠️" : ""}`)
        .join(", ");

      const fullMessage = `✅ Recorded: ${person} ${ACTION_VERB[action]} ${summaryText}`;
      setMessage(fullMessage);
      setLastBatchSummary(`Batch ID: ${data.batchId}`);
      setStatus("success");

      // Reset cart and batch inputs, keep person selected
      setCart([]);
      setNote("");
      clearPhoto();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage("Request timed out (took longer than 25s). Please check your internet connection or server logs and try again.");
      } else {
        setMessage(
          error instanceof Error ? error.message : "Something went wrong."
        );
      }
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* 1. Action Selector */}
      <fieldset>
        <legend className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          1. Choose Action
        </legend>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {ACTIONS.map((a) => {
            const isSelected = action === a.value;
            return (
              <button
                key={a.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  setAction(a.value);
                  setStatus("idle");
                  setMessage("");
                }}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 p-3 text-center transition active:scale-95 sm:flex-row sm:gap-2 sm:py-3.5 ${
                  isSelected
                    ? `${a.activeClass} shadow-md`
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="text-xl sm:text-2xl" aria-hidden>
                  {a.emoji}
                </span>
                <span className="text-xs font-bold sm:text-sm">{a.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 2. Item Selector & Add to List */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
          2. Add Items to List
        </h2>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600">
              Select Item
            </span>
            <select
              value={selectedItemName}
              onChange={(e) => setSelectedItemName(e.target.value)}
              className="h-13 rounded-2xl border-2 border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-800 transition focus:border-slate-900 focus:bg-white focus:outline-none"
            >
              <option value="">Choose an item…</option>
              {items.map((i) => (
                <option key={i.name} value={i.name}>
                  {i.name} ({i.quantity} in stock)
                </option>
              ))}
            </select>
          </label>

          {selectedItem && (
            <div className="flex items-center justify-between rounded-xl bg-slate-100/70 px-3 py-2 text-xs text-slate-600">
              <span className="font-semibold">{selectedItem.type}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-bold ${
                  selectedItem.quantity <= 0
                    ? "bg-rose-100 text-rose-700"
                    : selectedItem.lowStockThreshold &&
                        selectedItem.quantity <= selectedItem.lowStockThreshold
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-800"
                }`}
              >
                Stock: {selectedItem.quantity}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-semibold text-slate-600">
                Quantity
              </span>
              <div className="flex h-12 items-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-1">
                <button
                  type="button"
                  onClick={() => setItemQty((q) => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={itemQty}
                  onChange={(e) =>
                    setItemQty(
                      Math.max(1, Math.floor(Number(e.target.value) || 1))
                    )
                  }
                  className="w-full bg-transparent text-center text-base font-bold text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setItemQty((q) => q + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-end pt-5">
              <button
                type="button"
                disabled={!selectedItemName}
                onClick={() => addItemToList(Boolean(stockWarning))}
                className="h-12 rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-40"
              >
                + Add to list
              </button>
            </div>
          </div>

          {/* Soft stock warning (non-blocking) */}
          {stockWarning && (
            <div className="mt-1 flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900">
              <div className="flex items-start gap-2">
                <span className="text-base" aria-hidden>
                  ⚠️
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-amber-950">
                    Stock Notice
                  </p>
                  <p className="mt-0.5 text-amber-800">{stockWarning.message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => addItemToList(true)}
                className="self-end rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700 active:scale-95"
              >
                Continue anyway & add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Multi-Item Cart Running List */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            3. Running Cart
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
            {cart.length} {cart.length === 1 ? "item" : "items"} in list
          </span>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-8 text-center text-slate-400">
            <span className="text-3xl" aria-hidden>
              🎒
            </span>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Your list is empty
            </p>
            <p className="text-xs text-slate-400">
              Select an item above and tap &ldquo;+ Add to list&rdquo;
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {cart.map((line) => (
              <li
                key={line.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 transition"
              >
                {line.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={line.imageUrl}
                    alt={line.name}
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-sm font-bold text-slate-700">
                    📦
                  </div>
                )}

                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-bold text-slate-900">
                    {line.name}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{line.type}</span>
                    {line.stockFlag === "Discrepancy" && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                        ⚠ Discrepancy
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex h-8 items-center rounded-lg border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => updateCartQty(line.id, -1)}
                      className="flex h-7 w-7 items-center justify-center text-sm font-bold text-slate-600 hover:bg-slate-100"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-xs font-bold text-slate-900">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(line.id, 1)}
                      className="flex h-7 w-7 items-center justify-center text-sm font-bold text-slate-600 hover:bg-slate-100"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeCartItem(line.id)}
                    aria-label={`Remove ${line.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 4. Checkout Details (Person + Note + Single Batch Photo) */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            4. Who are you?
          </span>
          <select
            required
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className="h-13 rounded-2xl border-2 border-slate-200 bg-white px-4 text-base font-semibold text-slate-800 transition focus:border-slate-900 focus:outline-none"
          >
            <option value="" disabled>
              Select your name…
            </option>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Note <span className="font-normal lowercase text-slate-400">(optional)</span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything worth mentioning for this batch?"
            className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 focus:border-slate-900 focus:outline-none"
          />
        </label>

        {/* 5. Single Batch Photo Capture */}
        <div className={`rounded-3xl border p-4 shadow-sm sm:p-5 transition ${
          isPhotoRequired && !photoFile
            ? "border-emerald-300 bg-emerald-50/40"
            : "border-slate-200/80 bg-white"
        }`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              📸 {isPhotoRequired ? (
                <span className="text-emerald-800 font-extrabold">
                  Return Photo (Required)
                </span>
              ) : (
                <>
                  Batch Photo <span className="font-normal lowercase text-slate-400">(optional)</span>
                </>
              )}
            </h2>
            {photoPreview ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                ✓ Photo Ready
              </span>
            ) : isPhotoRequired ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                Photo Required
              </span>
            ) : null}
          </div>
          <p className="mb-3 text-xs text-slate-500">
            {currentActionMeta.photoPrompt}
            {isPhotoRequired && " — please snap a clear photo before submitting."}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
            id="batch-photo-input"
          />

          {photoPreview ? (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="Batch preview"
                className="h-44 w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800 backdrop-blur transition active:scale-95"
                >
                  🔄 Retake
                </button>
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="rounded-xl bg-rose-600/90 px-3 py-1.5 text-xs font-bold text-white backdrop-blur transition active:scale-95"
                >
                  ✕ Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 active:scale-98"
            >
              <span className="text-xl" aria-hidden>
                📷
              </span>
              <span className="text-xs font-bold">
                Tap to open camera & snap photo
              </span>
            </button>
          )}
        </div>

        {/* Status messages */}
        {message && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-2xl p-4 text-sm font-medium ${
              status === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            <p>{message}</p>
            {lastBatchSummary && (
              <p className="mt-1 font-mono text-xs text-emerald-600">
                {lastBatchSummary}
              </p>
            )}
          </div>
        )}

        {/* Single Submit Button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-1 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-lg font-bold text-white shadow-md transition active:scale-98 disabled:opacity-40"
        >
          {status === "submitting" ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Recording batch…
            </span>
          ) : (
            `Submit ${cart.length > 0 ? `(${cart.length} item${cart.length === 1 ? "" : "s"})` : ""}`
          )}
        </button>
      </form>
    </div>
  );
}
