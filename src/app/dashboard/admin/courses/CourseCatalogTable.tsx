"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, FileText, Folder, Layers3, Search, X } from "lucide-react";

export type CourseCatalogTableRow = {
  key: string;
  kind: "category" | "course" | "lesson" | "chapter";
  kindLabel: string;
  id: string;
  title: string;
  depth: number;
  parentLabel: string;
  childCount: number;
  contentLabel: string;
  completeness: number;
  missingItems: string[];
  rule: string;
  published: boolean;
  locked: boolean;
  href: string;
  active: boolean;
};

function RowIcon({ kind }: { kind: CourseCatalogTableRow["kind"] }) {
  if (kind === "category") return <Folder size={14} strokeWidth={1.6} />;
  if (kind === "course") return <BookOpen size={14} strokeWidth={1.6} />;
  if (kind === "lesson") return <Layers3 size={14} strokeWidth={1.6} />;
  return <FileText size={14} strokeWidth={1.6} />;
}

function RowStatus({ row }: { row: CourseCatalogTableRow }) {
  const published = row.published && !row.locked;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium"
      style={{
        color: published ? "var(--status-success)" : "var(--foreground-muted)",
        backgroundColor: published ? "var(--status-success-surface)" : "var(--surface-soft)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: published ? "var(--status-success)" : "var(--foreground-subtle)" }} />
      {row.locked ? "已锁定" : row.published ? "已发布" : "草稿"}
    </span>
  );
}

export function CourseCatalogTable({
  rows,
  children,
}: {
  rows: CourseCatalogTableRow[];
  children?: ReactNode;
}) {
  const router = useRouter();
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(
    () => {
      const activeIndex = rows.findIndex((row) => row.active);
      const expandedAncestors = new Set<string>();
      if (activeIndex >= 0) {
        let expectedDepth = rows[activeIndex].depth - 1;
        for (let index = activeIndex - 1; index >= 0 && expectedDepth >= 0; index -= 1) {
          if (rows[index].depth === expectedDepth) {
            expandedAncestors.add(rows[index].key);
            expectedDepth -= 1;
          }
        }
      }
      return new Set(rows.filter((row) => row.childCount > 0 && !expandedAncestors.has(row.key)).map((row) => row.key));
    },
  );
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const activeRow = rows.find((row) => row.active) ?? null;

  useEffect(() => {
    if (!children || !activeRow) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeRow, children]);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtering = Boolean(normalizedQuery) || kindFilter !== "all" || statusFilter !== "all";
    const filteredRows = rows.filter((row) => {
      const matchesQuery = !normalizedQuery || `${row.title} ${row.parentLabel}`.toLowerCase().includes(normalizedQuery);
      const matchesKind = kindFilter === "all" || row.kind === kindFilter;
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "published" && row.published && !row.locked)
        || (statusFilter === "draft" && !row.published)
        || (statusFilter === "locked" && row.locked)
        || (statusFilter === "incomplete" && row.completeness < 100);
      return matchesQuery && matchesKind && matchesStatus;
    });
    if (filtering) return filteredRows;

    const collapsedAncestorDepths: number[] = [];
    return rows.filter((row) => {
      while (
        collapsedAncestorDepths.length > 0 &&
        collapsedAncestorDepths[collapsedAncestorDepths.length - 1] >= row.depth
      ) {
        collapsedAncestorDepths.pop();
      }

      const hidden = collapsedAncestorDepths.length > 0;
      if (row.childCount > 0 && collapsedKeys.has(row.key)) {
        collapsedAncestorDepths.push(row.depth);
      }
      return !hidden;
    });
  }, [collapsedKeys, kindFilter, query, rows, statusFilter]);

  function toggleRow(key: string) {
    setCollapsedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      <section className="overflow-hidden border-y" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div>
          <h2 className="text-[13px] font-semibold">完整课程目录</h2>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <label className="relative min-w-[220px] flex-1 lg:max-w-md">
          <Search size={13} className="app-muted-text pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索课程、课时或所属目录"
            className="app-input w-full rounded-[6px] border py-2 pl-8 pr-8 text-[11px] outline-none"
          />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="清空搜索" className="app-muted-text absolute right-2 top-1/2 -translate-y-1/2 p-1"><X size={12} /></button>}
        </label>
        <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} className="app-input rounded-[6px] border px-3 py-2 text-[11px] outline-none">
          <option value="all">全部类型</option><option value="category">分类</option><option value="course">课程</option><option value="lesson">课时</option><option value="chapter">章节</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="app-input rounded-[6px] border px-3 py-2 text-[11px] outline-none">
          <option value="all">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option><option value="locked">已锁定</option><option value="incomplete">内容待完善</option>
        </select>
        <span className="app-muted-text ml-auto font-mono text-[10px]">{visibleRows.length} RESULTS</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="app-muted-text border-b text-[10px] font-medium" style={{ borderColor: "var(--border)" }}>
              <th className="w-[34%] px-4 py-2.5 font-medium">课程结构</th>
              <th className="w-[9%] px-3 py-2.5 font-medium">类型</th>
              <th className="w-[10%] px-3 py-2.5 font-medium">内容</th>
              <th className="w-[15%] px-3 py-2.5 font-medium">完整度</th>
              <th className="w-[16%] px-3 py-2.5 font-medium">开放方式</th>
              <th className="w-[10%] px-3 py-2.5 font-medium">状态</th>
              <th className="w-[6%] px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const collapsed = collapsedKeys.has(row.key);
              return (
                <tr
                  key={row.key}
                  className="border-b text-[11px] last:border-b-0"
                  style={{ borderColor: "var(--border-subtle)", backgroundColor: row.active ? "var(--accent)" : undefined }}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: `${row.depth * 18}px` }}>
                      {row.childCount > 0 ? (
                        <button
                          type="button"
                          aria-label={collapsed ? `展开${row.title}` : `收起${row.title}`}
                          aria-expanded={!collapsed}
                          onClick={() => toggleRow(row.key)}
                          className="app-muted-text flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] transition-colors hover:bg-[var(--surface-soft)]"
                        >
                          <ChevronRight size={12} className={`transition-transform ${collapsed ? "" : "rotate-90"}`} />
                        </button>
                      ) : (
                        <span className="h-6 w-6 shrink-0" />
                      )}
                      <Link href={row.href} className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="app-muted-text shrink-0"><RowIcon kind={row.kind} /></span>
                        <span className="min-w-0"><span className="block truncate font-medium">{row.title}</span><span className="app-muted-text mt-0.5 block truncate text-[9px]">{row.parentLabel}</span></span>
                      </Link>
                    </div>
                  </td>
                  <td className="app-muted-text px-3 py-2.5">{row.kindLabel}</td>
                  <td className="app-muted-text px-3 py-2.5">{row.contentLabel}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2"><span className="h-1 w-16 overflow-hidden bg-[var(--surface-soft)]"><span className="block h-full" style={{ width: `${row.completeness}%`, backgroundColor: row.completeness === 100 ? "var(--status-success)" : "var(--status-warning)" }} /></span><span className="font-mono text-[9px]">{row.completeness}%</span></div>
                    {row.missingItems.length > 0 && <p className="app-muted-text mt-1 max-w-[170px] truncate text-[9px]" title={row.missingItems.join("、")}>缺少：{row.missingItems.join("、")}</p>}
                  </td>
                  <td className="app-muted-text px-3 py-2.5">{row.rule}</td>
                  <td className="px-3 py-2.5"><RowStatus row={row} /></td>
                  <td className="px-4 py-2.5 text-right"><Link href={row.href} className="font-medium" style={{ color: "var(--primary-hover)" }}>编辑</Link></td>
                </tr>
              );
            })}
            {visibleRows.length === 0 && <tr><td colSpan={7} className="app-muted-text px-4 py-12 text-center text-[12px]">没有符合当前条件的课程内容。</td></tr>}
          </tbody>
        </table>
      </div>
      </section>

      {children && activeRow && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 p-3 backdrop-blur-[1px] sm:p-5" role="dialog" aria-modal="true" aria-label={`${activeRow.title}编辑工作窗`}>
          <div className="course-editor-window app-card relative flex h-[min(920px,calc(100vh-24px))] w-full max-w-[1500px] flex-col overflow-hidden border shadow-2xl sm:h-[calc(100vh-40px)]" style={{ borderColor: "var(--border)" }}>
            <div className="flex h-12 shrink-0 items-center justify-between border-b px-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex min-w-0 items-center gap-2 text-[11px]">
                <span className="app-muted-text"><RowIcon kind={activeRow.kind} /></span>
                <span className="truncate font-semibold">{activeRow.title}</span>
                <span className="app-muted-text shrink-0">· {activeRow.kindLabel}编辑工作窗</span>
              </div>
              <button
                type="button"
                onClick={() => router.replace("/dashboard/admin/courses", { scroll: false })}
                aria-label="关闭编辑工作窗"
                className="app-muted-text flex h-8 w-8 items-center justify-center rounded-[6px] border transition-colors hover:bg-[var(--surface-soft)]"
                style={{ borderColor: "var(--border)" }}
              >
                <X size={14} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
