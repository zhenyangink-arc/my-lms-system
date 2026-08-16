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

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function learningDateKey(value: string | Date) {
  const parts = dateKeyFormatter.formatToParts(
    typeof value === "string" ? new Date(value) : value,
  );
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function formatLearningDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return seconds > 0 ? `${seconds} 秒` : "0 分钟";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} 分钟`;
  return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}

export function fullLearningDateLabel(key: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${key}T12:00:00+09:00`));
}

export function shortLearningDateLabel(key: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${key}T12:00:00+09:00`));
}
