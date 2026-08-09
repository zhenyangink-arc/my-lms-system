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
import type { LibraryCourseOption } from "@/app/dashboard/admin/library/LibraryResourceForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LibraryResourceDisplayRow } from "./types";
import {
  LibraryTableToolbar,
  type LibraryCourseFilterOption,
  type LibraryTableFilters,
} from "./library-table-toolbar";
import { getLibraryResourceColumns } from "./columns";

const INITIAL_FILTERS: LibraryTableFilters = {
  query: "",
  status: "all",
  category: "all",
  resourceType: "all",
  courseId: "all",
};

const COLUMN_LABELS: Record<string, string> = {
  title: "资料名称",
  courseLabel: "所属课程",
  groupTitle: "课程分组",
  category: "资料分类",
  resource_type: "资料类型",
  status: "状态",
  download_count: "下载次数",
  sort_order: "排序",
  updated_at: "最近更新",
};

export function LibraryResourcesTable({
  data,
  courseOptions,
  courseTargets,
  canCurate,
}: {
  data: LibraryResourceDisplayRow[];
  courseOptions: LibraryCourseFilterOption[];
  courseTargets: LibraryCourseOption[];
  canCurate: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<LibraryTableFilters>(INITIAL_FILTERS);
  const columns = useMemo(
    () => getLibraryResourceColumns({ canCurate, courses: courseTargets }),
    [canCurate, courseTargets],
  );
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((resource) => {
      if (filters.status !== "all" && resource.status !== filters.status) {
        return false;
      }
      if (
        filters.category !== "all" &&
        resource.category !== filters.category
      ) {
        return false;
      }
      if (
        filters.resourceType !== "all" &&
        resource.resource_type !== filters.resourceType
      ) {
        return false;
      }
      if (
        filters.courseId !== "all" &&
        resource.course_id !== filters.courseId
      ) {
        return false;
      }
      if (!query) return true;
      return `${resource.title} ${resource.description} ${resource.courseLabel} ${resource.lessonLabel} ${resource.groupTitle} ${resource.original_file_name ?? ""}`
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
        <LibraryTableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          courseOptions={courseOptions}
          viewOptions={viewOptions}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的资料"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          当前显示 {filteredData.length} 条，共 {data.length} 条资料
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
