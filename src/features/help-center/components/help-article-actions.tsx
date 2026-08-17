"use client";

import { PencilLine, Plus } from "lucide-react";
import { useState } from "react";

import {
  HelpArticleForm,
  type HelpArticleFormValue,
} from "@/app/dashboard/admin/help/HelpArticleForm";
import { HelpArticleStatusActions } from "@/app/dashboard/admin/help/HelpArticleStatusActions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ManagedHelpArticle } from "../api/types";

function toFormValue(article: ManagedHelpArticle): HelpArticleFormValue {
  return {
    id: article.id,
    title: article.title,
    summary: article.summary,
    content: article.content,
    category: article.category,
    status: article.status,
    is_featured: article.is_featured,
    sort_order: article.sort_order,
  };
}

function ArticleFormDialog({ article }: { article?: ManagedHelpArticle }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          article
            ? "inline-flex h-8 items-center gap-1.5 border border-[var(--border)] bg-[var(--card)] px-3 text-[11px] font-semibold text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"
            : "inline-flex h-8 items-center gap-1.5 bg-[var(--primary)] px-3 text-[11px] font-semibold text-white hover:opacity-90"
        }
      >
        {article ? (
          <PencilLine size={12} aria-hidden="true" />
        ) : (
          <Plus size={13} aria-hidden="true" />
        )}
        {article ? "编辑" : "新建文章"}
      </button>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-none border-[var(--border)] p-0">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold text-[var(--foreground)]">
            {article ? "编辑帮助文章" : "新建帮助文章"}
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--foreground-muted)]">
            发布后的文章会按照现有权限规则显示在学生端帮助中心。
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-5">
          <HelpArticleForm article={article ? toFormValue(article) : undefined} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CreateHelpArticleDialog() {
  return <ArticleFormDialog />;
}

export function HelpArticleRowActions({ article }: { article: ManagedHelpArticle }) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <ArticleFormDialog article={article} />
      <HelpArticleStatusActions id={article.id} status={article.status} />
    </div>
  );
}
