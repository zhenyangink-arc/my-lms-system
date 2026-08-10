"use client";

import { useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Search } from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTable } from "@/components/ui/table/data-table";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { TenantMembershipAuditItem } from "../api/types";

const OPERATION_LABELS = { insert: "新增成员", update: "修改成员", delete: "移除成员" } as const;
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
function sortableHeader(title: string) { return function SortableHeader({ column }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (descending?: boolean) => void } }) { const direction = column.getIsSorted(); return <DataTableColumnHeader title={title} sortable direction={direction} onClick={() => column.toggleSorting(direction === "asc")} />; }; }
function changeSummary(item: TenantMembershipAuditItem) { const changes: string[] = []; if (item.before?.role !== item.after?.role) changes.push(`角色：${String(item.before?.role ?? "无")} → ${String(item.after?.role ?? "无")}`); if (item.before?.status !== item.after?.status) changes.push(`状态：${String(item.before?.status ?? "无")} → ${String(item.after?.status ?? "无")}`); return changes.join("；") || "成员关系已更新"; }
const columns: ColumnDef<TenantMembershipAuditItem>[] = [
  { id: "tenant", accessorKey: "tenantName", header: sortableHeader("机构"), cell: ({ row }) => <div className="min-w-36"><p className="font-medium">{row.original.tenantName}</p><p className="mt-0.5 font-mono text-[10px] text-[var(--app-muted)]">{row.original.tenantSlug}</p></div> },
  { id: "operation", accessorKey: "operation", header: sortableHeader("操作"), cell: ({ row }) => OPERATION_LABELS[row.original.operation] },
  { id: "actor", accessorKey: "actorName", header: sortableHeader("操作人") },
  { id: "target", accessorKey: "targetUserName", header: sortableHeader("目标账号") },
  { id: "change", accessorFn: changeSummary, header: "变更内容", cell: ({ row }) => <span className="min-w-64 text-[var(--app-text-soft)]">{changeSummary(row.original)}</span> },
  { id: "created", accessorKey: "createdAt", header: sortableHeader("操作时间"), cell: ({ row }) => <LocalDateTime value={row.original.createdAt} options={DATE_OPTIONS} /> },
];
export function TenantMembershipAuditTable({ data }: { data: TenantMembershipAuditItem[] }) {
  const [sorting, setSorting] = useState<SortingState>([]); const [query, setQuery] = useState(""); const [operation, setOperation] = useState("all");
  const filteredData = useMemo(() => { const normalized = query.trim().toLocaleLowerCase("zh-CN"); return data.filter((item) => (operation === "all" || item.operation === operation) && (!normalized || `${item.tenantName} ${item.tenantSlug} ${item.actorName} ${item.targetUserName}`.toLocaleLowerCase("zh-CN").includes(normalized))); }, [data, query, operation]);
  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: filteredData, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  return <DataTable toolbar={<div className="flex flex-wrap items-center gap-2"><label className="app-input flex h-9 min-w-64 flex-1 items-center gap-2 border px-2.5 sm:max-w-sm"><Search size={14} className="text-[var(--app-muted)]" /><span className="sr-only">搜索成员审计记录</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索机构、操作人或目标账号" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label><select value={operation} onChange={(event) => setOperation(event.target.value)} className="app-input h-9 border px-2.5 text-xs" aria-label="成员操作"><option value="all">全部操作</option><option value="insert">新增成员</option><option value="update">修改成员</option><option value="delete">移除成员</option></select></div>} isEmpty={filteredData.length === 0} emptyContent="没有符合条件的成员变更记录" footer={<p className="text-xs text-[var(--app-muted)]">机构成员变更审计 · 当前显示 {filteredData.length} / {data.length} 条</p>}><Table className="min-w-[1120px]"><TableHeader className="bg-[var(--app-soft-bg)]">{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} className="px-4 text-xs">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="px-4 py-3 text-xs">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table></DataTable>;
}
