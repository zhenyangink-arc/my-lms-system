/**
 * 把 `<input type="datetime-local">` 的值（没有时区，含义是“用户电脑当前时区的这个时刻”）转成带时区的 ISO 字符串。
 * 服务端动作对不带时区的时间有的按韩国时间（UTC+9）解析、有的按服务器时区解析；这里先在浏览器里按电脑时区换算成 UTC，动作就会原样采用。
 * 产品决定（2026-10-01）：时间一律跟随用户电脑的时区。表单里用 `LocalDateTimeField`（src/components/ui/local-datetime-field.tsx）。
 * 无法解析的值返回空字符串（动作会据此报“截止时间必须晚于开始时间”之类的错误）。
 */
export function localDateTimeToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return "";
  const date = new Date(value); // 不带时区的日期时间字符串按本地时区解析
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** 把时刻格式化成 datetime-local 需要的“本地时间”字符串。 */
export function toLocalDateTimeInputValue(date: Date): string {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}
