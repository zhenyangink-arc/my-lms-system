"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ArrowLeft, PencilLine } from "lucide-react";

export function ProfileDialogView({
  summary,
  form,
}: {
  summary: ReactNode;
  form: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <div hidden={editing}>
        {summary}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          <PencilLine size={16} aria-hidden="true" />
          编辑个人资料
        </button>
      </div>

      <div hidden={!editing}>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          返回资料概览
        </button>
        {form}
      </div>
    </div>
  );
}
