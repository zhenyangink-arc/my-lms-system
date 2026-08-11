"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import { LocalDateTime } from "@/components/LocalDateTime";
import { DataTable } from "@/components/ui/table/data-table";
import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type {
  AnnouncementTenantOption,
  ManagedAnnouncement,
} from "../api/types";

type TenantAnnouncementSummary = {
  id: string;
  name: string;
  total: number;
  published: number;
  draft: number;
  archived: number;
  urgent: number;
  latestPublishedAt: string | null;
  announcements: ManagedAnnouncement[];
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function sortableHeader(title: string) {
  return function SortableHeader({
    column,
  }: {
    column: {
      getIsSorted: () => false | "asc" | "desc";
      toggleSorting: (descending?: boolean) => void;
    };
  }) {
    const direction = column.getIsSorted();
    return (
      <DataTableColumnHeader
        title={title}
        sortable
        direction={direction}
        onClick={() => column.toggleSorting(direction === "asc")}
      />
    );
  };
}

const inspectionColumns: ColumnDef<TenantAnnouncementSummary>[] = [
  {
    accessorKey: "name",
    header: sortableHeader("机构名称"),
    cell: ({ row }) => (
      <span className="font-semibold text-[var(--app-text)]">
        {row.original.name}
      </span>
    ),
  },
  { accessorKey: "total", header: sortableHeader("公告总数") },
  { accessorKey: "published", header: sortableHeader("已发布") },
  { accessorKey: "draft", header: sortableHeader("草稿") },
  { accessorKey: "archived", header: sortableHeader("已归档") },
  { accessorKey: "urgent", header: sortableHeader("已发布紧急公告") },
  {
    accessorKey: "latestPublishedAt",
    header: sortableHeader("最近发布"),
    cell: ({ row }) => (
      <span className="text-xs text-[var(--app-muted)]">
        <LocalDateTime
          value={row.original.latestPublishedAt}
          options={DATE_OPTIONS}
          fallback="暂无发布"
        />
      </span>
    ),
  },
  {
    id: "details",
    enableSorting: false,
    header: () => <span className="sr-only">巡检公告</span>,
    cell: ({ row }) => <TenantInspectionDialog summary={row.original} />,
  },
];

export function TenantAnnouncementInspection({
  announcements,
  tenants,
}: {
  announcements: ManagedAnnouncement[];
  tenants: AnnouncementTenantOption[];
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const summaries = useMemo(() => {
    const announcementsByTenant = new Map<string, ManagedAnnouncement[]>();
    for (const announcement of announcements) {
      if (!announcement.tenantId) continue;
      const current = announcementsByTenant.get(announcement.tenantId) ?? [];
      current.push(announcement);
      announcementsByTenant.set(announcement.tenantId, current);
    }
    return tenants.map((tenant): TenantAnnouncementSummary => {
      const items = announcementsByTenant.get(tenant.id) ?? [];
      return {
        id: tenant.id,
        name: tenant.name,
        total: items.length,
        published: items.filter((item) => item.status === "published").length,
        draft: items.filter((item) => item.status === "draft").length,
        archived: items.filter((item) => item.status === "archived").length,
        urgent: items.filter(
          (item) => item.status === "published" && item.priority === "urgent",
        ).length,
        latestPublishedAt:
          items.find((item) => item.status === "published")?.publishedAt ?? null,
        announcements: items,
      };
    });
  }, [announcements, tenants]);
  // TanStack Table intentionally exposes mutable methods inside a client boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: summaries,
    columns: inspectionColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <DataTable
      isEmpty={summaries.length === 0}
      emptyContent="暂无可巡检机构"
      footer={
        <p className="text-xs text-[var(--app-muted)]">
          共 {summaries.length} 个机构；平台端仅查看机构公告，不在此处代替机构操作。
        </p>
      }
    >
      <Table className="min-w-[920px]">
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

function TenantInspectionDialog({
  summary,
}: {
  summary: TenantAnnouncementSummary;
}) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="h-8 rounded-md border border-[var(--app-border)] px-2.5 text-xs font-semibold text-[var(--app-text-soft)] hover:bg-[var(--app-soft-bg)]"
      >
        查看公告
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{summary.name}公告巡检</DialogTitle>
          <DialogDescription>
            共 {summary.total} 条公告，平台端保持只读。
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto border border-[var(--app-border)]">
          <table className="w-full min-w-[680px] border-collapse text-left text-xs">
            <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]">
              <tr>
                <th className="px-3 py-2.5 font-medium">公告标题</th>
                <th className="px-3 py-2.5 font-medium">状态</th>
                <th className="px-3 py-2.5 font-medium">阅读情况</th>
                <th className="px-3 py-2.5 font-medium">发布时间</th>
              </tr>
            </thead>
            <tbody>
              {summary.announcements.map((announcement) => (
                <tr
                  key={announcement.id}
                  className="border-t border-[var(--app-border-soft)]"
                >
                  <td className="max-w-72 truncate px-3 py-2.5 font-medium">
                    {announcement.title}
                  </td>
                  <td className="px-3 py-2.5">
                    {announcement.status === "published"
                      ? "已发布"
                      : announcement.status === "draft"
                        ? "草稿"
                        : "已归档"}
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">
                    {announcement.readCount} / {announcement.audienceCount}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--app-muted)]">
                    <LocalDateTime
                      value={announcement.publishedAt}
                      options={DATE_OPTIONS}
                      fallback="尚未发布"
                    />
                  </td>
                </tr>
              ))}
              {summary.announcements.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-10 text-center text-[var(--app-muted)]"
                  >
                    该机构暂无公告
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
