import {
  renderAssessmentAuthoring,
  type SubjectAdminSlotMap,
  type SubjectAssessmentAuthoringProps,
} from "./admin-slot-contract.ts";

export type {
  SubjectAdminSlotMap,
  SubjectAdminSlots,
  SubjectAssessmentAuthoringProps,
} from "./admin-slot-contract.ts";

/**
 * 学科管理端插槽注册表。平台页面只通过这里取学科界面，不引用学科内部文件。
 * 目前没有学科注册；数学的出题界面在 T2 注册。
 */
const SUBJECT_ADMIN_SLOTS: SubjectAdminSlotMap = {};

/** 学科的“制作标准试卷”界面；没有注册时返回 null，由平台页面使用原有界面。 */
export function renderSubjectAssessmentAuthoring(
  slug: string,
  props: SubjectAssessmentAuthoringProps,
) {
  return renderAssessmentAuthoring(SUBJECT_ADMIN_SLOTS, slug, props);
}
