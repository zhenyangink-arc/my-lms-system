"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import {
  formatLearningDuration,
  fullLearningDateLabel,
  type LearningDay,
} from "./learning-record-types";

type CalendarDay = LearningDay & { level: 0 | 1 | 2 | 3 | 4 };

const DEFAULT_VISIBLE_MONTHS = 3;

function activityLevel(day: LearningDay): CalendarDay["level"] {
  if (day.seconds <= 0) return day.activityCount > 0 ? 1 : 0;
  if (day.seconds < 10 * 60) return 1;
  if (day.seconds < 30 * 60) return 2;
  if (day.seconds < 60 * 60) return 3;
  return 4;
}

function buildMonths(days: LearningDay[]) {
  const months = new Map<string, CalendarDay[]>();
  for (const day of days) {
    const monthKey = day.key.slice(0, 7);
    const monthDays = months.get(monthKey) ?? [];
    monthDays.push({ ...day, level: activityLevel(day) });
    months.set(monthKey, monthDays);
  }
  return [...months.entries()].map(([key, monthDays]) => ({
    key,
    label: new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
    }).format(new Date(`${key}-15T12:00:00+09:00`)),
    offset:
      (new Date(`${monthDays[0].key}T12:00:00+09:00`).getDay() + 6) % 7,
    days: monthDays,
  }));
}

function dayBackground(day: CalendarDay) {
  if (day.seconds <= 0 && day.activityCount > 0) {
    return "var(--support-surface)";
  }
  if (day.level === 0) return "var(--surface-soft)";
  if (day.level === 1) {
    return "color-mix(in srgb, var(--status-success) 24%, var(--card))";
  }
  if (day.level === 2) {
    return "color-mix(in srgb, var(--status-success) 48%, var(--card))";
  }
  if (day.level === 3) {
    return "color-mix(in srgb, var(--status-success) 72%, var(--card))";
  }
  return "var(--status-success)";
}

export function YearLearningCalendar({
  days,
  selectedDate,
  onSelectDate,
}: {
  days: LearningDay[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const months = useMemo(() => buildMonths(days), [days]);
  const visibleMonths = expanded
    ? months
    : months.slice(-DEFAULT_VISIBLE_MONTHS);
  const hiddenMonthCount = Math.max(0, months.length - visibleMonths.length);
  const activeDays = days.filter(
    (day) => day.seconds > 0 || day.activityCount > 0,
  ).length;
  const totalSeconds = days.reduce((sum, day) => sum + day.seconds, 0);
  const selectedDay = selectedDate
    ? days.find((day) => day.key === selectedDate)
    : null;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex justify-end">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <p className="font-medium">
            <span className="font-bold tabular-nums text-[var(--status-success)]">
              {activeDays}
            </span>{" "}
            个学习日
          </p>
          <p className="font-medium">
            <span className="font-bold tabular-nums">
              {formatLearningDuration(totalSeconds)}
            </span>{" "}
            有效学习
          </p>
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        {visibleMonths.map((month) => (
          <section
            key={month.key}
            className="border-b border-[var(--border-subtle)] pb-5"
          >
            <h3 className="mb-3 text-sm font-semibold">{month.label}</h3>
            <div
              className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-[var(--foreground-muted)]"
              aria-hidden="true"
            >
              {["一", "二", "三", "四", "五", "六", "日"].map(
                (label) => (
                  <span key={label}>{label}</span>
                ),
              )}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: month.offset }, (_, index) => (
                <span key={`offset:${index}`} className="aspect-square" />
              ))}
              {month.days.map((day) => {
                const active = day.seconds > 0 || day.activityCount > 0;
                const selected = selectedDate === day.key;
                const detail = active
                  ? `${formatLearningDuration(day.seconds)}，${day.activityCount} 项学习活动`
                  : "暂无学习记录";
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => onSelectDate(selected ? null : day.key)}
                    aria-pressed={selected}
                    aria-label={`${fullLearningDateLabel(day.key)}，${detail}`}
                    title={`${fullLearningDateLabel(day.key)} · ${detail}`}
                    className="relative aspect-square min-h-9 cursor-pointer rounded-md border text-[10px] font-semibold tabular-nums transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--status-success)]"
                    style={{
                      color:
                        day.level >= 3
                          ? "white"
                          : active
                            ? "var(--foreground)"
                            : "var(--foreground-muted)",
                      backgroundColor: dayBackground(day),
                      borderColor: selected
                        ? "var(--foreground)"
                        : "transparent",
                      boxShadow: selected
                        ? "0 0 0 2px var(--card), 0 0 0 4px var(--status-success)"
                        : undefined,
                    }}
                  >
                    {Number(day.key.slice(-2))}
                    {day.activityCount > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--support)] ring-1 ring-[var(--card)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {months.length > DEFAULT_VISIBLE_MONTHS && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm font-semibold text-[var(--support)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--support)]"
          >
            {expanded ? (
              <>
                <ChevronUp size={16} aria-hidden="true" />
                收起较早月份
              </>
            ) : (
              <>
                <ChevronDown size={16} aria-hidden="true" />
                展开查看更早的 {hiddenMonthCount} 个月
              </>
            )}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="app-muted-text text-sm font-medium" aria-live="polite">
          {selectedDay
            ? `${fullLearningDateLabel(selectedDay.key)} · ${formatLearningDuration(selectedDay.seconds)} · ${selectedDay.activityCount} 项学习活动`
            : "点击任意日期，下方会直接显示当天的学习记录。"}
        </p>
        <div
          className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-[var(--foreground-muted)]"
          aria-label="学习日历图例"
        >
          <span className="h-3 w-3 bg-[var(--support-surface)] ring-1 ring-[var(--support)]" />
          <span>有活动</span>
          <span className="ml-2">时长少</span>
          {[1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className="h-3 w-3"
              style={{
                backgroundColor:
                  level === 4
                    ? "var(--status-success)"
                    : `color-mix(in srgb, var(--status-success) ${level * 24}%, var(--card))`,
              }}
            />
          ))}
          <span>时长多</span>
        </div>
      </div>
    </div>
  );
}
