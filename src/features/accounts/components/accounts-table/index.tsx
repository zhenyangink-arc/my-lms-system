"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type VisibilityState,
  type SortingState,
} from "@tanstack/react-table";

import { DataTable } from "@/components/ui/table/data-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AccountFilters, AccountListProfile, AccountScope } from "../../api/types";
import { getAccountColumns } from "./columns";
import { AccountTableToolbar } from "./account-table-toolbar";

export function AccountsTable({
  data,
  scope,
  viewerRole,
  filters,
}: {
  data: AccountListProfile[];
  scope: AccountScope;
  viewerRole: string;
  filters: AccountFilters;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const columns = useMemo(
    () => getAccountColumns({ scope, viewerRole }),
    [scope, viewerRole],
  );
  // TanStack Table intentionally exposes mutable table methods; keep this client boundary unmemoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <DataTable
      toolbar={<AccountTableToolbar table={table} scope={scope} filters={filters} />}
      isEmpty={data.length === 0}
      emptyContent="没有符合条件的账号"
      footer={<p className="text-xs text-[var(--app-muted)]">当前显示 {data.length} 个账号</p>}
    >
      <Table className="min-w-[1080px]">
        <TableHeader className="bg-[var(--app-soft-bg)]">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="px-4 text-xs">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
