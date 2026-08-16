"use client";

import {
  BarChart3,
  CalendarDays,
  Clock3,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  formatLearningDuration,
  fullLearningDateLabel,
  shortLearningDateLabel,
  type LearningDay,
  type LearningRangeDays,
} from "./learning-record-types";

const RANGE_OPTIONS: Array<{ value: LearningRangeDays; label: string }> = [
  { value: 7, label: "7 天" },
  { value: 30, label: "30 天" },
  { value: 90, label: "90 天" },
  { value: 365, label: "全年" },
];

const VIEWBOX_WIDTH = 820;

function sumSeconds(days: LearningDay[]) {
  return days.reduce((sum, day) => sum + day.seconds, 0);
}

export function LearningTrendChart({
  days,
  rangeDays,
  onRangeChange,
}: {
  days: LearningDay[];
  rangeDays: LearningRangeDays;
  onRangeChange: (range: LearningRangeDays) => void;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [tooltipPinned, setTooltipPinned] = useState(false);
  const chart = useMemo(() => {
    const visibleDays = days.slice(-rangeDays);
    const previousDays = days.slice(
      Math.max(0, days.length - rangeDays * 2),
      Math.max(0, days.length - rangeDays),
    );
    const totalSeconds = sumSeconds(visibleDays);
    const previousSeconds = sumSeconds(previousDays);
    const activeDays = visibleDays.filter(
      (day) => day.seconds > 0 || day.activityCount > 0,
    ).length;
    const timedDays = visibleDays.filter((day) => day.seconds > 0).length;
    const averageSeconds = timedDays ? Math.round(totalSeconds / timedDays) : 0;
    const maxMinutes = Math.max(
      10,
      Math.ceil(
        Math.max(...visibleDays.map((day) => day.seconds / 60), 0) / 10,
      ) * 10,
    );
    const plot = { left: 54, right: 786, top: 24, bottom: 218 };
    const width = plot.right - plot.left;
    const height = plot.bottom - plot.top;
    const points = visibleDays.map((day, index) => {
      const x =
        plot.left +
        (visibleDays.length <= 1
          ? width / 2
          : (index / (visibleDays.length - 1)) * width);
      const minutes = day.seconds / 60;
      const y = plot.bottom - (minutes / maxMinutes) * height;
      return { ...day, x, y, minutes };
    });
    const linePath = points
      .map(
        (point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
      )
      .join(" ");
    const areaPath = points.length
      ? `${linePath} L ${points.at(-1)?.x} ${plot.bottom} L ${points[0].x} ${plot.bottom} Z`
      : "";
    const labelIndexes = new Set(
      Array.from({ length: Math.min(6, visibleDays.length) }, (_, index) =>
        Math.round(
          (index / Math.max(1, Math.min(6, visibleDays.length) - 1)) *
            (visibleDays.length - 1),
        ),
      ),
    );
    const delta = totalSeconds - previousSeconds;
    const comparison =
      rangeDays === 365 || previousDays.length < rangeDays
        ? `近一年共有 ${activeDays} 个学习日`
        : previousSeconds === 0 && totalSeconds === 0
          ? "当前周期与上一周期都没有计时记录"
          : previousSeconds === 0
            ? "当前周期开始形成新的学习积累"
            : delta === 0
              ? "与上一周期投入持平"
              : `较上一周期${delta > 0 ? "增加" : "减少"} ${formatLearningDuration(Math.abs(delta))}`;

    return {
      visibleDays,
      totalSeconds,
      activeDays,
      averageSeconds,
      maxMinutes,
      plot,
      points,
      linePath,
      areaPath,
      labelIndexes,
      delta,
      comparison,
    };
  }, [days, rangeDays]);

  const safeActiveIndex =
    activeIndex != null && activeIndex < chart.points.length
      ? activeIndex
      : null;
  const activePoint =
    safeActiveIndex == null ? null : chart.points[safeActiveIndex];
  const TrendIcon =
    chart.delta > 0 ? TrendingUp : chart.delta < 0 ? TrendingDown : BarChart3;

  function updatePointFromPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (chart.points.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewboxX =
      ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * VIEWBOX_WIDTH;
    const clampedX = Math.min(
      chart.plot.right,
      Math.max(chart.plot.left, viewboxX),
    );
    const ratio =
      (clampedX - chart.plot.left) /
      Math.max(1, chart.plot.right - chart.plot.left);
    setActiveIndex(
      Math.round(ratio * Math.max(0, chart.points.length - 1)),
    );
  }

  function handleChartKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setTooltipPinned(true);
    setActiveIndex((current) => {
      const fallback = Math.max(0, chart.points.length - 1);
      const next = current ?? fallback;
      return event.key === "ArrowLeft"
        ? Math.max(0, next - 1)
        : Math.min(chart.points.length - 1, next + 1);
    });
  }

  function defaultTooltipIndex() {
    for (let index = chart.points.length - 1; index >= 0; index -= 1) {
      const point = chart.points[index];
      if (point.seconds > 0 || point.activityCount > 0) return index;
    }
    return Math.max(0, chart.points.length - 1);
  }

  const tooltipTransform = activePoint
    ? `${activePoint.x > 680 ? "translateX(-100%)" : activePoint.x < 140 ? "translateX(0)" : "translateX(-50%)"} ${activePoint.y < 78 ? "translateY(14px)" : "translateY(calc(-100% - 12px))"}`
    : undefined;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="app-muted-text text-sm font-medium">
          折线越高，表示当天经过计时确认的学习时间越长。
        </p>
        <div
          className="grid grid-cols-4 gap-1 rounded-2xl bg-[var(--app-soft-bg)] p-1"
          role="group"
          aria-label="选择学习趋势范围"
        >
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setActiveIndex(null);
                setTooltipPinned(false);
                onRangeChange(option.value);
              }}
              aria-pressed={rangeDays === option.value}
              className="min-h-11 cursor-pointer rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
              style={{
                color:
                  rangeDays === option.value
                    ? "var(--app-accent)"
                    : "var(--app-muted)",
                backgroundColor:
                  rangeDays === option.value
                    ? "var(--app-card-bg)"
                    : "transparent",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <div className="relative">
            <svg
              viewBox="0 0 820 260"
              className="h-auto w-full touch-manipulation rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
              role="img"
              tabIndex={0}
              aria-label={`${rangeDays === 365 ? "近一年" : `最近 ${rangeDays} 天`}累计有效学习 ${formatLearningDuration(chart.totalSeconds)}，${chart.activeDays} 个学习日。${chart.comparison}。可使用鼠标、触摸或左右方向键查看每日数据。`}
              aria-describedby={activePoint ? "learning-chart-tooltip" : undefined}
              onFocus={() => {
                setActiveIndex(defaultTooltipIndex());
                setTooltipPinned(true);
              }}
              onBlur={() => {
                setActiveIndex(null);
                setTooltipPinned(false);
              }}
              onKeyDown={handleChartKeyDown}
              onPointerMove={(event) => {
                if (event.pointerType !== "mouse") return;
                setTooltipPinned(false);
                updatePointFromPointer(event);
              }}
              onPointerDown={(event) => {
                updatePointFromPointer(event);
                setTooltipPinned(event.pointerType !== "mouse");
              }}
              onPointerLeave={() => {
                if (!tooltipPinned) setActiveIndex(null);
              }}
            >
              <defs>
                <linearGradient
                  id="learning-trend-area"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--app-accent)"
                    stopOpacity="0.2"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--app-accent)"
                    stopOpacity="0.01"
                  />
                </linearGradient>
              </defs>
              {[0, 0.5, 1].map((ratio) => {
                const y =
                  chart.plot.top +
                  ratio * (chart.plot.bottom - chart.plot.top);
                const value = Math.round(chart.maxMinutes * (1 - ratio));
                return (
                  <g key={ratio}>
                    <line
                      x1={chart.plot.left}
                      x2={chart.plot.right}
                      y1={y}
                      y2={y}
                      stroke="var(--app-border-soft)"
                      strokeDasharray={ratio === 1 ? undefined : "5 7"}
                    />
                    <text
                      x={chart.plot.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      fill="var(--app-muted)"
                      fontSize="10"
                      fontWeight="500"
                    >
                      {value} 分
                    </text>
                  </g>
                );
              })}
              {chart.areaPath && (
                <path d={chart.areaPath} fill="url(#learning-trend-area)" />
              )}
              {chart.linePath && (
                <path
                  d={chart.linePath}
                  fill="none"
                  stroke="var(--app-accent)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {activePoint && (
                <line
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1={chart.plot.top}
                  y2={chart.plot.bottom}
                  stroke="var(--app-accent)"
                  strokeDasharray="4 5"
                  strokeOpacity="0.65"
                />
              )}
              {chart.points.map((point, index) => (
                <g key={point.key}>
                  {point.seconds > 0 && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={safeActiveIndex === index ? 6 : 4}
                      fill="var(--app-card-bg)"
                      stroke="var(--app-accent)"
                      strokeWidth="3"
                    />
                  )}
                  {safeActiveIndex === index && point.seconds === 0 && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="5"
                      fill="var(--app-secondary)"
                      stroke="var(--app-card-bg)"
                      strokeWidth="2"
                    />
                  )}
                  {chart.labelIndexes.has(index) && (
                    <text
                      x={point.x}
                      y="246"
                      textAnchor="middle"
                      fill="var(--app-muted)"
                      fontSize="10"
                      fontWeight="500"
                    >
                      {shortLearningDateLabel(point.key)}
                    </text>
                  )}
                </g>
              ))}
            </svg>

            {activePoint && (
              <div
                id="learning-chart-tooltip"
                role="tooltip"
                className="pointer-events-none absolute z-10 min-w-40 border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 py-2 shadow-lg"
                style={{
                  left: `${(activePoint.x / VIEWBOX_WIDTH) * 100}%`,
                  top: `${(activePoint.y / 260) * 100}%`,
                  transform: tooltipTransform,
                }}
              >
                <p className="text-xs font-semibold">
                  {fullLearningDateLabel(activePoint.key)}
                </p>
                <p className="mt-1 text-sm font-black tabular-nums text-[var(--app-accent)]">
                  {formatLearningDuration(activePoint.seconds)}
                </p>
                <p className="app-muted-text mt-0.5 text-xs font-medium">
                  {activePoint.activityCount} 项学习活动
                </p>
              </div>
            )}
          </div>

          {chart.totalSeconds === 0 && (
            <p className="app-muted-text mt-2 text-center text-sm font-medium">
              当前范围还没有带计时的记录，课程完成与任务提交仍会显示在日历中。
            </p>
          )}

          <details className="mt-3 border-t border-[var(--app-border-soft)]">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]">
              查看每日数据表
            </summary>
            <div className="max-h-72 overflow-auto border-t border-[var(--app-border-soft)]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[var(--app-card-bg)]">
                  <tr>
                    <th className="px-3 py-3 font-semibold">日期</th>
                    <th className="px-3 py-3 text-right font-semibold">
                      有效学习
                    </th>
                    <th className="px-3 py-3 text-right font-semibold">
                      学习活动
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...chart.visibleDays].reverse().map((day) => (
                    <tr
                      key={day.key}
                      className="border-t border-[var(--app-border-soft)]"
                    >
                      <td className="px-3 py-3 font-medium">
                        {fullLearningDateLabel(day.key)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {formatLearningDuration(day.seconds)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {day.activityCount} 项
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>

        <aside className="divide-y divide-[var(--app-border-soft)] border-y border-[var(--app-border-soft)] xl:border-y-0 xl:border-l">
          {[
            {
              label:
                rangeDays === 365 ? "近一年累计" : `最近 ${rangeDays} 天累计`,
              value: formatLearningDuration(chart.totalSeconds),
              icon: Clock3,
              color: "var(--app-accent)",
            },
            {
              label: "有学习活动的日期",
              value: `${chart.activeDays} 天`,
              icon: CalendarDays,
              color: "var(--app-success)",
            },
            {
              label: "有计时日期的日均",
              value: formatLearningDuration(chart.averageSeconds),
              icon: BarChart3,
              color: "var(--app-secondary)",
            },
          ].map((metric) => {
            const MetricIcon = metric.icon;
            return (
              <div key={metric.label} className="flex items-center gap-3 px-3 py-4 xl:px-5">
                <MetricIcon
                  size={17}
                  style={{ color: metric.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-base font-black tabular-nums">
                    {metric.value}
                  </p>
                  <p className="app-muted-text mt-0.5 text-xs font-medium">
                    {metric.label}
                  </p>
                </div>
              </div>
            );
          })}
          <p
            className="flex items-start gap-2 px-3 py-4 text-xs font-semibold leading-5 xl:px-5"
            style={{
              color:
                chart.delta >= 0 ? "var(--app-success)" : "var(--app-warm)",
            }}
          >
            <TrendIcon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            {chart.comparison}
          </p>
        </aside>
      </div>
    </div>
  );
}
