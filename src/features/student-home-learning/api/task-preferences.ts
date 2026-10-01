import {
  DEFAULT_VIEWER_TIME_ZONE,
  weekStartKeyInTimeZone,
} from "../../../lib/viewer-time-zone.ts";

import type { HomeLearningTask } from "./types.ts";

export type StudentLearningTaskPreference = {
  taskKey: string;
  snoozedUntil: string | null;
  dismissedForWeek: string | null;
};

function preferenceIsActive(
  preference: StudentLearningTaskPreference,
  now: Date,
  timeZone: string,
) {
  const snoozedUntil = preference.snoozedUntil
    ? Date.parse(preference.snoozedUntil)
    : Number.NaN;
  return (
    (!Number.isNaN(snoozedUntil) && snoozedUntil > now.getTime()) ||
    preference.dismissedForWeek === weekStartKeyInTimeZone(now, timeZone)
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
  timeZone: string = DEFAULT_VIEWER_TIME_ZONE,
): HomeLearningTask[] {
  const activeTaskKeys = new Set(
    preferences
      .filter((preference) => preferenceIsActive(preference, now, timeZone))
      .map((preference) => preference.taskKey),
  );
  return tasks.filter(
    (task) => task.required || !activeTaskKeys.has(task.taskKey),
  );
}
