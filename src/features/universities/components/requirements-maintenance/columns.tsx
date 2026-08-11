"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/table/data-table-column-header";
import {
  UNIVERSITY_ADMISSION_STAGE_LABELS,
  UNIVERSITY_DOCUMENT_CATEGORY_LABELS,
  UNIVERSITY_VISA_STAGE_LABELS,
} from "../../constants/university-options";
import type {
  UniversityRequirementDisplayRow,
  UniversityVisaRequirementDisplayRow,
} from "./types";
import {
  EditApplicationRequirementDialog,
  EditVisaRequirementDialog,
} from "./requirement-action-dialogs";

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

export function getApplicationRequirementColumns(
  canManageContent: boolean,
): ColumnDef<UniversityRequirementDisplayRow>[] {
  const columns: ColumnDef<UniversityRequirementDisplayRow>[] = [
  {
    accessorKey: "universityName",
    header: sortableHeader("大学"),
    cell: ({ row }) => (
      <div className="min-w-52">
        <p className="font-semibold text-[var(--app-text)]">
          {row.original.universityName}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">
          {row.original.universityNameKo} · {row.original.universityProvince}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "title",
    header: sortableHeader("要求名称"),
    cell: ({ row }) => (
      <p className="min-w-60 max-w-96 font-medium text-[var(--app-text-soft)]">
        {row.original.title}
      </p>
    ),
  },
  {
    accessorKey: "category",
    header: sortableHeader("材料分类"),
    cell: ({ row }) => UNIVERSITY_DOCUMENT_CATEGORY_LABELS[row.original.category],
  },
  {
    accessorKey: "description",
    header: sortableHeader("说明"),
    cell: ({ row }) => (
      <p className="min-w-72 max-w-[32rem] whitespace-normal leading-5 text-[var(--app-muted)]">
        {row.original.description || "暂无补充说明"}
      </p>
    ),
  },
  {
    accessorKey: "sort_order",
    header: sortableHeader("顺序"),
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">{row.original.sort_order}</span>
    ),
  },
  ];
  if (canManageContent) {
    columns.push({
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: () => <span className="sr-only">操作</span>,
      cell: ({ row }) => (
        <div className="text-right">
          <EditApplicationRequirementDialog requirement={row.original} />
        </div>
      ),
    });
  }
  return columns;
}

export function getVisaRequirementColumns(
  canManageContent: boolean,
): ColumnDef<UniversityVisaRequirementDisplayRow>[] {
  const columns: ColumnDef<UniversityVisaRequirementDisplayRow>[] = [
  {
    accessorKey: "universityName",
    header: sortableHeader("大学"),
    cell: ({ row }) => (
      <div className="min-w-52">
        <p className="font-semibold text-[var(--app-text)]">
          {row.original.universityName}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">
          {row.original.universityNameKo} · {row.original.universityProvince}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "title",
    header: sortableHeader("要求名称"),
    cell: ({ row }) => (
      <p className="min-w-60 max-w-96 font-medium text-[var(--app-text-soft)]">
        {row.original.title}
      </p>
    ),
  },
  {
    accessorKey: "stage",
    header: sortableHeader("办理环节"),
    cell: ({ row }) => UNIVERSITY_VISA_STAGE_LABELS[row.original.stage],
  },
  {
    id: "applicable_scopes",
    accessorFn: (requirement) => requirement.applicable_scopes.length,
    header: sortableHeader("适用阶段"),
    cell: ({ row }) => (
      <div className="flex min-w-48 flex-wrap gap-1">
        {row.original.applicable_scopes.map((scope) => (
          <span
            key={scope}
            className="bg-[var(--app-soft-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--app-text-soft)]"
          >
            {UNIVERSITY_ADMISSION_STAGE_LABELS[scope]}
          </span>
        ))}
      </div>
    ),
  },
  {
    accessorKey: "description",
    header: sortableHeader("说明"),
    cell: ({ row }) => (
      <p className="min-w-72 max-w-[32rem] whitespace-normal leading-5 text-[var(--app-muted)]">
        {row.original.description || "暂无补充说明"}
      </p>
    ),
  },
  {
    accessorKey: "sort_order",
    header: sortableHeader("顺序"),
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">{row.original.sort_order}</span>
    ),
  },
  ];
  if (canManageContent) {
    columns.push({
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: () => <span className="sr-only">操作</span>,
      cell: ({ row }) => (
        <div className="text-right">
          <EditVisaRequirementDialog requirement={row.original} />
        </div>
      ),
    });
  }
  return columns;
}
