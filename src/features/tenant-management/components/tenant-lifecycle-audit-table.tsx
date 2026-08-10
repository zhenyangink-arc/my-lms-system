"use client";

import { useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Search } from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTable } from "@/components/ui/table/data-table";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { TenantLifecycleAuditItem } from "../api/types";

const ACTION_LABELS = { suspended: "停用", archived: "历史归档", restored: "恢复", permanently_deleted: "永久删除" } as const;
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
function sortableHeader(title: string) { return function SortableHeader({ column }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (descending?: boolean) => void } }) { const direction = column.getIsSorted(); return <DataTableColumnHeader title={title} sortable direction={direction} onClick={() => column.toggleSorting(direction === "asc")} />; }; }
const columns: ColumnDef<TenantLifecycleAuditItem>[] = [
  { id: "tenant", accessorKey: "tenantSlug", header: sortableHeader("机构标识"), cell: ({ row }) => <span className="font-mono">{row.original.tenantSlug}</span> },
  { id: "action", accessorKey: "action", header: sortableHeader("操作"), cell: ({ row }) => <span className={row.original.action === "permanently_deleted" ? "font-medium text-rose-700" : "font-medium"}>{ACTION_LABELS[row.original.action]}</span> },
  { id: "actor", accessorKey: "actorName", header: sortableHeader("操作人") },
  { id: "previous", accessorFn: (row) => String(row.details.previous_status ?? ""), header: sortableHeader("原状态"), cell: ({ row }) => String(row.original.details.previous_status ?? "—") },
  { id: "created", accessorKey: "createdAt", header: sortableHeader("操作时间"), cell: ({ row }) => <LocalDateTime value={row.original.createdAt} options={DATE_OPTIONS} /> },
];
export function TenantLifecycleAuditTable({ data }: { data: TenantLifecycleAuditItem[] }) {
  const [sorting, setSorting] = useState<SortingState>([]); const [query, setQuery] = useState(""); const [action, setAction] = useState("all");
  const filteredData = useMemo(() => { const normalized = query.trim().toLocaleLowerCase("zh-CN"); return data.filter((item) => (action === "all" || item.action === action) && (!normalized || `${item.tenantSlug} ${item.actorName}`.toLocaleLowerCase("zh-CN").includes(normalized))); }, [data, query, action]);
  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: filteredData, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  return <DataTable toolbar={<div className="flex flex-wrap items-center gap-2"><label className="app-input flex h-9 min-w-64 flex-1 items-center gap-2 border px-2.5 sm:max-w-sm"><Search size={14} className="text-[var(--app-muted)]" /><span className="sr-only">搜索生命周期记录</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索机构标识或操作人" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label><select value={action} onChange={(event) => setAction(event.target.value)} className="app-input h-9 border px-2.5 text-xs" aria-label="生命周期操作"><option value="all">全部操作</option><option value="suspended">停用</option><option value="restored">恢复</option><option value="permanently_deleted">永久删除</option></select></div>} isEmpty={filteredData.length === 0} emptyContent="没有符合条件的租户生命周期记录" footer={<p className="text-xs text-[var(--app-muted)]">租户生命周期审计 · 当前显示 {filteredData.length} / {data.length} 条</p>}><Table className="min-w-[860px]"><TableHeader className="bg-[var(--app-soft-bg)]">{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} className="px-4 text-xs">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="px-4 py-3 text-xs">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table></DataTable>;
}
