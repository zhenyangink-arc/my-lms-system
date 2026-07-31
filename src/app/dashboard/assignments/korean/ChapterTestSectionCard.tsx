"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";

export function ChapterTestSectionCard({
  eyebrow,
  title,
  description,
  meta,
  accentColor,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta: ReactNode;
  accentColor: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const contentId = useId();

  return (
    <section className="app-card rounded-3xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black" style={{ color: accentColor }}>
            {eyebrow}
          </p>
          <DashboardTitleWithHint
            className="mt-2"
            headingLevel={2}
            titleClassName="text-xl font-black"
            title={title}
            description={description}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-black" style={{ color: accentColor }}>
            {meta}
          </span>
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={contentId}
            onClick={() => setIsOpen((open) => !open)}
            className="app-soft-card inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition hover:-translate-y-0.5"
          >
            {isOpen ? "收起" : "展开"}
            <ChevronDown
              size={15}
              aria-hidden="true"
              className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div id={contentId} className="mt-5">
          {children}
        </div>
      )}
    </section>
  );
}
