import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { getAnnouncementAccess } from "@/lib/announcements";
import { isPlatformTenantManagerRole, isValidRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { getConversationPracticeAccess } from "@/lib/conversation-practice";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";
import { getDocumentReviewAccess } from "@/lib/document-reviews";
import { getGradeCenterAccess } from "@/lib/grade-center";
import { getHelpCenterAccess } from "@/lib/help-center";
import { isAssignmentManagerRole } from "@/lib/learning-assignments";
import { getLearningRecordAccess } from "@/lib/learning-records";
import { ASSIGNABLE_PERMISSION_LABELS, isAssignablePermissionKey } from "@/lib/permissions/catalog";
import { getStandardQuestionBankAccess } from "@/lib/question-bank";
import { getLibraryAccess } from "@/lib/resource-library";
import { getStudentAssignmentAccess } from "@/lib/student-assignments";
import { getVisaManagementAccess } from "@/lib/visa-management";
import { loadInstitutionPlatformOverview } from "@/features/institution-platform-overview/api/service";
import {
  InstitutionPlatformOverview,
  InstitutionPlatformOverviewLoadError,
} from "@/features/institution-platform-overview/components/institution-platform-overview";
import {
  getAdminRoleLabel,
  getVisibleAdminNavigation,
} from "./admin-navigation";
import { DataSyncStatusDialog } from "./DataSyncStatusDialog";
import { RecentPermissionActionsDialog } from "./RecentPermissionActionsDialog";

type CountResult = { count: number | null; error: unknown };
type DataResult = { data: unknown[] | null; error: unknown };
type WorkItem = {
  label: string;
  description: string;
  href: string;
  count: number;
  tone: "blue" | "orange" | "violet" | "teal" | "rose" | "sky" | "indigo";
};
type AuditRow = {
  permission_key: string;
  action: "granted" | "revoked";
  created_at: string;
};
type InstitutionSummary = {
  id: string;
  name: string;
  students: number;
  gradeReviews: number;
  attentionRecords: number;
  documentReviews: number;
  visaTasks: number;
  helpTickets: number;
};
type TenantDashboardSummary = {
  active_members: number | string | null;
  published_assignments: number | string | null;
  draft_assignments: number | string | null;
  published_announcements: number | string | null;
  draft_announcements: number | string | null;
  open_help_tickets: number | string | null;
  pending_grade_reviews: number | string | null;
  pending_document_reviews: number | string | null;
  pending_visa_tasks: number | string | null;
  attention_records: number | string | null;
};

const workToneStyles = {
  blue: { solid: "var(--primary)", soft: "var(--accent)" },
  orange: { solid: "var(--status-warning)", soft: "var(--status-warning-surface)" },
  violet: { solid: "var(--support)", soft: "var(--surface-soft)" },
  teal: { solid: "var(--status-success)", soft: "var(--status-success-surface)" },
  rose: { solid: "var(--status-danger)", soft: "var(--status-danger-surface)" },
  sky: { solid: "var(--primary)", soft: "var(--accent)" },
  indigo: { solid: "var(--support)", soft: "var(--surface-soft)" },
} as const;

const institutionSeries = [
  { key: "gradeReviews", label: "成绩", color: "var(--primary)", soft: "var(--accent)" },
  { key: "attentionRecords", label: "记录", color: "var(--status-danger)", soft: "var(--status-danger-surface)" },
  { key: "documentReviews", label: "资料", color: "var(--status-warning)", soft: "var(--status-warning-surface)" },
  { key: "visaTasks", label: "签证", color: "var(--support)", soft: "var(--surface-soft)" },
  { key: "helpTickets", label: "工单", color: "var(--status-success)", soft: "var(--status-success-surface)" },
] as const;

const metricToneStyles = [
  { solid: "var(--primary)", soft: "var(--surface-soft)" },
  { solid: "var(--support)", soft: "var(--surface-soft)" },
  { solid: "var(--status-success)", soft: "var(--surface-soft)" },
  { solid: "var(--status-warning)", soft: "var(--surface-soft)" },
] as const;

function emptyCount(): Promise<CountResult> {
  return Promise.resolve({ count: 0, error: null });
}

function emptyData(): Promise<DataResult> {
  return Promise.resolve({ data: [], error: null });
}

function countValue(result: CountResult) {
  return Number(result.count ?? 0) || 0;
}

function summaryCount(
  result: { data: unknown; error: unknown },
  field: keyof TenantDashboardSummary,
): CountResult {
  const row = Array.isArray(result.data)
    ? (result.data[0] as TenantDashboardSummary | undefined)
    : undefined;
  return {
    count: result.error ? 0 : numberValue(row?.[field]),
    error: result.error,
  };
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumField(rows: unknown, field: string) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce<number>((sum, row) => {
    if (!row || typeof row !== "object") return sum;
    return sum + numberValue((row as Record<string, unknown>)[field]);
  }, 0);
}

function safeErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "暂时无法读取该数据来源，请稍后重新检查。";
  const record = error as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : "暂时无法读取该数据来源。";
  const code = typeof record.code === "string" ? record.code : null;
  const summary = message.replace(/\s+/g, " ").slice(0, 180);
  return code ? `${summary}（错误代码：${code}）` : summary;
}

function scopeDescription(globalRole: string | null, tenantName: string | null) {
  if (tenantName) return `${tenantName} · 仅本机构数据`;
  if (globalRole === "platform_owner") return "平台全局 · 机构级汇总";
  if (globalRole === "platform_deputy") return "平台范围 · 机构协作";
  if (globalRole === "platform_admin") return "平台范围 · 内容运营";
  return "平台范围 · 只读巡检";
}

export default async function AdminCenterPage() {
  const auth = await requireActiveUser();
  const role = auth.platformProfile?.role === "platform_super_admin"
    ? "platform_super_admin"
    : auth.profile?.role;
  if (!isValidRole(role) || (!isAssignmentManagerRole(role) && !isPlatformTenantManagerRole(role))) {
    redirect("/dashboard");
  }

  const tenantId = auth.tenant?.id ?? null;
  const learningOverviewPromise =
    role === "platform_super_admin" ||
    (role === "tenant_super_admin" && tenantId)
      ? loadInstitutionPlatformOverview({
          supabase: auth.supabase,
          tenantId,
        })
          .then((snapshot) => ({ snapshot, failed: false }))
          .catch((error: unknown) => {
            console.error("[admin-home] 机构与平台学习概览读取失败", error);
            return { snapshot: null, failed: true };
          })
      : Promise.resolve({ snapshot: null, failed: false });
  const tenantSummaryPromise = tenantId
    ? auth.supabase.rpc("get_tenant_admin_dashboard_summary", {
        p_tenant_id: tenantId,
      })
    : Promise.resolve({ data: [], error: null });
  const [
    conversationAccess,
    announcementAccess,
    helpAccess,
    gradeAccess,
    recordAccess,
    libraryAccess,
    documentReviewAccess,
    questionBankAccess,
    visaAccess,
    studentAssignmentAccess,
    tenantSummaryResult,
    learningOverviewResult,
  ] = await Promise.all([
    getConversationPracticeAccess(),
    getAnnouncementAccess(),
    getHelpCenterAccess(),
    getGradeCenterAccess(),
    getLearningRecordAccess(),
    getLibraryAccess(),
    getDocumentReviewAccess(),
    getStandardQuestionBankAccess(),
    getVisaManagementAccess(),
    getStudentAssignmentAccess(),
    tenantSummaryPromise,
    learningOverviewPromise,
  ]);
  const learningOverview = learningOverviewResult.snapshot;

  const globalRole = auth.platformProfile?.global_role ?? null;
  const isPlatformOwner = !tenantId && role === "platform_super_admin";
  const isTenantExecutive = Boolean(tenantId) && (role === "tenant_super_admin" || role === "ceo");
  const canManageTenants = isPlatformTenantManagerRole(auth.platformProfile?.role);
  const canManagePlatformContent = !tenantId && (globalRole === "platform_owner" || globalRole === "platform_admin");
  const dashboardBasePath = getDashboardBasePath(auth.tenant?.slug);
  const visibleItems = getVisibleAdminNavigation(role, {
    canManageConversationPractice: conversationAccess.canManage,
    canAccessAnnouncements: announcementAccess.canAccess,
    canManageHelpCenter: helpAccess.canManage,
    canManageGradeCenter: gradeAccess.canManage,
    canManageLearningRecords: recordAccess.canManage,
    canManageLibrary: libraryAccess.canManage,
    canManageDocumentReviews: documentReviewAccess.canManage,
    canManageTenants,
    canAccessQuestionBank: questionBankAccess.canManage,
    canManageVisas: visaAccess.canManage,
    canManageStudentAssignments: studentAssignmentAccess.canManage,
  }).filter((item) => item.group !== "overview");

  const announcementCount = async (status: "draft" | "published"): Promise<CountResult> => {
    if (!announcementAccess.canAccess || !announcementAccess.scope) return emptyCount();
    let query = auth.supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    if (announcementAccess.scope === "platform") query = query.eq("scope", "platform");
    else query = query.eq("scope", "tenant").eq("tenant_id", announcementAccess.tenantId);
    return query;
  };
  const tenantSummary = (field: keyof TenantDashboardSummary) =>
    tenantId ? summaryCount(tenantSummaryResult, field) : emptyCount();

  const [
    activeTenantsResult,
    suspendedTenantsResult,
    platformAccountsResult,
    publishedCoursesResult,
    draftCoursesResult,
    publishedPapersResult,
    draftPapersResult,
    questionCountResult,
    activeMembersResult,
    publishedAssignmentsResult,
    draftAssignmentsResult,
    publishedAnnouncementsResult,
    draftAnnouncementsResult,
    openHelpResult,
    pendingGradeResult,
    pendingDocumentResult,
    pendingVisaResult,
    attentionRecordResult,
    gradeOverviewResult,
    recordOverviewResult,
    documentOverviewResult,
    visaOverviewResult,
    helpOverviewResult,
    auditResult,
  ] = await Promise.all([
    canManageTenants
      ? auth.supabase.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active")
      : emptyCount(),
    canManageTenants
      ? auth.supabase.from("tenants").select("id", { count: "exact", head: true }).in("status", ["suspended", "archived"])
      : emptyCount(),
    isPlatformOwner
      ? auth.supabase.from("profiles").select("id", { count: "exact", head: true }).not("global_role", "is", null).eq("status", "active")
      : emptyCount(),
    canManagePlatformContent
      ? auth.supabase.from("courses").select("id", { count: "exact", head: true }).eq("is_published", true)
      : emptyCount(),
    canManagePlatformContent
      ? auth.supabase.from("courses").select("id", { count: "exact", head: true }).eq("is_published", false)
      : emptyCount(),
    canManagePlatformContent
      ? auth.supabase.from("assessment_papers").select("id", { count: "exact", head: true }).eq("status", "published")
      : emptyCount(),
    canManagePlatformContent
      ? auth.supabase.from("assessment_papers").select("id", { count: "exact", head: true }).eq("status", "draft")
      : emptyCount(),
    questionBankAccess.canManage
      ? auth.supabase.from("chapter_test_questions").select("id", { count: "exact", head: true }).neq("status", "archived")
      : emptyCount(),
    isTenantExecutive && tenantId
      ? tenantSummary("active_members")
      : emptyCount(),
    tenantId && isAssignmentManagerRole(role)
      ? tenantSummary("published_assignments")
      : emptyCount(),
    tenantId && isAssignmentManagerRole(role)
      ? tenantSummary("draft_assignments")
      : emptyCount(),
    tenantId ? tenantSummary("published_announcements") : announcementCount("published"),
    tenantId ? tenantSummary("draft_announcements") : announcementCount("draft"),
    helpAccess.scope === "tenant" && helpAccess.tenantId
      ? tenantSummary("open_help_tickets")
      : emptyCount(),
    gradeAccess.scope === "institution" && gradeAccess.tenantId
      ? tenantSummary("pending_grade_reviews")
      : emptyCount(),
    documentReviewAccess.scope === "institution" && documentReviewAccess.tenantId
      ? tenantSummary("pending_document_reviews")
      : emptyCount(),
    visaAccess.scope === "institution" && visaAccess.tenantId
      ? tenantSummary("pending_visa_tasks")
      : emptyCount(),
    recordAccess.scope === "institution" && recordAccess.tenantId
      ? tenantSummary("attention_records")
      : emptyCount(),
    isPlatformOwner ? auth.supabase.rpc("get_platform_grade_overview") : emptyData(),
    isPlatformOwner ? auth.supabase.rpc("get_platform_learning_record_overview") : emptyData(),
    isPlatformOwner ? auth.supabase.rpc("get_platform_document_review_overview") : emptyData(),
    isPlatformOwner ? auth.supabase.rpc("get_platform_visa_management_overview") : emptyData(),
    isPlatformOwner ? auth.supabase.rpc("get_platform_help_center_overview") : emptyData(),
    isPlatformOwner
      ? auth.supabase.from("permission_grant_audit_logs").select("permission_key,action,created_at").order("created_at", { ascending: false }).limit(5)
      : emptyData(),
  ]);

  const platformPendingGrade = sumField(gradeOverviewResult.data, "pending_review_count");
  const platformAttentionRecords = sumField(recordOverviewResult.data, "attention_record_count");
  const platformPendingDocuments = sumField(documentOverviewResult.data, "pending_review_count");
  const platformPendingVisas = sumField(visaOverviewResult.data, "pending_task_count") + sumField(visaOverviewResult.data, "support_task_count");
  const platformOpenHelp = sumField(helpOverviewResult.data, "open_tickets") + sumField(helpOverviewResult.data, "in_progress_tickets");

  const institutionById = new Map<string, InstitutionSummary>();
  const mergeInstitutionRows = (
    data: unknown,
    merge: (summary: InstitutionSummary, row: Record<string, unknown>) => void
  ) => {
    if (!Array.isArray(data)) return;
    for (const value of data) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const id = String(row.tenant_id ?? "");
      if (!id) continue;
      const summary = institutionById.get(id) ?? {
        id,
        name: String(row.tenant_name ?? "历史机构"),
        students: 0,
        gradeReviews: 0,
        attentionRecords: 0,
        documentReviews: 0,
        visaTasks: 0,
        helpTickets: 0,
      };
      summary.students = Math.max(summary.students, numberValue(row.active_student_count ?? row.active_members));
      merge(summary, row);
      institutionById.set(id, summary);
    }
  };
  mergeInstitutionRows(gradeOverviewResult.data, (summary, row) => { summary.gradeReviews = numberValue(row.pending_review_count); });
  mergeInstitutionRows(recordOverviewResult.data, (summary, row) => { summary.attentionRecords = numberValue(row.attention_record_count); });
  mergeInstitutionRows(documentOverviewResult.data, (summary, row) => { summary.documentReviews = numberValue(row.pending_review_count); });
  mergeInstitutionRows(visaOverviewResult.data, (summary, row) => { summary.visaTasks = numberValue(row.pending_task_count) + numberValue(row.support_task_count); });
  mergeInstitutionRows(helpOverviewResult.data, (summary, row) => { summary.helpTickets = numberValue(row.open_tickets) + numberValue(row.in_progress_tickets); });
  const institutionRows = [...institutionById.values()].sort((left, right) => {
    const leftPending = left.gradeReviews + left.attentionRecords + left.documentReviews + left.visaTasks + left.helpTickets;
    const rightPending = right.gradeReviews + right.attentionRecords + right.documentReviews + right.visaTasks + right.helpTickets;
    return rightPending - leftPending || left.name.localeCompare(right.name, "zh-CN");
  });

  const workItems: WorkItem[] = [
    ...(gradeAccess.canManage ? [{ label: "成绩复核", description: isPlatformOwner ? "各机构等待处理的成绩复核" : "本机构等待处理的成绩复核", href: "/dashboard/admin/apps", count: isPlatformOwner ? platformPendingGrade : countValue(pendingGradeResult), tone: "blue" as const }] : []),
    ...(documentReviewAccess.canManage ? [{ label: "资料待审核", description: isPlatformOwner ? "各机构等待审核的申请资料" : "本机构等待审核的申请资料", href: "/dashboard/admin/apps/study-abroad/documents", count: isPlatformOwner ? platformPendingDocuments : countValue(pendingDocumentResult), tone: "orange" as const }] : []),
    ...(visaAccess.canManage ? [{ label: "签证待跟进", description: isPlatformOwner ? "各机构待处理的签证任务" : "本机构待处理的签证任务", href: "/dashboard/admin/apps/study-abroad/visa", count: isPlatformOwner ? platformPendingVisas : countValue(pendingVisaResult), tone: "violet" as const }] : []),
    ...(helpAccess.canManage ? [{ label: "帮助工单", description: isPlatformOwner ? "各机构尚未解决的帮助工单" : "本机构待回复或处理中的工单", href: "/dashboard/admin/help", count: isPlatformOwner ? platformOpenHelp : countValue(openHelpResult), tone: "teal" as const }] : []),
    ...(recordAccess.canManage ? [{ label: "关注记录", description: isPlatformOwner ? "各机构需要关注的学习记录" : "本机构标记为需要关注的记录", href: "/dashboard/admin/apps", count: isPlatformOwner ? platformAttentionRecords : countValue(attentionRecordResult), tone: "rose" as const }] : []),
    ...(announcementAccess.canAccess ? [{ label: "公告草稿", description: "尚未发布的通知公告", href: "/dashboard/admin/announcements", count: countValue(draftAnnouncementsResult), tone: "sky" as const }] : []),
    ...(tenantId && isAssignmentManagerRole(role) ? [{ label: "待发布任务", description: "仍处于草稿状态的作业与考试", href: "/dashboard/admin/apps", count: countValue(draftAssignmentsResult), tone: "indigo" as const }] : []),
    ...(!tenantId && canManagePlatformContent ? [{ label: "待发布试卷", description: "平台尚未发布的标准试卷", href: "/dashboard/admin/apps", count: countValue(draftPapersResult), tone: "indigo" as const }] : []),
  ];

  const coreMetrics = isPlatformOwner
    ? [
        ["活跃机构", countValue(activeTenantsResult), "当前正常运行"],
        ["平台账号", countValue(platformAccountsResult), "负责人及平台人员"],
        ["已发布课程", countValue(publishedCoursesResult), "平台课程目录"],
        ["已发布试卷", countValue(publishedPapersResult), "平台标准试卷"],
      ]
    : !tenantId && globalRole === "platform_deputy"
      ? [
          ["活跃机构", countValue(activeTenantsResult), "当前正常运行"],
          ["停用机构", countValue(suspendedTenantsResult), "暂停或已归档"],
          ["可用模块", visibleItems.length, "当前身份可访问"],
          ["待处理", workItems.reduce((sum, item) => sum + item.count, 0), "当前工作队列"],
        ]
      : !tenantId
        ? [
            ["已发布课程", countValue(publishedCoursesResult), "平台课程目录"],
            ["课程草稿", countValue(draftCoursesResult), "尚未发布"],
            ["已发布试卷", countValue(publishedPapersResult), "平台标准试卷"],
            ["题库题目", countValue(questionCountResult), questionBankAccess.canManage ? "当前可维护" : "未单独授权"],
          ]
        : isTenantExecutive
          ? [
              ["机构成员", countValue(activeMembersResult), "当前活跃账号"],
              ["已发布任务", countValue(publishedAssignmentsResult), "本机构作业与考试"],
              ["已发布公告", countValue(publishedAnnouncementsResult), "本机构成员可见"],
              ["待处理", workItems.reduce((sum, item) => sum + item.count, 0), "当前工作队列"],
            ]
          : [
              ["可用模块", visibleItems.length, "当前账号可访问"],
              ["已发布任务", countValue(publishedAssignmentsResult), "本机构作业与考试"],
              ["服务模块", visibleItems.filter((item) => item.group === "service").length, "已获得服务权限"],
              ["待处理", workItems.reduce((sum, item) => sum + item.count, 0), "当前工作队列"],
            ];

  const queryChecks = ([
    ["活跃机构", activeTenantsResult, canManageTenants], ["停用机构", suspendedTenantsResult, canManageTenants], ["平台账号", platformAccountsResult, isPlatformOwner],
    ["已发布课程", publishedCoursesResult, canManagePlatformContent], ["课程草稿", draftCoursesResult, canManagePlatformContent], ["已发布试卷", publishedPapersResult, canManagePlatformContent],
    ["试卷草稿", draftPapersResult, canManagePlatformContent], ["题库", questionCountResult, questionBankAccess.canManage], ["机构成员", activeMembersResult, isTenantExecutive],
    ["已发布任务", publishedAssignmentsResult, Boolean(tenantId) && isAssignmentManagerRole(role)], ["任务草稿", draftAssignmentsResult, Boolean(tenantId) && isAssignmentManagerRole(role)], ["已发布公告", publishedAnnouncementsResult, announcementAccess.canAccess],
    ["公告草稿", draftAnnouncementsResult, announcementAccess.canAccess], ["帮助工单", openHelpResult, helpAccess.scope === "tenant"], ["成绩复核", pendingGradeResult, gradeAccess.scope === "institution"],
    ["资料审核", pendingDocumentResult, documentReviewAccess.scope === "institution"], ["签证任务", pendingVisaResult, visaAccess.scope === "institution"], ["关注记录", attentionRecordResult, recordAccess.scope === "institution"],
    ["机构成绩汇总", gradeOverviewResult, isPlatformOwner], ["机构记录汇总", recordOverviewResult, isPlatformOwner], ["机构资料汇总", documentOverviewResult, isPlatformOwner],
    ["机构签证汇总", visaOverviewResult, isPlatformOwner], ["机构工单汇总", helpOverviewResult, isPlatformOwner], ["权限操作记录", auditResult, isPlatformOwner],
  ] as const).filter(([, , enabled]) => enabled);
  const syncIssues = queryChecks
    .filter(([, result]) => Boolean(result.error))
    .map(([label, result]) => ({ label, message: safeErrorMessage(result.error) }));
  const pendingByHref = new Map<string, number>();
  for (const item of workItems) pendingByHref.set(item.href, (pendingByHref.get(item.href) ?? 0) + item.count);
  const workloadTotal = workItems.reduce((sum, item) => sum + item.count, 0);
  const pendingCategoryCount = workItems.filter((item) => item.count > 0).length;
  const clearedCategoryCount = workItems.length - pendingCategoryCount;
  const maxWorkItemCount = Math.max(1, ...workItems.map((item) => item.count));
  const visualWorkItems = [...workItems].sort((left, right) => right.count - left.count);
  const quickItems = visibleItems
    .filter((item) => item.href !== "/dashboard/admin" && item.group !== "overview")
    .sort(
      (left, right) =>
        (pendingByHref.get(right.href) ?? 0) -
        (pendingByHref.get(left.href) ?? 0),
    )
    .slice(0, 6);
  const institutionChartRows = institutionRows.slice(0, 6);
  const institutionPendingTotal = (row: InstitutionSummary) => institutionSeries.reduce((sum, series) => sum + row[series.key], 0);
  const maxInstitutionPending = Math.max(1, ...institutionChartRows.map(institutionPendingTotal));
  const attentionInstitutionCount = institutionRows.filter(
    (row) => institutionPendingTotal(row) > 0,
  ).length;
  const healthyInstitutionCount = institutionRows.length - attentionInstitutionCount;
  const auditRows = (auditResult.data ?? []) as unknown as AuditRow[];
  const recentPermissionActions = auditRows.map((row) => ({
    label: isAssignablePermissionKey(row.permission_key) ? ASSIGNABLE_PERMISSION_LABELS[row.permission_key] : row.permission_key,
    action: row.action,
    time: row.created_at,
  }));

  return (
    <div
      data-admin-overview
      className="management-home mx-auto w-full max-w-[1500px] space-y-6 px-4 pb-10 pt-7 sm:px-6 lg:px-8"
    >
      <header className="management-home-hero">
        <div className="min-w-0">
          <h1>{isPlatformOwner ? "平台总览" : "管理工作台"}</h1>
        </div>

        <div className="management-home-actions">
          {isPlatformOwner && (
            <RecentPermissionActionsDialog actions={recentPermissionActions} />
          )}
          <span className="management-home-chip">
            <ShieldCheck size={15} aria-hidden="true" />
            {getAdminRoleLabel(role)}
          </span>
          <span className="management-home-chip management-home-chip-muted">
            {scopeDescription(globalRole, auth.tenant?.name ?? null)}
          </span>
          <DataSyncStatusDialog
            checkedCount={queryChecks.length}
            issues={syncIssues}
          />
        </div>
      </header>

      <section className="management-home-metrics" aria-label="平台核心指标">
        {coreMetrics.map(([label, value, description], index) => {
          const tone = metricToneStyles[index % metricToneStyles.length];
          return (
            <article
              key={String(label)}
              className="app-card management-home-metric border"
              style={{ "--metric-color": tone.solid } as CSSProperties}
            >
              <span className="management-home-metric-dot" aria-hidden="true" />
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{description}</small>
            </article>
          );
        })}
      </section>

      {learningOverview ? (
        <InstitutionPlatformOverview snapshot={learningOverview} />
      ) : learningOverviewResult.failed ? (
        <InstitutionPlatformOverviewLoadError
          retryHref={scopeDashboardPath("/dashboard/admin", dashboardBasePath)}
        />
      ) : null}

      <div className={`management-home-bento ${isPlatformOwner ? "management-home-bento-owner" : ""}`}>
        <section className="app-card management-focus-card border">
          <div className="management-card-heading">
            <div>
              <h2>需要你处理</h2>
            </div>
            <span className={workloadTotal > 0 ? "is-warning" : "is-success"}>
              {workloadTotal > 0 ? (
                <Clock3 size={15} aria-hidden="true" />
              ) : (
                <CheckCircle2 size={15} aria-hidden="true" />
              )}
              {workloadTotal > 0 ? `${pendingCategoryCount} 类待处理` : "队列已清空"}
            </span>
          </div>

          <div className="management-focus-summary">
            <strong>{workloadTotal}</strong>
            <span>
              <b>项待处理</b>
              <small>{clearedCategoryCount} 类工作当前无积压</small>
            </span>
          </div>

          <div className="management-focus-list">
            {visualWorkItems.map((item) => {
              const tone = workToneStyles[item.tone];
              const width = item.count > 0
                ? Math.max(7, (item.count / maxWorkItemCount) * 100)
                : 0;
              return (
                <Link
                  key={item.label}
                  href={scopeDashboardPath(item.href, dashboardBasePath)}
                  className="management-focus-row"
                >
                  <span className="management-focus-copy">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className="management-focus-track" aria-hidden="true">
                    <span
                      style={{ width: `${width}%`, backgroundColor: tone.solid }}
                    />
                  </span>
                  <b style={{ color: item.count > 0 ? tone.solid : "var(--foreground-muted)" }}>
                    {item.count}
                  </b>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              );
            })}
            {workItems.length === 0 && (
              <div className="management-empty-state">
                <Sparkles size={20} aria-hidden="true" />
                当前身份没有需要处理的工作队列
              </div>
            )}
          </div>
        </section>

        {isPlatformOwner && (
          <section className="app-card management-institution-card border">
            <div className="management-card-heading">
              <div>
                <h2>需关注机构</h2>
              </div>
              <span className={attentionInstitutionCount > 0 ? "is-warning" : "is-success"}>
                {attentionInstitutionCount > 0 ? (
                  <CircleAlert size={15} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={15} aria-hidden="true" />
                )}
                {attentionInstitutionCount > 0
                  ? `${attentionInstitutionCount} 个需关注`
                  : "全部正常"}
              </span>
            </div>

            <div className="management-institution-summary">
              <span><strong>{institutionRows.length}</strong><small>机构总数</small></span>
              <span><strong>{healthyInstitutionCount}</strong><small>运行正常</small></span>
              <span><strong>{attentionInstitutionCount}</strong><small>需要关注</small></span>
            </div>

            <div className="management-institution-list">
              {institutionChartRows.map((row) => {
                const total = institutionPendingTotal(row);
                const width = total > 0
                  ? Math.max(6, (total / maxInstitutionPending) * 100)
                  : 0;
                const details = institutionSeries
                  .filter((series) => row[series.key] > 0)
                  .slice(0, 3)
                  .map((series) => `${series.label} ${row[series.key]}`)
                  .join(" · ");
                return (
                  <Link
                    key={row.id}
                    href={scopeDashboardPath(`/dashboard/admin/tenants/${row.id}`, dashboardBasePath)}
                    className="management-institution-row"
                  >
                    <span className="management-institution-copy">
                      <strong title={row.name}>{row.name}</strong>
                      <small>{details || `${row.students} 名活跃学生`}</small>
                    </span>
                    <span className="management-institution-track" aria-hidden="true">
                      <span style={{ width: `${width}%` }} />
                    </span>
                    <b className={total > 0 ? "is-warning" : "is-success"}>
                      {total > 0 ? `${total} 项` : "正常"}
                    </b>
                  </Link>
                );
              })}
              {institutionChartRows.length === 0 && (
                <div className="management-empty-state">暂无机构汇总数据</div>
              )}
            </div>

            <Link
              href={scopeDashboardPath("/dashboard/admin/tenants", dashboardBasePath)}
              className="management-card-link"
            >
              查看全部机构
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
        )}
      </div>

      <section className="management-quick-section">
        <div className="management-section-heading">
          <div>
            <h2>常用工作区</h2>
            <p>有待办的模块自动排在前面，减少在导航中来回查找。</p>
          </div>
          <span>{visibleItems.length} 个可用模块</span>
        </div>

        <div className="management-quick-grid">
          {quickItems.map((item) => {
            const Icon = item.icon;
            const pending = pendingByHref.get(item.href) ?? 0;
            return (
              <Link
                key={item.href}
                href={scopeDashboardPath(item.href, dashboardBasePath)}
                className="app-card management-quick-card border"
              >
                <span className="management-quick-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="management-quick-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                {pending > 0 && <b>{pending} 项</b>}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

    </div>
  );
}
