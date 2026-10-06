"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Receipt } from "@/lib/types";
import { ReceiptView } from "./receipt";

// Receipt on screen plus a copy portalled to <body> that is the only thing
// printed (see .print-root in globals.css).
export function ReceiptDialog({
  receipt,
  onClose,
  heading,
  closeLabel = "إغلاق",
  children,
}: {
  receipt: Receipt;
  onClose: () => void;
  heading?: string;
  closeLabel?: string;
  children?: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`فاتورة رقم ${receipt.invoice_no}`}
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
        {heading && <p className="mb-3 text-center font-semibold text-emerald-700">{heading}</p>}
        <div className="rounded-lg border border-dashed border-gray-300 p-3">
          <ReceiptView receipt={receipt} />
        </div>
        {children}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-gray-900 py-2.5 font-semibold text-white"
          >
            طباعة
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-600 py-2.5 font-semibold text-white"
          >
            {closeLabel}
          </button>
        </div>
      </div>
      {createPortal(
        <div className="print-root">
          <ReceiptView receipt={receipt} />
        </div>,
        document.body,
      )}
    </div>
  );
}
