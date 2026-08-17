"use client";

import { useMemo, useState } from "react";
import { BookOpenText, ChevronDown, Search, Sparkles } from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HELP_ARTICLE_CATEGORY_LABELS,
  type HelpArticleCategory,
} from "./config";

type Article = {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: HelpArticleCategory;
  isFeatured: boolean;
};

export function HelpArticleBrowser({ articles }: { articles: Article[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | HelpArticleCategory>("all");
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return articles.filter(
      (article) =>
        (category === "all" || article.category === category) &&
        (!keyword ||
          `${article.title} ${article.summary} ${article.content}`
            .toLowerCase()
            .includes(keyword)),
    );
  }, [articles, category, query]);

  return (
    <section className="app-card rounded-3xl border p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <BookOpenText size={20} style={{ color: "var(--primary)" }} />
          <DashboardTitleWithHint
            headingLevel={2}
            titleClassName="text-xl font-bold"
            title="常见问题与使用指南"
            description="搜索标题、摘要或正文，点击问题展开答案。"
          />
        </div>
        <label className="app-input flex items-center gap-2 rounded-xl border px-3 py-2.5 lg:w-[330px]">
          <span className="sr-only">搜索帮助内容</span>
          <Search size={15} className="app-muted-text" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索帮助内容"
            className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCategory("all")}
          aria-pressed={category === "all"}
          className="rounded-full px-3 py-1.5 text-xs font-bold"
          style={{
            color:
              category === "all"
                ? "var(--primary-foreground)"
                : "var(--foreground-muted)",
            backgroundColor:
              category === "all" ? "var(--primary)" : "var(--surface-soft)",
          }}
        >
          全部
        </Button>
        {Object.entries(HELP_ARTICLE_CATEGORY_LABELS).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant="ghost"
            onClick={() => setCategory(value as HelpArticleCategory)}
            aria-pressed={category === value}
            className="rounded-full px-3 py-1.5 text-xs font-bold"
            style={{
              color:
                category === value
                  ? "var(--primary-foreground)"
                  : "var(--foreground-muted)",
              backgroundColor:
                category === value
                  ? "var(--primary)"
                  : "var(--surface-soft)",
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {filtered.map((article) => (
          <details
            key={article.id}
            className="app-soft-card group rounded-2xl border p-4 sm:p-5"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  color: article.isFeatured
                    ? "var(--status-warning)"
                    : "var(--primary)",
                  backgroundColor: article.isFeatured
                    ? "var(--status-warning-surface)"
                    : "var(--accent)",
                }}
              >
                {article.isFeatured ? (
                  <Sparkles size={16} />
                ) : (
                  <BookOpenText size={16} />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <DashboardTitleWithHint
                  headingLevel={3}
                  titleClassName="text-sm font-bold leading-6"
                  title={article.title}
                  description={
                    article.summary || "点击问题展开完整答案。"
                  }
                />
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    color: "var(--support)",
                    backgroundColor: "var(--support-surface)",
                  }}
                >
                  {HELP_ARTICLE_CATEGORY_LABELS[article.category]}
                </span>
              </div>
              <ChevronDown
                size={16}
                className="shrink-0 transition group-open:rotate-180"
              />
            </summary>
            <div
              className="app-muted-text ml-12 mt-4 whitespace-pre-wrap border-t pt-4 text-sm leading-6"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {article.content}
            </div>
          </details>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed p-6 text-center">
            <Search className="mx-auto opacity-30" size={28} />
            <p className="mt-3 text-sm font-bold">
              没有找到相关帮助内容
            </p>
            <p className="app-muted-text mt-1 text-xs">
              可以更换关键词，或者在下方提交求助。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
