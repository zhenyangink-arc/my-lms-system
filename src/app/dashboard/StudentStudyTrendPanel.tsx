"use client";

import { useMemo, useState } from "react";

type StudyRange = {
  id: "week" | "month" | "year";
  label: string;
  periodLabel: string;
  values: number[];
  axisLabels: string[];
  tips: string[];
};

type Props = {
  ranges: StudyRange[];
};

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
}

export function StudentStudyTrendPanel({ ranges }: Props) {
  const [rangeId, setRangeId] = useState<StudyRange["id"]>("week");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const range = ranges.find((item) => item.id === rangeId) ?? ranges[0];

  const summary = useMemo(() => {
    const total = range.values.reduce((sum, value) => sum + value, 0);
    const activeCount = range.values.filter((value) => value > 0).length;
    const bestValue = Math.max(0, ...range.values);
    const bestIndex = bestValue > 0 ? range.values.indexOf(bestValue) : -1;

    return { total, activeCount, bestIndex, bestValue };
  }, [range]);

  const maxValue = Math.max(1, ...range.values);
  const minimumChartWidth = Math.max(420, range.values.length * 19);

  function chooseRange(nextRange: StudyRange["id"]) {
    setRangeId(nextRange);
    setActiveIndex(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="study-trend-title" className="text-base font-bold tracking-tight">
            学习趋势
          </h2>
          <p className="app-muted-text mt-1 text-xs font-medium">
            按周、月、年查看有效学习时间
          </p>
        </div>
        <div
          className="grid grid-cols-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-1"
          role="group"
          aria-label="选择学习趋势时间范围"
        >
          {ranges.map((item) => {
            const active = item.id === range.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseRange(item.id)}
                aria-pressed={active}
                className="min-h-10 cursor-pointer rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                style={{
                  color: active ? "var(--primary-hover)" : "var(--foreground-muted)",
                  backgroundColor: active ? "var(--card)" : "transparent",
                  boxShadow: active ? "0 1px 4px rgba(30, 45, 64, 0.08)" : "none",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto pb-1" tabIndex={0} aria-label={`${range.periodLabel}学习柱状图，可横向滚动`}>
        <div
          className="grid h-52 items-end gap-1.5 border-b border-[var(--border-subtle)] px-1 pt-8"
          style={{
            minWidth: `${minimumChartWidth}px`,
            gridTemplateColumns: `repeat(${range.values.length}, minmax(0, 1fr))`,
          }}
        >
          {range.values.map((minutes, index) => {
            const height = minutes > 0
              ? Math.max(10, Math.round((minutes / maxValue) * 100))
              : 4;
            const showAxisLabel =
              range.id !== "month" ||
              index === 0 ||
              index === range.values.length - 1 ||
              (index + 1) % 5 === 0;
            const active = activeIndex === index;

            return (
              <div key={`${range.id}-${index}`} className="relative grid h-full min-w-0 grid-rows-[1fr_24px] gap-1">
                {active && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-0 z-20 w-max max-w-48 -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-center text-xs font-semibold shadow-lg"
                    style={{
                      color: "var(--foreground)",
                      borderColor: "var(--border)",
                      backgroundColor: "var(--card)",
                    }}
                  >
                    {range.tips[index] ?? `${range.axisLabels[index]} · ${formatMinutes(minutes)}`}
                  </div>
                )}
                <button
                  type="button"
                  className="group flex min-h-0 w-full cursor-pointer items-end rounded-t-lg bg-[color-mix(in_srgb,var(--border-subtle)_52%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                  onClick={() => setActiveIndex((current) => current === index ? null : index)}
                  aria-label={range.tips[index] ?? `${range.axisLabels[index]}，学习 ${formatMinutes(minutes)}`}
                >
                  <span
                    className="block w-full rounded-t-lg transition-[height,background-color]"
                    style={{
                      height: `${height}%`,
                      minHeight: "5px",
                      background: minutes > 0
                        ? active
                          ? "var(--primary-hover)"
                          : "linear-gradient(180deg, #4ea5ff, #087cf0)"
                        : "var(--border)",
                    }}
                  />
                </button>
                <span className="truncate text-center text-[11px] font-medium text-[var(--foreground-muted)]">
                  {showAxisLabel ? range.axisLabels[index] : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid overflow-hidden rounded-xl border border-[var(--border-subtle)] sm:grid-cols-3">
        {[
          ["有效学习", formatMinutes(summary.total)],
          [range.id === "year" ? "活跃月份" : "活跃天数", `${summary.activeCount} ${range.id === "year" ? "个月" : "天"}`],
          ["最投入时段", summary.bestIndex >= 0 ? range.axisLabels[summary.bestIndex] : "等待记录"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="border-t p-3 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span className="app-muted-text block text-xs font-medium">{label}</span>
            <strong className="mt-1 block text-sm font-bold tabular-nums">{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
