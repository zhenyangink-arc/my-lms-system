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
import type { ManagedHelpArticle } from "../../api/types";
import { helpArticleColumns } from "./columns";
import {
  HelpArticleTableToolbar,
  type HelpArticleTableFilters,
} from "./help-article-table-toolbar";

const INITIAL_FILTERS: HelpArticleTableFilters = {
  query: "",
  status: "all",
  category: "all",
};

const COLUMN_LABELS: Record<string, string> = {
  title: "文章",
  category: "分类",
  status: "状态",
  sort_order: "排序",
  updatedAt: "最近更新",
};

export function HelpArticlesTable({ data }: { data: ManagedHelpArticle[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<HelpArticleTableFilters>(INITIAL_FILTERS);
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((article) => {
      if (filters.status !== "all" && article.status !== filters.status) return false;
      if (filters.category !== "all" && article.category !== filters.category) return false;
      if (!query) return true;
      return `${article.title} ${article.summary} ${article.content}`
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    });
  }, [data, filters]);
  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns: helpArticleColumns,
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
        <HelpArticleTableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          viewOptions={viewOptions}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的帮助文章"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          当前显示 {filteredData.length} 篇，共 {data.length} 篇
        </p>
      }
    >
      <Table className="min-w-[880px]">
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
