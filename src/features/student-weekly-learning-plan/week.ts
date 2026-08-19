export const STUDENT_PLAN_TIME_ZONE = "Asia/Seoul";

const SEOUL_UTC_OFFSET_MINUTES = 9 * 60;
const DAY_MS = 86_400_000;

const seoulDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: STUDENT_PLAN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error("日期格式无效");
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function utcCalendarDateKey(value: Date) {
  return [
    String(value.getUTCFullYear()).padStart(4, "0"),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function shiftCalendarDate(dateKey: string, days: number) {
  const { year, month, day } = parseDateKey(dateKey);
  return utcCalendarDateKey(
    new Date(Date.UTC(year, month - 1, day + days)),
  );
}

/** 返回时间点在 Asia/Seoul 下的 YYYY-MM-DD。 */
export function getSeoulDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) throw new Error("时间格式无效");
  const parts = seoulDateFormatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function seoulMidnight(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey);
  // 韩国自 1988 年起全年固定 UTC+09:00；业务周计划不处理更早的历史日期。
  return new Date(
    Date.UTC(year, month - 1, day) - SEOUL_UTC_OFFSET_MINUTES * 60_000,
  );
}

export type SeoulWeekRange = {
  weekStartDate: string;
  weekEndDate: string;
  startsAt: string;
  endsAt: string;
};

/**
 * 以服务器传入时间为权威时间点，计算其所在韩国本地 ISO 周（周一至下周一）。
 * `endsAt` 是排他边界，适合数据库的 gte/lt 查询。
 */
export function getSeoulWeekRange(now = new Date()): SeoulWeekRange {
  const localDateKey = getSeoulDateKey(now);
  const { year, month, day } = parseDateKey(localDateKey);
  const localCalendarDate = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (localCalendarDate.getUTCDay() + 6) % 7;
  const weekStartDate = shiftCalendarDate(localDateKey, -daysSinceMonday);
  const weekEndDate = shiftCalendarDate(weekStartDate, 7);
  const startsAt = seoulMidnight(weekStartDate);

  return {
    weekStartDate,
    weekEndDate,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 7 * DAY_MS).toISOString(),
  };
}
