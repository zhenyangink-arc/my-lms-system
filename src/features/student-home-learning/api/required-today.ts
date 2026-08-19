import type { HomeLearningTask } from "./types.ts";

const DAY_MS = 86_400_000;
const PORTAL_TIME_ZONE = "Asia/Seoul";
const ACTIONABLE_REQUIRED_STATUSES = new Set<HomeLearningTask["status"]>([
  "not_started",
  "available",
  "in_progress",
  "overdue",
  "locked",
]);

export function localDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PORTAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function isSamePortalDay(value: string | null, now: Date): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && localDateKey(parsed) === localDateKey(now);
}

export function isTomorrowInPortal(value: string | null, now: Date): boolean {
  if (!value) return false;
  const tomorrow = new Date(now.getTime() + DAY_MS);
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && localDateKey(parsed) === localDateKey(tomorrow);
}

export function isOverdueCompletable(task: HomeLearningTask): boolean {
  return task.required && task.status === "overdue" && task.priority === "critical";
}

function isRequiredToday(task: HomeLearningTask, now: Date): boolean {
  if (!task.required || !ACTIONABLE_REQUIRED_STATUSES.has(task.status)) return false;
  if (task.status === "overdue") return isOverdueCompletable(task);
  return isSamePortalDay(task.dueAt, now) || isSamePortalDay(task.startsAt, now);
}

/** 保留完整任务列表的既有顺序，只筛出今天需要处理的必做任务。 */
export function selectRequiredTodayTasks(
  tasks: HomeLearningTask[],
  now = new Date(),
): HomeLearningTask[] {
  return tasks.filter((task) => isRequiredToday(task, now));
}
