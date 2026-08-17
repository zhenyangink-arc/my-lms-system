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
import type {
  AnnouncementManagementScope,
  ManagedAnnouncement,
} from "../../api/types";
import {
  AnnouncementTableToolbar,
  type AnnouncementTableFilters,
} from "./announcement-table-toolbar";
import { announcementColumns } from "./columns";

const INITIAL_FILTERS: AnnouncementTableFilters = {
  query: "",
  status: "all",
  category: "all",
  priority: "all",
};

const COLUMN_LABELS: Record<string, string> = {
  title: "公告标题",
  tenantName: "发布范围",
  category: "分类",
  priority: "优先级",
  status: "状态",
  readRate: "阅读情况",
  publishedAt: "发布时间",
  updatedAt: "最近更新",
};

export function AnnouncementsTable({
  data,
  scope,
}: {
  data: ManagedAnnouncement[];
  scope: AnnouncementManagementScope;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] =
    useState<AnnouncementTableFilters>(INITIAL_FILTERS);
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((announcement) => {
      if (filters.status !== "all" && announcement.status !== filters.status) {
        return false;
      }
      if (
        filters.category !== "all" &&
        announcement.category !== filters.category
      ) {
        return false;
      }
      if (
        filters.priority !== "all" &&
        announcement.priority !== filters.priority
      ) {
        return false;
      }
      if (!query) return true;
      return `${announcement.title} ${announcement.content} ${announcement.authorName} ${announcement.tenantName}`
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    });
  }, [data, filters]);
  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns: announcementColumns,
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
        <AnnouncementTableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          viewOptions={viewOptions}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的公告"
      footer={
        <p className="text-xs text-[var(--foreground-muted)]">
          当前显示 {filteredData.length} 条，共 {data.length} 条
          {scope === "platform" ? "平台公告" : "本机构公告"}
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
