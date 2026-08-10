"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Search } from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTable } from "@/components/ui/table/data-table";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import { DataTableViewOptions } from "@/components/ui/table/data-table-view-options";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import type { TenantListItem } from "../api/types";

const STATUS_LABELS = {
  active: "运行中",
  suspended: "已停用",
  archived: "历史归档",
} as const;

const PLAN_LABELS: Record<string, string> = {
  legacy: "历史兼容",
  starter: "入门套餐",
  growth: "成长套餐",
  enterprise: "企业套餐",
};

const COLUMN_LABELS: Record<string, string> = {
  tenant: "机构",
  manager: "负责人",
  members: "成员数量",
  status: "状态",
  plan: "套餐",
  created_at: "开通时间",
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};

function sortableHeader(title: string) {
  return function SortableHeader({ column }: { column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (descending?: boolean) => void } }) {
    const direction = column.getIsSorted();
    return <DataTableColumnHeader title={title} sortable direction={direction} onClick={() => column.toggleSorting(direction === "asc")} />;
  };
}

function getColumns(dashboardBasePath: string): ColumnDef<TenantListItem>[] {
  return [
    {
      id: "tenant",
      accessorKey: "name",
      header: sortableHeader("机构"),
      cell: ({ row }) => (
        <div className="min-w-44">
          <p className="font-semibold text-[var(--app-text)]">{row.original.name}</p>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--app-muted)]">{row.original.slug}</p>
        </div>
      ),
    },
    {
      id: "manager",
      accessorFn: (row) => row.managers[0]?.name ?? "",
      header: sortableHeader("负责人"),
      cell: ({ row }) => {
        const manager = row.original.managers[0];
        return manager ? (
          <div className="min-w-36">
            <p className="font-medium">{manager.name}{row.original.managers.length > 1 ? ` +${row.original.managers.length - 1}` : ""}</p>
            <p className="mt-0.5 font-mono text-[10px] text-[var(--app-muted)]">{manager.loginId}</p>
          </div>
        ) : <span className="text-amber-700">负责人待配置</span>;
      },
    },
    {
      id: "members",
      accessorKey: "memberCount",
      header: sortableHeader("成员数量"),
      cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.memberCount} 人</span>,
    },
    {
      id: "status",
      accessorKey: "status",
      header: sortableHeader("状态"),
      cell: ({ row }) => (
        <span className={row.original.status === "active" ? "inline-flex items-center gap-1.5 font-medium text-emerald-700" : "inline-flex items-center gap-1.5 font-medium text-amber-700"}>
          <span className="size-1.5 rounded-full bg-current" />
          {STATUS_LABELS[row.original.status]}
        </span>
      ),
    },
    {
      id: "plan",
      accessorKey: "planKey",
      header: sortableHeader("套餐"),
      cell: ({ row }) => PLAN_LABELS[row.original.planKey] ?? row.original.planKey,
    },
    {
      id: "created_at",
      accessorKey: "createdAt",
      header: sortableHeader("开通时间"),
      cell: ({ row }) => <LocalDateTime value={row.original.createdAt} options={DATE_OPTIONS} />,
    },
    {
      id: "details",
      enableHiding: false,
      enableSorting: false,
      header: () => <span className="sr-only">查看详情</span>,
      cell: ({ row }) => (
        <Link
          href={scopeDashboardPath(`/dashboard/admin/tenants/${row.original.id}`, dashboardBasePath)}
          className="inline-flex h-8 items-center border border-[var(--app-border)] px-3 text-xs font-semibold hover:bg-[var(--app-soft-bg)]"
        >
          查看详情
        </Link>
      ),
    },
  ];
}

type Filters = {
  query: string;
  status: "all" | TenantListItem["status"];
  plan: string;
};

export function TenantOverviewTable({ data, dashboardBasePath, scopeLabel }: { data: TenantListItem[]; dashboardBasePath: string; scopeLabel: string }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<Filters>({ query: "", status: "all", plan: "all" });
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((item) => {
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.plan !== "all" && item.planKey !== filters.plan) return false;
      if (!query) return true;
      return `${item.name} ${item.slug} ${item.managers.map((manager) => `${manager.name} ${manager.loginId}`).join(" ")}`.toLocaleLowerCase("zh-CN").includes(query);
    });
  }, [data, filters]);

  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns: getColumns(dashboardBasePath),
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const viewOptions = table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => ({ id: column.id, label: COLUMN_LABELS[column.id] ?? column.id, visible: column.getIsVisible(), canHide: column.getCanHide(), onVisibleChange: (visible: boolean) => column.toggleVisibility(visible) }));

  return (
    <DataTable
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <label className="app-input flex h-9 min-w-64 flex-1 items-center gap-2 border px-2.5 sm:max-w-sm">
            <Search size={14} className="text-[var(--app-muted)]" />
            <span className="sr-only">搜索机构</span>
            <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="搜索机构、标识或负责人" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
          </label>
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as Filters["status"] })} className="app-input h-9 border px-2.5 text-xs font-medium" aria-label="机构状态">
            <option value="all">全部状态</option><option value="active">运行中</option><option value="suspended">已停用</option>
          </select>
          <select value={filters.plan} onChange={(event) => setFilters({ ...filters, plan: event.target.value })} className="app-input h-9 border px-2.5 text-xs font-medium" aria-label="服务套餐">
            <option value="all">全部套餐</option><option value="legacy">历史兼容</option><option value="starter">入门套餐</option><option value="growth">成长套餐</option><option value="enterprise">企业套餐</option>
          </select>
          <DataTableViewOptions options={viewOptions} className="ml-auto" />
        </div>
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的机构"
      footer={<p className="text-xs text-[var(--app-muted)]">{scopeLabel} · 当前显示 {filteredData.length} / {data.length} 个机构，本步骤仅提供只读查看</p>}
    >
      <Table className="min-w-[1080px]">
        <TableHeader className="bg-[var(--app-soft-bg)]">{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} className="px-4 text-xs">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
        <TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="px-4 py-3 text-xs">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </DataTable>
  );
}
