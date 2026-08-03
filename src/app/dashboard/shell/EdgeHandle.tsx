"use client";

import type { ButtonHTMLAttributes } from "react";

type EdgeHandleProps = {
  side: "left" | "right";
  label: string;
  open: boolean;
  indicator?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function EdgeHandle({
  side,
  label,
  open,
  indicator,
  className,
  ...handleProps
}: EdgeHandleProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      data-side={side}
      data-open={open ? "true" : undefined}
      data-indicator={indicator ? "true" : undefined}
      className={`app-edge-handle ${className ?? ""}`}
      {...handleProps}
    />
  );
}
