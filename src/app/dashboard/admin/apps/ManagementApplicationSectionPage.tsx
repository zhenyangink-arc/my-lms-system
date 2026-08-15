import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  MessageSquareText,
  NotebookTabs,
  Settings2,
  ShieldCheck,
  UsersRound,
  Wrench,
} from "lucide-react";

import { ConversationPracticeManagementContent } from "@/app/dashboard/admin/conversation-practice/page-content";
import { ManagementApplicationPeoplePage } from "@/app/dashboard/admin/apps/ManagementApplicationPeoplePage";
import { ManagementApplicationAssessmentPage } from "@/app/dashboard/admin/apps/ManagementApplicationAssessmentPage";
import { ManagementApplicationSettingsPage } from "@/app/dashboard/admin/apps/ManagementApplicationSettingsPage";
import { ManagementStudyAbroadInsightPage } from "@/app/dashboard/admin/apps/ManagementStudyAbroadInsightPage";
import CourseCatalogListing from "@/features/courses/components/course-catalog-listing";
import DocumentReviewListing from "@/features/document-reviews/components/document-review-listing";
import { GradeListingContent } from "@/features/grades/components/grade-listing";
import GrowthToolboxListing from "@/features/growth-toolbox/components/growth-toolbox-listing";
import { LearningRecordListingContent } from "@/features/learning-records/components/learning-record-listing";
import UniversityListing from "@/features/universities/components/university-listing";
import VisaManagementListing from "@/features/visa-management/components/visa-management-listing";
import {
  requireManagementAppAccess,
  type ManagementAppAccess,
} from "@/lib/management-apps";

type SectionSearchParams = Record<string, string | string[] | undefined>;

type SectionDefinition = {
  title: string;
  description: string;
  icon: typeof BookOpenCheck;
  capability: keyof ManagementAppAccess["capabilities"];
};

const learningSections: Record<string, SectionDefinition> = {
  students: {
    title: "学生与教学分配",
    description: "管理应用授权、负责老师与应用内教学关系。",
    icon: UsersRound,
    capability: "manageStudents",
  },
  content: {
    title: "课程与内容",
    description: "当前页面只读取本应用所属的分类、课程、课时和章节。",
    icon: BookOpenCheck,
    capability: "manageContent",
  },
  assessments: {
    title: "作业与考试",
    description: "按应用管理章节测试、老师作业和正式考试。",
    icon: ClipboardCheck,
    capability: "manageAssessments",
  },
  grades: {
    title: "成绩分析",
    description: "按应用汇总老师作业、正式考试和六维能力。",
    icon: BarChart3,
    capability: "viewAnalytics",
  },
  records: {
    title: "学习记录",
    description: "按应用查看有效学习时间、课程进度与辅导记录。",
    icon: NotebookTabs,
    capability: "viewAnalytics",
  },
  toolbox: {
    title: "练习工具",
    description: "当前页面只读取本应用的练习入口、课程词汇和语法库。",
    icon: Wrench,
    capability: "manageContent",
  },
  conversation: {
    title: "会话与课堂",
    description: "当前页面只读取本应用的会话场景及其学生练习记录。",
    icon: MessageSquareText,
    capability: "manageAssessments",
  },
  settings: {
    title: "应用设置",
    description: "管理机构开放状态和当前应用权限。",
    icon: Settings2,
    capability: "manageTenantAvailability",
  },
};

const serviceSections: Record<string, SectionDefinition> = {
  students: {
    title: "服务学生",
    description: "管理留学服务授权、负责员工和服务关系。",
    icon: UsersRound,
    capability: "manageStudents",
  },
  universities: {
    title: "目标大学",
    description: "维护大学资料、申请条件和学生目标。",
    icon: GraduationCap,
    capability: "manageContent",
  },
  documents: {
    title: "申请材料",
    description: "核对学生材料、退回补充并保留审核记录。",
    icon: FileCheck2,
    capability: "manageAssessments",
  },
  visa: {
    title: "签证管理",
    description: "跟进签证档案、办理任务和审核意见。",
    icon: ShieldCheck,
    capability: "manageAssessments",
  },
  records: {
    title: "服务记录",
    description: "查看服务进度、逾期事项和内部跟进记录。",
    icon: NotebookTabs,
    capability: "viewAnalytics",
  },
  analytics: {
    title: "服务分析",
    description: "查看学生阶段分布、材料完成率和服务风险。",
    icon: BarChart3,
    capability: "viewAnalytics",
  },
  settings: {
    title: "应用设置",
    description: "管理机构开放状态和当前应用权限。",
    icon: Settings2,
    capability: "manageTenantAvailability",
  },
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function PendingSection({
  appTitle,
  title,
}: {
  appTitle: string;
  title: string;
}) {
  return (
    <section className="app-card border px-5 py-10 text-center sm:px-8">
      <p className="text-sm font-semibold">{title}正在接入应用数据边界</p>
      <p className="app-muted-text mx-auto mt-2 max-w-xl text-xs leading-5">
        当前不会回退展示其他应用或旧版全局数据。完成数据库聚合和权限校验后，
        这里将只呈现“{appTitle}”范围内的数据。
      </p>
    </section>
  );
}

export async function ManagementApplicationSectionPage({
  space,
  appSlug,
  section,
  searchParams,
}: {
  space: string;
  appSlug: string;
  section: string;
  searchParams: Promise<SectionSearchParams>;
}) {
  const access = await requireManagementAppAccess(space, appSlug);
  const definitions =
    access.app.kind === "service" ? serviceSections : learningSections;
  const definition = definitions[section];
  if (!definition) notFound();
  if (!access.capabilities[definition.capability]) redirect(access.appPath);

  const params = await searchParams;
  const routeBasePath = `${access.appPath}/${section}`;
  const Icon = definition.icon;
  let content: React.ReactNode;

  if (section === "settings") {
    content = <ManagementApplicationSettingsPage access={access} />;
  } else if (section === "students") {
    content = <ManagementApplicationPeoplePage access={access} />;
  } else if (
    access.app.kind === "learning" &&
    section === "assessments"
  ) {
    content = <ManagementApplicationAssessmentPage access={access} />;
  } else if (access.app.kind === "learning" && section === "content") {
    content = (
      <CourseCatalogListing
        searchParams={Promise.resolve({
          node: firstParam(params.node),
          id: firstParam(params.id),
        })}
        studentAppId={access.appId}
        routeBasePath={routeBasePath}
      />
    );
  } else if (access.app.kind === "learning" && section === "toolbox") {
    content = <GrowthToolboxListing studentAppId={access.appId} />;
  } else if (access.app.kind === "learning" && section === "conversation") {
    content = (
      <ConversationPracticeManagementContent
        searchParams={Promise.resolve({
          scenario: firstParam(params.scenario),
          mode: firstParam(params.mode),
        })}
        studentAppId={access.appId}
        routeBasePath={routeBasePath}
      />
    );
  } else if (
    access.scope === "tenant" &&
    access.app.kind === "learning" &&
    section === "grades"
  ) {
    content = <GradeListingContent studentAppId={access.appId} />;
  } else if (
    access.scope === "tenant" &&
    access.app.kind === "learning" &&
    section === "records"
  ) {
    content = <LearningRecordListingContent studentAppId={access.appId} />;
  } else if (access.app.slug === "study-abroad" && section === "universities") {
    content = <UniversityListing />;
  } else if (access.app.slug === "study-abroad" && section === "documents") {
    content = <DocumentReviewListing />;
  } else if (access.app.slug === "study-abroad" && section === "visa") {
    const requestedStatus = firstParam(params.status) ?? "all";
    const validStatus = new Set(["all", "action", "preparing", "submitted", "issued"]);
    content = (
      <VisaManagementListing
        initialQuery={(firstParam(params.q) ?? "").trim().slice(0, 80)}
        initialStatus={
          (validStatus.has(requestedStatus) ? requestedStatus : "all") as
            | "all"
            | "action"
            | "preparing"
            | "submitted"
            | "issued"
        }
        deleted={firstParam(params.deleted) === "1"}
      />
    );
  } else if (access.app.slug === "study-abroad" && section === "records") {
    content = <ManagementStudyAbroadInsightPage mode="records" />;
  } else if (access.app.slug === "study-abroad" && section === "analytics") {
    content = <ManagementStudyAbroadInsightPage mode="analytics" />;
  } else {
    content = <PendingSection appTitle={access.appTitle} title={definition.title} />;
  }

  return (
    <div className={`management-page management-app-tone-${access.app.accent} space-y-5`}>
      <header className="app-card border px-5 py-4 sm:px-6">
        <Link
          href={access.appPath}
          className="app-muted-text inline-flex min-h-8 items-center gap-1.5 text-xs font-medium hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          返回{access.appTitle}
        </Link>
        <div className="mt-3 flex items-start gap-3">
          <span className="management-app-icon flex size-10 shrink-0 items-center justify-center rounded-md border">
            <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <p className="management-kicker text-[10px] font-semibold uppercase">
              {access.appTitle}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.025em]">
              {definition.title}
            </h1>
            <p className="app-muted-text mt-1 text-xs leading-5">
              {definition.description}
            </p>
          </div>
        </div>
      </header>
      {content}
    </div>
  );
}
