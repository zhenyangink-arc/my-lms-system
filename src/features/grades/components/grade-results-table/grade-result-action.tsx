"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";
import type { LiveGradeResult } from "../../api/types";

export function GradeResultAction({ result }: { result: LiveGradeResult }) {
  const params = useParams<{ space?: string }>();

  if (result.source_type !== "assignment_submission") {
    return <span className="text-[10px] text-[var(--app-muted)]">自动评分</span>;
  }

  const tenantSlug =
    typeof params.space === "string" && params.space !== "platform"
      ? params.space
      : null;
  const href = scopeDashboardPath(
    result.detail_path,
    getDashboardBasePath(tenantSlug),
  );

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--app-accent)] hover:underline"
    >
      进入批改
      <ArrowRight size={12} aria-hidden="true" />
    </Link>
  );
}
