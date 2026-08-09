"use client";

import { useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/table/data-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PlatformTenantAssignmentRow } from "../../api/types";
import { platformCoverageColumns } from "./columns";

export function PlatformCoverageTable({ data }: { data: PlatformTenantAssignmentRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns: platformCoverageColumns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  return (
    <DataTable isEmpty={data.length === 0} emptyContent="暂无机构数据" footer={<p className="text-xs text-[var(--app-muted)]">共 {data.length} 个机构</p>}>
      <Table className="min-w-[820px]">
        <TableHeader className="bg-[var(--app-soft-bg)]">{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} className="px-4 text-xs">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
        <TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="px-4 py-3 text-xs">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </DataTable>
  );
}
