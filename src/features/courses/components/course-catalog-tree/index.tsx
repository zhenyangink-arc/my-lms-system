"use client";

import { useMemo, useState } from "react";

import { DataTable } from "@/components/ui/table/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CourseCatalogActionOptions } from "../course-catalog-action-dialogs";
import {
  FolderCard,
  FolderTitleCell,
  PublicationCell,
  RowActionsCell,
  StructureHealthCell,
  type CourseCatalogFolderRow,
} from "./columns";
import {
  CourseCatalogToolbar,
  INITIAL_COURSE_CATALOG_FILTERS,
  type CourseCatalogFilters,
} from "./course-catalog-toolbar";

function filterRows(
  rows: CourseCatalogFolderRow[],
  filters: CourseCatalogFilters,
): CourseCatalogFolderRow[] {
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");
  return rows.filter((row) => {
    const matchesQuery =
      !query ||
      `${row.title} ${row.slug}`.toLocaleLowerCase("zh-CN").includes(query);
    const matchesStatus =
      filters.status === "all" ||
      (filters.status === "published" && row.isPublished && !row.isLocked) ||
      (filters.status === "draft" && !row.isPublished) ||
      (filters.status === "locked" && row.isLocked) ||
      (filters.status === "incomplete" && row.completeness < 100);
    return matchesQuery && matchesStatus;
  });
}

export function CourseCatalogFolderTable({
  rows,
  canManage,
  options,
  dashboardBasePath,
  routeBasePath,
  catalogRoute,
  folderParam,
}: {
  rows: CourseCatalogFolderRow[];
  canManage: boolean;
  options: CourseCatalogActionOptions;
  dashboardBasePath: string;
  routeBasePath?: string;
  catalogRoute: string;
  folderParam?: string;
}) {
  const [filters, setFilters] = useState<CourseCatalogFilters>(
    INITIAL_COURSE_CATALOG_FILTERS,
  );
  const [view, setView] = useState<"grid" | "list">("grid");
  const filteredRows = useMemo(() => filterRows(rows, filters), [rows, filters]);

  return (
    <DataTable
      toolbar={
        <CourseCatalogToolbar
          filters={filters}
          onFiltersChange={setFilters}
          view={view}
          onViewChange={setView}
        />
      }
      isEmpty={filteredRows.length === 0}
      emptyContent={
        rows.length === 0 ? "这一层还没有内容" : "没有符合当前条件的内容"
      }
      footer={
        <p className="text-xs text-[var(--foreground-muted)] tabular-nums">
          当前范围 {filteredRows.length} 项，共 {rows.length} 项
        </p>
      }
    >
      {view === "grid" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 p-4">
          {filteredRows.map((row) => (
            <FolderCard
              key={row.key}
              row={row}
              canManage={canManage}
              options={options}
              catalogRoute={catalogRoute}
              dashboardBasePath={dashboardBasePath}
              routeBasePath={routeBasePath}
              folderParam={folderParam}
            />
          ))}
        </div>
      ) : (
        <Table className="min-w-[860px]">
          <TableHeader className="bg-[var(--surface-soft)]">
            <TableRow>
              <TableHead className="px-4 text-xs">目录结构</TableHead>
              <TableHead className="px-4 text-xs">结构情况</TableHead>
              <TableHead className="px-4 text-xs">上架与开放</TableHead>
              <TableHead className="px-4 text-right text-xs">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="px-4 py-3 text-xs">
                  <FolderTitleCell row={row} catalogRoute={catalogRoute} />
                </TableCell>
                <TableCell className="px-4 py-3 text-xs">
                  <StructureHealthCell row={row} />
                </TableCell>
                <TableCell className="px-4 py-3 text-xs">
                  <PublicationCell row={row} />
                </TableCell>
                <TableCell className="px-4 py-3 text-xs">
                  <RowActionsCell
                    row={row}
                    canManage={canManage}
                    options={options}
                    dashboardBasePath={dashboardBasePath}
                    routeBasePath={routeBasePath}
                    folderParam={folderParam}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </DataTable>
  );
}
