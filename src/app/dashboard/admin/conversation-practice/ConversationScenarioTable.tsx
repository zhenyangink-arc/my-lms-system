"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircleMore, Plus, Search, Star, X } from "lucide-react";

export type ConversationScenarioTableRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  difficultyLabel: string;
  durationMinutes: number;
  status: "draft" | "published" | "archived";
  statusLabel: string;
  isFeatured: boolean;
  studentCount: number;
  completedCount: number;
  practiceCount: number;
  completeness: number;
  missingItems: string[];
  editHref: string;
  active: boolean;
};

const statusColors = {
  draft: { color: "var(--app-muted)", background: "var(--app-soft-bg)" },
  published: { color: "var(--app-success)", background: "var(--app-success-soft)" },
  archived: { color: "var(--app-warm)", background: "var(--app-warm-soft)" },
};

export function ConversationScenarioTable({
  rows,
  canManage,
  createOpen,
  children,
}: {
  rows: ConversationScenarioTableRow[];
  canManage: boolean;
  createOpen: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const activeRow = rows.find((row) => row.active) ?? null;
  const modalOpen = Boolean(children) && (Boolean(activeRow) || createOpen);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modalOpen]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const searchText = `${row.title} ${row.description} ${row.categoryLabel} ${row.difficultyLabel}`.toLowerCase();
      const matchesQuery = !normalized || searchText.includes(normalized);
      const matchesCategory = category === "all" || row.category === category;
      const matchesStatus = status === "all" || row.status === status || (status === "incomplete" && row.completeness < 100);
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [category, query, rows, status]);

  return (
    <>
      <section className="overflow-hidden border-y" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-card-bg)" }}>
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-3" style={{ borderColor: "var(--app-border)" }}>
          <label className="relative min-w-[220px] flex-1 lg:max-w-sm">
            <Search size={13} className="app-muted-text pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索会话场景" className="app-input w-full rounded-[6px] border py-2 pl-8 pr-8 text-[11px] outline-none" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="清空搜索" className="app-muted-text absolute right-2 top-1/2 -translate-y-1/2 p-1"><X size={12} /></button>}
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="app-input rounded-[6px] border px-3 py-2 text-[11px] outline-none">
            <option value="all">全部分类</option>
            {Array.from(new Map(rows.map((row) => [row.category, row.categoryLabel])).entries()).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="app-input rounded-[6px] border px-3 py-2 text-[11px] outline-none">
            <option value="all">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
            <option value="archived">已归档</option>
            <option value="incomplete">待完善</option>
          </select>
          <span className="app-muted-text ml-auto text-[10px]">共 {filteredRows.length} 项</span>
          {canManage && <Link href="/dashboard/admin/conversation-practice?mode=create" className="flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-[11px] font-medium text-white" style={{ backgroundColor: "var(--app-accent)" }}><Plus size={13} />新建场景</Link>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="app-muted-text border-b text-[10px]" style={{ borderColor: "var(--app-border)" }}>
                <th className="w-[46%] px-4 py-2.5 font-medium">场景</th>
                <th className="w-[16%] px-3 py-2.5 font-medium">内容</th>
                <th className="w-[18%] px-3 py-2.5 font-medium">练习</th>
                <th className="w-[12%] px-3 py-2.5 font-medium">状态</th>
                <th className="w-[8%] px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const tone = statusColors[row.status];
                const name = (
                  <div className="flex min-w-0 items-start gap-2">
                    <MessageCircleMore size={14} className="app-muted-text mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium">{row.title}{row.isFeatured && <Star size={10} fill="currentColor" style={{ color: "var(--app-warm)" }} />}</span>
                      <span className="app-muted-text mt-1 block truncate text-[9px]">{row.categoryLabel} · {row.difficultyLabel} · {row.durationMinutes} 分钟{row.description ? ` · ${row.description}` : ""}</span>
                    </span>
                  </div>
                );
                return (
                  <tr key={row.id} className="border-b text-[11px] last:border-b-0" style={{ borderColor: "var(--app-border-soft)", backgroundColor: row.active ? "var(--app-accent-soft)" : undefined }}>
                    <td className="px-4 py-3">{canManage ? <Link href={row.editHref}>{name}</Link> : name}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2"><span className="h-1 w-14 bg-[var(--app-soft-bg)]"><span className="block h-full" style={{ width: `${row.completeness}%`, backgroundColor: row.completeness === 100 ? "var(--app-success)" : "var(--app-warm)" }} /></span><span className="font-mono text-[9px]">{row.completeness}%</span></div>
                      {row.missingItems.length > 0 && <p className="app-muted-text mt-1 text-[9px]" title={row.missingItems.join("、")}>缺 {row.missingItems.length} 项</p>}
                    </td>
                    <td className="app-muted-text px-3 py-3"><span>{row.studentCount} 人 · {row.practiceCount} 次</span><p className="mt-1 text-[9px]">已掌握 {row.completedCount}</p></td>
                    <td className="px-3 py-3"><span className="inline-flex rounded-full px-2 py-1 text-[9px] font-medium" style={{ color: tone.color, backgroundColor: tone.background }}>{row.statusLabel}</span></td>
                    <td className="px-4 py-3 text-right">{canManage ? <Link href={row.editHref} className="font-medium" style={{ color: "var(--app-accent-strong)" }}>编辑</Link> : <span className="app-muted-text">—</span>}</td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && <tr><td colSpan={5} className="app-muted-text px-4 py-12 text-center text-[11px]">没有符合条件的会话场景</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 p-3 backdrop-blur-[1px] sm:p-5" role="dialog" aria-modal="true" aria-label={activeRow ? `${activeRow.title}编辑工作窗` : "新建会话场景工作窗"}>
          <div className="course-editor-window app-card relative flex h-[min(920px,calc(100vh-24px))] w-full max-w-[1400px] flex-col overflow-hidden border shadow-2xl sm:h-[calc(100vh-40px)]" style={{ borderColor: "var(--app-border)" }}>
            <div className="flex h-12 shrink-0 items-center justify-between border-b px-4" style={{ borderColor: "var(--app-border)" }}>
              <div className="flex min-w-0 items-center gap-2 text-[11px]"><MessageCircleMore size={14} className="app-muted-text" /><span className="truncate font-semibold">{activeRow?.title ?? "新建会话场景"}</span></div>
              <button type="button" onClick={() => router.replace("/dashboard/admin/conversation-practice", { scroll: false })} aria-label="关闭编辑工作窗" className="app-muted-text flex h-8 w-8 items-center justify-center rounded-[6px] border hover:bg-[var(--app-soft-bg)]" style={{ borderColor: "var(--app-border)" }}><X size={14} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
