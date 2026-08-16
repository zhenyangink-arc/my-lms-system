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
import { GrowthToolboxTableToolbar } from "../table-toolbar";
import {
  getGrowthToolboxItemColumns,
  type GrowthToolboxItemDisplayRow,
} from "./columns";
import type { GrowthToolboxCourseOption } from "../growth-toolbox-action-dialogs";

const COLUMN_LABELS: Record<string, string> = {
  title: "工具入口",
  slug: "标识",
  relatedCourseTitle: "关联课程",
  href: "学生端路径",
  iconName: "图标",
  isEnabled: "启停状态",
  sortOrder: "排序",
};

export function GrowthToolboxItemsTable({
  data,
  courses,
  studentAppId,
  canManage,
}: {
  data: GrowthToolboxItemDisplayRow[];
  courses: GrowthToolboxCourseOption[];
  studentAppId: string;
  canManage: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "sortOrder", desc: false },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const columns = useMemo(
    () => getGrowthToolboxItemColumns(courses, studentAppId, canManage),
    [canManage, courses, studentAppId],
  );
  const filteredData = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((item) => {
      if (status === "enabled" && !item.isEnabled) return false;
      if (status === "disabled" && item.isEnabled) return false;
      if (!normalized) return true;
      return `${item.title} ${item.description} ${item.slug} ${item.href} ${item.relatedCourseTitle}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalized);
    });
  }, [data, query, status]);
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
        <GrowthToolboxTableToolbar
          query={query}
          queryLabel="搜索工具入口"
          queryPlaceholder="搜索名称、标识、路径或关联课程"
          filters={[
            {
              id: "status",
              label: "状态",
              value: status,
              options: [
                { value: "enabled", label: "已启用" },
                { value: "disabled", label: "已停用" },
              ],
            },
          ]}
          viewOptions={viewOptions}
          onQueryChange={setQuery}
          onFilterChange={(_, value) => setStatus(value)}
          onReset={() => {
            setQuery("");
            setStatus("all");
          }}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的工具入口"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          当前显示 {filteredData.length} 项，共 {data.length} 项工具入口
        </p>
      }
    >
      <Table className="min-w-[1200px]">
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
