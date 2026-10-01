import {
  renderAssessmentAuthoring,
  type SubjectAdminSlotMap,
  type SubjectAssessmentAuthoringProps,
} from "./admin-slot-contract.ts";

import { mathAdminSlots } from "./math/admin-slot.tsx";

export type {
  SubjectAdminSlotMap,
  SubjectAdminSlots,
  SubjectAssessmentAuthoringProps,
} from "./admin-slot-contract.ts";

/**
 * 学科管理端插槽注册表。平台页面只通过这里取学科界面，不引用学科内部文件。
 * 数学注册了“制作标准试卷”界面；韩语、英语没有注册，沿用平台原有界面。
 * 注意：这个文件会引入服务端代码，只能由服务端页面从 `@/features/subjects/admin-slots`
 * 直接引用，不能从 `@/features/subjects` 入口导出（入口会被客户端组件引用）。
 */
const SUBJECT_ADMIN_SLOTS: SubjectAdminSlotMap = { math: mathAdminSlots };

/** 学科的“制作标准试卷”界面；没有注册时返回 null，由平台页面使用原有界面。 */
export function renderSubjectAssessmentAuthoring(
  slug: string,
  props: SubjectAssessmentAuthoringProps,
) {
  return renderAssessmentAuthoring(SUBJECT_ADMIN_SLOTS, slug, props);
}
