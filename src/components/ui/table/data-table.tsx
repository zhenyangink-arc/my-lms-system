import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface DataTableProps {
  children: ReactNode;
  className?: string;
  toolbar?: ReactNode;
  footer?: ReactNode;
  isEmpty?: boolean;
  emptyContent?: ReactNode;
}

export function DataTable({
  children,
  className,
  toolbar,
  footer,
  isEmpty = false,
  emptyContent,
}: DataTableProps) {
  return (
    <section
      data-slot="data-table"
      className={cn(
        "overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-bg)]",
        className,
      )}
    >
      {toolbar && (
        <div
          data-slot="data-table-toolbar"
          className="border-b border-[var(--app-border)] p-3"
        >
          {toolbar}
        </div>
      )}
      {isEmpty ? (
        <div
          data-slot="data-table-empty"
          className="flex min-h-40 items-center justify-center px-5 py-10 text-center text-sm text-[var(--app-muted)]"
        >
          {emptyContent ?? "暂无数据"}
        </div>
      ) : (
        children
      )}
      {footer && (
        <div
          data-slot="data-table-footer"
          className="border-t border-[var(--app-border)] px-4 py-3"
        >
          {footer}
        </div>
      )}
    </section>
  );
}
