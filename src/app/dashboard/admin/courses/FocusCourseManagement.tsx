import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileVideo2,
  FolderKanban,
  Languages,
  Layers3,
  ListChecks,
  Route,
  Sparkles,
} from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";

export type FocusCourseKind = "service" | "korean";

type FocusCategoryItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  courseCount: number;
  lessonCount: number;
  publishedCount: number;
  videoCount: number;
};

type FocusCourseItem = {
  id: string;
  title: string;
  description: string | null;
  levelLabel: string | null;
  isPublished: boolean;
  lessonCount: number;
  publishedCount: number;
  videoCount: number;
};

const focusConfig = {
  service: {
    eyebrow: "留学服务内容中枢",
    summary: "把规划、择校、材料、申请与签证串成清晰的服务路线。",
    actionLabel: "进入留学服务工作台",
    stages: ["需求诊断", "选校规划", "材料准备", "申请执行", "签证行前"],
    checklist: ["流程节点是否完整", "材料模板是否可下载", "风险提醒是否清楚"],
    Icon: ClipboardCheck,
    accent: "var(--app-accent)",
  },
  korean: {
    eyebrow: "韩语成长内容中枢",
    summary: "围绕基础、表达、能力考试与留学场景建立连续成长路径。",
    actionLabel: "进入韩语课程工作台",
    stages: ["发音基础", "词汇积累", "语法理解", "场景表达", "能力备考"],
    checklist: ["学习目标是否明确", "讲解与练习是否配套", "课后复盘是否可执行"],
    Icon: Languages,
    accent: "var(--app-secondary)",
  },
} satisfies Record<FocusCourseKind, unknown>;

function getPercent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / total) * 100));
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="app-soft-card rounded-2xl border p-4">
      <p className="app-muted-text text-xs font-bold">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      <p className="app-muted-text mt-1 text-xs">{hint}</p>
    </div>
  );
}

function ProgressLine({
  label,
  value,
  total,
  accent,
}: {
  label: string;
  value: number;
  total: number;
  accent: string;
}) {
  const percent = getPercent(value, total);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="app-muted-text font-bold">{label}</span>
        <span className="font-black">{value} / {total}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--app-border)" }}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${percent}%`, backgroundColor: accent }}
        />
      </div>
    </div>
  );
}

/**
 * 课程管理首页中的重点业务卡片。
 * 只用于留学服务课与韩语课，其他课程继续使用原有卡片。
 */
export function FocusCourseAdminCard({
  kind,
  title,
  description,
  categoryCount,
  courseCount,
  lessonCount,
  publishedCount,
  videoCount,
}: {
  kind: FocusCourseKind;
  title: string;
  description: string | null;
  categoryCount: number;
  courseCount: number;
  lessonCount: number;
  publishedCount: number;
  videoCount: number;
}) {
  const config = focusConfig[kind];
  const Icon = config.Icon;
  const readiness = Math.round(
    getPercent(publishedCount, lessonCount) * 0.6 +
      getPercent(videoCount, lessonCount) * 0.4
  );

  return (
    <article className="app-card group relative overflow-hidden rounded-[2rem] border p-5">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-15 blur-2xl"
        style={{ backgroundColor: config.accent }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{
                color: config.accent,
                backgroundColor: `color-mix(in srgb, ${config.accent} 14%, var(--app-card-bg))`,
              }}
            >
              <Icon size={28} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black tracking-[0.18em]" style={{ color: config.accent }}>
                {config.eyebrow}
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight">{title}</h3>
              <p className="app-muted-text mt-2 line-clamp-2 text-sm leading-6">
                {description || config.summary}
              </p>
            </div>
          </div>

          <span
            className="shrink-0 rounded-full px-3 py-1 text-xs font-black"
            style={{
              color: config.accent,
              backgroundColor: `color-mix(in srgb, ${config.accent} 12%, var(--app-card-bg))`,
            }}
          >
            完成度 {readiness}%
          </span>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <MetricCard label="课程结构" value={`${categoryCount} / ${courseCount}`} hint="分类 / 课程" />
          <MetricCard label="发布课时" value={publishedCount} hint={`共 ${lessonCount} 个课时`} />
          <MetricCard label="视频就绪" value={videoCount} hint="已绑定视频" />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          {config.stages.map((stage, index) => (
            <div key={stage} className="flex items-center gap-2 text-xs font-bold">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-white"
                style={{ backgroundColor: config.accent }}
              >
                {index + 1}
              </span>
              <span className="truncate">{stage}</span>
            </div>
          ))}
        </div>

        <Link
          href={`/dashboard/admin/courses/category/${kind}`}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ backgroundColor: config.accent }}
        >
          {config.actionLabel}
          <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}

/** 留学服务课与韩语课共用的一级分类工作台。 */
export function FocusCategoryAdminView({
  kind,
  title,
  description,
  items,
}: {
  kind: FocusCourseKind;
  title: string;
  description: string | null;
  items: FocusCategoryItem[];
}) {
  const config = focusConfig[kind];
  const Icon = config.Icon;
  const totalCourses = items.reduce((sum, item) => sum + item.courseCount, 0);
  const totalLessons = items.reduce((sum, item) => sum + item.lessonCount, 0);
  const totalPublished = items.reduce((sum, item) => sum + item.publishedCount, 0);
  const totalVideos = items.reduce((sum, item) => sum + item.videoCount, 0);

  return (
    <>
      <DashboardPageHeader title={`${title}管理`} description={description || config.summary} />

      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5">
        <Link href="/dashboard/admin/courses" className="app-muted-text inline-flex items-center gap-2 text-sm font-bold transition hover:opacity-70">
          <ArrowLeft size={16} />
          返回课程管理
        </Link>

        <section className="app-card relative overflow-hidden rounded-[2rem] border p-5 sm:p-6">
          <div
            className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full opacity-15 blur-3xl"
            style={{ backgroundColor: config.accent }}
          />
          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-end">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{ color: config.accent, backgroundColor: `color-mix(in srgb, ${config.accent} 12%, var(--app-card-bg))` }}
              >
                <Icon size={15} />
                {config.eyebrow}
              </div>
              <h2 className="mt-3 max-w-3xl text-2xl font-black tracking-tight">
                从分类到课时，一眼看清内容是否真正可用
              </h2>
              <p className="app-muted-text mt-2 max-w-2xl text-sm leading-6 sm:text-base">
                {description || config.summary} 管理重点不仅是“有内容”，还要同时检查发布状态、视频覆盖和学习闭环。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="二级分类" value={items.length} hint="成长路线节点" />
              <MetricCard label="具体课程" value={totalCourses} hint="可维护课程" />
              <MetricCard label="已发布课时" value={`${totalPublished}/${totalLessons}`} hint="学生当前可见" />
              <MetricCard label="视频覆盖" value={`${getPercent(totalVideos, totalLessons)}%`} hint={`${totalVideos} 个已就绪`} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xl font-black tracking-tight">内容路线</p>
                <p className="app-muted-text mt-1 text-sm">按实际学习或办理顺序维护每个分类。</p>
              </div>
              <span className="app-muted-text text-xs font-bold">共 {items.length} 个分类</span>
            </div>

            {items.length > 0 ? items.map((item, index) => {
              const publishRate = getPercent(item.publishedCount, item.lessonCount);
              const videoRate = getPercent(item.videoCount, item.lessonCount);
              const needsAttention = item.lessonCount === 0 || publishRate < 100 || videoRate < 80;

              return (
                <article key={item.id} className="app-card rounded-[1.75rem] border p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px_150px] lg:items-center">
                    <div className="flex items-start gap-4">
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white"
                        style={{ backgroundColor: config.accent }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black tracking-tight">{item.title}</h3>
                          <span className="app-soft-card rounded-full border px-2.5 py-1 text-xs font-black">
                            {item.courseCount} 门课程
                          </span>
                          {needsAttention ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
                              <CircleAlert size={12} />待完善
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                              <CheckCircle2 size={12} />内容就绪
                            </span>
                          )}
                        </div>
                        <p className="app-muted-text mt-2 line-clamp-2 text-sm leading-6">{item.description || "暂未填写分类说明。"}</p>
                      </div>
                    </div>

                    <div className="app-soft-card space-y-4 rounded-2xl border p-4">
                      <ProgressLine label="课时发布" value={item.publishedCount} total={item.lessonCount} accent={config.accent} />
                      <ProgressLine label="视频覆盖" value={item.videoCount} total={item.lessonCount} accent={config.accent} />
                    </div>

                    <Link
                      href={`/dashboard/admin/courses/category/${kind}/${item.slug}`}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                      style={{ backgroundColor: config.accent }}
                    >
                      管理课程<ArrowRight size={15} />
                    </Link>
                  </div>
                </article>
              );
            }) : (
              <div className="app-card rounded-[1.75rem] border border-dashed p-8 text-center">
                <FolderKanban className="mx-auto opacity-30" size={34} />
                <p className="mt-3 font-black">暂时没有二级分类</p>
                <p className="app-muted-text mt-1 text-sm">请先在数据库中建立课程路线。</p>
              </div>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <div className="app-card rounded-[1.75rem] border p-5">
              <div className="flex items-center gap-3">
                <div className="app-soft-card flex h-10 w-10 items-center justify-center rounded-xl border" style={{ color: config.accent }}>
                  <ListChecks size={20} />
                </div>
                <div>
                  <p className="font-black">发布前检查</p>
                  <p className="app-muted-text text-xs">重点业务内容标准</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {config.checklist.map((item) => (
                  <div key={item} className="app-soft-card flex items-center gap-3 rounded-2xl border p-3 text-sm font-bold">
                    <CheckCircle2 size={17} style={{ color: config.accent }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="app-soft-card rounded-[1.75rem] border p-5">
              <Sparkles size={22} style={{ color: config.accent }} />
              <p className="mt-3 font-black">建议维护顺序</p>
              <p className="app-muted-text mt-2 text-sm leading-6">先补齐空课时，再完善学习目标与正文，最后上传视频和配套资料。</p>
            </div>
          </aside>
        </section>
      </div>
    </>
  );
}

/** 留学服务课与韩语课共用的具体课程工作台。 */
export function FocusSubcategoryAdminView({
  kind,
  parentTitle,
  subcategoryTitle,
  description,
  courses,
}: {
  kind: FocusCourseKind;
  parentTitle: string;
  subcategoryTitle: string;
  description: string | null;
  courses: FocusCourseItem[];
}) {
  const config = focusConfig[kind];
  const totalLessons = courses.reduce((sum, course) => sum + course.lessonCount, 0);
  const totalPublished = courses.reduce((sum, course) => sum + course.publishedCount, 0);
  const totalVideos = courses.reduce((sum, course) => sum + course.videoCount, 0);

  return (
    <>
      <DashboardPageHeader title={`${subcategoryTitle}管理`} description={description || "集中管理课程结构、发布状态与视频内容。"} />

      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/dashboard/admin/courses/category/${kind}`} className="app-muted-text inline-flex items-center gap-2 text-sm font-bold transition hover:opacity-70">
            <ArrowLeft size={16} />返回{parentTitle}管理
          </Link>
          <span className="app-muted-text">/</span>
          <Link href="/dashboard/admin/courses" className="app-muted-text text-sm font-bold transition hover:opacity-70">课程管理</Link>
        </div>

        <section className="app-card overflow-hidden rounded-[2rem] border">
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: config.accent, backgroundColor: `color-mix(in srgb, ${config.accent} 12%, var(--app-card-bg))` }}>{parentTitle}</span>
                <span className="app-soft-card rounded-full border px-3 py-1.5 text-xs font-black">{subcategoryTitle}</span>
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight">课程内容生产台</h2>
              <p className="app-muted-text mt-3 max-w-2xl text-sm leading-6">{description || config.summary} 从这里进入每门课程，完成课时讲解、视频和资料的最后检查。</p>

              <div className="mt-6 flex flex-wrap gap-2">
                {config.stages.map((stage, index) => (
                  <span key={stage} className="app-soft-card inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold">
                    <span style={{ color: config.accent }}>{index + 1}</span>{stage}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="课程" value={courses.length} hint="当前分类" />
              <MetricCard label="课时" value={totalLessons} hint="全部内容单元" />
              <MetricCard label="发布率" value={`${getPercent(totalPublished, totalLessons)}%`} hint={`${totalPublished} 个已发布`} />
              <MetricCard label="视频率" value={`${getPercent(totalVideos, totalLessons)}%`} hint={`${totalVideos} 个已绑定`} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          {courses.length > 0 ? courses.map((course, index) => {
            const publishRate = getPercent(course.publishedCount, course.lessonCount);
            const videoRate = getPercent(course.videoCount, course.lessonCount);
            const score = Math.round(publishRate * 0.6 + videoRate * 0.4);

            return (
              <article key={course.id} className="app-card flex h-full flex-col rounded-[1.75rem] border p-5 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="app-soft-card flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border font-black" style={{ color: config.accent }}>
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        {course.levelLabel && <span className="app-soft-card rounded-full border px-2.5 py-1 text-xs font-black">{course.levelLabel}</span>}
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${course.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {course.isPublished ? "课程已发布" : "课程未发布"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-black tracking-tight">{course.title}</h3>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-black" style={{ color: config.accent }}>{score}</p>
                    <p className="app-muted-text text-xs font-bold">内容分</p>
                  </div>
                </div>

                <p className="app-muted-text mt-4 line-clamp-2 min-h-12 text-sm leading-6">{course.description || "暂未填写课程简介。"}</p>

                <div className="app-soft-card mt-5 space-y-4 rounded-2xl border p-4">
                  <ProgressLine label="课时发布" value={course.publishedCount} total={course.lessonCount} accent={config.accent} />
                  <ProgressLine label="视频覆盖" value={course.videoCount} total={course.lessonCount} accent={config.accent} />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="app-soft-card rounded-xl border p-2"><BookOpenCheck className="mx-auto mb-1" size={16} style={{ color: config.accent }} /><b>{course.lessonCount}</b><p className="app-muted-text mt-0.5">课时</p></div>
                  <div className="app-soft-card rounded-xl border p-2"><CheckCircle2 className="mx-auto mb-1" size={16} style={{ color: config.accent }} /><b>{course.publishedCount}</b><p className="app-muted-text mt-0.5">已发布</p></div>
                  <div className="app-soft-card rounded-xl border p-2"><FileVideo2 className="mx-auto mb-1" size={16} style={{ color: config.accent }} /><b>{course.videoCount}</b><p className="app-muted-text mt-0.5">视频</p></div>
                </div>

                <Link href={`/dashboard/admin/courses/${course.id}`} className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90" style={{ backgroundColor: config.accent }}>
                  进入课时工作台<ArrowRight size={15} />
                </Link>
              </article>
            );
          }) : (
            <div className="app-card col-span-full rounded-[1.75rem] border border-dashed p-8 text-center">
              <Layers3 className="mx-auto opacity-30" size={34} />
              <p className="mt-3 font-black">当前分类还没有课程</p>
              <p className="app-muted-text mt-1 text-sm">课程建立后会在这里显示内容完成度。</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/** 重点课程详情页顶部的内容健康度提示，只在两条重点业务线显示。 */
export function FocusCourseQualityPanel({
  kind,
  lessonCount,
  publishedCount,
  videoCount,
}: {
  kind: FocusCourseKind;
  lessonCount: number;
  publishedCount: number;
  videoCount: number;
}) {
  const config = focusConfig[kind];
  const publishRate = getPercent(publishedCount, lessonCount);
  const videoRate = getPercent(videoCount, lessonCount);

  return (
    <section className="app-card relative overflow-hidden rounded-[1.75rem] border p-4 sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
        <div className="flex items-start gap-4">
          <div className="app-soft-card flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border" style={{ color: config.accent }}>
            <Route size={23} />
          </div>
          <div>
            <p className="text-xs font-black tracking-[0.16em]" style={{ color: config.accent }}>重点内容健康度</p>
            <h2 className="mt-2 text-xl font-black">先补齐课时，再检查视频与学习闭环</h2>
            <p className="app-muted-text mt-2 text-sm leading-6">每个课时都应让学生知道“学什么、怎么学、学完做什么”。</p>
          </div>
        </div>
        <div className="app-soft-card grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
          <ProgressLine label="发布进度" value={publishedCount} total={lessonCount} accent={config.accent} />
          <ProgressLine label="视频进度" value={videoCount} total={lessonCount} accent={config.accent} />
        </div>
      </div>
      {(publishRate < 100 || videoRate < 80) && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
          <CircleAlert size={16} />
          当前内容仍有待完善项：发布率 {publishRate}%，视频覆盖率 {videoRate}%。
        </div>
      )}
    </section>
  );
}
