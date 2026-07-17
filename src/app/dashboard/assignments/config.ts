export const ASSIGNMENT_TYPES = ["homework", "quiz", "exam"] as const;
export const ASSIGNMENT_STATUSES = ["draft", "published", "closed"] as const;
export const QUESTION_TYPES = ["short_text", "long_text", "single_choice", "file_link"] as const;
export const SUBMISSION_STATUSES = ["submitted", "graded", "revision_required"] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  homework: "课后作业",
  quiz: "章节测验",
  exam: "正式考试",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  draft: "草稿",
  published: "已发布",
  closed: "已关闭",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_text: "简答题",
  long_text: "长文题",
  single_choice: "单选题",
  file_link: "附件链接",
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: "待批改",
  graded: "已批改",
  revision_required: "退回重做",
};

export const assignmentDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatAssignmentDate(value: string | null) {
  if (!value) return "时间待定";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间待确认" : assignmentDateFormatter.format(date);
}
