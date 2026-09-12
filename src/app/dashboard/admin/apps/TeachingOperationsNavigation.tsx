import Link from "next/link";
import type { ManagementAppAccess } from "@/lib/management-apps";

export function teachingOperationsSteps(access: ManagementAppAccess) {
  if (access.app.slug !== "korean") return [];
  const platform = access.scope === "platform";
  return [
    { key: "students", title: platform ? "机构教学概况" : "学生与教学分配", allowed: access.capabilities.manageStudents },
    { key: "learning-plans", title: platform ? "标准学习计划" : "学习计划与执行", allowed: access.capabilities.manageAssessments && (!platform || access.globalRole === "platform_owner") },
    { key: "assessments", title: platform ? "标准作业与考试" : "作业与考试", allowed: access.capabilities.manageAssessments },
    { key: "practice-center", title: "巩固中心管理", allowed: platform && access.globalRole === "platform_owner" && access.capabilities.manageContent },
    { key: "completion-review", title: platform ? "结课政策与统计" : "结课资格", allowed: access.capabilities.manageAssessments && (platform ? access.globalRole === "platform_owner" : ["teacher", "ceo", "tenant_super_admin"].includes(access.role)) },
  ].filter(step => step.allowed);
}

export function TeachingOperationsNavigation({ access, section }: { access: ManagementAppAccess; section: string }) {
  return <nav aria-label="教学与考核" className="mb-4 flex flex-wrap gap-2 border-b pb-3">
    {teachingOperationsSteps(access).map(step => <Link key={step.key} href={`${access.appPath}/${step.key}`} aria-current={step.key === section ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${step.key === section ? "bg-[var(--foreground)] text-[var(--background)]" : "hover:bg-[var(--surface-soft)]"}`}>{step.title}</Link>)}
  </nav>;
}
