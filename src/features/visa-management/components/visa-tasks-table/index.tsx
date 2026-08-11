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
import type { VisaManagementCase } from "../../api/types";
import { visaTaskColumns } from "./columns";
import type { VisaTaskDisplayRow } from "./types";
import {
  VisaTaskTableToolbar,
  type VisaTaskFilters,
} from "./visa-task-table-toolbar";

const COLUMN_LABELS: Record<string, string> = {
  student: "学生",
  stage: "任务阶段",
  task: "任务",
  status: "状态",
  student_note: "学生说明",
  admin_note: "审核意见",
  submitted_at: "提交时间",
  updated_at: "最近更新",
};

const INITIAL_FILTERS: VisaTaskFilters = {
  query: "",
  stage: "all",
  status: "all",
};

export function VisaTasksTable({
  cases,
  scopeLabel,
}: {
  cases: VisaManagementCase[];
  scopeLabel: string;
}) {
  const data = useMemo<VisaTaskDisplayRow[]>(
    () =>
      cases.flatMap((item) =>
        item.tasks.map((task) => ({
          id: task.id,
          studentName: item.studentName,
          universityName: item.universityName,
          title: task.title,
          stage: task.stage,
          status: task.status,
          studentNote: task.studentNote,
          adminNote: task.adminNote,
          submittedAt: task.submittedAt,
          updatedAt: task.updatedAt,
        })),
      ),
    [cases],
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<VisaTaskFilters>(INITIAL_FILTERS);
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((item) => {
      if (filters.stage !== "all" && item.stage !== filters.stage) return false;
      if (filters.status !== "all" && item.status !== filters.status) {
        return false;
      }
      if (!query) return true;
      return `${item.studentName} ${item.universityName} ${item.title} ${item.studentNote} ${item.adminNote}`
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    });
  }, [data, filters]);

  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns: visaTaskColumns,
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
        <VisaTaskTableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          viewOptions={viewOptions}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的签证任务"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          {scopeLabel} · 当前显示 {filteredData.length} / {data.length} 项签证任务，待审核任务可按现有状态流转处理
        </p>
      }
    >
      <Table className="min-w-[1640px]">
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
