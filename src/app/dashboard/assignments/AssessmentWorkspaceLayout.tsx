"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  ClipboardCheck,
  FilePenLine,
  LayoutDashboard,
} from "lucide-react";

import {
  normalizeDashboardPathname,
  scopeDashboardPath,
} from "@/lib/dashboard-path";

export type WorkspaceSection = "chapter_test" | "homework" | "exam";

const sections = [
  {
    value: "chapter_test",
    label: "章节测试",
    description: "按章节巩固",
    icon: BookOpenCheck,
  },
  {
    value: "homework",
    label: "老师作业",
    description: "完成并提交",
    icon: FilePenLine,
  },
  {
    value: "exam",
    label: "正式考试",
    description: "限时测评",
    icon: ClipboardCheck,
  },
] satisfies Array<{
  value: WorkspaceSection;
  label: string;
  description: string;
  icon: typeof BookOpenCheck;
}>;

function getActiveSection(
  pathname: string,
  requestedType: string | null,
): WorkspaceSection | null {
  if (pathname.startsWith("/dashboard/assignments/korean")) {
    return "chapter_test";
  }

  if (
    requestedType === "chapter_test" ||
    requestedType === "homework" ||
    requestedType === "exam"
  ) {
    return requestedType;
  }

  return null;
}

export function AssessmentWorkspaceLayout({
  children,
  dashboardBasePath,
  section,
}: {
  children: ReactNode;
  dashboardBasePath: string;
  section?: WorkspaceSection;
}) {
  const pathname = normalizeDashboardPathname(usePathname());
  const searchParams = useSearchParams();
  const activeSection =
    section ?? getActiveSection(pathname, searchParams.get("type"));
  const visibleSections = activeSection
    ? sections.filter((item) => item.value === activeSection)
    : [];
  const assignmentsHref = scopeDashboardPath(
    "/dashboard/assignments",
    dashboardBasePath,
  );

  return (
    <div className="assessment-workspace min-h-svh">
      <header className="assessment-workspace-nav sticky top-0 z-50 border-b">
        <div className="mx-auto flex min-h-16 w-full max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-5 lg:min-h-[72px] lg:flex-nowrap lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
            <Link
              href={scopeDashboardPath("/dashboard", dashboardBasePath)}
              className="assessment-nav-icon-button flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition hover:-translate-x-0.5"
              aria-label="返回学习首页"
              title="返回学习首页"
            >
              <ArrowLeft size={17} aria-hidden="true" />
            </Link>

            <Link
              href={assignmentsHref}
              className="flex min-w-0 items-center gap-3 rounded-xl px-1 py-1"
            >
              <span className="assessment-brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm">
                <ClipboardCheck size={19} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold tracking-tight sm:text-base">
                  作业与考试
                </span>
              </span>
            </Link>
          </div>

          <nav
            className="order-3 flex w-full min-w-0 gap-1 overflow-x-auto rounded-2xl p-1 lg:order-none lg:mx-auto lg:w-auto"
            aria-label="作业与考试导航"
          >
            {visibleSections.map((navigationSection) => {
              const Icon = navigationSection.icon;
              return (
                <Link
                  key={navigationSection.value}
                  href={`${assignmentsHref}?type=${navigationSection.value}`}
                  aria-current="page"
                  className="assessment-nav-tab is-active flex min-w-[156px] flex-1 items-center gap-2 rounded-xl px-3 py-2 transition lg:min-w-[176px]"
                >
                  <span className="assessment-nav-tab-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-xs font-bold">
                      {navigationSection.label}
                    </span>
                    <span className="assessment-nav-muted block truncate text-[9px] font-bold">
                      {navigationSection.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <Link
            href={scopeDashboardPath("/dashboard", dashboardBasePath)}
            className="assessment-home-link hidden shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition hover:-translate-y-0.5 lg:inline-flex"
          >
            <LayoutDashboard size={15} aria-hidden="true" />
            学习首页
          </Link>
        </div>
      </header>

      <div className="assessment-workspace-content">{children}</div>
    </div>
  );
}
