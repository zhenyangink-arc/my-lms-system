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
import { getStudentLearningRecordColumns } from "./columns";
import { StudentRecordTableToolbar } from "./student-record-table-toolbar";
import type {
  StudentLearningRecordFilters,
  StudentLearningRecordTableRow,
} from "./types";

const COLUMN_LABELS: Record<string, string> = {
  student: "学生",
  membership_tier: "会员档位",
  completed_lesson_count: "课时进度",
  submission_count: "任务提交",
  conversation_practice_count: "会话练习",
  grade_count: "成绩记录",
  note_count: "人工辅导备注",
  last_learning_at: "最近学习",
  status: "学习状态",
};

const INITIAL_FILTERS: StudentLearningRecordFilters = {
  query: "",
  activity: "all",
};

function activityOf(row: StudentLearningRecordTableRow) {
  if (row.attention_count > 0) return "attention";
  return row.last_learning_at ? "learning" : "pending";
}

export function StudentLearningRecordsTable({
  data,
  scopeLabel,
  dashboardBasePath,
}: {
  data: StudentLearningRecordTableRow[];
  scopeLabel: string;
  dashboardBasePath: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<StudentLearningRecordFilters>(INITIAL_FILTERS);
  const columns = useMemo(
    () => getStudentLearningRecordColumns(dashboardBasePath),
    [dashboardBasePath],
  );
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((row) => {
      const matchesActivity = filters.activity === "all" || activityOf(row) === filters.activity;
      if (!matchesActivity) return false;
      if (!query) return true;
      return `${row.full_name ?? ""} ${row.email ?? ""} ${row.student_id.slice(-8)}`
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
        <StudentRecordTableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          viewOptions={viewOptions}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的学生学习档案"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          {scopeLabel} · 当前显示 {filteredData.length} / {data.length} 份学生档案
        </p>
      }
    >
      <Table className="min-w-[1320px]">
        <TableHeader className="bg-[var(--app-soft-bg)]">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="px-4 text-xs">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
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
