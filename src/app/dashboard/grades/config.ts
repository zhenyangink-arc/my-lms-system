export const GRADE_ITEM_TYPES = ["homework", "quiz", "exam", "course", "final", "other"] as const;
export const GRADE_ITEM_STATUSES = ["draft", "published", "archived"] as const;
export const GRADE_RECORD_STATUSES = ["graded", "absent", "exempt"] as const;
export const GRADE_REVIEW_STATUSES = ["pending", "reviewing", "resolved", "rejected"] as const;
export type GradeItemType = (typeof GRADE_ITEM_TYPES)[number];
export type GradeItemStatus = (typeof GRADE_ITEM_STATUSES)[number];
export type GradeRecordStatus = (typeof GRADE_RECORD_STATUSES)[number];
export type GradeReviewStatus = (typeof GRADE_REVIEW_STATUSES)[number];
export const GRADE_ITEM_TYPE_LABELS: Record<GradeItemType, string> = { homework: "作业", quiz: "测验", exam: "考试", course: "课程成绩", final: "综合成绩", other: "其他成绩" };
export const GRADE_ITEM_STATUS_LABELS: Record<GradeItemStatus, string> = { draft: "草稿", published: "已发布", archived: "已归档" };
export const GRADE_RECORD_STATUS_LABELS: Record<GradeRecordStatus, string> = { graded: "已评分", absent: "缺考", exempt: "免考" };
export const GRADE_REVIEW_STATUS_LABELS: Record<GradeReviewStatus, string> = { pending: "待处理", reviewing: "复核中", resolved: "已完成", rejected: "未调整" };
export function gradeLevel(percent: number) { if (percent >= 90) return "优秀"; if (percent >= 80) return "良好"; if (percent >= 70) return "中等"; if (percent >= 60) return "及格"; return "需加强"; }
export const gradeDateFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
