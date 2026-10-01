import type { SubjectAdminSlots } from "../admin-slot-contract.ts";
import { CategoryAccessPanel } from "./admin/CategoryAccessPanel";
import { MajorEnrollmentPanel } from "./admin/MajorEnrollmentPanel";

/** 大学课程的管理端插槽：学生分区追加“学生所属专业”，课程结构分区追加“专业可见范围”。 */
export const universityAdminSlots: SubjectAdminSlots = {
  SectionExtras: {
    students: MajorEnrollmentPanel,
    content: CategoryAccessPanel,
  },
};
