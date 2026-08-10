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
import { updateUnifiedPermissionGrantAction } from "@/app/dashboard/admin/permissions/actions";
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
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">授权操作</span>,
        cell: ({ row }) => (
          <form action={updateUnifiedPermissionGrantAction} className="text-right">
            <input type="hidden" name="targetUserId" value={row.original.subjectUserId} />
            <input type="hidden" name="permissionKey" value={row.original.permissionKey} />
            <input type="hidden" name="tenantId" value={row.original.tenantId ?? ""} />
            <input type="hidden" name="enabled" value="false" />
            <input type="hidden" name="view" value="grants" />
            <button
              type="submit"
              className="h-8 border border-rose-200 px-2.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
            >
              撤销
            </button>
          </form>
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
          当前共 {data.length} 条生效授权；撤销后从下一次服务端权限检查开始生效。
        </p>
      }
    >
      <Table className="min-w-[1080px]">
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
