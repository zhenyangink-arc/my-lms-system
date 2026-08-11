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
import type { LiveGradeResult } from "../../api/types";
import { gradeResultColumns } from "./columns";
import {
  GradeResultsTableToolbar,
  type GradeResultFilters,
} from "./grade-results-table-toolbar";

const COLUMN_LABELS: Record<string, string> = {
  student: "学生",
  source: "来源",
  course: "课程",
  content: "考核内容",
  score: "成绩",
  result: "结果",
  recorded_at: "记录时间",
};

const INITIAL_FILTERS: GradeResultFilters = {
  query: "",
  source: "all",
  result: "all",
};

export function GradeResultsTable({
  data,
  scopeLabel,
}: {
  data: LiveGradeResult[];
  scopeLabel: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<GradeResultFilters>(INITIAL_FILTERS);
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((row) => {
      if (filters.source !== "all" && row.source_type !== filters.source) {
        return false;
      }
      if (filters.result === "passed" && !row.passed) return false;
      if (filters.result === "failed" && row.passed) return false;
      if (!query) return true;
      return `${row.student_name} ${row.course_name} ${row.title} ${row.type_label}`
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    });
  }, [data, filters]);

  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns: gradeResultColumns,
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
        <GradeResultsTableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          viewOptions={viewOptions}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的实时成绩"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          {scopeLabel} · 当前显示 {filteredData.length} / {data.length} 条实时成绩
        </p>
      }
    >
      <Table className="min-w-[1180px]">
        <TableHeader className="bg-[var(--app-soft-bg)]">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
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
