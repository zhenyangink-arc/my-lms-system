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
import type { GrowthToolboxGrammarItem } from "../../api/types";
import { GrowthToolboxTableToolbar } from "../table-toolbar";
import { getGrowthToolboxGrammarColumns } from "./columns";

const COLUMN_LABELS: Record<string, string> = {
  title: "语法名称",
  cases: "收音情况",
  rows: "形态组合",
  examples: "例句",
  audio: "音频字段",
  caution: "注意事项",
  source: "来源",
  sortOrder: "排序",
};

function grammarAudioKeys(item: GrowthToolboxGrammarItem) {
  return [
    ...item.rows.map((row) => row.audio),
    ...item.examples.map((example) => example.audio),
  ].filter(Boolean);
}

export function GrowthToolboxGrammarTable({
  data,
  studentAppId,
  canManage,
}: {
  data: GrowthToolboxGrammarItem[];
  studentAppId: string;
  canManage: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "sortOrder", desc: false },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [audio, setAudio] = useState("all");
  const columns = useMemo(
    () => getGrowthToolboxGrammarColumns(studentAppId, canManage),
    [canManage, studentAppId],
  );
  const filteredData = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((item) => {
      const audioKeys = grammarAudioKeys(item);
      if (source !== "all" && item.source !== source) return false;
      if (audio === "configured" && audioKeys.length === 0) return false;
      if (audio === "missing" && audioKeys.length > 0) return false;
      if (!normalized) return true;
      return `${item.title} ${item.meaning} ${item.caution} ${item.cases
        .map((entry) => `${entry.batchim} ${entry.conjugation}`)
        .join(" ")} ${item.rows
        .map((entry) => `${entry.form} ${entry.combination} ${entry.audio}`)
        .join(" ")} ${item.examples
        .map((entry) => `${entry.ko} ${entry.zh} ${entry.audio}`)
        .join(" ")}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalized);
    });
  }, [audio, data, query, source]);
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
          queryLabel="搜索语法"
          queryPlaceholder="搜索名称、含义、形态、例句或注意事项"
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
            {
              id: "audio",
              label: "音频",
              value: audio,
              options: [
                { value: "configured", label: "已配置" },
                { value: "missing", label: "未配置" },
              ],
            },
          ]}
          viewOptions={viewOptions}
          onQueryChange={setQuery}
          onFilterChange={(id, value) => {
            if (id === "source") setSource(value);
            if (id === "audio") setAudio(value);
          }}
          onReset={() => {
            setQuery("");
            setSource("all");
            setAudio("all");
          }}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的语法条目"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          当前显示 {filteredData.length} 条，共 {data.length} 条语法
        </p>
      }
    >
      <Table className="min-w-[1360px]">
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
