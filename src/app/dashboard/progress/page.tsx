import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  PlayCircle,
  TrendingUp,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { DashboardPageHeader } from "../DashboardPageHeader";

type ProgressRow = {
  lesson_id: string;
  course_id: string;
  status: string;
  progress_percent: number | null;
  completed_at: string | null;
  last_viewed_at: string | null;
};

type CourseRow = {
  id: string;
  title: string;
};

function toSeoulDateString(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default async function ProgressPage() {
  const { supabase, user } = await requireActiveUser();
  const { data: progressData } = await supabase
    .from("lesson_progress")
    .select("lesson_id, course_id, status, progress_percent, completed_at, last_viewed_at")
    .eq("user_id", user.id)
    .order("last_viewed_at", { ascending: false, nullsFirst: false });

  const progressRows = (progressData ?? []) as ProgressRow[];
  const courseIds = [...new Set(progressRows.map((row) => row.course_id))];
  const { data: courseData } = courseIds.length > 0
    ? await supabase.from("courses").select("id, title").in("id", courseIds)
    : { data: [] as CourseRow[] };
  const courseMap = new Map(
    ((courseData ?? []) as CourseRow[]).map((course) => [course.id, course])
  );

  const completedRows = progressRows.filter((row) => row.status === "completed");
  const inProgressRows = progressRows.filter((row) => row.status === "in_progress");
  const overallPercent = progressRows.length > 0
    ? Math.round(
        progressRows.reduce(
          (sum, row) => sum + (row.status === "completed" ? 100 : row.progress_percent ?? 0),
          0
        ) / progressRows.length
      )
    : 0;

  const completedDateSet = new Set(
    completedRows
      .filter((row) => row.completed_at)
      .map((row) => toSeoulDateString(new Date(row.completed_at as string)))
  );
  let streakDays = 0;
  const today = new Date();
  for (let offset = 0; offset < 365; offset++) {
    const cursor = new Date(today.getTime() - offset * 86400000);
    if (!completedDateSet.has(toSeoulDateString(cursor))) {
      if (offset === 0) continue;
      break;
    }
    streakDays += 1;
  }

  const courseProgress = courseIds.map((courseId) => {
    const rows = progressRows.filter((row) => row.course_id === courseId);
    const completed = rows.filter((row) => row.status === "completed").length;
    const percent = rows.length > 0
      ? Math.round(
          rows.reduce(
            (sum, row) => sum + (row.status === "completed" ? 100 : row.progress_percent ?? 0),
            0
          ) / rows.length
        )
      : 0;
    return {
      id: courseId,
      title: courseMap.get(courseId)?.title ?? "课程",
      completed,
      total: rows.length,
      percent,
    };
  });

  const activityDays = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today.getTime() - (13 - index) * 86400000);
    const dateString = toSeoulDateString(date);
    return {
      dateString,
      label: new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Seoul",
        weekday: "narrow",
      }).format(date),
      count: completedRows.filter(
        (row) => row.completed_at && toSeoulDateString(new Date(row.completed_at)) === dateString
      ).length,
    };
  });
  const maxActivity = Math.max(1, ...activityDays.map((day) => day.count));

  const stats = [
    { label: "总体进度", value: `${overallPercent}%`, icon: TrendingUp, color: "var(--app-accent)", soft: "var(--app-accent-soft)" },
    { label: "完成课时", value: completedRows.length, icon: CheckCircle2, color: "var(--app-success)", soft: "var(--app-success-soft)" },
    { label: "进行中", value: inProgressRows.length, icon: PlayCircle, color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
    { label: "连续学习", value: `${streakDays} 天`, icon: Flame, color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
  ];

  return (
    <>
      <DashboardPageHeader
        title="学习进度"
        description="用真实课程数据查看完成率、学习节奏和课程进展。"
        action={
          <Link href="/dashboard/courses" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}>
            继续学习 <ArrowRight size={15} aria-hidden="true" />
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="app-card rounded-[30px] border p-6 sm:p-8" style={{ background: "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg), var(--app-hero-end))" }}>
          <div className="grid items-center gap-6 lg:grid-cols-[1fr_300px]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>
                <BarChart3 size={14} aria-hidden="true" /> 学习成长报告
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight">你的每一节课，都在形成清晰的成长曲线</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 app-muted-text">进度来自已开始和已完成的真实课时，不使用虚拟成绩或占位数据。</p>
            </div>
            <div className="app-card rounded-3xl border p-5">
              <div className="flex items-end justify-between">
                <span className="text-xs font-bold app-muted-text">综合完成度</span>
                <strong className="text-3xl font-black" style={{ color: "var(--app-accent)" }}>{overallPercent}%</strong>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                <div className="h-full rounded-full" style={{ width: `${overallPercent}%`, background: "linear-gradient(90deg, var(--app-secondary), var(--app-accent))" }} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="app-card rounded-2xl border p-4 sm:p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ color: item.color, backgroundColor: item.soft }}><Icon size={19} aria-hidden="true" /></span>
                <p className="mt-4 text-xs font-bold app-muted-text">{item.label}</p>
                <p className="mt-1 text-2xl font-black">{item.value}</p>
              </article>
            );
          })}
        </section>

        <div className="grid gap-6 xl:grid-cols-12">
          <section className="app-card rounded-3xl border p-5 sm:p-6 xl:col-span-7">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="text-lg font-black">课程进展</h2><p className="mt-1 text-xs app-muted-text">按已经学习过的课程汇总</p></div>
              <BookOpen size={20} style={{ color: "var(--app-secondary)" }} aria-hidden="true" />
            </div>
            {courseProgress.length > 0 ? (
              <div className="space-y-3">
                {courseProgress.map((course) => (
                  <article key={course.id} className="app-soft-card rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-3"><h3 className="truncate text-sm font-black">{course.title}</h3><strong style={{ color: "var(--app-accent)" }}>{course.percent}%</strong></div>
                    <p className="mt-1 text-xs app-muted-text">已完成 {course.completed} / {course.total} 个学习课时</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-card-bg)" }}><div className="h-full rounded-full" style={{ width: `${course.percent}%`, background: "linear-gradient(90deg, var(--app-secondary), var(--app-accent))" }} /></div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="app-soft-card flex min-h-52 flex-col items-center justify-center rounded-2xl border p-6 text-center"><BookOpen size={24} style={{ color: "var(--app-secondary)" }} /><p className="mt-3 text-sm font-black">还没有学习记录</p><p className="mt-1 text-xs app-muted-text">开始第一节课后，进度会自动出现在这里。</p></div>
            )}
          </section>

          <section className="app-card rounded-3xl border p-5 sm:p-6 xl:col-span-5">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-black">近两周节奏</h2><p className="mt-1 text-xs app-muted-text">每天完成的课时数量</p></div><CalendarDays size={20} style={{ color: "var(--app-success)" }} /></div>
            <div className="flex h-48 items-end gap-1.5">
              {activityDays.map((day) => (
                <div key={day.dateString} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <div className="flex h-36 w-full items-end rounded-lg" style={{ backgroundColor: "var(--app-soft-bg)" }}><div title={`${day.dateString}：${day.count} 个课时`} className="w-full rounded-lg" style={{ height: day.count ? `${Math.max(20, (day.count / maxActivity) * 100)}%` : "5%", backgroundColor: day.count ? "var(--app-success)" : "var(--app-border)" }} /></div>
                  <span className="text-[9px] font-bold app-muted-text">{day.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold app-muted-text" style={{ backgroundColor: "var(--app-success-soft)" }}><Clock3 size={14} /> 完成课时后，图表会自动更新。</p>
          </section>
        </div>
      </div>
    </>
  );
}
