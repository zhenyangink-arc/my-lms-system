import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  PanelsTopLeft,
  ShieldCheck,
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
import { getVisaManagementAccess } from "@/lib/visa-management";
import {
  ADMIN_GROUP_LABELS,
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

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const workToneStyles = {
  blue: { solid: "#2563eb", soft: "#eff6ff" },
  orange: { solid: "#d97706", soft: "#fffbeb" },
  violet: { solid: "#7c3aed", soft: "#f5f3ff" },
  teal: { solid: "#0f766e", soft: "#f0fdfa" },
  rose: { solid: "#e11d48", soft: "#fff1f2" },
  sky: { solid: "#0284c7", soft: "#f0f9ff" },
  indigo: { solid: "#4f46e5", soft: "#eef2ff" },
} as const;

const institutionSeries = [
  { key: "gradeReviews", label: "成绩", color: "#2563eb", soft: "#eff6ff" },
  { key: "attentionRecords", label: "记录", color: "#e11d48", soft: "#fff1f2" },
  { key: "documentReviews", label: "资料", color: "#d97706", soft: "#fffbeb" },
  { key: "visaTasks", label: "签证", color: "#7c3aed", soft: "#f5f3ff" },
  { key: "helpTickets", label: "工单", color: "#0f766e", soft: "#f0fdfa" },
] as const;

const metricToneStyles = [
  { solid: "#2563eb", soft: "#eff6ff" },
  { solid: "#7c3aed", soft: "#f5f3ff" },
  { solid: "#0f766e", soft: "#f0fdfa" },
  { solid: "#d97706", soft: "#fffbeb" },
] as const;

function VisualCount({ value, color, soft }: { value: number; color: string; soft: string }) {
  return (
    <span
      className="inline-flex min-w-7 justify-center rounded px-1.5 py-0.5 font-semibold tabular-nums"
      style={value > 0 ? { color, backgroundColor: soft } : { color: "var(--app-muted-text)" }}
    >
      {value}
    </span>
  );
}

function emptyCount(): Promise<CountResult> {
  return Promise.resolve({ count: 0, error: null });
}

function emptyData(): Promise<DataResult> {
  return Promise.resolve({ data: [], error: null });
}

function countValue(result: CountResult) {
  return Number(result.count ?? 0) || 0;
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
  ]);

  const tenantId = auth.tenant?.id ?? null;
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
      ? auth.supabase.from("tenant_memberships").select("user_id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "active")
      : emptyCount(),
    tenantId && isAssignmentManagerRole(role)
      ? auth.supabase.from("learning_assignments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "published")
      : emptyCount(),
    tenantId && isAssignmentManagerRole(role)
      ? auth.supabase.from("learning_assignments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "draft")
      : emptyCount(),
    announcementCount("published"),
    announcementCount("draft"),
    helpAccess.scope === "tenant" && helpAccess.tenantId
      ? auth.supabase.from("help_tickets").select("id", { count: "exact", head: true }).eq("tenant_id", helpAccess.tenantId).in("status", ["open", "in_progress"])
      : emptyCount(),
    gradeAccess.scope === "institution" && gradeAccess.tenantId
      ? auth.supabase.from("grade_review_requests").select("id", { count: "exact", head: true }).eq("tenant_id", gradeAccess.tenantId).eq("status", "pending")
      : emptyCount(),
    documentReviewAccess.scope === "institution" && documentReviewAccess.tenantId
      ? auth.supabase.from("student_university_targets").select("id", { count: "exact", head: true }).eq("tenant_id", documentReviewAccess.tenantId).eq("document_review_status", "pending_review")
      : emptyCount(),
    visaAccess.scope === "institution" && visaAccess.tenantId
      ? auth.supabase.from("student_visa_tasks").select("id", { count: "exact", head: true }).eq("tenant_id", visaAccess.tenantId).eq("is_archived", false).in("status", ["submitted", "reviewing", "revision_required", "blocked"])
      : emptyCount(),
    recordAccess.scope === "institution" && recordAccess.tenantId
      ? auth.supabase.from("learning_record_notes").select("id", { count: "exact", head: true }).eq("tenant_id", recordAccess.tenantId).eq("status", "active").eq("record_type", "attention")
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
    ...(gradeAccess.canManage ? [{ label: "成绩复核", description: isPlatformOwner ? "各机构等待处理的成绩复核" : "本机构等待处理的成绩复核", href: "/dashboard/admin/grades", count: isPlatformOwner ? platformPendingGrade : countValue(pendingGradeResult), tone: "blue" as const }] : []),
    ...(documentReviewAccess.canManage ? [{ label: "资料待审核", description: isPlatformOwner ? "各机构等待审核的申请资料" : "本机构等待审核的申请资料", href: "/dashboard/admin/documents", count: isPlatformOwner ? platformPendingDocuments : countValue(pendingDocumentResult), tone: "orange" as const }] : []),
    ...(visaAccess.canManage ? [{ label: "签证待跟进", description: isPlatformOwner ? "各机构待处理的签证任务" : "本机构待处理的签证任务", href: "/dashboard/admin/visa", count: isPlatformOwner ? platformPendingVisas : countValue(pendingVisaResult), tone: "violet" as const }] : []),
    ...(helpAccess.canManage ? [{ label: "帮助工单", description: isPlatformOwner ? "各机构尚未解决的帮助工单" : "本机构待回复或处理中的工单", href: "/dashboard/admin/help", count: isPlatformOwner ? platformOpenHelp : countValue(openHelpResult), tone: "teal" as const }] : []),
    ...(recordAccess.canManage ? [{ label: "关注记录", description: isPlatformOwner ? "各机构需要关注的学习记录" : "本机构标记为需要关注的记录", href: "/dashboard/admin/records", count: isPlatformOwner ? platformAttentionRecords : countValue(attentionRecordResult), tone: "rose" as const }] : []),
    ...(announcementAccess.canAccess ? [{ label: "公告草稿", description: "尚未发布的通知公告", href: "/dashboard/admin/announcements", count: countValue(draftAnnouncementsResult), tone: "sky" as const }] : []),
    ...(tenantId && isAssignmentManagerRole(role) ? [{ label: "待发布任务", description: "仍处于草稿状态的作业与考试", href: "/dashboard/admin/assignments", count: countValue(draftAssignmentsResult), tone: "indigo" as const }] : []),
    ...(!tenantId && canManagePlatformContent ? [{ label: "待发布试卷", description: "平台尚未发布的标准试卷", href: "/dashboard/admin/assignments", count: countValue(draftPapersResult), tone: "indigo" as const }] : []),
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
  const toneByHref = new Map<string, WorkItem["tone"]>();
  for (const item of workItems) pendingByHref.set(item.href, (pendingByHref.get(item.href) ?? 0) + item.count);
  for (const item of workItems) toneByHref.set(item.href, item.tone);
  const workloadTotal = workItems.reduce((sum, item) => sum + item.count, 0);
  const pendingCategoryCount = workItems.filter((item) => item.count > 0).length;
  const clearedCategoryCount = workItems.length - pendingCategoryCount;
  const maxWorkItemCount = Math.max(1, ...workItems.map((item) => item.count));
  const visualWorkItems = [...workItems].sort((left, right) => right.count - left.count);
  const institutionChartRows = institutionRows.slice(0, 6);
  const institutionPendingTotal = (row: InstitutionSummary) => institutionSeries.reduce((sum, series) => sum + row[series.key], 0);
  const maxInstitutionPending = Math.max(1, ...institutionChartRows.map(institutionPendingTotal));
  const groups = ["teaching", "service", "organization"] as const;
  const auditRows = (auditResult.data ?? []) as unknown as AuditRow[];
  const recentPermissionActions = auditRows.map((row) => ({
    label: isAssignablePermissionKey(row.permission_key) ? ASSIGNABLE_PERMISSION_LABELS[row.permission_key] : row.permission_key,
    action: row.action,
    time: dateTimeFormatter.format(new Date(row.created_at)),
  }));

  return (
    <div data-admin-overview className="mx-auto w-full max-w-[1500px] space-y-3 p-3 sm:p-4">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="app-muted-text flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em]"><PanelsTopLeft size={12} />管理驾驶舱</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">管理首页</h1>
          <p className="app-muted-text mt-1 text-[11px]">先处理需要关注的事项，再进入对应业务模块。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">{isPlatformOwner && <RecentPermissionActionsDialog actions={recentPermissionActions} />}<span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5"><ShieldCheck size={12} />{getAdminRoleLabel(role)}</span><span className="app-muted-text inline-flex items-center rounded-md border px-2.5 py-1.5">{scopeDescription(globalRole, auth.tenant?.name ?? null)}</span><DataSyncStatusDialog checkedCount={queryChecks.length} issues={syncIssues} /></div>
      </header>

      <section className="app-card overflow-hidden rounded-xl border">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {coreMetrics.map(([label, value, description], index) => { const tone = metricToneStyles[index % metricToneStyles.length]; return <div key={String(label)} className={`relative px-4 py-3 ${index > 0 ? "sm:border-l" : ""} ${index > 1 ? "border-t xl:border-t-0" : ""}`} style={{ borderColor: "var(--app-border)", backgroundColor: tone.soft }}><span className="absolute left-4 top-3 size-1.5 rounded-full" style={{ backgroundColor: tone.solid }} /><p className="app-muted-text pl-3 text-[9px]">{label}</p><div className="mt-1 flex items-end justify-between gap-3"><p className="text-xl font-semibold tabular-nums" style={{ color: tone.solid }}>{value}</p><p className="app-muted-text pb-0.5 text-right text-[9px]">{description}</p></div></div>; })}
        </div>
      </section>

      <div className={`grid items-start gap-3 ${isPlatformOwner ? "xl:grid-cols-2" : ""}`}>
      <section className="app-card overflow-hidden rounded-xl border">
        <div className="flex flex-col gap-1 border-b px-4 py-3 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: "var(--app-border)", backgroundColor: "#f0f9ff" }}>
          <div><h2 className="text-xs font-semibold">工作负载概览</h2><p className="app-muted-text mt-0.5 text-[9px]">横条越长，当前需要处理的事项越多；点击事项可直接进入。</p></div>
          <div className="flex items-center gap-3 text-[9px]"><span className="font-semibold text-amber-700">{pendingCategoryCount} 类待处理</span><span className="font-semibold text-emerald-700">{clearedCategoryCount} 类已清空</span></div>
        </div>
        <div className="grid xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex flex-col justify-between border-b p-4 xl:border-b-0 xl:border-r" style={{ borderColor: "var(--app-border)" }}>
            <div><p className="app-muted-text text-[9px]">待处理总量</p><div className="mt-2 flex items-baseline gap-1"><span className="text-4xl font-semibold tracking-tight tabular-nums">{workloadTotal}</span><span className="app-muted-text text-[10px]">项</span></div></div>
            <p className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded px-2 py-1 text-[9px] font-semibold ${workloadTotal > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{workloadTotal > 0 ? <Clock3 size={11} /> : <CheckCircle2 size={11} />}{workloadTotal > 0 ? "存在待办，建议优先处理" : "当前工作队列已清空"}</p>
          </div>
          <div className="grid gap-x-7 gap-y-3 p-4 lg:grid-cols-2">
            {visualWorkItems.map((item) => { const tone = workToneStyles[item.tone]; const width = item.count > 0 ? Math.max(7, (item.count / maxWorkItemCount) * 100) : 0; return <Link key={item.label} href={scopeDashboardPath(item.href, dashboardBasePath)} className="group grid grid-cols-[88px_minmax(0,1fr)_32px] items-center gap-2 text-[9px]"><span className="truncate font-semibold group-hover:underline">{item.label}</span><span className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}><span className="block h-full rounded-full transition-[width]" style={{ width: `${width}%`, backgroundColor: tone.solid }} /></span><span className="text-right font-semibold tabular-nums" style={{ color: item.count > 0 ? tone.solid : "var(--app-muted-text)" }}>{item.count}</span></Link>; })}
            {workItems.length === 0 && <p className="app-muted-text col-span-full py-5 text-center text-[9px]">当前身份没有需要处理的工作队列</p>}
          </div>
        </div>
      </section>

      {isPlatformOwner && (
        <section className="app-card overflow-hidden rounded-xl border">
          <details open className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 hover:bg-black/[0.015] [&::-webkit-details-marker]:hidden" style={{ backgroundColor: "#f5f3ff" }}><span><span className="text-[10px] font-semibold text-violet-800">机构运行概览</span><span className="app-muted-text ml-2 text-[9px]">仅显示机构级汇总，不显示学生明细</span></span><span className="app-muted-text flex items-center gap-2 text-[9px]">{institutionRows.length} 个机构<ChevronDown size={13} className="transition-transform group-open:rotate-180" /></span></summary>
            <div className="border-t px-4 py-3" style={{ borderColor: "var(--app-border)" }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[9px] font-semibold">机构待办构成 <span className="app-muted-text ml-1 font-normal">按待办量排序，显示前 6 个机构</span></p><div className="flex flex-wrap gap-3">{institutionSeries.map((series) => <span key={series.key} className="app-muted-text inline-flex items-center gap-1 text-[8px]"><span className="size-1.5 rounded-full" style={{ backgroundColor: series.color }} />{series.label}</span>)}</div></div>
              <div className="space-y-2.5">{institutionChartRows.map((row) => { const total = institutionPendingTotal(row); const outerWidth = total > 0 ? Math.max(5, (total / maxInstitutionPending) * 100) : 0; return <div key={row.id} className="grid grid-cols-[110px_minmax(0,1fr)_48px] items-center gap-3 text-[9px]"><span className="truncate font-semibold" title={row.name}>{row.name}</span><div className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}><div className="flex h-full overflow-hidden rounded-full" style={{ width: `${outerWidth}%` }}>{institutionSeries.map((series) => { const value = row[series.key]; return value > 0 ? <span key={series.key} style={{ width: `${(value / total) * 100}%`, backgroundColor: series.color }} /> : null; })}</div></div><span className={`text-right font-semibold tabular-nums ${total > 0 ? "text-amber-700" : "text-emerald-700"}`}>{total > 0 ? `${total} 项` : "正常"}</span></div>; })}{institutionChartRows.length === 0 && <p className="app-muted-text py-5 text-center text-[9px]">暂无机构负载数据</p>}</div>
            </div>
            <details className="group/detail border-t" style={{ borderColor: "var(--app-border)" }}>
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[9px] font-semibold hover:bg-black/[0.015] [&::-webkit-details-marker]:hidden"><span>查看全部机构明细</span><span className="app-muted-text flex items-center gap-1 font-normal">{institutionRows.length} 个机构<ChevronDown size={12} className="transition-transform group-open/detail:rotate-180" /></span></summary>
              <div className="overflow-x-auto border-t" style={{ borderColor: "var(--app-border)" }}><table className="w-full min-w-[940px] table-fixed text-left"><thead><tr className="border-b text-[9px]" style={{ borderColor: "var(--app-border)", color: "var(--app-muted-text)" }}><th className="w-[22%] px-4 py-2 font-medium">机构</th><th className="px-2 py-2 text-center font-medium">学生</th><th className="px-2 py-2 text-center font-medium">成绩复核</th><th className="px-2 py-2 text-center font-medium">关注记录</th><th className="px-2 py-2 text-center font-medium">资料审核</th><th className="px-2 py-2 text-center font-medium">签证任务</th><th className="px-2 py-2 text-center font-medium">帮助工单</th><th className="w-[12%] px-2 py-2 font-medium">状态</th><th className="w-[9%] px-4 py-2 text-right font-medium">操作</th></tr></thead><tbody>{institutionRows.map((row) => { const pending = institutionPendingTotal(row); return <tr key={row.id} className="border-b text-[10px] last:border-b-0" style={{ borderColor: "var(--app-border)" }}><td className="truncate px-4 py-2.5 font-semibold">{row.name}</td><td className="px-2 py-2.5 text-center tabular-nums">{row.students}</td><td className="px-2 py-2.5 text-center"><VisualCount value={row.gradeReviews} color={institutionSeries[0].color} soft={institutionSeries[0].soft} /></td><td className="px-2 py-2.5 text-center"><VisualCount value={row.attentionRecords} color={institutionSeries[1].color} soft={institutionSeries[1].soft} /></td><td className="px-2 py-2.5 text-center"><VisualCount value={row.documentReviews} color={institutionSeries[2].color} soft={institutionSeries[2].soft} /></td><td className="px-2 py-2.5 text-center"><VisualCount value={row.visaTasks} color={institutionSeries[3].color} soft={institutionSeries[3].soft} /></td><td className="px-2 py-2.5 text-center"><VisualCount value={row.helpTickets} color={institutionSeries[4].color} soft={institutionSeries[4].soft} /></td><td className="px-2 py-2.5">{pending > 0 ? <span className="font-semibold text-amber-700">需关注 {pending}</span> : <span className="font-semibold text-emerald-700">正常</span>}</td><td className="px-4 py-2.5 text-right"><Link href={`/dashboard/admin/tenants/${row.id}`} className="font-semibold hover:underline">机构详情</Link></td></tr>; })}</tbody></table>{institutionRows.length === 0 && <p className="app-muted-text px-4 py-7 text-center text-[9px]">暂无机构汇总数据</p>}</div>
            </details>
          </details>
        </section>
      )}
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-2 [&_table]:min-w-[560px]">
      <section className="app-card overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--app-border)", backgroundColor: "#fffbeb" }}><div><h2 className="text-xs font-semibold text-amber-800">待处理事项</h2><p className="app-muted-text mt-0.5 text-[9px]">只显示当前身份有权处理的工作</p></div><span className="text-[10px] font-semibold tabular-nums text-amber-800">{workItems.reduce((sum, item) => sum + item.count, 0)} 项</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] table-fixed text-left"><thead><tr className="border-b text-[9px]" style={{ borderColor: "var(--app-border)", color: "var(--app-muted-text)" }}><th className="w-[22%] px-4 py-2 font-medium">事项</th><th className="w-[42%] px-3 py-2 font-medium">说明</th><th className="w-[16%] px-3 py-2 font-medium">状态</th><th className="px-4 py-2 text-right font-medium">操作</th></tr></thead><tbody>{workItems.map((item) => { const tone = workToneStyles[item.tone]; return <tr key={item.label} className="border-b text-[10px] last:border-b-0" style={{ borderColor: "var(--app-border)" }}><td className="px-4 py-2.5 font-semibold"><span className="mr-2 inline-block size-1.5 rounded-full" style={{ backgroundColor: tone.solid }} />{item.label}</td><td className="app-muted-text px-3 py-2.5">{item.description}</td><td className="px-3 py-2.5">{item.count > 0 ? <span className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[9px] font-semibold" style={{ color: tone.solid, backgroundColor: tone.soft }}><Clock3 size={10} />待处理 {item.count}</span> : <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-1 text-[9px] font-semibold text-emerald-700"><CheckCircle2 size={10} />已清空</span>}</td><td className="px-4 py-2.5 text-right"><Link href={scopeDashboardPath(item.href, dashboardBasePath)} className="inline-flex items-center gap-1 font-semibold hover:underline">进入处理<ArrowRight size={11} /></Link></td></tr>; })}</tbody></table></div>
        {workItems.length === 0 && <div className="px-4 py-8 text-center text-[10px]"><CheckCircle2 className="mx-auto text-emerald-600" size={18} /><p className="mt-2 font-semibold">当前没有需要处理的事项</p></div>}
      </section>

      <section className="app-card overflow-hidden rounded-xl border">
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--app-border)", backgroundColor: "#f0fdfa" }}><h2 className="text-xs font-semibold text-teal-800">业务运行情况</h2><p className="app-muted-text mt-0.5 text-[9px]">入口、权限与待处理状态合并展示，点击分组可以展开或收起。</p></div>
        <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
          {groups.map((group, groupIndex) => {
            const items = visibleItems.filter((item) => item.group === group);
            if (items.length === 0) return null;
            return (
              <details key={group} open={groupIndex === 0} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 hover:bg-black/[0.015] [&::-webkit-details-marker]:hidden">
                  <span className="text-[10px] font-semibold">{ADMIN_GROUP_LABELS[group]} <span className="app-muted-text ml-1 font-normal">{items.length} 个模块</span></span>
                  <ChevronDown size={13} className="app-muted-text transition-transform group-open:rotate-180" />
                </summary>
                <div className="overflow-x-auto border-t" style={{ borderColor: "var(--app-border)" }}>
                  <table className="w-full min-w-[760px] table-fixed text-left">
                    <thead>
                      <tr className="border-b text-[9px]" style={{ borderColor: "var(--app-border)" }}>
                        <th className="w-[28%] px-4 py-2 font-medium">业务模块</th>
                        <th className="w-[46%] px-3 py-2 font-medium">用途说明</th>
                        <th className="w-[14%] px-3 py-2 font-medium">运行状态</th>
                        <th className="px-4 py-2 text-right font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const Icon = item.icon;
                        const pending = pendingByHref.get(item.href) ?? 0;
                        const tone = workToneStyles[toneByHref.get(item.href) ?? "blue"];
                        return (
                          <tr key={item.href} className="border-b text-[10px] last:border-b-0" style={{ borderColor: "var(--app-border)" }}>
                            <td className="px-4 py-2.5"><span className="flex items-center gap-2 font-semibold"><span className="flex size-6 items-center justify-center rounded border" style={{ color: tone.solid, borderColor: tone.soft, backgroundColor: tone.soft }}><Icon size={12} /></span>{item.label}</span></td>
                            <td className="app-muted-text px-3 py-2.5">{item.description}</td>
                            <td className="px-3 py-2.5">{pending > 0 ? <span className="font-semibold" style={{ color: tone.solid }}>待处理 {pending}</span> : <span className="font-semibold text-emerald-700">运行正常</span>}</td>
                            <td className="px-4 py-2.5 text-right"><Link href={scopeDashboardPath(item.href, dashboardBasePath)} className="inline-flex items-center gap-1 font-semibold hover:underline">打开<ArrowRight size={11} /></Link></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      </section>
      </div>

      <footer className="flex items-start gap-2 border-t px-1 pt-3 text-[9px]"><ShieldCheck className="app-muted-text mt-0.5 shrink-0" size={11} /><p className="app-muted-text">首页只汇总当前身份有权看到的数据。平台负责人看到机构级统计，不在这里展示机构学生明细；所有入口仍由服务端权限再次校验。</p></footer>
    </div>
  );
}
