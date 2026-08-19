export const ASSIGNMENT_TYPES = ["homework", "quiz", "exam"] as const;
export const ASSIGNMENT_STATUSES = ["draft", "published", "closed"] as const;
export const QUESTION_TYPES = [
  "short_text",
  "long_text",
  "single_choice",
  "file_link",
  "audio_recording",
] as const;
export const SUBMISSION_STATUSES = [
  "submitted",
  "graded",
  "revision_required",
] as const;
export const SUBMISSION_WORKFLOW_STATES = [
  "submitted_pending_grading",
  "objective_graded_pending_manual",
  "grading_completed",
  "grade_released",
  "revision_required",
] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export type SubmissionWorkflowState =
  (typeof SUBMISSION_WORKFLOW_STATES)[number];

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  homework: "课后作业",
  quiz: "课程测试",
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
  audio_recording: "录音题",
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: "待批改",
  graded: "已批改",
  revision_required: "退回重做",
};

export const SUBMISSION_WORKFLOW_STATE_LABELS: Record<
  SubmissionWorkflowState,
  string
> = {
  submitted_pending_grading: "已提交，等待判分",
  objective_graded_pending_manual: "客观题已判分，等待人工批改",
  grading_completed: "已完成批改，等待发布",
  grade_released: "成绩已发布",
  revision_required: "退回重做",
};

export const ASSIGNMENT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};
