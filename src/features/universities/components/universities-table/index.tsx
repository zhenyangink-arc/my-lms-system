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
import type { ManagedUniversity } from "../../api/types";
import { universityColumns } from "./columns";
import {
  INITIAL_UNIVERSITY_TABLE_FILTERS,
  UniversityTableToolbar,
  type UniversityTableFilters,
} from "./university-table-toolbar";

const COLUMN_LABELS: Record<string, string> = {
  name_zh: "大学名称",
  region: "地区",
  qs_rank_sort: "世界排名",
  joongang_rank_sort: "韩国排名",
  tuition_max_cny: "年度学费",
  admission_stages: "申请阶段",
  is_published: "发布状态",
  sort_order: "推荐顺序",
  updated_at: "最近更新",
};

function matchesRankingFilter(
  university: ManagedUniversity,
  ranking: UniversityTableFilters["ranking"],
) {
  if (ranking === "all") return true;
  if (ranking === "qs_top_100") {
    return university.qs_rank_sort !== null && university.qs_rank_sort <= 100;
  }
  if (ranking === "qs_top_300") {
    return university.qs_rank_sort !== null && university.qs_rank_sort <= 300;
  }
  if (ranking === "qs_ranked") return university.qs_rank_sort !== null;
  if (ranking === "joongang_ranked") {
    return university.joongang_rank_sort !== null;
  }
  return (
    university.qs_rank_sort === null &&
    university.joongang_rank_sort === null
  );
}
function matchesTuitionFilter(
  university: ManagedUniversity,
  tuition: UniversityTableFilters["tuition"],
) {
  if (tuition === "all") return true;
  if (tuition === "max_at_most_50000") {
    return university.tuition_max_cny <= 50_000;
  }
  if (tuition === "max_50000_to_80000") {
    return (
      university.tuition_max_cny > 50_000 &&
      university.tuition_max_cny <= 80_000
    );
  }
  return university.tuition_max_cny > 80_000;
}

export function UniversitiesTable({ data }: { data: ManagedUniversity[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "sort_order", desc: false },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [filters, setFilters] = useState<UniversityTableFilters>(
    INITIAL_UNIVERSITY_TABLE_FILTERS,
  );
  const regions = useMemo(
    () =>
      Array.from(new Set(data.map((university) => university.province))).sort(
        (left, right) => left.localeCompare(right, "zh-CN"),
      ),
    [data],
  );
  const filteredData = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase("zh-CN");
    return data.filter((university) => {
      if (
        filters.status === "published" &&
        !university.is_published
      ) {
        return false;
      }
      if (filters.status === "hidden" && university.is_published) return false;
      if (filters.region !== "all" && university.province !== filters.region) {
        return false;
      }
      if (
        filters.admissionStage !== "all" &&
        !university.admission_stages.includes(filters.admissionStage)
      ) {
        return false;
      }
      if (!matchesRankingFilter(university, filters.ranking)) return false;
      if (!matchesTuitionFilter(university, filters.tuition)) return false;
      if (!query) return true;
      return `${university.name_zh} ${university.name_ko} ${university.province} ${university.city} ${university.summary}`
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    });
  }, [data, filters]);
  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns: universityColumns,
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
        <UniversityTableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          regions={regions}
          viewOptions={viewOptions}
        />
      }
      isEmpty={filteredData.length === 0}
      emptyContent="没有符合条件的大学"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          当前显示 {filteredData.length} 所，共 {data.length} 所大学
        </p>
      }
    >
      <Table className="min-w-[1440px]">
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
