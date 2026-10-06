"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Folder, Search, ChevronsUpDown } from "lucide-react";
import type { CourseCatalogFolderRow } from "./course-catalog-tree/columns";

export type StructureEntry = { key: string; title: string; context: string; href: string; active: boolean };

export function CourseStructureDirectory({ entries, rootHref, rootActive }: { entries: StructureEntry[]; rootHref: string; rootActive: boolean }) {
  const [query, setQuery] = useState("");
  const visible = entries.filter(entry => `${entry.title} ${entry.context}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <details className="group min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
    <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
      <span><span className="block text-xs text-[var(--foreground-muted)]">当前课程范围</span><span className="mt-1 block text-sm font-semibold">{entries.find(entry => entry.active)?.title ?? "全部分类"}</span></span>
      <span className="flex items-center gap-2 text-sm">切换目录<ChevronsUpDown aria-hidden="true" className="size-4" /></span>
    </summary>
    <div className="border-t border-[var(--border)] p-4">
    <h2 className="sr-only">课程目录</h2>
    <label className="relative block">
      <span className="sr-only">搜索分类或课程</span><Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-[var(--foreground-muted)]" />
      <input style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }} value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索分类或课程" className="mb-3 h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]" />
    </label>
    <nav aria-label="分类与课程" className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
      <Link href={rootHref} aria-current={rootActive ? "page" : undefined} className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm ${rootActive ? "bg-[var(--surface-soft)] font-semibold" : "hover:bg-[var(--surface-soft)]"}`}><Folder aria-hidden="true" className="size-4" />全部分类</Link>
      {visible.map(entry => <Link key={entry.key} href={entry.href} aria-current={entry.active ? "page" : undefined} className={`block rounded-lg border px-3 py-3 focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${entry.active ? "border-[var(--primary)] bg-[var(--surface-soft)]" : "border-transparent hover:bg-[var(--surface-soft)]"}`}>
        <span className="block break-words text-sm font-medium">{entry.title}</span><span className="mt-1 block break-words text-xs text-[var(--foreground-muted)]">{entry.context}</span>
      </Link>)}
      {!visible.length && <p role="status" className="p-3 text-sm text-[var(--foreground-muted)]">没有匹配的分类或课程</p>}
    </nav>
    </div>
  </details>;
}

export function CourseStructureItems({ rows, catalogRoute, folderParam, selectedKey }: {
  rows: CourseCatalogFolderRow[]; catalogRoute: string; folderParam?: string; selectedKey?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const visible = rows.filter(row => row.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (status === "all" || (status === "draft" ? !row.isPublished : status === "locked" ? row.isLocked : row.isPublished && !row.isLocked)));
  const join = catalogRoute.includes("?") ? "&" : "?";
  return <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
    <div className="grid gap-3 border-b border-[var(--border)] p-4">
      <label className="grid min-w-0 flex-1 gap-1 text-xs text-[var(--foreground-muted)]">查找当前目录<input style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }} value={query} onChange={e => setQuery(e.target.value)} placeholder="输入名称" className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]" /></label>
      <label className="grid gap-1 text-xs text-[var(--foreground-muted)]">开放状态<select style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }} aria-label="开放状态" value={status} onChange={e => setStatus(e.target.value)} className="h-11 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)]"><option value="all">全部状态</option><option value="published">已上架且未锁定</option><option value="draft">未上架</option><option value="locked">已锁定</option></select></label>
    </div>
    <ul aria-label="当前目录内容" className="max-h-64 overflow-y-auto p-2 xl:max-h-[65vh]">
      {visible.map(row => {
        const detail = `${catalogRoute}${join}node=${row.kind}&id=${encodeURIComponent(row.id)}${folderParam ? `&folder=${encodeURIComponent(folderParam)}` : ""}#course-content`;
        return <li key={row.key}>
          <Link href={detail} aria-current={selectedKey === row.key ? "true" : undefined} className={`group flex min-w-0 items-start gap-3 rounded-lg border p-3 focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${selectedKey === row.key ? "border-[var(--primary)] bg-[var(--surface-soft)]" : "border-transparent hover:bg-[var(--surface-soft)]"}`}>
            <Folder aria-hidden="true" className="mt-1 size-4 shrink-0 text-[var(--foreground-muted)]" />
            <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{row.title}</span><span className="mt-1 block text-xs text-[var(--foreground-muted)]">{row.kindLabel} · {row.contentLabel}</span><span className="mt-2 block text-xs text-[var(--foreground-muted)]">{row.isPublished ? "已上架" : "未上架"}{row.isLocked ? " · 已锁定" : ""}</span></span>
            <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-[var(--foreground-muted)]" />
          </Link>
        </li>;
      })}
    </ul>
    {!visible.length && <p role="status" className="p-8 text-center text-sm text-[var(--foreground-muted)]">{rows.length ? "没有符合当前条件的内容" : "当前目录还没有内容，可使用上方新建按钮添加。"}</p>}
    <p aria-live="polite" className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--foreground-muted)]">显示 {visible.length} / {rows.length} 项</p>
  </div>;
}
