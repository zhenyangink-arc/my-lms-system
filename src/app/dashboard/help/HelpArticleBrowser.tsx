"use client";

import { useMemo, useState } from "react";
import { BookOpenText, ChevronDown, Search, Sparkles } from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { HELP_ARTICLE_CATEGORY_LABELS, type HelpArticleCategory } from "./config";

type Article = { id: string; title: string; summary: string; content: string; category: HelpArticleCategory; isFeatured: boolean };

export function HelpArticleBrowser({ articles }: { articles: Article[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | HelpArticleCategory>("all");
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return articles.filter((article) => (category === "all" || article.category === category) && (!keyword || `${article.title} ${article.summary} ${article.content}`.toLowerCase().includes(keyword)));
  }, [articles, category, query]);

  return (
    <section className="app-card rounded-3xl border p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2"><BookOpenText size={20} style={{ color: "var(--app-accent)" }} /><DashboardTitleWithHint headingLevel={2} titleClassName="text-xl font-black" title="常见问题与使用指南" description="搜索标题、摘要或正文，点击问题展开答案。" /></div><label className="app-input flex items-center gap-2 rounded-xl border px-3 py-2.5 lg:w-[330px]"><Search size={15} className="app-muted-text" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索帮助内容" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label></div>
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => setCategory("all")} className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: category === "all" ? "white" : "var(--app-muted)", backgroundColor: category === "all" ? "var(--app-accent)" : "var(--app-soft-bg)" }}>全部</button>{Object.entries(HELP_ARTICLE_CATEGORY_LABELS).map(([value, label]) => <button key={value} type="button" onClick={() => setCategory(value as HelpArticleCategory)} className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: category === value ? "white" : "var(--app-muted)", backgroundColor: category === value ? "var(--app-accent)" : "var(--app-soft-bg)" }}>{label}</button>)}</div>
      <div className="mt-5 space-y-3">{filtered.map((article) => <details key={article.id} className="app-soft-card group rounded-2xl border p-4 sm:p-5"><summary className="flex cursor-pointer list-none items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ color: article.isFeatured ? "var(--app-warm)" : "var(--app-accent)", backgroundColor: article.isFeatured ? "var(--app-warm-soft)" : "var(--app-accent-soft)" }}>{article.isFeatured ? <Sparkles size={16} /> : <BookOpenText size={16} />}</span><div className="flex min-w-0 flex-1 flex-wrap items-center gap-2"><DashboardTitleWithHint headingLevel={3} titleClassName="text-sm font-black leading-6" title={article.title} description={article.summary || "点击问题展开完整答案。"} /><span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{HELP_ARTICLE_CATEGORY_LABELS[article.category]}</span></div><ChevronDown size={16} className="shrink-0 transition group-open:rotate-180" /></summary><div className="app-muted-text ml-12 mt-4 whitespace-pre-wrap border-t pt-4 text-sm leading-6" style={{ borderColor: "var(--app-border-soft)" }}>{article.content}</div></details>)}{filtered.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center"><Search className="mx-auto opacity-30" size={28} /><p className="mt-3 text-sm font-black">没有找到相关帮助内容</p><p className="app-muted-text mt-1 text-xs">可以更换关键词，或者在下方提交求助。</p></div>}</div>
    </section>
  );
}
