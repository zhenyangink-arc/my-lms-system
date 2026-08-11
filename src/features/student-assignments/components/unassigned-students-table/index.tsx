"use client";

import { useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/table/data-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AssignmentMember } from "../../api/types";
import { unassignedStudentColumns } from "./columns";

export function UnassignedStudentsTable({ data }: { data: AssignmentMember[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns: unassignedStudentColumns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  return (
    <DataTable isEmpty={data.length === 0} emptyContent="当前没有未分配学生" footer={<p className="text-xs text-[var(--app-muted)]">共 {data.length} 名未分配学生</p>}>
      <Table className="min-w-[720px]">
        <TableHeader className="bg-[var(--app-soft-bg)]">{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} className="px-4 text-xs">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
        <TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.original.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="px-4 py-3 text-xs">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </DataTable>
  );
}
