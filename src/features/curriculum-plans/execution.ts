import type { HomeLearningTaskStatus } from "../student-home-learning/api/types";

export type CurriculumExecutionEvidence = {
  plan_id: string;
  item_id: string;
  student_id: string;
  completed: boolean;
  started: boolean;
  pending_grading: boolean;
  available: boolean;
  tracked: boolean;
  progress_percent: number | null;
  assignment_id: string | null;
  starts_at: string | null;
  due_at: string | null;
};

export function executionKey(planId: string, itemId: string, studentId: string) {
  return `${planId}:${itemId}:${studentId}`;
}

/** Completion evidence takes precedence over the calendar, including late work. */
export function resolveCurriculumExecution(
  evidence: CurriculumExecutionEvidence | undefined,
  schedule: { startsAt: Date; endsAt: Date },
  required: boolean,
  now: Date,
): { status: HomeLearningTaskStatus; progressPercent: number | null; reason: string } {
  if (!evidence) return { status: "unavailable", progressPercent: null, reason: "学习结果暂时无法核实，请刷新后重试。" };
  if (!evidence.tracked) return { status: "unavailable", progressPercent: null, reason: "此安排尚未绑定可核实的学习内容，请联系老师完善计划。" };
  if (evidence.completed) return { status: "completed", progressPercent: 100, reason: "已按真实学习记录完成。" };
  if (evidence.pending_grading) return { status: "pending_grading", progressPercent: null, reason: "已提交，等待批改或成绩公开。" };
  if (!evidence.available) return { status: "unavailable", progressPercent: null, reason: "内容尚不可用或考试尚未布置给你，请联系老师。" };
  const startsAt = evidence.starts_at ? new Date(evidence.starts_at) : schedule.startsAt;
  const endsAt = evidence.due_at ? new Date(evidence.due_at) : schedule.endsAt;
  const status = required && now > endsAt ? "overdue"
    : evidence.started ? "in_progress"
    : now < startsAt ? "not_started" : "available";
  return {
    status,
    progressPercent: evidence.progress_percent,
    reason: status === "overdue" ? "已超过计划时间，尚无完成记录。"
      : status === "in_progress" ? "已开始，尚未达到完成要求。"
      : status === "not_started" ? "尚未到计划开始时间。" : "可以开始学习。",
  };
}

export const EXECUTION_LABELS: Record<HomeLearningTaskStatus, string> = {
  not_started: "未到时间", available: "未开始", in_progress: "学习中",
  submitted: "已提交", pending_grading: "待批改／公开", completed: "已完成",
  overdue: "逾期未完成", locked: "尚未开放", unavailable: "待完善／布置",
};
