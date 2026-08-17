"use client";

import { useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/table/data-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AssignmentMember, StudentTeacherAssignment } from "../../api/types";
import { teacherAssignmentColumns, type TeacherAssignmentDisplayRow } from "./columns";

export function TeacherAssignmentTable({ teachers, students, assignments }: { teachers: AssignmentMember[]; students: AssignmentMember[]; assignments: StudentTeacherAssignment[] }) {
  const data = useMemo(() => buildDisplayRows(teachers, students, assignments), [teachers, students, assignments]);
  const [sorting, setSorting] = useState<SortingState>([]);
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns: teacherAssignmentColumns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  return (
    <DataTable isEmpty={data.length === 0} emptyContent="本机构还没有老师账号" footer={<p className="text-xs text-[var(--foreground-muted)]">共 {teachers.length} 位老师，{assignments.length} 条负责关系</p>}>
      <Table className="min-w-[780px]">
        <TableHeader className="bg-[var(--surface-soft)]">{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id} sortDirection={header.column.getCanSort() ? header.column.getIsSorted() : undefined} className="px-4 text-xs">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
        <TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.original.id}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="px-4 py-3 text-xs">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </DataTable>
  );
}

function buildDisplayRows(teachers: AssignmentMember[], students: AssignmentMember[], assignments: StudentTeacherAssignment[]): TeacherAssignmentDisplayRow[] {
  const studentById = new Map(students.map((student) => [student.id, student]));
  const studentIdsByTeacher = new Map<string, string[]>();
  for (const assignment of assignments) {
    const studentIds = studentIdsByTeacher.get(assignment.teacher_id) ?? [];
    studentIds.push(assignment.student_id);
    studentIdsByTeacher.set(assignment.teacher_id, studentIds);
  }

  return teachers.flatMap((teacher) => {
    const studentIds = studentIdsByTeacher.get(teacher.id) ?? [];
    if (studentIds.length === 0) return [{ id: `${teacher.id}:unassigned`, teacher, student: null }];
    return studentIds.map((studentId) => ({ id: `${teacher.id}:${studentId}`, teacher, student: studentById.get(studentId) ?? null }));
  });
}
