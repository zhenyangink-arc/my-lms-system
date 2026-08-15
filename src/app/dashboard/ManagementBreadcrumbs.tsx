"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

import { normalizeDashboardPathname, scopeDashboardPath } from "@/lib/dashboard-path";

const SEGMENT_LABELS: Record<string, string> = {
  admin: "管理中心",
  accounts: "账号管理",
  assignments: "作业与考试",
  apps: "应用中心",
  announcements: "通知公告",
  courses: "课程管理",
  "digital-textbook": "互动教材",
  documents: "资料审核",
  grades: "成绩管理",
  "growth-toolbox": "成长工具箱",
  help: "帮助中心",
  "home-tree": "首页课程树",
  "my-students": "我的学生",
  permissions: "权限管理",
  profile: "个人资料",
  "question-bank": "标准题库",
  records: "学习记录",
  schools: "学校管理",
  "student-assignments": "学生分配",
  tenants: "机构管理",
  "token-usage": "模型用量",
  universities: "韩国大学",
  visa: "签证管理",
};

export function ManagementBreadcrumbs({
  dashboardBasePath,
}: {
  dashboardBasePath: string;
}) {
  const pathname = normalizeDashboardPathname(usePathname());
  const segments = pathname.split("/").filter(Boolean);
  const adminIndex = segments.indexOf("admin");
  const visibleSegments = adminIndex >= 0 ? segments.slice(adminIndex) : ["admin"];

  return (
    <div className="management-breadcrumbs min-w-0">
      <nav className="flex min-w-0 items-center gap-1 text-xs" aria-label="面包屑导航">
        {visibleSegments.map((segment, index) => {
          const isLast = index === visibleSegments.length - 1;
          const rawPath = `/dashboard/${visibleSegments.slice(0, index + 1).join("/")}`;
          const label = SEGMENT_LABELS[segment] ?? (isLast ? "详情" : segment);
          return (
            <span key={`${segment}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight size={13} className="app-muted-text shrink-0" aria-hidden="true" />}
              {isLast ? (
                <span className="max-w-44 truncate font-medium">{label}</span>
              ) : (
                <Link href={scopeDashboardPath(rawPath, dashboardBasePath)} className="app-muted-text max-w-36 truncate hover:underline">
                  {label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
