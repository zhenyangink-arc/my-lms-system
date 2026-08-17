"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FilePenLine,
  Flame,
  GraduationCap,
  History,
  MessageCircleMore,
  NotebookPen,
  Target,
} from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { Button } from "@/components/ui/button";
import { LearningActivityPanel } from "./LearningActivityPanel";
import { LEARNING_RECORD_DATE_TIME_OPTIONS } from "./config";
import {
  formatLearningDuration,
  fullLearningDateLabel,
  learningDateKey,
  type LearningDay,
  type LearningRangeDays,
  type LearningRecordCategory,
  type LearningRecordEvent,
} from "./learning-record-types";

export type {
  LearningDay,
  LearningRecordCategory,
  LearningRecordEvent,
} from "./learning-record-types";

type Summary = {
  todaySeconds: number;
  weekSeconds: number;
  streakDays: number;
  completedCount: number;
};

const categoryPresentation = {
  course: {
    label: "课程学习",
    shortLabel: "阅读记录和已完成课时",
    icon: BookOpenCheck,
    color: "var(--primary)",
    soft: "var(--accent)",
  },
  task: {
    label: "作业与考试",
    shortLabel: "提交、批改和修改记录",
    icon: FilePenLine,
    color: "var(--support)",
    soft: "var(--support-surface)",
  },
  practice: {
    label: "专项练习",
    shortLabel: "会话和技能训练记录",
    icon: MessageCircleMore,
    color: "var(--status-success)",
    soft: "var(--status-success-surface)",
  },
  teacher: {
    label: "老师反馈",
    shortLabel: "老师评价和下一步建议",
    icon: NotebookPen,
    color: "var(--status-warning)",
    soft: "var(--status-warning-surface)",
  },
} satisfies Record<
  LearningRecordCategory,
  {
    label: string;
    shortLabel: string;
    icon: typeof BookOpenCheck;
    color: string;
    soft: string;
  }
>;

const relativeDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  weekday: "short",
});

function relativeDateLabel(key: string) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === learningDateKey(today)) return "今天";
  if (key === learningDateKey(yesterday)) return "昨天";
  return relativeDateFormatter.format(new Date(`${key}T12:00:00+09:00`));
}

export function LearningRecordBoard({
  events,
  learningDays,
  summary,
  latestTeacherNote,
  dataError,
}: {
  events: LearningRecordEvent[];
  learningDays: LearningDay[];
  summary: Summary;
  latestTeacherNote: LearningRecordEvent | null;
  dataError: boolean;
}) {
  const [category, setCategory] =
    useState<LearningRecordCategory>("course");
  const [rangeDays, setRangeDays] = useState<LearningRangeDays>(30);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateGroupOpen, setDateGroupOpen] = useState<Record<string, boolean>>(
    {},
  );

  const cutoffKey = learningDays.slice(-rangeDays)[0]?.key ?? "0000-00-00";
  const eventsInScope = useMemo(
    () =>
      events.filter((event) =>
        selectedDate
          ? learningDateKey(event.date) === selectedDate
          : learningDateKey(event.date) >= cutoffKey,
      ),
    [cutoffKey, events, selectedDate],
  );
  const categoryCounts = useMemo(
    () => ({
      course: eventsInScope.filter((event) => event.category === "course")
        .length,
      task: eventsInScope.filter((event) => event.category === "task").length,
      practice: eventsInScope.filter((event) => event.category === "practice")
        .length,
      teacher: eventsInScope.filter((event) => event.category === "teacher")
        .length,
    }),
    [eventsInScope],
  );
  const filteredEvents = eventsInScope.filter(
    (event) => event.category === category,
  );
  const groupedEvents = filteredEvents.reduce<
    Array<{ key: string; events: LearningRecordEvent[] }>
  >((groups, event) => {
    const key = learningDateKey(event.date);
    const last = groups.at(-1);
    if (last?.key === key) {
      last.events.push(event);
    } else {
      groups.push({ key, events: [event] });
    }
    return groups;
  }, []);
  const activePresentation = categoryPresentation[category];
  const ActiveIcon = activePresentation.icon;
  const yearSeconds = learningDays.reduce(
    (sum, day) => sum + day.seconds,
    0,
  );

  function chooseDate(date: string | null) {
    setSelectedDate(date);
    if (!date) return;
    const firstEvent = events.find(
      (event) => learningDateKey(event.date) === date,
    );
    if (firstEvent) setCategory(firstEvent.category);
  }

  function chooseRange(range: LearningRangeDays) {
    setRangeDays(range);
    setSelectedDate(null);
  }

  return (
    <div className="space-y-5">
      <header className="grid gap-5 px-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <h2 className="text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
          学习记录
        </h2>
        <div className="border-l-2 border-[var(--primary)] pl-4 sm:min-w-56">
          <p className="app-muted-text text-xs font-medium">近一年有效学习</p>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-[var(--primary)]">
            {formatLearningDuration(yearSeconds)}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="学习概览">
        {[
          {
            label: "今日有效学习",
            value: formatLearningDuration(summary.todaySeconds),
            icon: Clock3,
            color: "var(--primary)",
            soft: "var(--accent)",
          },
          {
            label: "本周有效学习",
            value: formatLearningDuration(summary.weekSeconds),
            icon: CalendarDays,
            color: "var(--support)",
            soft: "var(--support-surface)",
          },
          {
            label: "连续学习",
            value: `${summary.streakDays} 天`,
            icon: Flame,
            color: "var(--status-warning)",
            soft: "var(--status-warning-surface)",
          },
          {
            label: "累计完成课时",
            value: `${summary.completedCount} 个`,
            icon: CheckCircle2,
            color: "var(--status-success)",
            soft: "var(--status-success-surface)",
          },
        ].map((metric) => {
          const MetricIcon = metric.icon;
          return (
            <article key={metric.label} className="app-card rounded-2xl border p-4">
              <div className="flex items-start gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ color: metric.color, backgroundColor: metric.soft }}
                >
                  <MetricIcon size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold tabular-nums sm:text-xl">
                    {metric.value}
                  </p>
                  <h2 className="mt-1 text-xs font-semibold">{metric.label}</h2>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {dataError && (
        <section
          role="alert"
          className="rounded-2xl border p-4 text-sm font-semibold"
          style={{
            color: "var(--status-warning)",
            backgroundColor: "var(--status-warning-surface)",
          }}
        >
          部分学习记录暂时无法读取，请稍后刷新。
        </section>
      )}

      {latestTeacherNote?.nextAction && (
        <section
          className="app-card rounded-2xl border p-5"
          style={{ borderColor: "var(--status-warning)" }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--status-warning-surface)] text-[var(--status-warning)]">
              <Target size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--status-warning)]">
                老师给你的下一步建议
              </p>
              <h2 className="mt-1 text-sm font-bold">
                {latestTeacherNote.title}
              </h2>
              <p className="app-muted-text mt-2 whitespace-pre-wrap text-xs font-medium leading-6">
                {latestTeacherNote.nextAction}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCategory("teacher");
                setSelectedDate(null);
              }}
              className="min-h-11 cursor-pointer rounded-xl bg-[var(--status-warning-surface)] px-4 text-xs font-semibold text-[var(--status-warning)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--status-warning)]"
            >
              查看老师反馈
            </Button>
          </div>
        </section>
      )}

      <LearningActivityPanel
        days={learningDays}
        rangeDays={rangeDays}
        selectedDate={selectedDate}
        onRangeChange={chooseRange}
        onSelectDate={chooseDate}
      />

      <section aria-labelledby="record-category-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h2 id="record-category-title" className="text-lg font-bold tracking-tight">
              按记录类型查看
            </h2>
          </div>
          <p className="app-muted-text text-xs font-semibold">
            {selectedDate
              ? fullLearningDateLabel(selectedDate)
              : rangeDays === 365
                ? "近一年"
                : `最近 ${rangeDays} 天`}
            · {eventsInScope.length} 条记录
          </p>
        </div>

        <div
          className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-1 lg:grid-cols-4"
          role="group"
          aria-label="选择学习记录类型"
        >
          {(Object.keys(categoryPresentation) as LearningRecordCategory[]).map(
            (key) => {
              const item = categoryPresentation[key];
              const active = category === key;
              return (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  onClick={() => setCategory(key)}
                  aria-pressed={active}
                  aria-label={`${item.label}，${item.shortLabel}，${categoryCounts[key]} 条记录`}
                  title={item.shortLabel}
                  className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-[border-color,background-color,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  style={{
                    color: active ? item.color : "var(--foreground)",
                    backgroundColor: active
                      ? "var(--card)"
                      : "transparent",
                    borderColor: active ? item.color : "var(--border-subtle)",
                  }}
                >
                  <span className="truncate text-xs font-semibold sm:text-sm">
                    {item.label}
                  </span>
                  <span
                    className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                    style={{
                      color: active ? item.color : "var(--foreground-muted)",
                      backgroundColor: active
                        ? item.soft
                        : "var(--card)",
                    }}
                  >
                    {categoryCounts[key]}
                  </span>
                </Button>
              );
            },
          )}
        </div>
      </section>

      <section aria-labelledby="record-detail-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{
                color: activePresentation.color,
                backgroundColor: activePresentation.soft,
              }}
            >
              <ActiveIcon size={16} aria-hidden="true" />
            </span>
            <div>
              <h2 id="record-detail-title" className="text-sm font-bold">
                {selectedDate
                  ? `${fullLearningDateLabel(selectedDate)}的${activePresentation.label}`
                  : activePresentation.label}
              </h2>
            </div>
          </div>
          {selectedDate && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelectedDate(null)}
              className="min-h-11 cursor-pointer rounded-xl bg-[var(--surface-soft)] px-4 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              style={{ color: activePresentation.color }}
            >
              清除日期筛选
            </Button>
          )}
        </div>

        <div className="space-y-5">
          {groupedEvents.map((group, groupIndex) => (
            <details
              key={group.key}
              className="group"
              open={dateGroupOpen[group.key] ?? groupIndex === 0}
              onToggle={(event) => {
                const open = event.currentTarget.open;
                setDateGroupOpen((current) =>
                  current[group.key] === open
                    ? current
                    : { ...current, [group.key]: open },
                );
              }}
            >
              <summary className="mb-2 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] [&::-webkit-details-marker]:hidden">
                <span className="text-xs font-semibold">
                  {relativeDateLabel(group.key)}
                </span>
                <span className="app-muted-text text-[9px] font-medium">
                  {group.events.length} 条
                </span>
                <span className="h-px flex-1 bg-[var(--border-subtle)]" />
                <ChevronDown
                  className="app-muted-text transition-transform group-open:rotate-180"
                  size={15}
                  aria-hidden="true"
                />
              </summary>
              <div className="grid gap-3 pb-1 lg:grid-cols-2">
                {group.events.map((event) => (
                  <article
                    key={event.id}
                    className="app-card h-full rounded-2xl border px-4 py-4"
                  >
                    <div className="flex h-full items-start gap-3">
                      <span
                        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                        style={{
                          color: activePresentation.color,
                          backgroundColor: activePresentation.soft,
                        }}
                      >
                        <ActiveIcon size={17} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="text-[10px] font-semibold"
                            style={{ color: activePresentation.color }}
                          >
                            {event.status}
                          </span>
                          {event.durationSeconds != null &&
                            event.durationSeconds > 0 && (
                              <span className="rounded-full bg-[var(--surface-soft)] px-2 py-1 text-[9px] font-semibold">
                                有效学习 {formatLearningDuration(event.durationSeconds)}
                              </span>
                            )}
                          <span className="app-muted-text ml-auto text-[9px] font-medium">
                            <LocalDateTime
                              value={event.date}
                              options={LEARNING_RECORD_DATE_TIME_OPTIONS}
                            />
                          </span>
                        </div>
                        {event.subtitle && (
                          <p
                            className="mt-1.5 inline-flex px-0 py-1 text-[11px] font-semibold"
                            style={{
                              color: activePresentation.color,
                            }}
                          >
                            {event.subtitle}
                          </p>
                        )}
                        <h3
                          className={`${event.subtitle ? "mt-1" : "mt-1.5"} text-sm font-bold leading-5`}
                        >
                          {event.title}
                        </h3>
                        <p className="app-muted-text mt-1.5 whitespace-pre-wrap text-xs font-medium leading-5">
                          {event.description}
                        </p>
                        {event.nextAction && (
                          <p className="mt-3 border-l-2 border-[var(--status-success)] bg-[var(--status-success-surface)] px-3 py-2 text-xs font-medium leading-5">
                            下一步：{event.nextAction}
                          </p>
                        )}
                      </div>
                      {event.href && (
                        <Link
                          href={event.href}
                          className="mt-1 inline-flex min-h-8 shrink-0 items-center gap-1 text-[10px] font-semibold"
                          style={{ color: "var(--support)" }}
                        >
                          查看
                          <ArrowRight size={10} aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>

        {groupedEvents.length === 0 && !dataError && (
          <div className="app-card rounded-2xl border border-dashed p-10 text-center">
            <History className="mx-auto opacity-30" size={34} aria-hidden="true" />
            <h3 className="mt-3 font-bold">
              这段时间还没有{activePresentation.label}记录
            </h3>
            <p className="app-muted-text mt-2 text-xs font-medium">
              开始学习或完成相关活动后，记录会自动出现在这里。
            </p>
          </div>
        )}
      </section>

      <section className="app-soft-card flex items-center gap-3 rounded-2xl border p-4">
        <GraduationCap
          size={18}
          className="shrink-0 text-[var(--support)]"
          aria-hidden="true"
        />
        <p className="app-muted-text text-[10px] font-medium leading-5">
          学习记录用于回顾学习过程；具体作业和考试分数仍在“我的成绩”页面查看。
        </p>
      </section>
    </div>
  );
}
