import type { HomeLearningTask } from "./types.ts";

export type StudentLearningTaskPreference = {
  taskKey: string;
  snoozedUntil: string | null;
  dismissedForWeek: string | null;
};

const seoulDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function seoulDateKey(value: Date) {
  const parts = seoulDateFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function seoulWeekStartDate(now: Date) {
  const [year, month, day] = seoulDateKey(now).split("-").map(Number);
  const localCalendarDate = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (localCalendarDate.getUTCDay() + 6) % 7;
  localCalendarDate.setUTCDate(localCalendarDate.getUTCDate() - daysSinceMonday);
  return [
    localCalendarDate.getUTCFullYear(),
    String(localCalendarDate.getUTCMonth() + 1).padStart(2, "0"),
    String(localCalendarDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function preferenceIsActive(
  preference: StudentLearningTaskPreference,
  now: Date,
) {
  const snoozedUntil = preference.snoozedUntil
    ? Date.parse(preference.snoozedUntil)
    : Number.NaN;
  return (
    (!Number.isNaN(snoozedUntil) && snoozedUntil > now.getTime()) ||
    preference.dismissedForWeek === seoulWeekStartDate(now)
  );
}

/**
 * 仅在既有聚合、去重和排序完成后隐藏仍处于暂缓期的普通建议。
 * required 是来源任务的权威属性，因此无论偏好数据内容如何都始终保留。
 */
export function filterSnoozedHomeLearningTasks(
  tasks: HomeLearningTask[],
  preferences: StudentLearningTaskPreference[],
  now = new Date(),
): HomeLearningTask[] {
  const activeTaskKeys = new Set(
    preferences
      .filter((preference) => preferenceIsActive(preference, now))
      .map((preference) => preference.taskKey),
  );
  return tasks.filter(
    (task) => task.required || !activeTaskKeys.has(task.taskKey),
  );
}
