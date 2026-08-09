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
import type { ManagedHelpTicket } from "../../api/types";
import { helpTicketColumns } from "./columns";
import {
  HelpTicketTableToolbar,
  type HelpTicketTableFilters,
} from "./help-ticket-table-toolbar";

const INITIAL_FILTERS: HelpTicketTableFilters = {
  query: "",
  status: "all",
  assignee: "all",
};

const COLUMN_LABELS: Record<string, string> = {
  subject: "问题",
  studentName: "学生",
  category: "分类",
  priority: "优先级",
  assignedTeacherName: "分配人",
  status: "状态",
  updatedAt: "最近更新",
};

export function HelpTicketsTable({ data }: { data: ManagedHelpTicket[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<HelpTicketTableFilters>(INITIAL_FILTERS);
  const assignees = useMemo(
    () => [...new Set(data.map((ticket) => ticket.assignedTeacherName))].sort((a, b) => a.localeCompare(b, "zh-CN")),
    [data],
  );
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((ticket) => {
      if (filters.status !== "all" && ticket.status !== filters.status) return false;
      if (filters.assignee !== "all" && ticket.assignedTeacherName !== filters.assignee) return false;
      if (!query) return true;
      return `${ticket.subject} ${ticket.studentName} ${ticket.assignedTeacherName}`
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    });
  }, [data, filters]);
  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns: helpTicketColumns,
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
        <HelpTicketTableToolbar
          filters={filters}
          assignees={assignees}
          onFiltersChange={setFilters}
          viewOptions={viewOptions}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的工单"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          当前显示 {filteredData.length} 条，共 {data.length} 条
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
