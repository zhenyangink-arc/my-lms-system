"use client";

import { useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Search } from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTable } from "@/components/ui/table/data-table";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import type { TenantMemberDetail } from "../api/types";

const ROLE_LABELS: Record<string, string> = { tenant_super_admin: "机构负责人", ceo: "运营负责人", admin: "管理员", teacher: "教师", student: "学生" };
const STATUS_LABELS: Record<string, string> = { invited: "待接受", active: "正常", suspended: "已停用", left: "已离开" };
const TIER_LABELS: Record<string, string> = { normal: "普通", vip1: "一级会员", vip2: "二级会员", vip3: "三级会员" };
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };

function sortableHeader(title: string) {
  return function SortableHeader({ column }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (descending?: boolean) => void } }) {
    const direction = column.getIsSorted();
    return <DataTableColumnHeader title={title} sortable direction={direction} onClick={() => column.toggleSorting(direction === "asc")} />;
  };
}

const columns: ColumnDef<TenantMemberDetail>[] = [
  { id: "member", accessorKey: "name", header: sortableHeader("成员"), cell: ({ row }) => <div className="min-w-40"><p className="font-semibold">{row.original.name}</p><p className="mt-0.5 font-mono text-[10px] text-[var(--foreground-muted)]">{row.original.loginId}</p></div> },
  { id: "role", accessorKey: "role", header: sortableHeader("机构角色"), cell: ({ row }) => ROLE_LABELS[row.original.role] ?? row.original.role },
  { id: "status", accessorKey: "status", header: sortableHeader("账号状态"), cell: ({ row }) => <span className={row.original.status === "active" ? "text-emerald-700" : "text-amber-700"}>{STATUS_LABELS[row.original.status] ?? row.original.status}</span> },
  { id: "tier", accessorKey: "membershipTier", header: sortableHeader("会员等级"), cell: ({ row }) => TIER_LABELS[row.original.membershipTier] ?? row.original.membershipTier },
  { id: "joined", accessorKey: "createdAt", header: sortableHeader("加入时间"), cell: ({ row }) => <LocalDateTime value={row.original.createdAt} options={DATE_OPTIONS} /> },
];

export function TenantMembersTable({ data, institutionName }: { data: TenantMemberDetail[]; institutionName: string }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const filteredData = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((item) => (role === "all" || item.role === role) && (status === "all" || item.status === status) && (!normalized || `${item.name} ${item.loginId}`.toLocaleLowerCase("zh-CN").includes(normalized)));
  }, [data, query, role, status]);

  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: filteredData, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  return (
    <DataTable toolbar={<div className="flex flex-wrap items-center gap-2"><label className="app-input flex h-9 min-w-64 flex-1 items-center gap-2 border px-2.5 sm:max-w-sm"><Search size={14} className="text-[var(--foreground-muted)]" aria-hidden="true" /><span className="sr-only">搜索成员</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名或登录账号" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label><select value={role} onChange={(event) => setRole(event.target.value)} className="app-input h-9 border px-2.5 text-xs" aria-label="机构角色"><option value="all">全部角色</option><option value="tenant_super_admin">机构负责人</option><option value="ceo">运营负责人</option><option value="admin">管理员</option><option value="teacher">教师</option><option value="student">学生</option></select><select value={status} onChange={(event) => setStatus(event.target.value)} className="app-input h-9 border px-2.5 text-xs" aria-label="成员状态"><option value="all">全部状态</option><option value="active">正常</option><option value="suspended">已停用</option><option value="invited">待接受</option><option value="left">已离开</option></select></div>} isEmpty={filteredData.length === 0} emptyContent="没有符合条件的机构成员" footer={<p className="text-xs text-[var(--foreground-muted)]">{institutionName} · 当前显示 {filteredData.length} / {data.length} 条成员关系，本步骤不提供成员修改操作</p>}>
      <Table className="min-w-[840px]"><TableHeader className="bg-[var(--surface-soft)]">{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} sortDirection={header.column.getCanSort() ? header.column.getIsSorted() : undefined} className="px-4 text-xs">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader><TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="px-4 py-3 text-xs">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table>
    </DataTable>
  );
}
