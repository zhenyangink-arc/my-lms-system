"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import { DataTable } from "@/components/ui/table/data-table";
import type { DataTableViewOption } from "@/components/ui/table/data-table-view-options";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function RequirementDataTable<T extends object>({
  data,
  columns,
  columnLabels,
  initialSorting,
  emptyContent,
  tableClassName,
  renderToolbar,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  columnLabels: Record<string, string>;
  initialSorting: SortingState;
  emptyContent: string;
  tableClassName: string;
  renderToolbar: (viewOptions: DataTableViewOption[]) => ReactNode;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, pagination },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const viewOptions = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide())
    .map((column) => ({
      id: column.id,
      label: columnLabels[column.id] ?? column.id,
      visible: column.getIsVisible(),
      canHide: column.getCanHide(),
      onVisibleChange: (visible: boolean) => column.toggleVisibility(visible),
    }));
  const pageCount = Math.max(table.getPageCount(), 1);
  const start = data.length === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const end = Math.min((pagination.pageIndex + 1) * pagination.pageSize, data.length);

  return (
    <DataTable
      toolbar={renderToolbar(viewOptions)}
      isEmpty={data.length === 0}
      emptyContent={emptyContent}
      footer={
        <div className="flex flex-col gap-2 text-xs text-[var(--foreground-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            当前显示 {start} 至 {end} 条，共 {data.length} 条
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span>每页</span>
              <select
                value={pagination.pageSize}
                onChange={(event) => table.setPageSize(Number(event.target.value))}
                className="h-8 border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--foreground-secondary)]"
              >
                {[25, 50, 100].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize} 条
                  </option>
                ))}
              </select>
            </label>
            <span className="tabular-nums">
              第 {pagination.pageIndex + 1} 页，共 {pageCount} 页
            </span>
            <button
              type="button"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              className="h-8 border border-[var(--border)] px-2.5 font-semibold text-[var(--foreground-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              className="h-8 border border-[var(--border)] px-2.5 font-semibold text-[var(--foreground-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      }
    >
      <Table className={tableClassName}>
        <TableHeader className="bg-[var(--surface-soft)]">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
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
