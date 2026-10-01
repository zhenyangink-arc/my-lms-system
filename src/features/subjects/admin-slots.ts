import {
  prepareMachineGradesFor,
  renderAssessmentAuthoring,
  renderSectionExtras,
  renderSubmissionReviewActions,
  type SubjectAdminSlotMap,
  type SubjectAssessmentAuthoringProps,
  type SubjectMachineGradingInput,
  type SubjectSectionExtraKey,
  type SubjectSectionExtrasProps,
  type SubjectSubmissionReviewActionsProps,
} from "./admin-slot-contract.ts";

import { mathAdminSlots } from "./math/admin-slot.tsx";
import { universityAdminSlots } from "./university/admin-slot.tsx";

export type {
  SubjectAdminSlotMap,
  SubjectAdminSlots,
  SubjectAssessmentAuthoringProps,
} from "./admin-slot-contract.ts";

/**
 * 学科管理端插槽注册表。平台页面只通过这里取学科界面，不引用学科内部文件。
 * 数学注册了“制作标准试卷”界面，大学课程注册了“学生所属专业”“专业可见范围”区块；韩语、英语没有注册，沿用平台原有界面。
 * 注意：这个文件会引入服务端代码，只能由服务端页面从 `@/features/subjects/admin-slots`
 * 直接引用，不能从 `@/features/subjects` 入口导出（入口会被客户端组件引用）。
 */
const SUBJECT_ADMIN_SLOTS: SubjectAdminSlotMap = { math: mathAdminSlots, university: universityAdminSlots };

/** 学科的“制作标准试卷”界面；没有注册时返回 null，由平台页面使用原有界面。 */
export function renderSubjectAssessmentAuthoring(
  slug: string,
  props: SubjectAssessmentAuthoringProps,
) {
  return renderAssessmentAuthoring(SUBJECT_ADMIN_SLOTS, slug, props);
}

/** 教师批改页：学科的机器判题建议（按作答 ID）；没有注册的学科返回空。 */
export function prepareSubjectMachineGrades(slug: string, input: SubjectMachineGradingInput) {
  return prepareMachineGradesFor(SUBJECT_ADMIN_SLOTS, slug, input);
}

/** 教师批改页：学科的批改操作（如数学的“重新判题”）；没有注册的学科返回 null。 */
export function renderSubjectReviewActions(slug: string, props: SubjectSubmissionReviewActionsProps) {
  return renderSubmissionReviewActions(SUBJECT_ADMIN_SLOTS, slug, props);
}

/** 学科在“学生”“课程结构”分区底部追加的区块；没有注册的学科返回 null。 */
export function renderSubjectSectionExtras(
  slug: string,
  section: SubjectSectionExtraKey,
  props: SubjectSectionExtrasProps,
) {
  return renderSectionExtras(SUBJECT_ADMIN_SLOTS, slug, section, props);
}
