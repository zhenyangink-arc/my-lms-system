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
import type { DocumentReviewApplication } from "../../api/types";
import { getDocumentReviewApplicationColumns } from "./columns";
import {
  DocumentReviewTableToolbar,
  type DocumentReviewTableFilters,
} from "./document-review-table-toolbar";

const COLUMN_LABELS: Record<string, string> = {
  student: "学生",
  application: "目标大学与项目",
  document_progress: "资料进度",
  applicationStage: "申请阶段",
  reviewStatus: "审核状态",
  lockStatus: "学生端状态",
};

const INITIAL_FILTERS: DocumentReviewTableFilters = {
  query: "",
  reviewStatus: "all",
  lockStatus: "all",
};

export function DocumentReviewApplicationsTable({
  data,
  dashboardBasePath,
}: {
  data: DocumentReviewApplication[];
  dashboardBasePath: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<DocumentReviewTableFilters>(INITIAL_FILTERS);
  const columns = useMemo(
    () => getDocumentReviewApplicationColumns(dashboardBasePath),
    [dashboardBasePath],
  );
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((application) => {
      if (
        filters.reviewStatus !== "all" &&
        application.reviewStatus !== filters.reviewStatus
      ) {
        return false;
      }
      const lockStatus = application.documentsLockedAt ? "locked" : "editable";
      if (filters.lockStatus !== "all" && lockStatus !== filters.lockStatus) {
        return false;
      }
      if (!query) return true;
      return `${application.studentName} ${application.studentEmail} ${application.studentId.slice(-8)} ${application.universityName} ${application.programName ?? ""}`
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
        <DocumentReviewTableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          viewOptions={viewOptions}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的学生申请档案"
      footer={
        <p className="text-xs text-[var(--foreground-muted)]">
          当前显示 {filteredData.length} / {data.length} 份申请档案
        </p>
      }
    >
      <Table className="min-w-[1240px]">
        <TableHeader className="bg-[var(--surface-soft)]">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} sortDirection={header.column.getCanSort() ? header.column.getIsSorted() : undefined} className="px-4 text-xs">
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
