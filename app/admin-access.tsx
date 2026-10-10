"use client";

import Image from "next/image";
import { useRef } from "react";
import { X } from "lucide-react";
import AdminLogin from "./admin-login";

export default function AdminAccess() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="brand-logo-button" title="Admin activity log" aria-label="Open admin activity log" onClick={() => dialogRef.current?.showModal()}>
        <Image className="brand-logo" src="/emmanuel-logo.png" width={72} height={72} alt="Emmanuel logo" />
      </button>
      <dialog ref={dialogRef} className="admin-dialog" aria-labelledby="admin-title">
        <div className="dialog-heading">
          <h2 id="admin-title">Admin access</h2>
          <button type="button" className="icon-button" title="Close" aria-label="Close admin access" onClick={() => dialogRef.current?.close()}><X size={18} /></button>
        </div>
        <AdminLogin onSuccess={() => dialogRef.current?.close()} />
      </dialog>
    </>
  );
}