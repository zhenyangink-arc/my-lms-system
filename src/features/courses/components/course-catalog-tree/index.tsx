"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
  type ExpandedState,
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
import type {
  CourseCatalogChapter,
  CourseCatalogCourse,
  CourseCatalogLesson,
  CourseCategory,
} from "../../api/types";
import { getCourseCatalogTreeColumns, type CourseCatalogTreeRow } from "./columns";
import {
  CourseCatalogToolbar,
  INITIAL_COURSE_CATALOG_FILTERS,
  type CourseCatalogFilters,
} from "./course-catalog-toolbar";

function filterTree(
  rows: CourseCatalogTreeRow[],
  filters: CourseCatalogFilters,
): CourseCatalogTreeRow[] {
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");

  return rows.flatMap((row) => {
    const children = filterTree(row.children, filters);
    const matchesQuery =
      !query ||
      `${row.title} ${row.slug} ${row.parentTitle}`
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    const matchesKind = filters.kind === "all" || row.kind === filters.kind;
    const matchesStatus =
      filters.status === "all" ||
      (filters.status === "published" && row.isPublished && !row.isLocked) ||
      (filters.status === "draft" && !row.isPublished) ||
      (filters.status === "locked" && row.isLocked);

    if ((matchesQuery && matchesKind && matchesStatus) || children.length > 0) {
      return [{ ...row, children }];
    }
    return [];
  });
}

function countRows(rows: CourseCatalogTreeRow[]): number {
  return rows.reduce((total, row) => total + 1 + countRows(row.children), 0);
}

export function CourseCatalogTreeTable({
  data,
  canManage,
  categories,
  courses,
  lessons,
  chapters,
}: {
  data: CourseCatalogTreeRow[];
  canManage: boolean;
  categories: CourseCategory[];
  courses: CourseCatalogCourse[];
  lessons: CourseCatalogLesson[];
  chapters: CourseCatalogChapter[];
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [filters, setFilters] = useState<CourseCatalogFilters>(
    INITIAL_COURSE_CATALOG_FILTERS,
  );
  const filteredData = useMemo(() => filterTree(data, filters), [data, filters]);
  const hasFilters =
    Boolean(filters.query.trim()) ||
    filters.kind !== "all" ||
    filters.status !== "all";
  const columns = useMemo(
    () =>
      getCourseCatalogTreeColumns({
        canManage,
        options: { categories, courses, lessons, chapters },
      }),
    [canManage, categories, courses, lessons, chapters],
  );

  // TanStack Table 在客户端表格边界中提供可变状态方法。
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, expanded: hasFilters ? true : expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.children,
    getRowId: (row) => row.key,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });
  const visibleCount = countRows(filteredData);
  const totalCount = countRows(data);

  return (
    <DataTable
      toolbar={
        <CourseCatalogToolbar
          filters={filters}
          onFiltersChange={setFilters}
          onExpandAll={() => setExpanded(true)}
          onCollapseAll={() => setExpanded({})}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合当前条件的课程结构"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          当前范围 {visibleCount} 项，共 {totalCount} 项课程结构
        </p>
      }
    >
      <Table className="min-w-[1040px]">
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
