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
  ActivePermissionGrant,
  PermissionCenterTenant,
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
  identity: ActivePermissionGrant["subject"],
  userId: string,
) {
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

export function ActivePermissionGrantsTable({
  data,
  tenants,
  permissionLabels,
}: {
  data: ActivePermissionGrant[];
  tenants: PermissionCenterTenant[];
  permissionLabels: Record<string, string>;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const tenantNames = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenant.name])),
    [tenants],
  );
  const columns = useMemo<ColumnDef<ActivePermissionGrant>[]>(
    () => [
      {
        id: "subject",
        accessorFn: (row) => identityName(row.subject, row.subjectUserId),
        header: sortableHeader("被授权账号"),
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-[var(--app-text)]">
              {identityName(row.original.subject, row.original.subjectUserId)}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">
              {row.original.subject?.loginId || `账号 …${row.original.subjectUserId.slice(-8)}`}
            </p>
          </div>
        ),
      },
      {
        id: "permission",
        accessorKey: "permissionKey",
        header: sortableHeader("授权权限"),
        cell: ({ row }) => (
          <div>
            <p className="font-medium">
              {permissionLabels[row.original.permissionKey] || row.original.permissionKey}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-[var(--app-muted)]">
              {row.original.permissionKey}
            </p>
          </div>
        ),
      },
      {
        id: "scope",
        accessorFn: (row) =>
          row.scopeType === "platform"
            ? "平台"
            : tenantNames.get(row.tenantId ?? "") || "历史机构",
        header: sortableHeader("适用范围"),
      },
      {
        id: "grantor",
        accessorFn: (row) =>
          identityName(row.grantedBy, row.grantedByUserId),
        header: sortableHeader("授权人"),
        cell: ({ row }) =>
          identityName(row.original.grantedBy, row.original.grantedByUserId),
      },
      {
        id: "grantedAt",
        accessorKey: "grantedAt",
        header: sortableHeader("授权时间"),
        cell: ({ row }) => (
          <LocalDateTime value={row.original.grantedAt} options={DATE_OPTIONS} />
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
      emptyContent="当前没有生效中的账号例外授权"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          当前共 {data.length} 条生效授权；本步骤仅展示，不提供授权或撤销操作。
        </p>
      }
    >
      <Table className="min-w-[980px]">
        <TableHeader className="bg-[var(--app-soft-bg)]">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id} className="px-4 text-xs">
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
