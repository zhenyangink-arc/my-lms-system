import { dateKeyInTimeZone, formatDateKey } from "@/lib/viewer-time-zone";

export type LearningRecordCategory =
  | "course"
  | "task"
  | "practice"
  | "teacher";

export type LearningRecordEvent = {
  id: string;
  category: LearningRecordCategory;
  title: string;
  subtitle?: string;
  description: string;
  date: string;
  status: string;
  durationSeconds?: number;
  nextAction?: string;
  href?: string;
};

export type LearningDay = {
  key: string;
  label: string;
  seconds: number;
  activityCount: number;
  isToday: boolean;
};

export type LearningRangeDays = 7 | 30 | 90 | 365;

/** 时间点在用户时区下的日期键（YYYY-MM-DD）；时区来自用户电脑（见 lib/viewer-time-zone.ts）。 */
export function learningDateKey(value: string | Date, timeZone: string) {
  return dateKeyInTimeZone(value, timeZone);
}

export function formatLearningDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return seconds > 0 ? `${seconds} 秒` : "0 分钟";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} 分钟`;
  return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}

/** 日期键本身是日历日期，格式化与时区无关。 */
export function fullLearningDateLabel(key: string) {
  return formatDateKey(key, { year: "numeric", month: "long", day: "numeric" });
}

export function shortLearningDateLabel(key: string) {
  return formatDateKey(key, { month: "numeric", day: "numeric" });
}
