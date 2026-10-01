import type { SupabaseClient } from "@supabase/supabase-js";
import { createElement, type ComponentType, type ReactElement } from "react";

import type { ManagementAppAccess } from "@/lib/management-apps";

import type { SubjectSlug } from "./contracts.ts";

/**
 * 学科管理端插槽：学科用自己的界面替换平台页面里的某一块。
 * 没有注册插槽的学科（韩语、英语）沿用平台原有界面。
 * 清单（contracts.ts）仍是纯数据，组件只放在插槽注册表里。
 */
export type SubjectAssessmentAuthoringProps = {
  appId: string;
  appSlug: SubjectSlug;
  /** 当前账号是否可以发布标准试卷（只有平台负责人）；发布权限仍由数据库最终校验。 */
  canRelease: boolean;
};

/** 学科给教师批改页面提供的机器判题建议（只是建议，正式得分仍由教师确认）。 */
export type MachineSuggestion = {
  verdict: "correct" | "incorrect" | "error";
  /** 建议得分；无法判定时为 null */
  suggestedPoints: number | null;
  /** 面向老师的中文说明 */
  message: string;
};

export type SubjectMachineGradingInput = {
  /** 当前教职人员的数据库连接（受 RLS 约束）。 */
  supabase: SupabaseClient;
  /** 已通过页面权限校验、仍在待批改阶段的提交。 */
  pendingSubmissionIds: string[];
  /** 页面要显示建议的作答。 */
  answerIds: string[];
};

export type SubjectSubmissionReviewActionsProps = {
  /** 当前作业；学科动作自己再校验权限与归属。 */
  assignmentId: string;
};

/** 学科在管理端分区页面底部追加的区块（如大学课程的“学生所属专业”）。 */
export type SubjectSectionExtraKey = "students" | "content";
export type SubjectSectionExtrasProps = {
  /** 页面已通过分区权限校验的访问上下文；区块自己再按能力决定是否显示。 */
  access: ManagementAppAccess;
};

export type SubjectAdminSlots = {
  /** 学科在“学生”“课程结构”分区页面底部追加的区块。 */
  SectionExtras?: Partial<Record<SubjectSectionExtraKey, ComponentType<SubjectSectionExtrasProps>>>;
  /** 平台视图“作业与考试”里的“制作标准试卷”区域。 */
  AssessmentAuthoring?: ComponentType<SubjectAssessmentAuthoringProps>;
  /** 教师批改页面里提交列表上方的学科操作（如“重新判题”）。 */
  SubmissionReviewActions?: ComponentType<SubjectSubmissionReviewActionsProps>;
  /** 教师批改页面：补上机器判题并返回每道作答的最新建议（键为作答 ID）。 */
  prepareMachineGrades?: (input: SubjectMachineGradingInput) => Promise<Map<string, MachineSuggestion>>;
};

export type SubjectAdminSlotMap = Readonly<
  Partial<Record<SubjectSlug, SubjectAdminSlots>>
>;

/** 纯函数：按 slug 取插槽；没有注册或 slug 不是学科时返回 null。 */
export function resolveAssessmentAuthoring(
  slots: SubjectAdminSlotMap,
  slug: string,
): ComponentType<SubjectAssessmentAuthoringProps> | null {
  if (!Object.prototype.hasOwnProperty.call(slots, slug)) return null;
  return slots[slug as SubjectSlug]?.AssessmentAuthoring ?? null;
}

/** 取插槽并创建元素；没有注册时返回 null。页面只持有元素，不在渲染中创建组件类型。 */
export function renderAssessmentAuthoring(
  slots: SubjectAdminSlotMap,
  slug: string,
  props: SubjectAssessmentAuthoringProps,
): ReactElement | null {
  const Component = resolveAssessmentAuthoring(slots, slug);
  return Component ? createElement(Component, props) : null;
}

/** 取学科的机器判题；没有注册时返回空结果，页面照常人工批改。 */
export async function prepareMachineGradesFor(
  slots: SubjectAdminSlotMap,
  slug: string,
  input: SubjectMachineGradingInput,
): Promise<Map<string, MachineSuggestion>> {
  if (!Object.prototype.hasOwnProperty.call(slots, slug)) return new Map();
  const prepare = slots[slug as SubjectSlug]?.prepareMachineGrades;
  return prepare ? prepare(input) : new Map();
}

/** 取学科的批改页操作并创建元素；没有注册时返回 null。 */
export function renderSubmissionReviewActions(
  slots: SubjectAdminSlotMap,
  slug: string,
  props: SubjectSubmissionReviewActionsProps,
): ReactElement | null {
  if (!Object.prototype.hasOwnProperty.call(slots, slug)) return null;
  const Component = slots[slug as SubjectSlug]?.SubmissionReviewActions;
  return Component ? createElement(Component, props) : null;
}

/** 取学科在某个分区追加的区块并创建元素；没有注册时返回 null。 */
export function renderSectionExtras(
  slots: SubjectAdminSlotMap,
  slug: string,
  section: SubjectSectionExtraKey,
  props: SubjectSectionExtrasProps,
): ReactElement | null {
  if (!Object.prototype.hasOwnProperty.call(slots, slug)) return null;
  const extras = slots[slug as SubjectSlug]?.SectionExtras;
  if (!extras || !Object.prototype.hasOwnProperty.call(extras, section)) return null;
  const Component = extras[section];
  return Component ? createElement(Component, props) : null;
}
