"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
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
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { LEARNING_RECORD_DATE_TIME_OPTIONS } from "./config";

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
  isToday: boolean;
};

type Summary = {
  todaySeconds: number;
  weekSeconds: number;
  streakDays: number;
  completedCount: number;
};

type HeatmapDay = LearningDay & {
  level: 0 | 1 | 2 | 3 | 4;
};

const categoryPresentation = {
  course: {
    label: "课程学习",
    shortLabel: "电子书与课时",
    icon: BookOpenCheck,
    color: "var(--app-accent)",
    soft: "var(--app-accent-soft)",
  },
  task: {
    label: "作业考试",
    shortLabel: "提交与批改",
    icon: FilePenLine,
    color: "var(--app-secondary)",
    soft: "var(--app-secondary-soft)",
  },
  practice: {
    label: "练习工具",
    shortLabel: "会话与专项练习",
    icon: MessageCircleMore,
    color: "var(--app-success)",
    soft: "var(--app-success-soft)",
  },
  teacher: {
    label: "老师评价",
    shortLabel: "反馈与下一步",
    icon: NotebookPen,
    color: "var(--app-warm)",
    soft: "var(--app-warm-soft)",
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

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateLabelFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  weekday: "short",
});

function dateKey(value: string | Date) {
  const parts = dateKeyFormatter.formatToParts(
    typeof value === "string" ? new Date(value) : value,
  );
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return `${seconds} 秒`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} 分钟`;
  return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}

function relativeDateLabel(key: string) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === dateKey(today)) return "今天";
  if (key === dateKey(yesterday)) return "昨天";
  return dateLabelFormatter.format(new Date(`${key}T12:00:00+09:00`));
}

function activityLevel(seconds: number): HeatmapDay["level"] {
  if (seconds <= 0) return 0;
  if (seconds < 10 * 60) return 1;
  if (seconds < 30 * 60) return 2;
  if (seconds < 60 * 60) return 3;
  return 4;
}

function heatmapDateLabel(key: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${key}T12:00:00+09:00`));
}

function buildHeatmapWeeks(days: LearningDay[]) {
  if (days.length === 0) return [] as Array<Array<HeatmapDay | null>>;
  const daysByKey = new Map(days.map((day) => [day.key, day]));
  const first = new Date(`${days[0].key}T12:00:00+09:00`);
  const last = new Date(`${days.at(-1)?.key}T12:00:00+09:00`);
  const cursor = new Date(first);
  const mondayOffset = (cursor.getDay() + 6) % 7;
  cursor.setDate(cursor.getDate() - mondayOffset);
  const end = new Date(last);
  end.setDate(end.getDate() + ((7 - ((end.getDay() + 6) % 7) - 1) % 7));
  const weeks: Array<Array<HeatmapDay | null>> = [];

  while (cursor <= end) {
    const week: Array<HeatmapDay | null> = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const key = dateKey(cursor);
      const day = daysByKey.get(key);
      week.push(day ? { ...day, level: activityLevel(day.seconds) } : null);
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
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
  const [category, setCategory] = useState<LearningRecordCategory>("course");
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateGroupOpen, setDateGroupOpen] = useState<Record<string, boolean>>(
    {},
  );
  const categoryCounts = useMemo(
    () => ({
      course: events.filter((event) => event.category === "course").length,
      task: events.filter((event) => event.category === "task").length,
      practice: events.filter((event) => event.category === "practice").length,
      teacher: events.filter((event) => event.category === "teacher").length,
    }),
    [events],
  );
  const cutoff = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - (rangeDays - 1));
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, [rangeDays]);
  const filteredEvents = events.filter(
    (event) =>
      event.category === category &&
      (selectedDate
        ? dateKey(event.date) === selectedDate
        : new Date(event.date).getTime() >= cutoff),
  );
  const groupedEvents = filteredEvents.reduce<
    Array<{ key: string; events: LearningRecordEvent[] }>
  >((groups, event) => {
    const key = dateKey(event.date);
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
  const heatmapWeeks = useMemo(
    () => buildHeatmapWeeks(learningDays),
    [learningDays],
  );
  const yearSeconds = learningDays.reduce(
    (sum, day) => sum + day.seconds,
    0,
  );
  const activeLearningDays = learningDays.filter((day) => day.seconds > 0).length;
  const selectedDay = selectedDate
    ? learningDays.find((day) => day.key === selectedDate)
    : undefined;
  const analysis = useMemo(() => {
    const recent30 = learningDays.slice(-30);
    const recent14 = learningDays.slice(-14);
    const recent7 = recent14.slice(-7);
    const previous7 = recent14.slice(0, 7);
    const recent90 = learningDays.slice(-90);
    const total = (days: LearningDay[]) =>
      days.reduce((sum, day) => sum + day.seconds, 0);
    const activeCount = (days: LearningDay[]) =>
      days.filter((day) => day.seconds > 0).length;
    const recent30Seconds = total(recent30);
    const recent30ActiveDays = activeCount(recent30);
    const recent7Seconds = total(recent7);
    const previous7Seconds = total(previous7);
    const recent7ActiveDays = activeCount(recent7);
    const averageActiveDaySeconds = recent30ActiveDays
      ? Math.round(recent30Seconds / recent30ActiveDays)
      : 0;

    let longestStreak = 0;
    let runningStreak = 0;
    for (const day of learningDays) {
      if (day.seconds > 0) {
        runningStreak += 1;
        longestStreak = Math.max(longestStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    }

    const weekdaySeconds = new Map<string, number>();
    for (const day of recent90) {
      const weekday = new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Seoul",
        weekday: "long",
      }).format(new Date(`${day.key}T12:00:00+09:00`));
      weekdaySeconds.set(
        weekday,
        (weekdaySeconds.get(weekday) ?? 0) + day.seconds,
      );
    }
    const bestWeekdayEntry = [...weekdaySeconds.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    const bestWeekday =
      bestWeekdayEntry && bestWeekdayEntry[1] > 0
        ? bestWeekdayEntry[0]
        : "暂无";

    const eventCutoffKey = recent30[0]?.key;
    const recentEvents = eventCutoffKey
      ? events.filter((event) => dateKey(event.date) >= eventCutoffKey)
      : [];
    const categoryActivity = (
      Object.keys(categoryPresentation) as LearningRecordCategory[]
    )
      .map((key) => ({
        key,
        count: recentEvents.filter((event) => event.category === key).length,
      }))
      .sort((a, b) => b.count - a.count);
    const focusCategory = categoryActivity[0]?.count
      ? categoryPresentation[categoryActivity[0].key].label
      : "暂无";

    const trendDelta = recent7Seconds - previous7Seconds;
    const comparison =
      recent7Seconds === 0 && previous7Seconds === 0
        ? "最近两周暂无有效学习"
        : previous7Seconds === 0
          ? "本周开始形成新的学习积累"
          : trendDelta === 0
            ? "与前 7 天投入持平"
            : `较前 7 天${trendDelta > 0 ? "增加" : "减少"} ${formatDuration(Math.abs(trendDelta))}`;

    const pace =
      recent7ActiveDays >= 5
        ? { label: "节奏稳定", tone: "success" as const }
        : recent7ActiveDays >= 3
          ? { label: "正在形成", tone: "accent" as const }
          : recent7ActiveDays > 0
            ? { label: "需要加强", tone: "warm" as const }
            : { label: "尚未开始", tone: "muted" as const };
    const suggestion =
      recent7ActiveDays === 0
        ? "先从一次 10 分钟的有效学习开始，重新建立学习节奏。"
        : recent7ActiveDays < 3
          ? "下一步先把每周有效学习提高到 3 天，频率比单次学很久更重要。"
          : trendDelta < 0
            ? "本周投入有所回落，建议固定一个容易坚持的学习时段。"
            : recent7ActiveDays < 5
              ? "当前节奏已经形成，可以尝试增加 1 个学习日来提升稳定性。"
              : "当前学习节奏稳定，继续保持，并及时完成对应章节的练习与测试。";

    const achievements = [
      {
        label: "近一年学习日",
        value: `${activeCount(learningDays)} 天`,
      },
      { label: "最长连续", value: `${longestStreak} 天` },
      { label: "完成课时", value: `${summary.completedCount} 个` },
    ];

    return {
      recent30Seconds,
      recent30ActiveDays,
      averageActiveDaySeconds,
      recent7Seconds,
      previous7Seconds,
      trendDelta,
      comparison,
      pace,
      bestWeekday,
      focusCategory,
      suggestion,
      achievements,
      sampleLimited: recent30ActiveDays < 3,
    };
  }, [events, learningDays, summary.completedCount]);
  const analysisPaceColor =
    analysis.pace.tone === "success"
      ? "var(--app-success)"
      : analysis.pace.tone === "accent"
        ? "var(--app-accent)"
        : analysis.pace.tone === "warm"
          ? "var(--app-warm)"
          : "var(--app-muted)";
  const analysisPaceSoft =
    analysis.pace.tone === "success"
      ? "var(--app-success-soft)"
      : analysis.pace.tone === "accent"
        ? "var(--app-accent-soft)"
        : analysis.pace.tone === "warm"
          ? "var(--app-warm-soft)"
          : "var(--app-soft-bg)";

  return (
    <div className="space-y-5">
      <section
        className="app-card overflow-hidden rounded-[2rem] border p-5 sm:p-6"
        style={{
          background:
            "linear-gradient(130deg, var(--app-hero-end), var(--app-card-bg) 56%, var(--app-accent-soft))",
        }}
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-xl">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
              style={{
                color: "var(--app-accent)",
                backgroundColor: "var(--app-accent-soft)",
              }}
            >
              <Sparkles size={14} />
              我的学习档案
            </span>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              看见每一天的学习积累
            </h1>
            <p className="app-muted-text mt-2 text-sm font-bold leading-6">
              学习时长来自数据库记录的有效学习行为，切换页面或刷新不会重新估算。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[620px]">
            {[
              ["今日学习", formatDuration(summary.todaySeconds), Clock3, "var(--app-accent)", "var(--app-accent-soft)"],
              ["本周学习", formatDuration(summary.weekSeconds), CalendarDays, "var(--app-secondary)", "var(--app-secondary-soft)"],
              ["连续学习", `${summary.streakDays} 天`, Flame, "var(--app-warm)", "var(--app-warm-soft)"],
              ["完成课时", `${summary.completedCount} 个`, CheckCircle2, "var(--app-success)", "var(--app-success-soft)"],
            ].map(([label, value, Icon, color, soft]) => {
              const MetricIcon = Icon as typeof Clock3;
              return (
                <div
                  key={String(label)}
                  className="app-card flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-3"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ color: String(color), backgroundColor: String(soft) }}
                  >
                    <MetricIcon size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{String(value)}</p>
                    <p className="app-muted-text mt-1 text-[10px] font-black">
                      {String(label)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {dataError && (
        <section
          className="rounded-2xl border p-4 text-sm font-bold"
          style={{
            color: "var(--app-warm)",
            backgroundColor: "var(--app-warm-soft)",
          }}
        >
          部分学习记录暂时无法读取，请稍后刷新。
        </section>
      )}

      {latestTeacherNote?.nextAction && (
        <section
          className="app-card rounded-3xl border p-5"
          style={{ borderColor: "var(--app-warm)" }}
        >
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}
            >
              <Target size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black" style={{ color: "var(--app-warm)" }}>
                老师给你的下一步建议
              </p>
              <h2 className="mt-1 text-sm font-black">{latestTeacherNote.title}</h2>
              <p className="app-muted-text mt-2 whitespace-pre-wrap text-xs leading-6">
                {latestTeacherNote.nextAction}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCategory("teacher")}
              className="shrink-0 text-[10px] font-black"
              style={{ color: "var(--app-secondary)" }}
            >
              查看评价
            </button>
          </div>
        </section>
      )}

      <section className="app-card overflow-hidden rounded-3xl border">
        <div className="flex flex-col gap-4 border-b border-[var(--app-border-soft)] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  color: "var(--app-success)",
                  backgroundColor: "var(--app-success-soft)",
                }}
              >
                <CalendarDays size={17} />
              </span>
              <div>
                <h2 className="text-base font-black">全年学习足迹</h2>
                <p className="app-muted-text mt-0.5 text-[10px] font-bold">
                  每一个方格，都是一次真实的有效学习积累
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black">
            <span className="rounded-full bg-[var(--app-success-soft)] px-3 py-1.5 text-[var(--app-success)]">
              学习 {activeLearningDays} 天
            </span>
            <span className="rounded-full bg-[var(--app-soft-bg)] px-3 py-1.5">
              累计 {formatDuration(yearSeconds)}
            </span>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[790px]">
              <div className="mb-2 ml-8 flex gap-[3px]">
                {heatmapWeeks.map((week, weekIndex) => {
                  const firstDay = week.find((day) => day !== null);
                  const previousDay = heatmapWeeks[weekIndex - 1]?.find(
                    (day) => day !== null,
                  );
                  const currentMonth = firstDay?.key.slice(5, 7);
                  const previousMonth = previousDay?.key.slice(5, 7);
                  const showMonth = Boolean(
                    firstDay &&
                      (weekIndex === 0 || currentMonth !== previousMonth),
                  );
                  return (
                    <span
                      key={`month:${weekIndex}`}
                      className="w-3 shrink-0 text-[9px] font-black text-[var(--app-muted)]"
                    >
                      {showMonth ? `${Number(currentMonth)}月` : ""}
                    </span>
                  );
                })}
              </div>
              <div className="flex items-start gap-2">
                <div className="grid w-6 shrink-0 grid-rows-7 gap-[3px] pt-[15px] text-[8px] font-bold text-[var(--app-muted)]">
                  <span />
                  <span>二</span>
                  <span />
                  <span>四</span>
                  <span />
                  <span>六</span>
                  <span />
                </div>
                <div className="flex gap-[3px]">
                  {heatmapWeeks.map((week, weekIndex) => (
                    <div
                      key={`week:${weekIndex}`}
                      className="grid grid-rows-7 gap-[3px]"
                    >
                      {week.map((day, weekdayIndex) =>
                        day ? (
                          <button
                            key={day.key}
                            type="button"
                            title={`${heatmapDateLabel(day.key)} · ${day.seconds > 0 ? `有效学习 ${formatDuration(day.seconds)}` : "暂无学习记录"}`}
                            aria-label={`${heatmapDateLabel(day.key)}，${day.seconds > 0 ? `有效学习 ${formatDuration(day.seconds)}` : "暂无学习记录"}`}
                            aria-pressed={selectedDate === day.key}
                            onClick={() => {
                              setSelectedDate((current) =>
                                current === day.key ? null : day.key,
                              );
                              const firstEvent = events.find(
                                (event) => dateKey(event.date) === day.key,
                              );
                              if (firstEvent) setCategory(firstEvent.category);
                            }}
                            className="h-3 w-3 rounded-[3px] border transition hover:scale-125 hover:ring-2 hover:ring-[var(--app-success-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-success)]"
                            style={{
                              backgroundColor:
                                day.level === 0
                                  ? "var(--app-soft-bg)"
                                  : day.level === 1
                                    ? "color-mix(in srgb, var(--app-success) 24%, var(--app-card-bg))"
                                    : day.level === 2
                                      ? "color-mix(in srgb, var(--app-success) 48%, var(--app-card-bg))"
                                      : day.level === 3
                                        ? "color-mix(in srgb, var(--app-success) 72%, var(--app-card-bg))"
                                        : "var(--app-success)",
                              borderColor:
                                selectedDate === day.key
                                  ? "var(--app-text)"
                                  : "transparent",
                              boxShadow:
                                selectedDate === day.key
                                  ? "0 0 0 2px var(--app-card-bg), 0 0 0 3px var(--app-success)"
                                  : undefined,
                            }}
                          />
                        ) : (
                          <span
                            key={`empty:${weekIndex}:${weekdayIndex}`}
                            className="h-3 w-3"
                          />
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border-soft)] pt-4">
            <p className="app-muted-text text-[10px] font-bold">
              {selectedDay
                ? `${heatmapDateLabel(selectedDay.key)} · ${selectedDay.seconds > 0 ? `有效学习 ${formatDuration(selectedDay.seconds)}` : "暂无有效学习"}`
                : "点击日期方格，可查看当天的详细学习记录"}
            </p>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--app-muted)]">
              <span>少</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <span
                  key={level}
                  className="h-3 w-3 rounded-[3px]"
                  style={{
                    backgroundColor:
                      level === 0
                        ? "var(--app-soft-bg)"
                        : `color-mix(in srgb, var(--app-success) ${level * 24}%, var(--app-card-bg))`,
                  }}
                />
              ))}
              <span>多</span>
            </div>
          </div>
        </div>
      </section>

      <section className="app-card overflow-hidden rounded-3xl border">
        <div className="flex flex-col gap-3 border-b border-[var(--app-border-soft)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                color: "var(--app-secondary)",
                backgroundColor: "var(--app-secondary-soft)",
              }}
            >
              <BrainCircuit size={19} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black">学习分析与成果</h2>
                <span
                  className="rounded-full px-2.5 py-1 text-[9px] font-black"
                  style={{
                    color: analysisPaceColor,
                    backgroundColor: analysisPaceSoft,
                  }}
                >
                  {analysis.pace.label}
                </span>
              </div>
              <p className="app-muted-text mt-1 text-[10px] font-bold">
                基于最近 30 天有效时长，并参考近一年学习连续性
              </p>
            </div>
          </div>
          {analysis.sampleLimited && (
            <span className="rounded-full bg-[var(--app-warm-soft)] px-3 py-1.5 text-[9px] font-black text-[var(--app-warm)]">
              当前数据较少，持续学习后分析会更准确
            </span>
          )}
        </div>

        <div className="grid gap-3 p-5 sm:p-6 lg:grid-cols-12">
          <article
            className="relative overflow-hidden rounded-3xl border p-5 lg:col-span-5"
            style={{
              borderColor: analysisPaceColor,
              background:
                "linear-gradient(140deg, var(--app-card-bg), var(--app-hero-end))",
            }}
          >
            <span
              aria-hidden="true"
              className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-50"
              style={{ backgroundColor: analysisPaceSoft }}
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="app-muted-text text-[10px] font-black">
                    最近 7 天学习状态
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight">
                    {formatDuration(analysis.recent7Seconds)}
                  </p>
                  <p
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black"
                    style={{
                      color:
                        analysis.trendDelta > 0
                          ? "var(--app-success)"
                          : analysis.trendDelta < 0
                            ? "var(--app-warm)"
                            : "var(--app-muted)",
                    }}
                  >
                    {analysis.trendDelta > 0 ? (
                      <TrendingUp size={13} />
                    ) : analysis.trendDelta < 0 ? (
                      <TrendingDown size={13} />
                    ) : (
                      <BarChart3 size={13} />
                    )}
                    {analysis.comparison}
                  </p>
                </div>
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    color: analysisPaceColor,
                    backgroundColor: analysisPaceSoft,
                  }}
                >
                  <BarChart3 size={20} />
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-[var(--app-card-bg)]/80 px-3 py-3">
                  <p className="app-muted-text text-[9px] font-black">
                    近 30 天有效学习
                  </p>
                  <p className="mt-1 text-sm font-black">
                    {formatDuration(analysis.recent30Seconds)}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--app-card-bg)]/80 px-3 py-3">
                  <p className="app-muted-text text-[9px] font-black">
                    近 30 天活跃
                  </p>
                  <p className="mt-1 text-sm font-black">
                    {analysis.recent30ActiveDays} 天
                  </p>
                </div>
              </div>
            </div>
          </article>

          <div className="grid gap-3 sm:grid-cols-3 lg:col-span-7">
            {[
              {
                label: "平均学习日投入",
                value:
                  analysis.averageActiveDaySeconds > 0
                    ? formatDuration(analysis.averageActiveDaySeconds)
                    : "暂无",
                hint: "仅计算有有效学习的日期",
                icon: Clock3,
                color: "var(--app-accent)",
                soft: "var(--app-accent-soft)",
              },
              {
                label: "最常学习日",
                value: analysis.bestWeekday,
                hint: "根据最近 90 天累计时长",
                icon: CalendarDays,
                color: "var(--app-success)",
                soft: "var(--app-success-soft)",
              },
              {
                label: "主要学习活动",
                value: analysis.focusCategory,
                hint: "根据最近 30 天学习记录",
                icon: Target,
                color: "var(--app-warm)",
                soft: "var(--app-warm-soft)",
              },
            ].map((item) => {
              const ItemIcon = item.icon;
              return (
                <article
                  key={item.label}
                  className="rounded-3xl border border-[var(--app-border-soft)] bg-[var(--app-card-bg)] p-4"
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ color: item.color, backgroundColor: item.soft }}
                  >
                    <ItemIcon size={16} />
                  </span>
                  <p className="app-muted-text mt-4 text-[9px] font-black">
                    {item.label}
                  </p>
                  <p className="mt-1 text-base font-black">{item.value}</p>
                  <p className="app-muted-text mt-1.5 text-[9px] font-bold leading-4">
                    {item.hint}
                  </p>
                </article>
              );
            })}
          </div>

          <article className="rounded-3xl border border-[var(--app-border-soft)] bg-[var(--app-soft-bg)] p-5 lg:col-span-7">
            <div className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  color: "var(--app-secondary)",
                  backgroundColor: "var(--app-secondary-soft)",
                }}
              >
                <BrainCircuit size={16} />
              </span>
              <div>
                <p className="text-[10px] font-black text-[var(--app-secondary)]">
                  下一步建议
                </p>
                <p className="mt-1.5 text-sm font-black leading-6">
                  {analysis.suggestion}
                </p>
                <p className="app-muted-text mt-2 text-[9px] font-bold">
                  建议会随着有效学习记录自动更新
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-[var(--app-border-soft)] bg-[var(--app-card-bg)] p-5 lg:col-span-5">
            <div className="flex items-center gap-2">
              <Trophy size={17} className="text-[var(--app-warm)]" />
              <h3 className="text-sm font-black">我的学习成果</h3>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {analysis.achievements.map((achievement, index) => (
                <div
                  key={achievement.label}
                  className="rounded-2xl bg-[var(--app-soft-bg)] px-2 py-3 text-center"
                >
                  {index === 0 ? (
                    <CalendarDays
                      size={14}
                      className="mx-auto text-[var(--app-success)]"
                    />
                  ) : index === 1 ? (
                    <Award
                      size={14}
                      className="mx-auto text-[var(--app-warm)]"
                    />
                  ) : (
                    <CheckCircle2
                      size={14}
                      className="mx-auto text-[var(--app-accent)]"
                    />
                  )}
                  <p className="mt-2 text-sm font-black">
                    {achievement.value}
                  </p>
                  <p className="app-muted-text mt-1 text-[8px] font-black">
                    {achievement.label}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="px-1 py-1">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black tracking-tight">学习全景</h2>
            <p className="app-muted-text mt-1 text-xs font-bold">
              从课程、任务、练习和老师反馈四个方面回顾学习
            </p>
          </div>
          <p className="app-muted-text text-xs font-black">共 {events.length} 条</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:auto-rows-[116px] lg:grid-cols-12">
          {(Object.keys(categoryPresentation) as LearningRecordCategory[]).map((key) => {
            const item = categoryPresentation[key];
            const Icon = item.icon;
            const active = category === key;
            const categoryEvents = events.filter(
              (event) => event.category === key,
            );
            const categoryDuration = categoryEvents.reduce(
              (sum, event) => sum + (event.durationSeconds ?? 0),
              0,
            );
            const latestEvent = categoryEvents[0];
            const layoutClass = {
              course: "lg:col-span-5 lg:row-span-2",
              task: "lg:col-span-3",
              practice: "lg:col-span-4",
              teacher: "lg:col-span-7",
            }[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setCategory(key);
                  setSelectedDate(null);
                }}
                aria-pressed={active}
                className={`${layoutClass} group relative flex min-h-28 w-full overflow-hidden rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md`}
                style={{
                  backgroundColor: active ? item.soft : "var(--app-card-bg)",
                  borderColor: active ? item.color : "var(--app-border-soft)",
                  boxShadow: active ? `0 0 0 1px ${item.color}` : undefined,
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute -bottom-7 -right-5 h-24 w-24 rounded-full opacity-40 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: item.soft }}
                />
                <span className="relative flex h-full w-full flex-col">
                  <span className="flex items-start justify-between gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ color: item.color, backgroundColor: item.soft }}
                    >
                      <Icon size={18} />
                    </span>
                    <span
                      className="text-2xl font-black tabular-nums"
                      style={{ color: item.color }}
                    >
                      {categoryCounts[key]}
                    </span>
                  </span>
                  <span className="mt-3 block text-base font-black">
                    {item.label}
                  </span>
                  <span className="app-muted-text mt-0.5 block text-[10px] font-bold">
                    {item.shortLabel}
                    {categoryDuration > 0
                      ? ` · ${formatDuration(categoryDuration)}`
                      : ""}
                  </span>
                  {key === "course" && latestEvent && (
                    <span className="mt-auto rounded-2xl bg-[var(--app-card-bg)]/80 px-3 py-2.5">
                      <span className="app-muted-text block text-[9px] font-black">
                        最近学习
                      </span>
                      <span className="mt-1 block truncate text-xs font-black">
                        {latestEvent.title}
                      </span>
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ color: activePresentation.color, backgroundColor: activePresentation.soft }}
            >
              <ActiveIcon size={15} />
            </span>
            <div>
              <h3 className="text-sm font-black">
                {selectedDate
                  ? `${heatmapDateLabel(selectedDate)}的${activePresentation.label}`
                  : activePresentation.label}
              </h3>
              <p className="app-muted-text text-[10px] font-bold">
                {selectedDate ? "来自上方学习足迹的日期筛选" : "按日期分组显示"}
              </p>
            </div>
          </div>
          {selectedDate ? (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="rounded-xl bg-[var(--app-soft-bg)] px-3 py-2 text-[10px] font-black"
              style={{ color: activePresentation.color }}
            >
              清除日期筛选
            </button>
          ) : (
            <div className="flex rounded-xl bg-[var(--app-soft-bg)] p-1">
              {([7, 30, 90] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    setRangeDays(days);
                    setSelectedDate(null);
                  }}
                  className="rounded-lg px-3 py-1.5 text-[10px] font-black transition"
                  style={{
                    color:
                      rangeDays === days
                        ? activePresentation.color
                        : "var(--app-muted)",
                    backgroundColor:
                      rangeDays === days
                        ? "var(--app-card-bg)"
                        : "transparent",
                  }}
                >
                  {days} 天
                </button>
              ))}
            </div>
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
              <summary className="mb-2 flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-[var(--app-soft-bg)] [&::-webkit-details-marker]:hidden">
                <span className="text-xs font-black">{relativeDateLabel(group.key)}</span>
                <span className="app-muted-text text-[9px] font-bold">{group.events.length} 条</span>
                <span className="h-px flex-1 bg-[var(--app-border-soft)]" />
                <ChevronDown className="app-muted-text transition-transform group-open:rotate-180" size={15} />
              </summary>
              <div className="grid gap-2 pb-1 md:grid-cols-2 xl:grid-cols-4">
                {group.events.map((event) => (
                  <article key={event.id} className="app-card h-full rounded-2xl border px-4 py-4">
                    <div className="flex h-full items-start gap-3">
                      <span
                        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ color: activePresentation.color, backgroundColor: activePresentation.soft }}
                      >
                        <ActiveIcon size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black" style={{ color: activePresentation.color }}>
                            {event.status}
                          </span>
                          {event.durationSeconds != null && event.durationSeconds > 0 && (
                            <span className="rounded-full bg-[var(--app-soft-bg)] px-2 py-1 text-[9px] font-black">
                              有效学习 {formatDuration(event.durationSeconds)}
                            </span>
                          )}
                          <span className="app-muted-text ml-auto text-[9px] font-bold">
                            <LocalDateTime value={event.date} options={LEARNING_RECORD_DATE_TIME_OPTIONS} />
                          </span>
                        </div>
                        {event.subtitle && (
                          <p
                            className="mt-1.5 inline-flex rounded-md px-2 py-1 text-[11px] font-black"
                            style={{
                              color: activePresentation.color,
                              backgroundColor: activePresentation.soft,
                            }}
                          >
                            {event.subtitle}
                          </p>
                        )}
                        <h4
                          className={`${event.subtitle ? "mt-1" : "mt-1.5"} text-sm font-black leading-5`}
                        >
                          {event.title}
                        </h4>
                        <p className="app-muted-text mt-1.5 whitespace-pre-wrap text-xs leading-5">
                          {event.description}
                        </p>
                        {event.nextAction && (
                          <p
                            className="mt-3 rounded-xl px-3 py-2.5 text-xs font-bold leading-5"
                            style={{ backgroundColor: "var(--app-success-soft)" }}
                          >
                            下一步：{event.nextAction}
                          </p>
                        )}
                      </div>
                      {event.href && (
                        <Link
                          href={event.href}
                          className="mt-1 inline-flex shrink-0 items-center gap-1 text-[10px] font-black"
                          style={{ color: "var(--app-secondary)" }}
                        >
                          查看
                          <ArrowRight size={10} />
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
          <div className="app-card rounded-3xl border border-dashed p-10 text-center">
            <History className="mx-auto opacity-30" size={34} />
            <h3 className="mt-3 font-black">这段时间还没有{activePresentation.label}记录</h3>
            <p className="app-muted-text mt-2 text-xs">
              开始学习或完成相关活动后，记录会自动出现在这里。
            </p>
          </div>
        )}
      </section>

      <section className="app-soft-card flex items-center gap-3 rounded-2xl border p-4">
        <GraduationCap size={18} className="shrink-0 text-[var(--app-secondary)]" />
        <p className="app-muted-text text-[10px] font-bold leading-5">
          学习记录用于帮助你回顾学习过程；具体作业和考试分数请在“成绩”页面查看。
        </p>
      </section>
    </div>
  );
}
