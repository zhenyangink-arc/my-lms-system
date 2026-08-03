"use client";

import { useActionState } from "react";
import { Save, Send } from "lucide-react";

import { initialHelpCenterActionState } from "@/app/dashboard/help/action-state";
import { createHelpArticleAction, updateHelpArticleAction } from "@/app/dashboard/help/actions";
import { HELP_ARTICLE_CATEGORY_LABELS, type HelpArticleCategory, type HelpArticleStatus } from "@/app/dashboard/help/config";

export type HelpArticleFormValue = { id: string; title: string; summary: string; content: string; category: HelpArticleCategory; status: HelpArticleStatus; is_featured: boolean; sort_order: number };

export function HelpArticleForm({ article }: { article?: HelpArticleFormValue }) {
  const action = article ? updateHelpArticleAction.bind(null, article.id) : createHelpArticleAction;
  const [state, formAction, pending] = useActionState(action, initialHelpCenterActionState);
  return (
    <form action={formAction} className="space-y-4">
      {article && <input type="hidden" name="status" value={article.status} />}
      <div className="border border-black/[0.08] text-[10px]">
        <label className="grid border-b border-black/[0.07] sm:grid-cols-[130px_minmax(0,1fr)]"><span className="bg-zinc-50/60 px-3 py-3 font-medium text-zinc-500">文章标题</span><span className="p-2"><input name="title" required minLength={2} maxLength={120} defaultValue={article?.title} className="app-input w-full border px-3 py-2.5 text-xs" /></span></label>
        <label className="grid border-b border-black/[0.07] sm:grid-cols-[130px_minmax(0,1fr)]"><span className="bg-zinc-50/60 px-3 py-3 font-medium text-zinc-500">简短摘要</span><span className="p-2"><textarea name="summary" maxLength={500} rows={2} defaultValue={article?.summary} className="app-input w-full resize-y border px-3 py-2.5 text-xs leading-5" /></span></label>
        <div className="grid border-b border-black/[0.07] sm:grid-cols-2">
          <label className="grid border-b border-black/[0.07] sm:grid-cols-[130px_minmax(0,1fr)] sm:border-b-0 sm:border-r"><span className="bg-zinc-50/60 px-3 py-3 font-medium text-zinc-500">分类</span><span className="p-2"><select name="category" defaultValue={article?.category ?? "platform"} className="app-input w-full border px-3 py-2.5 text-xs">{Object.entries(HELP_ARTICLE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></span></label>
          <label className="grid sm:grid-cols-[130px_minmax(0,1fr)]"><span className="bg-zinc-50/60 px-3 py-3 font-medium text-zinc-500">显示顺序</span><span className="p-2"><input type="number" name="sort_order" min={0} max={100000} defaultValue={article?.sort_order ?? 0} className="app-input w-full border px-3 py-2.5 text-xs" /></span></label>
        </div>
        <label className="grid border-b border-black/[0.07] sm:grid-cols-[130px_minmax(0,1fr)]"><span className="bg-zinc-50/60 px-3 py-3 font-medium text-zinc-500">文章正文</span><span className="p-2"><textarea name="content" required minLength={2} maxLength={10000} rows={article ? 8 : 10} defaultValue={article?.content} className="app-input w-full resize-y border px-3 py-2.5 text-xs leading-5" /></span></label>
        <label className="flex min-h-11 items-center gap-3 px-3 text-[10px] text-zinc-600"><input type="checkbox" name="is_featured" defaultChecked={article?.is_featured} className="size-3.5" />设为推荐帮助</label>
      </div>
      {state.message && <p className={`border px-3 py-2 text-[10px] ${state.status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{state.message}</p>}
      <div className="flex justify-end gap-2">{article ? <button type="submit" disabled={pending} className="inline-flex h-8 items-center gap-2 border border-zinc-900 bg-zinc-900 px-4 text-[10px] font-medium text-white disabled:opacity-50"><Save size={12} />{pending ? "保存中…" : "保存修改"}</button> : <><button type="submit" name="intent" value="draft" disabled={pending} className="inline-flex h-8 items-center gap-2 border border-black/[0.1] bg-white px-3 text-[10px] font-medium text-zinc-700 disabled:opacity-50"><Save size={12} />保存草稿</button><button type="submit" name="intent" value="publish" disabled={pending} className="inline-flex h-8 items-center gap-2 border border-emerald-700 bg-emerald-700 px-3 text-[10px] font-medium text-white disabled:opacity-50"><Send size={12} />{pending ? "发布中…" : "保存并发布"}</button></>}</div>
    </form>
  );
}
