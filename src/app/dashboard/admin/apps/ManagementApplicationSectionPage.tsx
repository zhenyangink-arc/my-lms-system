import type { ReactNode } from "react";
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
  PanelsTopLeft,
  Settings2,
  ShieldCheck,
  UsersRound,
  Wrench,
} from "lucide-react";

import { ManagementPage } from "@/components/layout/management-page";
import { RouteLinkStatus } from "@/app/dashboard/RouteLinkStatus";
import {
  requireManagementAppAccess,
  type ManagementAppAccess,
} from "@/lib/management-apps";

export type SectionSearchParams = Record<
  string,
  string | string[] | undefined
>;

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
    description: "管理分类、课程、课时和章节。",
    icon: BookOpenCheck,
    capability: "manageContent",
  },
  assessments: {
    title: "作业与考试",
    description: "按应用管理章节测试、老师作业和正式考试。",
    icon: ClipboardCheck,
    capability: "manageAssessments",
  },
  textbooks: {
    title: "互动教材",
    description: "管理教材、版本、章节、词汇和语法。",
    icon: PanelsTopLeft,
    capability: "manageContent",
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
    description: "管理练习入口、课程词汇和语法库。",
    icon: Wrench,
    capability: "manageContent",
  },
  conversation: {
    title: "会话与课堂",
    description: "管理会话场景和学生练习记录。",
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
  content: {
    title: "留学课程",
    description: "管理留学服务课程、课时和发布状态。",
    icon: BookOpenCheck,
    capability: "manageContent",
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

export function firstSectionParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function requireManagementApplicationSection(
  space: string,
  appSlug: string,
  section: string,
) {
  const access = await requireManagementAppAccess(space, appSlug);
  const definitions =
    access.app.kind === "service" ? serviceSections : learningSections;
  const definition = definitions[section];

  if (!definition) notFound();
  if (!access.capabilities[definition.capability]) redirect(access.appPath);

  return { access, definition, section };
}

export function ManagementApplicationSectionFrame({
  access,
  definition,
  children,
}: {
  access: ManagementAppAccess;
  definition: SectionDefinition;
  children: ReactNode;
}) {
  const Icon = definition.icon;

  return (
    <ManagementPage
      eyebrow={access.appTitle}
      title={definition.title}
      description={definition.description}
      icon={Icon}
      className={`management-app-tone-${access.app.accent}`}
      meta={
        <span>
          {access.scope === "platform" ? "平台标准空间" : access.tenantName}
        </span>
      }
      action={
        <Link
          href={access.appPath}
          className="management-secondary-button inline-flex items-center gap-1.5 border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          返回{access.appTitle}
          <RouteLinkStatus />
        </Link>
      }
    >
      {children}
    </ManagementPage>
  );
}
