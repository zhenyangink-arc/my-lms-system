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
import type { GrowthToolboxVocabularyItem } from "../../api/types";
import { GrowthToolboxTableToolbar } from "../table-toolbar";
import { getGrowthToolboxVocabularyColumns } from "./columns";

const COLUMN_LABELS: Record<string, string> = {
  ko: "韩语词汇",
  zh: "中文释义",
  pos: "词性",
  collocation: "搭配与说明",
  source: "来源",
  sortOrder: "排序",
};

export function GrowthToolboxVocabularyTable({
  data,
  studentAppId,
  canManage,
}: {
  data: GrowthToolboxVocabularyItem[];
  studentAppId: string;
  canManage: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "sortOrder", desc: false },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const columns = useMemo(
    () => getGrowthToolboxVocabularyColumns(studentAppId, canManage),
    [canManage, studentAppId],
  );
  const filteredData = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((word) => {
      if (source !== "all" && word.source !== source) return false;
      if (!normalized) return true;
      return `${word.ko} ${word.zh} ${word.pos} ${word.collocation} ${word.transcription}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalized);
    });
  }, [data, query, source]);
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
          queryLabel="搜索词汇"
          queryPlaceholder="搜索韩语、释义、词性、搭配或音标"
          filters={[
            {
              id: "source",
              label: "来源",
              value: source,
              options: [
                { value: "textbook", label: "互动教材" },
                { value: "custom", label: "自定义" },
              ],
            },
          ]}
          viewOptions={viewOptions}
          onQueryChange={setQuery}
          onFilterChange={(_, value) => setSource(value)}
          onReset={() => {
            setQuery("");
            setSource("all");
          }}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的词汇"
      footer={
        <p className="text-xs text-[var(--foreground-muted)]">
          当前显示 {filteredData.length} 条，共 {data.length} 条词汇
        </p>
      }
    >
      <Table className="min-w-[1080px]">
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
