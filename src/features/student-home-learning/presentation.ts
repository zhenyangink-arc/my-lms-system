import { DEFAULT_VIEWER_TIME_ZONE, formatInTimeZone } from "../../lib/viewer-time-zone.ts";

import type { HomeLearningTask } from "./api/types.ts";

/** 按用户时区显示任务时间；没有传时区时是首尔（与改动前一致）。 */
export function formatLearningDateTime(value: string, timeZone: string = DEFAULT_VIEWER_TIME_ZONE): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "时间待确认";
  return formatInTimeZone(parsed, timeZone, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function getTaskTiming(task: HomeLearningTask, timeZone: string = DEFAULT_VIEWER_TIME_ZONE): string {
  if (task.dueAt) return `${formatLearningDateTime(task.dueAt, timeZone)} 截止`;
  if (task.progressPercent !== null) {
    return `已完成 ${Math.round(task.progressPercent)}%`;
  }
  if (task.startsAt) return `${formatLearningDateTime(task.startsAt, timeZone)} 开始`;
  return task.status === "in_progress" ? "可以继续完成" : "现在可以开始";
}

/** 去掉“第 N 课”前缀，只保留课时名称。 */
export function getLessonDisplayTitle(title: string): string {
  return title.replace(/^第\s*\d+\s*课[：:\s]*/, "").trim() || title;
}
