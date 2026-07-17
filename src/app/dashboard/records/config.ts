export const LEARNING_RECORD_TYPES = ["coaching", "evaluation", "milestone", "attention", "plan"] as const;
export const LEARNING_RECORD_VISIBILITIES = ["student_visible", "internal"] as const;
export type LearningRecordType = (typeof LEARNING_RECORD_TYPES)[number];
export type LearningRecordVisibility = (typeof LEARNING_RECORD_VISIBILITIES)[number];
export const LEARNING_RECORD_TYPE_LABELS: Record<LearningRecordType,string> = { coaching: "辅导记录", evaluation: "阶段评价", milestone: "成长里程碑", attention: "关注事项", plan: "学习计划" };
export const LEARNING_RECORD_VISIBILITY_LABELS: Record<LearningRecordVisibility,string> = { student_visible: "学生可见", internal: "仅后台可见" };
export const learningRecordDateFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
