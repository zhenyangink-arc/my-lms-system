"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
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
import type { CourseLessonResource } from "../../api/types";
import { getLessonResourceColumns } from "./columns";
import {
  INITIAL_LESSON_RESOURCE_FILTERS,
  LessonResourceTableToolbar,
  type LessonResourceFilters,
} from "./lesson-resource-table-toolbar";

export function LessonResourcesTable({
  data,
  canManage,
  canPermanentlyDelete,
}: {
  data: CourseLessonResource[];
  canManage: boolean;
  canPermanentlyDelete: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "sort_order", desc: false },
  ]);
  const [filters, setFilters] = useState<LessonResourceFilters>(
    INITIAL_LESSON_RESOURCE_FILTERS,
  );
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((resource) => {
      if (filters.type !== "all" && resource.resource_type !== filters.type) {
        return false;
      }
      const status = resource.is_deleted
        ? "deleted"
        : resource.is_published
          ? "published"
          : "hidden";
      if (filters.status !== "all" && status !== filters.status) return false;
      if (!query) return true;
      return `${resource.title} ${resource.description ?? ""} ${resource.original_file_name ?? ""} ${resource.resource_url ?? ""}`
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    });
  }, [data, filters]);
  const columns = useMemo(
    () => getLessonResourceColumns({ canManage, canPermanentlyDelete }),
    [canManage, canPermanentlyDelete],
  );

  // TanStack Table 在客户端表格边界中提供可变状态方法。
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <DataTable
      toolbar={
        <LessonResourceTableToolbar
          filters={filters}
          onFiltersChange={setFilters}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合当前条件的课时资料"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          当前显示 {filteredData.length} 条，共 {data.length} 条课时资料
        </p>
      }
    >
      <Table className="min-w-[980px]">
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
            <TableRow key={row.original.id}>
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
