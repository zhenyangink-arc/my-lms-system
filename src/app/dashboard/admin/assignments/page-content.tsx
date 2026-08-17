import Link from "next/link";
import {
  BookOpenCheck,
  ClipboardCheck,
  FlaskConical,
  GraduationCap,
} from "lucide-react";

import { requireAssessmentPaperWorkspace } from "@/lib/assessment-papers";
import { ChapterTestWorkspace } from "./ChapterTestWorkspace";
import { HomeworkChapterWorkspace } from "./HomeworkChapterWorkspace";
import { PaperTypeWorkspace } from "./PaperTypeWorkspace";

type Workspace = "chapter-tests" | "homework" | "exam";

type AssignmentManagementPageProps = {
  searchParams: Promise<{
    workspace?: string | string[];
  }>;
};

export default async function AssignmentManagementPage({
  searchParams,
}: AssignmentManagementPageProps) {
  const { canManagePapers } = await requireAssessmentPaperWorkspace();
  const params = await searchParams;
  const requestedWorkspace = Array.isArray(params.workspace)
    ? params.workspace[0]
    : params.workspace;
  const visibleWorkspaces: Workspace[] = canManagePapers
    ? ["chapter-tests", "homework", "exam"]
    : ["homework", "exam"];
  const activeWorkspace = visibleWorkspaces.includes(
    requestedWorkspace as Workspace
  )
    ? (requestedWorkspace as Workspace)
    : visibleWorkspaces[0];
  const navigation = [
    ...(canManagePapers
      ? [
          {
            key: "chapter-tests" as const,
            label: "章节测试管理",
            icon: FlaskConical,
          },
        ]
      : []),
    {
      key: "homework" as const,
      label: "作业管理",
      icon: BookOpenCheck,
    },
    {
      key: "exam" as const,
      label: "考试管理",
      icon: GraduationCap,
    },
  ];

  return (
    <div className="pb-12">
      <div className="mx-auto w-full max-w-[1500px] px-4 pt-6 sm:px-6 lg:px-8">
        <nav
          aria-label="作业与考试管理工作区"
          className={`app-card grid overflow-hidden rounded-2xl border ${
            canManagePapers ? "md:grid-cols-3" : "md:grid-cols-2"
          }`}
        >
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activeWorkspace;

            return (
              <Link
                key={item.key}
                href={`/dashboard/admin/assignments?workspace=${item.key}`}
                aria-current={isActive ? "page" : undefined}
                className="group flex min-h-20 items-center gap-3 border-b px-5 py-4 transition-colors last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
                style={{
                  color: isActive
                    ? "var(--primary)"
                    : "var(--foreground)",
                  backgroundColor: isActive
                    ? "var(--accent)"
                    : "var(--card)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                  style={{
                    color: isActive
                      ? "var(--primary)"
                      : "var(--foreground-muted)",
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                </span>
                {isActive && (
                  <ClipboardCheck
                    className="ml-auto shrink-0"
                    size={16}
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-5">
        {activeWorkspace === "chapter-tests" ? (
          <ChapterTestWorkspace embedded />
        ) : activeWorkspace === "homework" && canManagePapers ? (
          <HomeworkChapterWorkspace embedded />
        ) : (
          <PaperTypeWorkspace
            paperType={activeWorkspace}
            embedded
          />
        )}
      </div>
    </div>
  );
}
