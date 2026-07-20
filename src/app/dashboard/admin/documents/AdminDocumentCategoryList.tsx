"use client";

import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  FolderOpen,
  Lock,
  MessageSquarePlus,
  MessageSquareText,
  MinusCircle,
} from "lucide-react";

import { CATEGORY_ICONS, CATEGORY_LABELS, STATUS_LABELS, STATUS_TONES } from "@/app/dashboard/documents/constants";
import { DeleteChecklistItemButton, DocumentItemControls } from "./DocumentItemControls";

type ChecklistDocument = {
  id: string;
  title: string;
  category: string;
  notes: string | null;
  admin_note: string | null;
  status: "preparing" | "completed" | "not_needed";
  due_date: string | null;
  admin_locked_at: string | null;
  targetLabel: string | null;
};

type CategoryGroup = {
  category: string;
  items: ChecklistDocument[];
};

export function AdminDocumentCategoryList({
  studentId,
  categoryGroups,
}: {
  studentId: string;
  categoryGroups: CategoryGroup[];
}) {
  const [expanded, setExpanded] = useState(true);
  const totalItems = categoryGroups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section className="app-card rounded-[1.75rem] border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black">申请资料分类清单</h2>
          <p className="app-muted-text mt-1 text-xs">按材料分类展示，{categoryGroups.length} 个分类、共 {totalItems} 项资料。</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition hover:-translate-y-0.5"
          style={{ color: "var(--app-accent)", borderColor: "var(--app-accent)" }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "收起全部" : "展开全部"}
        </button>
      </div>

      {categoryGroups.length === 0 ? (
        <div className="app-card mt-5 rounded-[1.5rem] border border-dashed p-8 text-center">
          <FileText className="mx-auto opacity-30" size={30} />
          <p className="mt-3 font-black">当前没有申请资料项目</p>
          <p className="app-muted-text mt-2 text-xs">可以从上方选择目标大学并添加清单项目。</p>
        </div>
      ) : !expanded ? (
        <p className="app-muted-text mt-5 text-xs">已收起，点击「展开全部」查看具体资料项目。</p>
      ) : (
        <div className="mt-5 space-y-5">
          {categoryGroups.map(({ category, items }) => {
            const CategoryIcon = CATEGORY_ICONS[category] ?? FolderOpen;
            return (
              <div key={category}>
                <div className="mb-3 flex items-center gap-2 border-b pb-2.5" style={{ borderColor: "var(--app-border-soft)" }}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><CategoryIcon size={14} /></span>
                  <h3 className="text-sm font-black">{CATEGORY_LABELS[category] ?? category}</h3>
                  <span className="app-muted-text text-xs font-bold">{items.length} 项</span>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {items.map((document) => {
                    const tone = STATUS_TONES[document.status] ?? STATUS_TONES.preparing;
                    const StatusIcon =
                      document.status === "completed" ? CheckCircle2 : document.status === "not_needed" ? MinusCircle : Clock3;
                    const locked = document.admin_locked_at !== null;
                    return (
                      <article key={document.id} className="app-card rounded-[1.5rem] border p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: tone.color, backgroundColor: tone.soft }}><StatusIcon size={18} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div><h2 className="text-sm font-black">{document.title}</h2><p className="app-muted-text mt-1 text-xs">{CATEGORY_LABELS[document.category] ?? document.category}</p></div>
                              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                {locked && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}><Lock size={10} />已锁定</span>}
                                <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{STATUS_LABELS[document.status]}</span>
                              </div>
                            </div>
                            <p className="mt-2 text-xs font-black" style={{ color: "var(--app-accent)" }}>{document.targetLabel ?? "历史通用资料"}</p>
                            {document.due_date && <p className="app-muted-text mt-2 inline-flex items-center gap-1 text-xs"><CalendarClock size={11} />截止日期：{document.due_date}</p>}
                            {document.notes && <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-5" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><MessageSquareText className="mt-0.5 shrink-0" size={13} /><p className="whitespace-pre-wrap"><b>资料备注：</b>{document.notes}</p></div>}
                            {document.admin_note && <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-5" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}><MessageSquarePlus className="mt-0.5 shrink-0" size={13} /><p className="whitespace-pre-wrap"><b>管理员备注：</b>{document.admin_note}</p></div>}
                            <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--app-border-soft)" }}>
                              <DocumentItemControls studentId={studentId} documentId={document.id} title={document.title} adminNote={document.admin_note} locked={locked} />
                              <DeleteChecklistItemButton studentId={studentId} documentId={document.id} title={document.title} locked={locked} />
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
