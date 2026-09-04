import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  compareDefaultPriority,
  type DefaultPriorityRule,
} from "../priority.ts";
import { getGradeFeedbackPath } from "../routes.ts";
import { loadCoursePracticeCatalog } from "@/lib/course-practice-catalog.server";
import { loadAssignmentExamTasks } from "./assignment-exam-source.ts";
import { loadChapterPracticeTasks } from "./chapter-practice-source.ts";
import { loadCourseContinuationTasks } from "./course-source.ts";
import { dedupeHomeLearningTasks } from "./dedupe.ts";
import { loadReviewTasks } from "./review-source.ts";
import {
  isOverdueCompletable,
  isSamePortalDay,
  isTomorrowInPortal,
  selectRequiredTodayTasks,
} from "./required-today.ts";
import { loadSpecializedPracticeTasks } from "./specialized-practice-source.ts";
import { filterSnoozedHomeLearningTasks } from "./task-preferences.ts";
import type { HomeLearningTask } from "./types.ts";

const DAY_MS = 86_400_000;
const DEADLINE_REMINDER_STATUSES = new Set<HomeLearningTask["status"]>([
  "not_started",
  "available",
  "in_progress",
  "locked",
]);
const TEACHER_SOURCE_TYPES = new Set<HomeLearningTask["sourceType"]>([
  "assignment",
  "exam",
  "teacher_recommendation",
]);

export type LoadHomeLearningTasksInput = {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  studentAppId: string;
  appSlug: string;
  appLabel: string;
  space: string;
  now?: Date;
};

export type PortalLearningFeedback = {
  id: string;
  assignmentId: string;
  title: string;
  feedback: string;
  publishedAt: string;
  appLabel: string;
  href: string;
};

export type PortalHomeLearningSummary = {
  mostImportant: HomeLearningTask | null;
  requiredTodayCount: number;
  nearestDeadline: HomeLearningTask | null;
  latestFeedback: PortalLearningFeedback | null;
};

type PublishedFeedbackRow = {
  id: string;
  assignment_id: string;
  overall_feedback: string | null;
  grade_released_at: string | null;
  graded_at: string | null;
  assignment:
    | { title: string; student_app_id: string }
    | Array<{ title: string; student_app_id: string }>
    | null;
};

function timestamp(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function updatedTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function priorityRuleForTask(
  task: HomeLearningTask,
  now: Date,
): DefaultPriorityRule {
  if (isOverdueCompletable(task)) return "overdue_required_completable";

  const nowTime = now.getTime();
  const startTime = timestamp(task.startsAt);
  const dueTime = timestamp(task.dueAt);
  if (dueTime >= nowTime && isSamePortalDay(task.dueAt, now)) {
    return "due_today";
  }
  if (
    task.sourceType === "exam" &&
    ((startTime >= nowTime && startTime <= nowTime + DAY_MS) ||
      (dueTime >= nowTime && dueTime <= nowTime + DAY_MS))
  ) {
    return "exam_within_24_hours";
  }
  if (task.sourceType === "teacher_recommendation" && task.required) {
    return "teacher_required_recommendation";
  }
  if (isTomorrowInPortal(task.dueAt, now)) return "due_tomorrow";
  if (
    task.status === "in_progress" &&
    (task.sourceType === "course" || task.sourceType === "chapter_practice")
  ) {
    return "in_progress_course_or_chapter_practice";
  }
  if (dueTime >= nowTime && dueTime <= nowTime + 7 * DAY_MS) {
    return "due_this_week";
  }
  if (task.sourceType === "review") return "review";
  if (task.sourceType === "specialized_practice") {
    return "weak_skill_specialized_practice";
  }
  return "continue_learning";
}

/** 按路线图 10.1/10.2 的确定性规则排序，不在门户层重新解释优先级。 */
export function sortHomeLearningTasks(
  tasks: HomeLearningTask[],
  now = new Date(),
): HomeLearningTask[] {
  return [...tasks].sort((left, right) => {
    const ruleDifference = compareDefaultPriority(
      priorityRuleForTask(left, now),
      priorityRuleForTask(right, now),
    );
    if (ruleDifference !== 0) return ruleDifference;

    const leftDueTime = timestamp(left.dueAt);
    const rightDueTime = timestamp(right.dueAt);
    if (leftDueTime !== rightDueTime) return leftDueTime - rightDueTime;
    if (left.required !== right.required) return left.required ? -1 : 1;
    if (left.status !== right.status) {
      if (left.status === "in_progress") return -1;
      if (right.status === "in_progress") return 1;
    }
    const leftIsTeacherTask = TEACHER_SOURCE_TYPES.has(left.sourceType);
    const rightIsTeacherTask = TEACHER_SOURCE_TYPES.has(right.sourceType);
    if (leftIsTeacherTask !== rightIsTeacherTask) {
      return leftIsTeacherTask ? -1 : 1;
    }
    const updatedDifference =
      updatedTimestamp(right.updatedAt) - updatedTimestamp(left.updatedAt);
    return updatedDifference || left.taskKey.localeCompare(right.taskKey);
  });
}

/** 并行读取五类既有来源，随后统一去重、排序。 */
export async function loadHomeLearningTasks({
  supabase,
  tenantId,
  studentId,
  studentAppId,
  appSlug,
  appLabel,
  space,
  now = new Date(),
}: LoadHomeLearningTasksInput): Promise<HomeLearningTask[]> {
  const commonInput = {
    supabase,
    studentId,
    studentAppId,
    appSlug,
    appLabel,
    space,
    now,
  };
  // 课程巩固目录本身要串行查好几轮（课程→课时→章节→…），
  // chapterPractice/specializedPractice/review 三个来源都要用它——
  // 这里只发起一次，其余三个来源共享同一个 promise，避免各自重复查一遍。
  const catalogPromise = loadCoursePracticeCatalog({ supabase, userId: studentId, now });
  const taskGroups = await Promise.all([
    loadAssignmentExamTasks({ ...commonInput, tenantId }),
    loadCourseContinuationTasks(commonInput),
    loadChapterPracticeTasks({ ...commonInput, catalog: catalogPromise }),
    loadSpecializedPracticeTasks({ ...commonInput, catalog: catalogPromise }),
    loadReviewTasks({ ...commonInput, catalog: catalogPromise }),
  ]);

  const sortedTasks = sortHomeLearningTasks(
    dedupeHomeLearningTasks(taskGroups.flat()),
    now,
  );
  const { data: preferenceRows, error: preferenceError } = await supabase
    .from("student_learning_task_preferences")
    .select("task_key,snoozed_until,dismissed_for_week")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("student_app_id", studentAppId);
  if (preferenceError) {
    throw new Error("首页建议暂缓状态读取失败", { cause: preferenceError });
  }

  return filterSnoozedHomeLearningTasks(
    sortedTasks,
    (preferenceRows ?? []).map((preference) => ({
      taskKey: String(preference.task_key),
      snoozedUntil: preference.snoozed_until
        ? String(preference.snoozed_until)
        : null,
      dismissedForWeek: preference.dismissed_for_week
        ? String(preference.dismissed_for_week)
        : null,
    })),
    now,
  );
}

export async function loadLatestPublishedFeedback({
  supabase,
  tenantId,
  studentId,
  studentAppId,
  appLabel,
  space,
}: LoadHomeLearningTasksInput): Promise<PortalLearningFeedback | null> {
  const { data, error } = await supabase
    .from("learning_submissions")
    .select(
      "id,assignment_id,overall_feedback,grade_released_at,graded_at,assignment:learning_assignments!learning_submissions_assignment_id_fkey!inner(title,student_app_id)",
    )
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("submission_state", "grade_released")
    .eq("assignment.student_app_id", studentAppId)
    .not("overall_feedback", "is", null)
    .not("grade_released_at", "is", null)
    .order("grade_released_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("首页最新已发布反馈读取失败", { cause: error });
  }
  if (!data) return null;

  const row = data as unknown as PublishedFeedbackRow;
  const assignment = Array.isArray(row.assignment)
    ? row.assignment[0]
    : row.assignment;
  const feedback = row.overall_feedback?.trim();
  const publishedAt = row.grade_released_at ?? row.graded_at;
  if (!assignment || !feedback || !publishedAt) return null;

  return {
    id: row.id,
    assignmentId: row.assignment_id,
    title: assignment.title,
    feedback,
    publishedAt,
    appLabel,
    href: getGradeFeedbackPath(space, row.assignment_id),
  };
}

export { selectRequiredTodayTasks };

/** 路线图 10.3：仅输出门户需要的四项摘要，不暴露完整任务数组。 */
export function selectPortalHomeLearningSummary(
  tasks: HomeLearningTask[],
  latestFeedback: PortalLearningFeedback | null,
  now = new Date(),
): PortalHomeLearningSummary {
  const sortedTasks = sortHomeLearningTasks(tasks, now);
  const nowTime = now.getTime();
  const nearestDeadline = sortedTasks
    .filter(
      (task) =>
        task.dueAt !== null &&
        DEADLINE_REMINDER_STATUSES.has(task.status) &&
        timestamp(task.dueAt) >= nowTime,
    )
    .sort((left, right) => timestamp(left.dueAt) - timestamp(right.dueAt))[0];

  return {
    mostImportant: sortedTasks[0] ?? null,
    requiredTodayCount: selectRequiredTodayTasks(sortedTasks, now).length,
    nearestDeadline: nearestDeadline ?? null,
    latestFeedback,
  };
}

export async function loadPortalHomeLearningSummary(
  input: LoadHomeLearningTasksInput,
): Promise<PortalHomeLearningSummary> {
  const now = input.now ?? new Date();
  const [tasks, latestFeedback] = await Promise.all([
    loadHomeLearningTasks({ ...input, now }),
    loadLatestPublishedFeedback({ ...input, now }),
  ]);
  return selectPortalHomeLearningSummary(tasks, latestFeedback, now);
}
