import { createElement, type ComponentType, type ReactElement } from "react";

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

export type SubjectAdminSlots = {
  /** 平台视图“作业与考试”里的“制作标准试卷”区域。 */
  AssessmentAuthoring?: ComponentType<SubjectAssessmentAuthoringProps>;
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
