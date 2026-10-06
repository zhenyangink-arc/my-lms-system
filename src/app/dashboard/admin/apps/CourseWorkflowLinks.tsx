"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { workflowHref } from "@/lib/course-workflow-context";

/** URL owns chapter context, including chapter changes via native history. */
export function CourseWorkflowLinks({ steps, appPath, section }: {
  steps: readonly { key: string; title: string; responsibility: string; boundary: string }[];
  appPath: string;
  section: string;
}) {
  const params = useSearchParams();
  const chapterId = params.get("chapter") ?? undefined;
  const current = steps.find(step => step.key === section);
  return <div className="space-y-2">
    <nav aria-label="课程内容工作导航" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {steps.map(step => <Link key={step.key} href={workflowHref(appPath, step.key, chapterId)}
        aria-current={section === step.key ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${section === step.key ? "bg-[var(--surface-soft)] text-[var(--foreground)]" : "text-[var(--foreground-muted)] hover:bg-[var(--surface-soft)]"}`}>
        {step.title}
      </Link>)}
    </nav>
    {current && <CardTitleWithHint title={current.responsibility} description={current.boundary}
      headingLevel={2} hintLabel={`${current.title}的职责与边界`}
      titleClassName="text-sm font-medium text-[var(--foreground-secondary)]" />}
  </div>;
}
