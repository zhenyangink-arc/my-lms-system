import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarCheck2,
  CalendarRange,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  Languages,
  MessageSquareText,
  NotebookTabs,
  PanelsTopLeft,
  Settings2,
  ShieldCheck,
  Stamp,
  Target,
  UsersRound,
  Wrench,
  Workflow,
} from "lucide-react";

import {
  ManagementNotice,
  ManagementPage,
} from "@/components/layout/management-page";
import { RouteLinkStatus } from "@/app/dashboard/RouteLinkStatus";
import { getManagementAppsPath } from "@/lib/management-app-path";
import {
  requireManagementAppAccess,
  type ManagementAppAccess,
} from "@/lib/management-apps";
import type { StudentAppSlug } from "@/lib/student-apps";
import { createClient } from "@/lib/supabase/server";

type CountResult = { count: number | null; error: unknown };

type WorkspaceModule = {
  key: string;
  title: string;
  description: string;
  icon: typeof Languages;
  group: string;
  capability?: keyof ManagementAppAccess["capabilities"];
  appSlugs?: StudentAppSlug[];
  platformOwnerOnly?: boolean;
  tenantTeacherOnly?: boolean;
  institutionExecutiveOnly?: boolean;
  platformOwnerOrTenant?: boolean;
};

const MODULE_GROUP_ORDER = [
  "课程内容",
  "教学与考核",
  "学情与设置",
  "服务与课程",
  "申请与签证",
  "数据与设置",
];

const MODULE_GROUP_TONE: Record<string, string> = {
  课程内容: "emerald",
  教学与考核: "sky",
  学情与设置: "violet",
  服务与课程: "amber",
  申请与签证: "rose",
  数据与设置: "sky",
};

const learningModules: WorkspaceModule[] = [
  {
    key: "learning-plans",
    title: "学习计划",
    description: "平台制定标准学习流程，机构设置开课时间并发布给学生。",
    icon: CalendarRange,
    group: "教学与考核",
    capability: "manageAssessments",
    appSlugs: ["korean"],
    platformOwnerOrTenant: true,
  },
  {
    key: "class-today",
    title: "班级今日情况",
    description: "查看负责学生今天的学习、必做任务、逾期和待批改情况。",
    icon: CalendarCheck2,
    group: "教学与考核",
    capability: "viewAnalytics",
    tenantTeacherOnly: true,
  },
  {
    key: "students",
    title: "学生与教学分配",
    description: "管理开通学生、负责老师与应用内教学关系。",
    icon: UsersRound,
    group: "教学与考核",
    capability: "manageStudents",
  },
  {
    key: "content",
    title: "课程结构",
    description: "建立分类、课程、课时和章节，配置顺序、开放规则与学生端上架。",
    icon: BookOpenCheck,
    group: "课程内容",
    capability: "manageContent",
  },
  {
    key: "assessments",
    title: "作业与考试",
    description: "管理章节测试、老师作业和正式考试。",
    icon: ClipboardCheck,
    group: "教学与考核",
    capability: "manageAssessments",
  },
  {
    key: "textbooks",
    title: "教材制作",
    description: "制作各章节的教材模块、词汇、语法与互动内容，并发布教材版本。",
    icon: PanelsTopLeft,
    group: "课程内容",
    capability: "manageContent",
  },
  {
    key: "teaching-scripts",
    title: "教学脚本",
    description: "编排教学 Agent 的分段讲解、理解检查、补救路径和发布版本。",
    icon: Workflow,
    group: "课程内容",
    capability: "manageContent",
    appSlugs: ["korean"],
    platformOwnerOnly: true,
  },
  {
    key: "grades",
    title: "成绩分析",
    description: "查看应用内作业、考试和六维能力表现。",
    icon: BarChart3,
    group: "学情与设置",
    capability: "viewAnalytics",
  },
  {
    key: "records",
    title: "学习记录",
    description: "查看有效学习时间、进度、预警和辅导记录。",
    icon: NotebookTabs,
    group: "学情与设置",
    capability: "viewAnalytics",
  },
  {
    key: "toolbox",
    title: "练习工具",
    description: "维护听说读写、语法和词汇练习。",
    icon: Wrench,
    group: "课程内容",
    capability: "manageContent",
  },
  {
    key: "practice-insights",
    title: "巩固学情",
    description: "查看负责学生的章节巩固进度、薄弱能力并发送练习推荐。",
    icon: Target,
    group: "学情与设置",
    capability: "viewAnalytics",
    appSlugs: ["korean"],
    tenantTeacherOnly: true,
  },
  {
    key: "practice-center",
    title: "巩固中心管理",
    description: "按真实课程树查看每章教材、练习、作业、测试与巩固内容覆盖状态。",
    icon: Target,
    group: "教学与考核",
    capability: "manageContent",
    appSlugs: ["korean"],
    platformOwnerOnly: true,
  },
  {
    key: "completion-review",
    title: "结课资格",
    description: "机构查看资格与证书统计，平台查看按政策版本区分的跨机构趋势。",
    icon: Stamp,
    group: "教学与考核",
    capability: "manageAssessments",
    appSlugs: ["korean"],
  },
  {
    key: "conversation",
    title: "会话与课堂",
    description: "管理会话练习场景和实时伴学课堂。",
    icon: MessageSquareText,
    group: "学情与设置",
    capability: "manageAssessments",
  },
  {
    key: "settings",
    title: "应用设置",
    description: "检查机构开放状态和当前账号权限。",
    icon: Settings2,
    group: "学情与设置",
    capability: "manageTenantAvailability",
  },
];

const serviceModules: WorkspaceModule[] = [
  {
    key: "students",
    title: "服务学生",
    description: "管理已开通留学服务的学生和负责员工。",
    icon: UsersRound,
    group: "服务与课程",
    capability: "manageStudents",
  },
  {
    key: "content",
    title: "留学课程",
    description: "维护选校、申请、签证与面试准备课程。",
    icon: BookOpenCheck,
    group: "服务与课程",
    capability: "manageContent",
  },
  {
    key: "universities",
    title: "目标大学",
    description: "维护大学资料、申请条件和学生目标。",
    icon: GraduationCap,
    group: "服务与课程",
    capability: "manageContent",
  },
  {
    key: "documents",
    title: "申请材料",
    description: "核对学生材料、退回补充并保留审核记录。",
    icon: FileCheck2,
    group: "申请与签证",
    capability: "manageAssessments",
  },
  {
    key: "visa",
    title: "签证管理",
    description: "跟进签证档案、办理任务和审核意见。",
    icon: ShieldCheck,
    group: "申请与签证",
    capability: "manageAssessments",
  },
  {
    key: "records",
    title: "服务记录",
    description: "查看服务进度、逾期事项和内部跟进记录。",
    icon: NotebookTabs,
    group: "数据与设置",
    capability: "viewAnalytics",
  },
  {
    key: "analytics",
    title: "服务分析",
    description: "查看学生阶段分布、材料完成率和风险。",
    icon: BarChart3,
    group: "数据与设置",
    capability: "viewAnalytics",
  },
  {
    key: "settings",
    title: "应用设置",
    description: "检查机构开放状态和当前账号权限。",
    icon: Settings2,
    group: "数据与设置",
    capability: "manageTenantAvailability",
  },
];

function countValue(result: CountResult) {
  return result.error ? 0 : Number(result.count ?? 0) || 0;
}

function statusLabel(access: ManagementAppAccess) {
  if (!access.availability.enabled || access.availability.status === "hidden") {
    return "机构未开放";
  }
  if (access.availability.status === "coming_soon") return "建设中";
  return "运行中";
}

export async function ManagementApplicationWorkspacePage({
  space,
  appSlug,
}: {
  space: string;
  appSlug: string;
}) {
  const access = await requireManagementAppAccess(space, appSlug);
  const client = await createClient();
  let studentsQuery = client
    .from("student_app_enrollments")
    .select("student_id", { count: "exact", head: true })
    .eq("app_id", access.appId)
    .eq("status", "active");
  let assignmentsQuery = access.app.kind === "service"
    ? client
        .from("student_university_targets")
        .select("id", { count: "exact", head: true })
    : client
        .from("learning_assignments")
        .select("id", { count: "exact", head: true })
        .eq("student_app_id", access.appId);
  let recordsQuery = access.app.kind === "service"
    ? client
        .from("student_application_documents")
        .select("id", { count: "exact", head: true })
    : client
        .from("learning_record_notes")
        .select("id", { count: "exact", head: true })
        .eq("student_app_id", access.appId)
        .eq("status", "active");

  if (access.tenantId) {
    studentsQuery = studentsQuery.eq("tenant_id", access.tenantId);
    assignmentsQuery = assignmentsQuery.eq("tenant_id", access.tenantId);
    recordsQuery = recordsQuery.eq("tenant_id", access.tenantId);
  }

  const [courseResult, studentResult, assignmentResult, recordResult] =
    (await Promise.all([
      client
        .from("courses")
        .select("id", { count: "exact", head: true })
        .eq("student_app_id", access.appId)
        .eq("content_scope", "platform"),
      studentsQuery,
      assignmentsQuery,
      recordsQuery,
    ])) as CountResult[];
  const modules = (
    access.app.kind === "service" ? serviceModules : learningModules
  ).filter(
    (module) =>
      (!module.appSlugs || module.appSlugs.includes(access.app.slug)) &&
      (!module.tenantTeacherOnly ||
        (access.scope === "tenant" && access.role === "teacher")) &&
      (!module.institutionExecutiveOnly ||
        (access.scope === "tenant" &&
          (access.role === "tenant_super_admin" || access.role === "ceo"))) &&
      (!module.platformOwnerOnly ||
        (access.scope === "platform" &&
          access.globalRole === "platform_owner")) &&
      (!module.platformOwnerOrTenant ||
        access.scope === "tenant" ||
        access.globalRole === "platform_owner"),
  );
  const moduleGroups = MODULE_GROUP_ORDER.map((group) => ({
    group,
    items: modules.filter((module) => module.group === group),
  })).filter((entry) => entry.items.length > 0);
  const metrics = [
    { label: access.app.kind === "service" ? "服务项目" : "课程内容", value: countValue(courseResult) },
    { label: "已授权学生", value: countValue(studentResult) },
    { label: access.app.kind === "service" ? "申请项目" : "教学任务", value: countValue(assignmentResult) },
    { label: access.app.kind === "service" ? "材料清单" : "有效记录", value: countValue(recordResult) },
  ];
  const hasMetricError = [
    courseResult,
    studentResult,
    assignmentResult,
    recordResult,
  ].some((result) => Boolean(result.error));

  return (
    <ManagementPage
      title={access.appTitle}
      description={access.app.description}
      className={`management-app-workspace management-app-tone-${access.app.accent}`}
      meta={
        <>
          <span>{statusLabel(access)}</span>
          <span>{access.scope === "platform" ? "平台标准空间" : access.tenantName}</span>
          <span>{access.accessRole === "platform" ? "平台权限" : access.accessRole}</span>
        </>
      }
      action={
        <Link
          href={getManagementAppsPath(access.dashboardBasePath)}
          className="management-secondary-button inline-flex items-center gap-1.5 border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          返回应用中心
          <RouteLinkStatus />
        </Link>
      }
    >
      {hasMetricError && (
        <ManagementNotice tone="warning">
          当前应用的部分概况数据读取失败；模块入口仍可使用，请稍后刷新重试。
        </ManagementNotice>
      )}
      <section className="grid overflow-hidden rounded-lg border bg-[var(--card)] sm:grid-cols-2 xl:grid-cols-4" aria-label="当前应用概况">
        {metrics.map((metric, index) => (
          <div key={metric.label} className={`min-h-24 px-5 py-4 ${index > 0 ? "border-t sm:border-l sm:border-t-0" : ""}`}>
            <p className="app-muted-text text-xs">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{metric.value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="application-operations-title" className="space-y-6">
        <h2 id="application-operations-title" className="text-sm font-semibold">运营模块</h2>
        {moduleGroups.map(({ group, items }) => (
          <div key={group} className={`management-app-tone-${MODULE_GROUP_TONE[group] ?? "sky"}`}>
            <p className="app-muted-text mb-2 text-xs font-semibold">{group}</p>
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {items.map((module) => {
                const Icon = module.icon;
                const enabled = !module.capability || access.capabilities[module.capability];
                const content = (
                  <>
                    <span className="management-module-icon flex size-7 items-center justify-center border">
                      <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <h3 className="mt-2.5 text-base font-semibold leading-tight">{module.title}</h3>
                    <span className="mt-auto flex items-center justify-between pt-2 text-[11px] font-medium">
                      <span className={enabled ? "text-[var(--primary-hover)]" : "app-muted-text"}>
                        {enabled ? "进入" : "无权限"}
                      </span>
                      {enabled && (
                        <span className="inline-flex items-center gap-1">
                          <RouteLinkStatus />
                          <ArrowRight size={12} aria-hidden="true" />
                        </span>
                      )}
                    </span>
                  </>
                );

                return enabled ? (
                  <Link
                    key={module.key}
                    href={`${access.appPath}/${module.key}`}
                    aria-label={`进入${module.title}模块`}
                    className="management-module-card flex min-h-20 flex-col border p-3 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={module.key} className="management-module-card flex min-h-20 flex-col border p-3 opacity-55" aria-disabled="true">
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </ManagementPage>
  );
}
