"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

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
import type {
  PermissionCenterIdentity,
  PermissionCenterTenant,
  PermissionGrantAuditEntry,
} from "../api/types";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function identityName(
  identity: PermissionCenterIdentity | null,
  userId: string | null,
) {
  if (!userId) return "系统";
  return (
    identity?.fullName?.trim() ||
    identity?.loginId?.trim() ||
    identity?.email?.trim() ||
    `历史账号 …${userId.slice(-8)}`
  );
}

function sortableHeader(title: string) {
  return function SortableHeader({
    column,
  }: {
    column: {
      getIsSorted: () => false | "asc" | "desc";
      toggleSorting: (descending?: boolean) => void;
    };
  }) {
    const direction = column.getIsSorted();
    return (
      <DataTableColumnHeader
        title={title}
        sortable
        direction={direction}
        onClick={() => column.toggleSorting(direction === "asc")}
      />
    );
  };
}

export function PermissionAuditTable({
  data,
  tenants,
  permissionLabels,
}: {
  data: PermissionGrantAuditEntry[];
  tenants: PermissionCenterTenant[];
  permissionLabels: Record<string, string>;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const tenantNames = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenant.name])),
    [tenants],
  );
  const columns = useMemo<ColumnDef<PermissionGrantAuditEntry>[]>(
    () => [
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: sortableHeader("操作时间"),
        cell: ({ row }) => (
          <LocalDateTime value={row.original.createdAt} options={DATE_OPTIONS} />
        ),
      },
      {
        id: "actor",
        accessorFn: (row) => identityName(row.actor, row.actorId),
        header: sortableHeader("操作人"),
      },
      {
        id: "subject",
        accessorFn: (row) => identityName(row.subject, row.subjectUserId),
        header: sortableHeader("目标账号"),
      },
      {
        id: "permission",
        accessorKey: "permissionKey",
        header: sortableHeader("权限"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">
              {permissionLabels[row.original.permissionKey] || row.original.permissionKey}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-[var(--foreground-muted)]">
              {row.original.permissionKey}
            </p>
          </div>
        ),
      },
      {
        id: "scope",
        accessorFn: (row) =>
          row.tenantId
            ? tenantNames.get(row.tenantId) || "历史机构"
            : "平台",
        header: sortableHeader("适用范围"),
      },
      {
        id: "action",
        accessorKey: "action",
        header: sortableHeader("结果"),
        cell: ({ row }) => (
          <span
            className={
              row.original.action === "granted"
                ? "font-semibold text-emerald-700"
                : "font-semibold text-rose-700"
            }
          >
            {row.original.action === "granted" ? "已授权" : "已撤销"}
          </span>
        ),
      },
    ],
    [permissionLabels, tenantNames],
  );

  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <DataTable
      isEmpty={data.length === 0}
      emptyContent="当前没有统一权限变更记录"
      footer={
        <p className="text-xs text-[var(--foreground-muted)]">
          展示最近 {data.length} / 200 条授权审计记录。
        </p>
      }
    >
      <Table className="min-w-[1080px]">
        <TableHeader className="bg-[var(--surface-soft)]">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id} sortDirection={header.column.getCanSort() ? header.column.getIsSorted() : undefined} className="px-4 text-xs">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="px-4 py-3 text-xs">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTable>
  );
}
