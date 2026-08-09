"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

export type DataTableSortDirection = "asc" | "desc" | false;

export interface DataTableColumnHeaderProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  title: ReactNode;
  sortable?: boolean;
  direction?: DataTableSortDirection;
}

export function DataTableColumnHeader({
  title,
  sortable = false,
  direction = false,
  className,
  disabled,
  ...props
}: DataTableColumnHeaderProps) {
  if (!sortable) {
    return <span className={cn("inline-flex items-center", className)}>{title}</span>;
  }

  const SortIcon =
    direction === "asc"
      ? Icons.sortAscending
      : direction === "desc"
        ? Icons.sortDescending
        : Icons.sort;

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 items-center gap-1 font-medium text-[var(--app-muted)] transition-colors hover:text-[var(--app-text)] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      disabled={disabled}
      aria-label={`${String(title)}排序`}
      {...props}
    >
      <span>{title}</span>
      <SortIcon className="size-3.5" aria-hidden="true" />
    </button>
  );
}
