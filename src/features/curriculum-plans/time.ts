import type { CurriculumPlanTemplateItem } from "./types";

export function itemOffsetMinutes(item: Pick<CurriculumPlanTemplateItem, "dayOffset" | "startMinute">) {
  return item.dayOffset * 24 * 60 + item.startMinute;
}

export function calculatePlanEnd(
  startsAt: Date,
  items: Array<Pick<CurriculumPlanTemplateItem, "dayOffset" | "startMinute" | "durationMinutes">>,
) {
  if (items.length === 0) return startsAt;
  const anchor = Math.min(...items.map(itemOffsetMinutes));
  const finalMinute = Math.max(
    ...items.map((item) => itemOffsetMinutes(item) + item.durationMinutes),
  );
  return new Date(startsAt.getTime() + (finalMinute - anchor) * 60_000);
}

export function expandPlanItemTime(
  startsAt: Date,
  anchorMinute: number,
  item: Pick<CurriculumPlanTemplateItem, "dayOffset" | "startMinute" | "durationMinutes">,
) {
  const itemStartsAt = new Date(
    startsAt.getTime() + (itemOffsetMinutes(item) - anchorMinute) * 60_000,
  );
  return {
    startsAt: itemStartsAt,
    endsAt: new Date(itemStartsAt.getTime() + item.durationMinutes * 60_000),
  };
}

/** 表单提交的是浏览器按用户电脑时区换算好的 ISO 时间点（LocalDateTimeField），这里校验并规范成 UTC ISO 字符串。 */
export function parsePlanStartsAt(value: string) {
  const date = new Date(value.trim());
  if (!value.trim() || Number.isNaN(date.getTime())) {
    throw new Error("请选择有效的开课日期和时间。");
  }
  return date.toISOString();
}
