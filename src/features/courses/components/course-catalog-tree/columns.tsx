import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";

import { TableHead, TableRow } from "@/components/ui/table";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import { cn } from "@/lib/utils";
import {
  CourseCatalogEditDialog,
  type CourseCatalogActionOptions,
} from "../course-catalog-action-dialogs";
import {
  ICON_NAME_MAP,
  KIND_DEFAULT_ICON,
  STATUS_TONE_VAR,
  getStatusInfo,
  resolveAccent,
  resolveCoverObjectKey,
  type CourseCatalogFolderRow,
} from "./course-catalog-visuals";

export type { CourseCatalogFolderRow } from "./course-catalog-visuals";

// 三个可排序列：目录结构（标题）、结构情况（完成度）、上架与开放（状态）。
export type CourseCatalogSortKey = "title" | "completeness" | "status";
export type CourseCatalogSortState = {
  key: CourseCatalogSortKey;
  direction: "asc" | "desc";
} | null;

const SORT_KEY_BY_LABEL: Record<string, CourseCatalogSortKey> = {
  目录结构: "title",
  结构情况: "completeness",
  上架与开放: "status",
};

type CourseCatalogSortContextValue = {
  sort: CourseCatalogSortState;
  onSortChange: (key: CourseCatalogSortKey) => void;
};

const CourseCatalogSortContext =
  createContext<CourseCatalogSortContextValue | null>(null);

export function CourseCatalogSortProvider({
  value,
  children,
}: {
  value: CourseCatalogSortContextValue;
  children: ReactNode;
}) {
  return (
    <CourseCatalogSortContext.Provider value={value}>
      {children}
    </CourseCatalogSortContext.Provider>
  );
}

function ariaSortForKey(
  sort: CourseCatalogSortState,
  sortKey: CourseCatalogSortKey,
): "ascending" | "descending" | "none" {
  if (sort?.key !== sortKey) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function SortableTableHead({
  label,
  sortKey,
}: {
  label: string;
  sortKey: CourseCatalogSortKey;
}) {
  const context = useContext(CourseCatalogSortContext);
  const sort = context?.sort ?? null;
  const isActive = sort?.key === sortKey;
  const Icon = !isActive
    ? ArrowUpDown
    : sort.direction === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <TableHead className="px-4 text-xs" aria-sort={ariaSortForKey(sort, sortKey)}>
      <button
        type="button"
        onClick={() => context?.onSortChange(sortKey)}
        className="inline-flex items-center gap-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        aria-label={`按${label}排序，${isActive ? (sort.direction === "asc" ? "当前升序" : "当前降序") : "未排序"}`}
      >
        {label}
        <Icon size={12} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

export function sortableHeader(label: string) {
  const sortKey = SORT_KEY_BY_LABEL[label];
  if (!sortKey) return <TableHead className="px-4 text-xs">{label}</TableHead>;
  return <SortableTableHead label={label} sortKey={sortKey} />;
}

export function CourseCatalogTableHeaderRow() {
  return (
    <TableRow>
      {sortableHeader("目录结构")}
      {sortableHeader("结构情况")}
      {sortableHeader("上架与开放")}
      <TableHead className="px-4 text-right text-xs">操作</TableHead>
    </TableRow>
  );
}

export function getCourseCatalogSortValue(
  row: CourseCatalogFolderRow,
  key: CourseCatalogSortKey,
): string | number {
  if (key === "title") return row.title.toLocaleLowerCase("zh-CN");
  if (key === "completeness") return row.completeness;
  if (row.isLocked) return 2;
  if (row.isPublished) return 0;
  return 1;
}

function detailHref({
  row,
  dashboardBasePath,
  routeBasePath,
  folderParam,
}: {
  row: CourseCatalogFolderRow;
  dashboardBasePath: string;
  routeBasePath?: string;
  folderParam?: string;
}) {
  const folderQuery = folderParam ? `&folder=${folderParam}` : "";
  return routeBasePath
    ? `${routeBasePath}?node=${row.kind}&id=${row.id}${folderQuery}#course-content`
    : scopeDashboardPath(
        `/dashboard/admin/courses?node=${row.kind}&id=${row.id}${folderQuery}#course-content`,
        dashboardBasePath,
      );
}

function openHref(catalogRoute: string, row: CourseCatalogFolderRow) {
  return `${catalogRoute}?folder=${row.kind}:${row.id}`;
}

export function FolderTitleCell({
  row,
  catalogRoute,
}: {
  row: CourseCatalogFolderRow;
  catalogRoute: string;
}) {
  const iconName = "icon_name" in row.node ? row.node.icon_name : null;
  const Icon =
    (iconName && ICON_NAME_MAP[iconName]) || KIND_DEFAULT_ICON[row.kind];
  const content = (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="shrink-0 text-[var(--foreground-muted)]">
        <Icon size={14} strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-medium text-[var(--foreground)]">
            {row.title}
          </span>
          <span className="shrink-0 text-[10px] text-[var(--foreground-muted)]">
            {row.kindLabel}
          </span>
        </span>
        <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--foreground-muted)]">
          {row.slug}
        </span>
      </span>
      {row.canOpen && (
        <ChevronRight
          size={14}
          className="shrink-0 text-[var(--foreground-muted)]"
          aria-hidden="true"
        />
      )}
    </span>
  );

  if (!row.canOpen) {
    return <div className="min-w-72">{content}</div>;
  }

  return (
    <Link
      href={openHref(catalogRoute, row)}
      className="block min-w-72 rounded-sm py-0.5 hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      {content}
    </Link>
  );
}

export function StructureHealthCell({ row }: { row: CourseCatalogFolderRow }) {
  return (
    <div className="min-w-44">
      <p className="text-[11px] font-medium text-[var(--foreground-secondary)]">
        {row.contentLabel}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex h-[2px] w-20 bg-[var(--border-subtle)]">
          <span
            className="h-full"
            style={{
              width: `${row.completeness}%`,
              backgroundColor:
                row.completeness === 100
                  ? "var(--status-success)"
                  : "var(--status-warning)",
            }}
          />
        </span>
        <span className="font-mono text-[10px] tabular-nums text-[var(--foreground-muted)]">
          {row.completeness}%
        </span>
      </div>
      {row.missingItems.length > 0 && (
        <p
          className="mt-1.5 max-w-52 truncate text-[9px] text-[var(--foreground-muted)]"
          title={row.missingItems.join("、")}
        >
          待补：{row.missingItems.join("、")}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ row }: { row: CourseCatalogFolderRow }) {
  const status = getStatusInfo(row);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--foreground-secondary)]">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: STATUS_TONE_VAR[status.tone] }}
        aria-hidden="true"
      />
      {status.label}
    </span>
  );
}

export function PublicationCell({ row }: { row: CourseCatalogFolderRow }) {
  return (
    <div className="min-w-36 space-y-1.5">
      <StatusBadge row={row} />
      <p
        className="truncate text-[10px] text-[var(--foreground-muted)]"
        title={row.unlockMode}
      >
        {row.unlockMode}
        <span className="mx-1.5" aria-hidden="true">
          ·
        </span>
        排序 {row.sortOrder}
      </p>
    </div>
  );
}

export function RowActionsCell({
  row,
  canManage,
  options,
  dashboardBasePath,
  routeBasePath,
  folderParam,
}: {
  row: CourseCatalogFolderRow;
  canManage: boolean;
  options: CourseCatalogActionOptions;
  dashboardBasePath: string;
  routeBasePath?: string;
  folderParam?: string;
}) {
  return (
    <div className="flex min-w-max justify-end gap-1.5">
      <Link
        href={detailHref({
          row,
          dashboardBasePath,
          routeBasePath,
          folderParam,
        })}
        className="inline-flex h-7 items-center px-2 text-[11px] font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
      >
        查看结构
      </Link>
      {canManage && (
        <CourseCatalogEditDialog node={row.node} options={options} />
      )}
    </div>
  );
}

export function FolderCard({
  row,
  canManage,
  options,
  catalogRoute,
  dashboardBasePath,
  routeBasePath,
  folderParam,
}: {
  row: CourseCatalogFolderRow;
  canManage: boolean;
  options: CourseCatalogActionOptions;
  catalogRoute: string;
  dashboardBasePath: string;
  routeBasePath?: string;
  folderParam?: string;
}) {
  const iconName = "icon_name" in row.node ? row.node.icon_name : null;
  const Icon =
    (iconName && ICON_NAME_MAP[iconName]) || KIND_DEFAULT_ICON[row.kind];
  const accent = resolveAccent(row);
  const coverObjectKey = resolveCoverObjectKey(row);
  const status = getStatusInfo(row);
  const primaryHref = row.canOpen
    ? openHref(catalogRoute, row)
    : detailHref({ row, dashboardBasePath, routeBasePath, folderParam });
  const primaryLabel = row.canOpen
    ? `打开${row.title}`
    : `查看${row.title}详情`;

  return (
    <div className="group relative flex flex-col overflow-hidden border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-soft)]">
      <Link
        href={primaryHref}
        aria-label={primaryLabel}
        className="absolute inset-0 z-0 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
      />

      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--surface-soft)]">
        {coverObjectKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/course-assets/${row.kind}/${row.id}`}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center",
              accent.iconBox,
            )}
          >
            <Icon size={28} strokeWidth={1.6} className={accent.iconText} />
          </div>
        )}
        {row.canOpen && (
          <span
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--card)] text-[var(--foreground-muted)] shadow-sm"
            aria-hidden="true"
          >
            <ChevronRight size={14} />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-[var(--foreground)]">
              {row.title}
            </span>
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_TONE_VAR[status.tone] }}
              aria-hidden="true"
              title={status.label}
            />
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--foreground-muted)]">
            {row.slug}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex h-[2px] flex-1 bg-[var(--border-subtle)]">
            <span
              className="h-full"
              style={{
                width: `${row.completeness}%`,
                backgroundColor:
                  row.completeness === 100
                    ? "var(--status-success)"
                    : "var(--status-warning)",
              }}
            />
          </span>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--foreground-muted)]">
            {row.completeness}%
          </span>
        </div>
        <p className="truncate text-[11px] text-[var(--foreground-muted)]">
          {row.contentLabel}
        </p>

        <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2">
          <span
            className="truncate text-[10px] text-[var(--foreground-muted)]"
            title={row.unlockMode}
          >
            {row.unlockMode}
            <span className="mx-1" aria-hidden="true">
              ·
            </span>
            排序 {row.sortOrder}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {row.canOpen && (
              <Link
                href={detailHref({
                  row,
                  dashboardBasePath,
                  routeBasePath,
                  folderParam,
                })}
                className="inline-flex h-6 items-center px-1.5 text-[10px] font-medium text-[var(--foreground-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
              >
                详情
              </Link>
            )}
            {canManage && (
              <CourseCatalogEditDialog
                node={row.node}
                options={options}
                compact
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
