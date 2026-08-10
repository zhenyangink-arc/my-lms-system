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
import { visaCaseColumns } from "./columns";
import {
  VisaCaseTableToolbar,
  type VisaCaseFilters,
} from "./visa-case-table-toolbar";

const COLUMN_LABELS: Record<string, string> = {
  student: "学生",
  target: "目标院校",
  visa_type: "签证类型",
  channel: "办理通道",
  status: "办理阶段",
  progress: "任务进度",
  entry_date: "入境日期",
  updated_at: "最近更新",
};

const INITIAL_FILTERS: VisaCaseFilters = {
  query: "",
  channel: "all",
  status: "all",
};

export function VisaCasesTable({
  data,
  scopeLabel,
}: {
  data: VisaManagementCase[];
  scopeLabel: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<VisaCaseFilters>(INITIAL_FILTERS);
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((item) => {
      if (
        filters.channel !== "all" &&
        item.applicationChannel !== filters.channel
      ) {
        return false;
      }
      const pending = item.tasks.some((task) =>
        ["submitted", "reviewing"].includes(task.status),
      );
      const support = item.tasks.some((task) =>
        ["revision_required", "blocked"].includes(task.status),
      );
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "action" && (pending || support)) ||
        (filters.status === "preparing" &&
          [
            "admin_preparing",
            "planning",
            "preparing",
            "ready_to_submit",
          ].includes(item.caseStatus)) ||
        (filters.status === "submitted" &&
          ["submitted", "additional_documents", "approved"].includes(
            item.caseStatus,
          )) ||
        (filters.status === "issued" && item.caseStatus === "issued");
      if (!matchesStatus) return false;
      if (!query) return true;
      return `${item.studentName} ${item.studentEmail} ${item.universityName} ${item.programName}`
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    });
  }, [data, filters]);

  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns: visaCaseColumns,
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
        <VisaCaseTableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          viewOptions={viewOptions}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的学生签证档案"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          {scopeLabel} · 当前显示 {filteredData.length} / {data.length} 份签证档案，可编辑跟进信息或进入二次确认删除流程
        </p>
      }
    >
      <Table className="min-w-[1540px]">
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
