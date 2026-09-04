"use client";

import { useState, useTransition } from "react";
import { PencilLine, Quote } from "lucide-react";

import { updateMottoAction } from "./personal-space-actions";

export function PortalMottoCard({
  motto,
  embedded = false,
}: {
  motto: string | null;
  embedded?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveMotto(formData: FormData) {
    startTransition(async () => {
      setError(null);
      try {
        const result = await updateMottoAction(formData);
        if (result.saved) {
          setEditing(false);
          return;
        }
        setError(result.error);
      } catch {
        setError("保存失败，请稍后再试。");
      }
    });
  }

  return (
    <article
      className={
        embedded
          ? "flex h-full flex-col p-5 sm:p-6"
          : "flex h-full flex-col rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_16px_48px_-32px_rgba(15,23,42,0.4)]"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-slate-950">我的一句话</h3>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="编辑我的一句话"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <PencilLine size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {editing ? (
        <form
          action={saveMotto}
          className="mt-3 flex flex-1 flex-col justify-between gap-3"
        >
          <div>
            <textarea
              name="motto"
              defaultValue={motto ?? ""}
              maxLength={60}
              rows={3}
              placeholder="写一句最能代表你的话吧"
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
            {error ? (
              <p className="mt-1.5 text-xs font-bold text-red-600" role="alert">{error}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white transition disabled:opacity-60"
            >
              {pending ? "正在保存…" : "保存"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              取消
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-1 items-center">
          {motto ? (
            <p className="flex items-start gap-2 text-sm font-semibold italic leading-6 text-slate-700">
              <Quote size={15} className="mt-0.5 shrink-0 text-slate-300" aria-hidden="true" />
              {motto}
            </p>
          ) : (
            <p className="text-sm font-semibold text-slate-400">还没有写一句话，点右上角编辑一下吧。</p>
          )}
        </div>
      )}
    </article>
  );
}
