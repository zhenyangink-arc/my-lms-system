"use client";

import { useState, useTransition } from "react";
import { Plus, Tag } from "lucide-react";

import { updateInterestTagsAction } from "./personal-space-actions";
import { INTEREST_TAG_OPTIONS } from "./interest-tags";

export function PortalTagsCard({
  tags,
  embedded = false,
}: {
  tags: string[];
  embedded?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(tags);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveTags(formData: FormData) {
    startTransition(async () => {
      setError(null);
      try {
        const result = await updateInterestTagsAction(formData);
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

  function toggle(tag: string) {
    setSelected((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : current.length >= 8
          ? current
          : [...current, tag],
    );
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
        <h3 className="text-sm font-black text-slate-950">我的标签</h3>
        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setSelected(tags);
              setError(null);
              setEditing(true);
            }}
            aria-label="编辑我的标签"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {editing ? (
        <form
          action={saveTags}
          className="mt-3 flex flex-1 flex-col justify-between gap-3"
        >
          <div className="flex flex-wrap gap-1.5">
            {INTEREST_TAG_OPTIONS.map((tag) => {
              const active = selected.includes(tag);
              return (
                <label
                  key={tag}
                    className={`inline-flex min-h-9 cursor-pointer items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset transition ${
                    active
                      ? "bg-emerald-600 text-white ring-emerald-600"
                      : "bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="tags"
                    value={tag}
                    checked={active}
                    onChange={() => toggle(tag)}
                    className="sr-only"
                  />
                  #{tag}
                </label>
              );
            })}
          </div>
          {error ? (
            <p className="text-xs font-bold text-red-600" role="alert">{error}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white transition disabled:opacity-60"
            >
              {pending ? "正在保存…" : "保存（最多 8 个）"}
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
        <div className="mt-3 flex flex-1 flex-wrap content-start gap-1.5">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
              >
                #{tag}
              </span>
            ))
          ) : (
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400">
              <Tag size={14} aria-hidden="true" />
              还没有添加标签
            </p>
          )}
        </div>
      )}
    </article>
  );
}
