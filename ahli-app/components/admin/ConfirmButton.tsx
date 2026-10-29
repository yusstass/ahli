"use client";
import { useRef } from "react";
// Must be rendered inside a <form>. Validates the form, asks for confirmation, then submits.
export default function ConfirmButton({ label, message, danger = false }: { label: string; message: string; danger?: boolean }) {
  const d = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={(e) => { if (e.currentTarget.form?.reportValidity() !== false) d.current?.showModal(); }}
        className={`min-h-[40px] rounded-full px-4 text-sm font-semibold ${danger ? "bg-[#b3261e] text-white" : "bg-[#0f7a79] text-white"}`}>{label}</button>
      <dialog ref={d} className="max-w-sm rounded-2xl p-6 text-[#12263F] backdrop:bg-black/50">
        <p className="font-semibold">{message}</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={() => d.current?.close()} className="min-h-[40px] rounded-full border border-[#12263F] px-4 text-sm font-semibold">Cancel</button>
          <button type="submit" onClick={() => d.current?.close()} className={`min-h-[40px] rounded-full px-4 text-sm font-semibold text-white ${danger ? "bg-[#b3261e]" : "bg-[#0f7a79]"}`}>Confirm</button>
        </div>
      </dialog>
    </>
  );
}
