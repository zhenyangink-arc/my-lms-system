"use client";

import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface DataTableViewOption {
  id: string;
  label: string;
  visible: boolean;
  canHide?: boolean;
  onVisibleChange: (visible: boolean) => void;
}

export function DataTableViewOptions({
  options,
  className,
}: {
  options: DataTableViewOption[];
  className?: string;
}) {
  const hideableOptions = options.filter((option) => option.canHide !== false);

  if (hideableOptions.length === 0) return null;

  return (
    <details className={cn("group relative", className)}>
      <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-muted">
        <Icons.columns className="size-3.5" aria-hidden="true" />
        显示列
        <Icons.chevronDown
          className="size-3.5 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="absolute right-0 z-30 mt-1 min-w-40 border border-border bg-popover p-1 text-popover-foreground shadow-lg">
        {hideableOptions.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-2 px-2 py-2 text-xs font-medium text-secondary-foreground hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={option.visible}
              onChange={(event) => option.onVisibleChange(event.target.checked)}
              className="size-3.5 accent-primary"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
