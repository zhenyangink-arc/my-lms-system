import {
  DEFAULT_VIEWER_TIME_ZONE,
  dateKeyInTimeZone,
} from "../../../lib/viewer-time-zone.ts";

import type { HomeLearningTask } from "./types.ts";

const DAY_MS = 86_400_000;
const ACTIONABLE_REQUIRED_STATUSES = new Set<HomeLearningTask["status"]>([
  "not_started",
  "available",
  "in_progress",
  "overdue",
  "locked",
]);

/** 时间点在用户时区下的日期键；没有传时区时是首尔（与改动前一致）。 */
export function localDateKey(value: Date, timeZone: string = DEFAULT_VIEWER_TIME_ZONE): string {
  return dateKeyInTimeZone(value, timeZone);
}

export function isSamePortalDay(
  value: string | null,
  now: Date,
  timeZone: string = DEFAULT_VIEWER_TIME_ZONE,
): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && localDateKey(parsed, timeZone) === localDateKey(now, timeZone);
}

export function isTomorrowInPortal(
  value: string | null,
  now: Date,
  timeZone: string = DEFAULT_VIEWER_TIME_ZONE,
): boolean {
  if (!value) return false;
  const tomorrow = new Date(now.getTime() + DAY_MS);
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && localDateKey(parsed, timeZone) === localDateKey(tomorrow, timeZone);
}

export function isOverdueCompletable(task: HomeLearningTask): boolean {
  return task.required && task.status === "overdue" && task.priority === "critical";
}

function isRequiredToday(task: HomeLearningTask, now: Date, timeZone: string): boolean {
  if (!task.required || !ACTIONABLE_REQUIRED_STATUSES.has(task.status)) return false;
  if (task.status === "overdue") return isOverdueCompletable(task);
  return isSamePortalDay(task.dueAt, now, timeZone) || isSamePortalDay(task.startsAt, now, timeZone);
}

/** 保留完整任务列表的既有顺序，只筛出今天需要处理的必做任务。 */
export function selectRequiredTodayTasks(
  tasks: HomeLearningTask[],
  now = new Date(),
  timeZone: string = DEFAULT_VIEWER_TIME_ZONE,
): HomeLearningTask[] {
  return tasks.filter((task) => isRequiredToday(task, now, timeZone));
}
