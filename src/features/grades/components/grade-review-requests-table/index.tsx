"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import { DataTable } from "@/components/ui/table/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GradeReviewRequest } from "../../api/types";
import { getGradeReviewColumns } from "./columns";
import {
  GradeReviewTableToolbar,
  type GradeReviewFilters,
} from "./grade-review-table-toolbar";

const COLUMN_LABELS: Record<string, string> = {
  student: "学生",
  source: "成绩来源",
  reason: "申请原因",
  requested_at: "申请时间",
  status: "状态",
  response: "处理说明",
};

const INITIAL_FILTERS: GradeReviewFilters = {
  query: "",
  status: "all",
};

export function GradeReviewRequestsTable({
  data,
  scopeLabel,
  canResolveReviews,
  studentAppId,
}: {
  data: GradeReviewRequest[];
  scopeLabel: string;
  canResolveReviews: boolean;
  studentAppId?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<GradeReviewFilters>(INITIAL_FILTERS);
  const columns = useMemo(
    () => getGradeReviewColumns(canResolveReviews, studentAppId),
    [canResolveReviews, studentAppId],
  );
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((row) => {
      if (filters.status !== "all" && row.status !== filters.status) {
        return false;
      }
      if (!query) return true;
      return `${row.student_name} ${row.source_title} ${row.reason}`
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    });
  }, [data, filters]);

  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const viewOptions = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide())
    .map((column) => ({
      id: column.id,
      label: COLUMN_LABELS[column.id] ?? column.id,
      visible: column.getIsVisible(),
      canHide: column.getCanHide(),
      onVisibleChange: (visible: boolean) => column.toggleVisibility(visible),
    }));

  return (
    <DataTable
      toolbar={
        <GradeReviewTableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          viewOptions={viewOptions}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的成绩复核请求"
      footer={
        <p className="text-xs text-[var(--foreground-muted)]">
          {scopeLabel} · 当前显示 {filteredData.length} / {data.length} 条复核请求，可用操作由当前账号权限决定
        </p>
      }
    >
      <Table className="min-w-[1180px]">
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
