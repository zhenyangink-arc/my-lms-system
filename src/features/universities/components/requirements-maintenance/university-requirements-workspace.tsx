"use client";

import { useState } from "react";

import { ApplicationRequirementsTable } from "./application-requirements-table";
import type {
  RequirementUniversityOption,
  UniversityRequirementDisplayRow,
  UniversityVisaRequirementDisplayRow,
} from "./types";
import { VisaRequirementsTable } from "./visa-requirements-table";

export function UniversityRequirementsWorkspace({
  requirements,
  visaRequirements,
  universities,
  canManageContent,
}: {
  requirements: UniversityRequirementDisplayRow[];
  visaRequirements: UniversityVisaRequirementDisplayRow[];
  universities: RequirementUniversityOption[];
  canManageContent: boolean;
}) {
  const [view, setView] = useState<"application" | "visa">("application");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)]">
        <button
          type="button"
          aria-pressed={view === "application"}
          onClick={() => setView("application")}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${
            view === "application"
              ? "border-[var(--primary)] text-[var(--foreground)]"
              : "border-transparent text-[var(--foreground-muted)]"
          }`}
        >
          申请要求
          <span className="ml-2 font-mono text-xs tabular-nums opacity-70">
            {requirements.length}
          </span>
        </button>
        <button
          type="button"
          aria-pressed={view === "visa"}
          onClick={() => setView("visa")}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold ${
            view === "visa"
              ? "border-[var(--primary)] text-[var(--foreground)]"
              : "border-transparent text-[var(--foreground-muted)]"
          }`}
        >
          签证要求
          <span className="ml-2 font-mono text-xs tabular-nums opacity-70">
            {visaRequirements.length}
          </span>
        </button>
        <p className="ml-auto px-2 text-xs text-[var(--foreground-muted)]">
          当前仅供查看，编辑操作将在下一阶段接入
        </p>
      </div>

      {view === "application" ? (
        <ApplicationRequirementsTable
          data={requirements}
          universities={universities}
          canManageContent={canManageContent}
        />
      ) : (
        <VisaRequirementsTable
          data={visaRequirements}
          universities={universities}
          canManageContent={canManageContent}
        />
      )}
    </section>
  );
}
