import type { HomeLearningTask } from "./api/types.ts";

/** 学生端统一按首尔时间显示任务时间。 */
export function formatLearningDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "时间待确认";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(parsed);
}

export function getTaskTiming(task: HomeLearningTask): string {
  if (task.dueAt) return `${formatLearningDateTime(task.dueAt)} 截止`;
  if (task.progressPercent !== null) {
    return `已完成 ${Math.round(task.progressPercent)}%`;
  }
  if (task.startsAt) return `${formatLearningDateTime(task.startsAt)} 开始`;
  return task.status === "in_progress" ? "可以继续完成" : "现在可以开始";
}

/** 去掉“第 N 课”前缀，只保留课时名称。 */
export function getLessonDisplayTitle(title: string): string {
  return title.replace(/^第\s*\d+\s*课[：:\s]*/, "").trim() || title;
}
