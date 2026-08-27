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
import {
  getDigitalTextbookColumns,
  type DigitalTextbookDisplayRow,
} from "./columns";
import {
  DigitalTextbookTableToolbar,
  INITIAL_DIGITAL_TEXTBOOK_FILTERS,
  type DigitalTextbookTableFilters,
} from "./digital-textbook-table-toolbar";

const COLUMN_LABELS: Record<string, string> = {
  hierarchy: "教材位置",
  versionNumber: "当前版本",
  chapterNumber: "教材章节",
  contentSummary: "内容概况",
  publishing: "发布状态",
};

export function DigitalTextbookTable({
  data,
  canManage,
  canPublishChapters,
}: {
  data: DigitalTextbookDisplayRow[];
  canManage: boolean;
  canPublishChapters: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "hierarchy", desc: false },
    { id: "versionNumber", desc: false },
    { id: "chapterNumber", desc: false },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<DigitalTextbookTableFilters>(
    INITIAL_DIGITAL_TEXTBOOK_FILTERS,
  );
  const columns = useMemo(
    () => getDigitalTextbookColumns(canManage, canPublishChapters),
    [canManage, canPublishChapters],
  );

  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((row) => {
      if (
        filters.textbookStatus !== "all" &&
        row.textbookStatus !== filters.textbookStatus
      ) {
        return false;
      }
      if (
        filters.chapterStatus !== "all" &&
        row.chapterStatus !== filters.chapterStatus
      ) {
        return false;
      }
      if (
        filters.moduleCode !== "all" &&
        !row.moduleCodes.includes(filters.moduleCode)
      ) {
        return false;
      }
      if (!query) return true;
      return `${row.courseTitle} ${row.lessonTitle} ${row.textbookTitle} ${row.textbookSlug} ${row.chapterSlug}`
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
        <DigitalTextbookTableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          viewOptions={viewOptions}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合筛选条件的教材章节"
      footer={
        <p className="text-xs text-[var(--foreground-muted)]">
          当前显示 {filteredData.length} 个章节，共 {data.length} 个章节
        </p>
      }
    >
      <Table className="min-w-[1060px]">
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
