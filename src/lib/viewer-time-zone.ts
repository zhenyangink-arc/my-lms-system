// 用户时区（产品决定 2026-10-01：时间一律跟随用户电脑的时区）。
// 浏览器把自己的时区写进 cookie（见 components/viewer-time-zone.tsx），服务端读取它（viewer-time-zone.server.ts）；
// 没有 cookie 或值无效时回落到首尔，与改动前的行为一致。本文件是纯函数，客户端与服务端都可以使用。

export const DEFAULT_VIEWER_TIME_ZONE = "Asia/Seoul";
export const VIEWER_TIME_ZONE_COOKIE = "viewer_tz";

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveViewerTimeZone(value: unknown): string {
  return isValidTimeZone(value) ? value : DEFAULT_VIEWER_TIME_ZONE;
}

type DateInput = string | number | Date;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** 时间点在指定时区下的日期键（YYYY-MM-DD）。 */
export function dateKeyInTimeZone(value: DateInput, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(toDate(value));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

/** 时间点在指定时区下的小时（0–23）。 */
export function hourInTimeZone(value: DateInput, timeZone: string): number {
  const text = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(toDate(value));
  return Number(text) % 24;
}

/** 按指定时区格式化时间点。 */
export function formatInTimeZone(
  value: DateInput,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = "zh-CN",
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(toDate(value));
}

/** 日期键本身代表的日历日期，格式化时与任何时区无关（取当天中午的 UTC，避免跨日）。 */
export function formatDateKey(key: string, options: Intl.DateTimeFormatOptions, locale = "zh-CN"): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

/** 日期键是星期几（0 = 周日）。 */
export function weekdayOfDateKey(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

/** 日期键加减若干天。 */
export function addDaysToDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString().slice(0, 10);
}

// 时区相对 UTC 的偏移（毫秒）：该时间点在时区里的“墙上时间”按 UTC 解读，减去该时间点本身。
function offsetMsInTimeZone(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instantMs));
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const wallAsUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour") % 24, read("minute"), read("second"));
  return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
}

/** 指定时区里某个日期键当天某个钟点的时间点（正确处理夏令时切换）。 */
export function zonedTimeToDate(key: string, hour: number, minute: number, timeZone: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const first = wallAsUtc - offsetMsInTimeZone(wallAsUtc, timeZone);
  const second = wallAsUtc - offsetMsInTimeZone(first, timeZone);
  return new Date(second);
}

/** 指定时区里某个日期键当天 00:00 的时间点。 */
export function startOfDayInTimeZone(key: string, timeZone: string): Date {
  return zonedTimeToDate(key, 0, 0, timeZone);
}

/** 时间点所在周（周一为一周的开始）的周一日期键，按指定时区计算。 */
export function weekStartKeyInTimeZone(value: DateInput, timeZone: string): string {
  const todayKey = dateKeyInTimeZone(value, timeZone);
  return addDaysToDateKey(todayKey, -((weekdayOfDateKey(todayKey) + 6) % 7));
}
