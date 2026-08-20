"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function PrintCertificateButton() {
  useEffect(() => {
    const preparePrint = () => document.body.classList.add("completion-printing");
    const finishPrint = () => document.body.classList.remove("completion-printing");
    window.addEventListener("beforeprint", preparePrint);
    window.addEventListener("afterprint", finishPrint);
    return () => {
      window.removeEventListener("beforeprint", preparePrint);
      window.removeEventListener("afterprint", finishPrint);
      finishPrint();
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--foreground)] outline-none transition hover:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 sm:w-auto"
    >
      <Printer size={17} aria-hidden="true" />
      打印证书
    </button>
  );
}
