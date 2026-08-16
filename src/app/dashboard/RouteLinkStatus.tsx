"use client";

import { useLinkStatus } from "next/link";

export function RouteLinkStatus({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();

  return (
    <span
      className={`route-link-status ${className}`}
      data-pending={pending ? "true" : "false"}
      aria-hidden="true"
    />
  );
}
