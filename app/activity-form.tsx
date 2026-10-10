"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Camera, Check, CheckCheck, ImagePlus, LoaderCircle, RotateCcw, X } from "lucide-react";
import { ACTIONS, MAX_PHOTO_BYTES, type ActivityAction } from "@/lib/activity";

const actionIcons = { Take: ArrowUpRight, Return: ArrowDownLeft, Consume: CheckCheck };

async function preparePhoto(file: File): Promise<File> {
  const source = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this photo.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not prepare this photo.")), "image/jpeg", 0.82);
    });
    if (blob.size > MAX_PHOTO_BYTES) throw new Error("Choose a smaller photo, under 3 MB.");
    return new File([blob], "items.jpg", { type: "image/jpeg" });
  } catch (error) {
    if (error instanceof Error && error.message.includes("3 MB")) throw error;
    throw new Error("This photo could not be opened. Try a JPEG, PNG, or WebP image.");
  } finally {
    URL.revokeObjectURL(source);
  }
}

export default function ActivityForm() {
  const [action, setAction] = useState<ActivityAction>("Take");
  const [person, setPerson] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState<"idle" | "preparing" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const [savedTime, setSavedTime] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const submitLock = useRef(false);
  const photoVersion = useRef(0);
  const successRef = useRef<HTMLHeadingElement>(null);
  const busy = status === "preparing" || status === "saving";

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  useEffect(() => {
    if (status === "saved") successRef.current?.focus();
  }, [status]);

  async function selectPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const version = ++photoVersion.current;
    setError("");
    setStatus("preparing");
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error("Choose a photo smaller than 30 MB.");
      if (file.type === "image/svg+xml" || (file.type && !file.type.startsWith("image/"))) {
        throw new Error("Choose a photo, not a document.");
      }
      const prepared = await preparePhoto(file);
      if (version === photoVersion.current) {
        setPhoto(prepared);
        setPreview(URL.createObjectURL(prepared));
      }
    } catch (error) {
      if (version === photoVersion.current) setError(error instanceof Error ? error.message : "Could not open this photo.");
    } finally {
      if (version === photoVersion.current) setStatus("idle");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || busy) return;
    if (!person.trim()) { setError("Enter your name."); return; }
    if (!photo) { setError("Add a photo of all the items."); return; }
    submitLock.current = true;
    setStatus("saving");
    setError("");
    const form = new FormData();
    form.set("person", person.trim());
    form.set("action", action);
    form.set("photo", photo);
    try {
      const response = await fetch("/api/transaction", { method: "POST", body: form, signal: AbortSignal.timeout(110000) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || "Could not save. Check your connection and try again.");
      setSavedTime(new Date(result.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
      setStatus("saved");
      setPhoto(null);
      setPreview("");
    } catch (error) {
      setError(error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError" || error instanceof TypeError)
        ? "The server response could not be confirmed. Check the activity log with the administrator before retrying to avoid a duplicate."
        : error instanceof Error ? error.message : "Could not save your activity.");
      setStatus("idle");
    } finally {
      submitLock.current = false;
    }
  }

  if (status === "saved") {
    return (
      <section className="success-view" aria-live="polite">
        <div className="success-mark"><Check size={32} aria-hidden="true" /></div>
        <p className="eyebrow">Activity recorded</p>
        <h2 ref={successRef} tabIndex={-1}>Thank you, {person.trim()}.</h2>
        <p className="saved-detail">{action} <span aria-hidden="true">/</span> {savedTime}</p>
        <button className="submit-button" onClick={() => { setStatus("idle"); setPerson(""); setAction("Take"); }}>
          <RotateCcw size={18} aria-hidden="true" /> New activity
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="activity-form" aria-busy={busy}>
      <fieldset disabled={busy}>
        <div className="name-field">
          <label htmlFor="person">Your name</label>
          <input id="person" name="person" autoComplete="name" placeholder="First and last name" required maxLength={100} value={person} onChange={(event) => setPerson(event.target.value)} />
        </div>
        <div className="action-field">
          <span id="action-label" className="field-label">Activity</span>
          <div className="action-options" role="group" aria-labelledby="action-label">
            {ACTIONS.map((option) => {
              const Icon = actionIcons[option];
              return <button key={option} type="button" className={`action-option action-${option.toLowerCase()}`} aria-pressed={action === option} onClick={() => { setAction(option); setError(""); }}><Icon size={21} aria-hidden="true" /><span>{option}</span></button>;
            })}
          </div>
        </div>
        <div className="photo-field">
          <div className="photo-label"><span className="field-label">Items photo</span><span className="required-label">Required</span></div>
          <input ref={cameraRef} className="visually-hidden" type="file" accept="image/*" capture="environment" aria-label="Take a photo of the items" onChange={selectPhoto} tabIndex={-1} />
          <input ref={galleryRef} className="visually-hidden" type="file" accept="image/*" aria-label="Choose a photo of the items" onChange={selectPhoto} tabIndex={-1} />
          {photo && preview ? (
            <div className="photo-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Items to be recorded" />
              <button className="remove-photo icon-button" type="button" title="Remove photo" aria-label="Remove photo" onClick={() => { setPhoto(null); setPreview(""); }}><X size={18} /></button>
              <span className="photo-ready"><Check size={14} aria-hidden="true" /> Photo ready</span>
            </div>
          ) : (
            <button className="photo-capture" type="button" onClick={() => cameraRef.current?.click()}>
              <span className="camera-mark"><Camera size={29} strokeWidth={1.5} aria-hidden="true" /></span>
              <span>{status === "preparing" ? "Preparing photo..." : "Take a photo"}</span>
            </button>
          )}
          <button className="gallery-button" type="button" onClick={() => galleryRef.current?.click()}><ImagePlus size={16} aria-hidden="true" /> {photo ? "Choose another photo" : "Choose from gallery"}</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="submit-button" type="submit" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={19} aria-hidden="true" /> : <Check size={19} aria-hidden="true" />}
          {status === "saving" ? "Saving activity..." : status === "preparing" ? "Preparing photo..." : `Record ${action.toLowerCase()}`}
        </button>
      </fieldset>
    </form>
  );
}