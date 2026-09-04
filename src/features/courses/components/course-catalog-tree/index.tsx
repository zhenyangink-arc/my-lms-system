"use client";

import { useMemo, useState } from "react";

import { DataTable } from "@/components/ui/table/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CourseCatalogActionOptions } from "../course-catalog-action-dialogs";
import {
  CourseCatalogSortProvider,
  CourseCatalogTableHeaderRow,
  FolderCard,
  FolderTitleCell,
  PublicationCell,
  RowActionsCell,
  StructureHealthCell,
  getCourseCatalogSortValue,
  type CourseCatalogFolderRow,
  type CourseCatalogSortKey,
  type CourseCatalogSortState,
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
  const [sort, setSort] = useState<CourseCatalogSortState>(null);
  const filteredRows = useMemo(
    () => filterRows(rows, filters),
    [rows, filters],
  );
  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const { key, direction } = sort;
    const sorted = [...filteredRows].sort((a, b) => {
      const left = getCourseCatalogSortValue(a, key);
      const right = getCourseCatalogSortValue(b, key);
      if (left < right) return direction === "asc" ? -1 : 1;
      if (left > right) return direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredRows, sort]);
  const handleSortChange = (key: CourseCatalogSortKey) => {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };
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
          {sortedRows.map((row) => (
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
        <CourseCatalogSortProvider
          value={{ sort, onSortChange: handleSortChange }}
        >
          <Table className="min-w-[860px]">
            <TableHeader className="bg-[var(--surface-soft)]">
              <CourseCatalogTableHeaderRow />
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
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
        </CourseCatalogSortProvider>
      )}
    </DataTable>
  );
}
