"use client";

import { useState } from "react";
import { CalendarDays, ChartNoAxesCombined } from "lucide-react";

import { LearningTrendChart } from "./LearningTrendChart";
import { YearLearningCalendar } from "./YearLearningCalendar";
import type {
  LearningDay,
  LearningRangeDays,
} from "./learning-record-types";

type ActivityView = "trend" | "calendar";

const VIEW_OPTIONS = [
  { value: "trend" as const, label: "趋势图", icon: ChartNoAxesCombined },
  { value: "calendar" as const, label: "日历", icon: CalendarDays },
];

export function LearningActivityPanel({
  days,
  rangeDays,
  selectedDate,
  onRangeChange,
  onSelectDate,
}: {
  days: LearningDay[];
  rangeDays: LearningRangeDays;
  selectedDate: string | null;
  onRangeChange: (range: LearningRangeDays) => void;
  onSelectDate: (date: string | null) => void;
}) {
  const [view, setView] = useState<ActivityView>("trend");

  return (
    <section
      className="app-card overflow-hidden rounded-3xl border"
      aria-labelledby="learning-activity-title"
    >
      <header className="flex flex-col gap-4 border-b border-[var(--border-subtle)] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--primary)]">
            每日学习
          </p>
          <h2
            id="learning-activity-title"
            className="mt-1 text-lg font-bold tracking-tight"
          >
            学习投入与完成足迹
          </h2>
          <p className="app-muted-text mt-1 text-sm font-medium leading-6">
            在趋势图和全年日历之间切换，查看同一组每日学习数据。
          </p>
        </div>

        <div
          className="grid w-full grid-cols-2 gap-1 rounded-2xl bg-[var(--surface-soft)] p-1 sm:w-auto"
          role="tablist"
          aria-label="切换每日学习视图"
        >
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = view === option.value;
            return (
              <button
                key={option.value}
                id={`learning-activity-tab-${option.value}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`learning-activity-panel-${option.value}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setView(option.value)}
                onKeyDown={(event) => {
                  if (
                    event.key !== "ArrowLeft" &&
                    event.key !== "ArrowRight" &&
                    event.key !== "Home" &&
                    event.key !== "End"
                  ) {
                    return;
                  }
                  event.preventDefault();
                  const nextView =
                    event.key === "Home"
                      ? "trend"
                      : event.key === "End"
                        ? "calendar"
                        : view === "trend"
                          ? "calendar"
                          : "trend";
                  setView(nextView);
                  requestAnimationFrame(() => {
                    document
                      .getElementById(`learning-activity-tab-${nextView}`)
                      ?.focus();
                  });
                }}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                style={{
                  color: active ? "var(--primary)" : "var(--foreground-muted)",
                  backgroundColor: active
                    ? "var(--card)"
                    : "transparent",
                }}
              >
                <Icon size={16} aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>
      </header>

      {view === "trend" ? (
        <div
          id="learning-activity-panel-trend"
          role="tabpanel"
          aria-labelledby="learning-activity-tab-trend"
        >
          <LearningTrendChart
            days={days}
            rangeDays={rangeDays}
            onRangeChange={onRangeChange}
          />
        </div>
      ) : (
        <div
          id="learning-activity-panel-calendar"
          role="tabpanel"
          aria-labelledby="learning-activity-tab-calendar"
        >
          <YearLearningCalendar
            days={days}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
          />
        </div>
      )}
    </section>
  );
}
