import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarClock,
  Calculator,
  CheckCircle2,
  CircleAlert,
  Clock3,
  GraduationCap,
  Languages,
  MessageSquareText,
  PlayCircle,
} from "lucide-react";
import { redirect } from "next/navigation";

import { ProfileContent } from "@/app/dashboard/profile/page-content";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import {
  loadAbilityPortrait,
  type AbilityPortraitData,
} from "@/features/student-ability-portrait/api/service";
import {
  loadPortalHomeLearningSummary,
  selectPortalHomeLearningSummary,
  type PortalHomeLearningSummary,
} from "@/features/student-home-learning/api/service";
import type { HomeLearningTask } from "@/features/student-home-learning/api/types";
import { getCourseLearningPath } from "@/features/student-home-learning/routes";
import { requireDashboardAccess } from "@/lib/dashboard-access";
import { getPublishedAnnouncementsForTenant } from "@/lib/published-tenant-content";
import {
  MEMBERSHIP_TIER_LABELS,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import {
  withStudentAppSchemaFallback,
} from "@/lib/student-app-data";
import {
  getStudentAppBasePath,
  getStudentAppPath,
  getStudentPortalPath,
  STUDENT_APPS,
  STUDENT_APP_IDS,
  type StudentAppDefinition,
  type StudentAppSlug,
  type StudentAppStatus,
} from "@/lib/student-apps";
import { AbilityPortrait } from "./AbilityPortrait";
import { PortalSettingsPanel } from "./PortalSettingsPanel";
import type { PortalNotificationItem } from "./PortalNotificationMenu";
import { PortalTopbar } from "./PortalTopbar";

type ProgressRow = {
  lesson_id: string;
  course_id: string;
  status: string;
  progress_percent: number | null;
  started_at: string | null;
  last_viewed_at: string | null;
  completed_at: string | null;
};

type CurrentCourse = {
  courseTitle: string;
  lessonTitle: string;
  progressPercent: number;
  continueHref: string;
};

type TenantAppRelation = {
  slug: string;
  title: string;
  short_title: string;
  description: string;
  app_kind: "learning" | "service";
};

type TenantAppRow = {
  is_enabled: boolean;
  status: StudentAppStatus;
  custom_title: string | null;
  sort_order: number;
  student_apps: TenantAppRelation | TenantAppRelation[] | null;
};

type PortalApp = StudentAppDefinition & {
  portalTitle: string;
  portalStatus: StudentAppStatus;
  portalSortOrder: number;
};

const appIconMap = {
  korean: Languages,
  english: BookOpen,
  math: Calculator,
  university: GraduationCap,
  "study-abroad": Building2,
} satisfies Record<StudentAppSlug, typeof Languages>;

const appAccentClasses = {
  emerald: "bg-emerald-500/12 text-emerald-700 ring-emerald-600/15",
  sky: "bg-sky-500/12 text-sky-700 ring-sky-600/15",
  amber: "bg-amber-500/12 text-amber-700 ring-amber-600/15",
  violet: "bg-violet-500/12 text-violet-700 ring-violet-600/15",
  rose: "bg-rose-500/12 text-rose-700 ring-rose-600/15",
} as const;

function getGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );

  if (hour < 6) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function getActivityTime(row: ProgressRow) {
  return row.last_viewed_at ?? row.completed_at ?? row.started_at ?? "";
}

function formatPortalDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "时间待确认";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(parsed);
}

function getTaskTiming(task: HomeLearningTask): string {
  if (task.dueAt) return `${formatPortalDateTime(task.dueAt)} 截止`;
  if (task.progressPercent !== null) {
    return `已完成 ${Math.round(task.progressPercent)}%`;
  }
  if (task.startsAt) return `${formatPortalDateTime(task.startsAt)} 开始`;
  return task.status === "in_progress" ? "可以继续完成" : "现在可以开始";
}

async function getPortalApps({
  supabase,
  tenantId,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof requireDashboardAccess>>["auth"]["supabase"];
  tenantId: string;
  userId: string;
}): Promise<PortalApp[]> {
  const [{ data, error }, enrollmentResult] = await Promise.all([
    supabase
      .from("tenant_student_apps")
      .select(
        "is_enabled, status, custom_title, sort_order, student_apps!inner(slug, title, short_title, description, app_kind)",
      )
      .eq("tenant_id", tenantId)
      .eq("is_enabled", true)
      .neq("status", "hidden")
      .order("sort_order", { ascending: true }),
    supabase
      .from("student_app_enrollments")
      .select("app_id,status,starts_at,ends_at")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("status", "active"),
  ]);

  if (error) return [];

  const configuredApps = (data as unknown as TenantAppRow[])
    .map((row) => {
      const relation = Array.isArray(row.student_apps)
        ? row.student_apps[0]
        : row.student_apps;
      if (!relation) return null;

      const definition = STUDENT_APPS.find((app) => app.slug === relation.slug);
      if (!definition) return null;

      return {
        ...definition,
        title: relation.title || definition.title,
        shortTitle: relation.short_title || definition.shortTitle,
        description: relation.description || definition.description,
        kind: relation.app_kind || definition.kind,
        portalTitle: row.custom_title || relation.title || definition.title,
        portalStatus: row.status,
        portalSortOrder: row.sort_order,
      } satisfies PortalApp;
    })
    .filter((app): app is PortalApp => app !== null)
    .sort((a, b) => a.portalSortOrder - b.portalSortOrder);

  if (enrollmentResult.error) return [];

  // 服务端目录过滤必须以本次请求时间判断授权有效期。
  const now = Date.now();
  const enrolledAppIds = new Set(
    (enrollmentResult.data ?? [])
      .filter((row) => {
        const startsAt = row.starts_at ? Date.parse(row.starts_at) : null;
        const endsAt = row.ends_at ? Date.parse(row.ends_at) : null;
        return (
          (startsAt === null || !Number.isFinite(startsAt) || startsAt <= now) &&
          (endsAt === null || !Number.isFinite(endsAt) || endsAt > now)
        );
      })
      .map((row) => String(row.app_id)),
  );

  return configuredApps.filter((app) =>
    enrolledAppIds.has(STUDENT_APP_IDS[app.slug]),
  );
}

async function getCurrentKoreanCourse({
  supabase,
  userId,
  space,
}: {
  supabase: Awaited<ReturnType<typeof requireDashboardAccess>>["auth"]["supabase"];
  userId: string;
  space: string;
}): Promise<CurrentCourse | null> {
  const { data: rootCategory } = await withStudentAppSchemaFallback(
    supabase
      .from("course_categories")
      .select("id, slug")
      .is("parent_id", null)
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .eq("is_published", true)
      .maybeSingle(),
    () =>
      supabase
        .from("course_categories")
        .select("id, slug")
        .is("parent_id", null)
        .eq("slug", "korean")
        .eq("is_published", true)
        .maybeSingle(),
  );

  if (!rootCategory) return null;

  const { data: subcategoryData } = await supabase
    .from("course_categories")
    .select("id, slug")
    .eq("parent_id", rootCategory.id)
    .eq("is_published", true);
  const subcategories = subcategoryData ?? [];
  const subcategoryIds = subcategories.map((category) => category.id);
  if (subcategoryIds.length === 0) return null;

  const { data: courseData } = await supabase
    .from("courses")
    .select("id, title, slug, category_id")
    .in("category_id", subcategoryIds)
    .eq("is_published", true);
  const courses = courseData ?? [];
  const courseIds = courses.map((course) => course.id);
  if (courseIds.length === 0) return null;

  const { data: progressData } = await supabase
    .from("lesson_progress")
    .select(
      "lesson_id, course_id, status, progress_percent, started_at, last_viewed_at, completed_at",
    )
    .eq("user_id", userId)
    .in("course_id", courseIds);
  const progressRows = (progressData ?? []) as ProgressRow[];
  const latestProgress = [...progressRows]
    .filter((row) => getActivityTime(row))
    .sort((a, b) => getActivityTime(b).localeCompare(getActivityTime(a)))[0];

  if (!latestProgress) return null;
  const course = courses.find((item) => item.id === latestProgress.course_id);
  if (!course) return null;

  const { data: lessonData } = await supabase
    .from("lessons")
    .select("id, title, slug")
    .eq("course_id", course.id)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  const lessons = lessonData ?? [];
  const currentLesson = lessons.find(
    (lesson) => lesson.id === latestProgress.lesson_id,
  );
  if (!currentLesson) return null;

  const progressByLessonId = new Map(
    progressRows
      .filter((row) => row.course_id === course.id)
      .map((row) => [row.lesson_id, row]),
  );
  const totalProgress = lessons.reduce((sum, lesson) => {
    const progress = progressByLessonId.get(lesson.id);
    if (progress?.status === "completed") return sum + 100;
    return sum + Math.max(0, Math.min(100, progress?.progress_percent ?? 0));
  }, 0);
  const progressPercent =
    lessons.length > 0 ? Math.round(totalProgress / lessons.length) : 0;
  const subcategory = subcategories.find(
    (category) => category.id === course.category_id,
  );

  return {
    courseTitle: course.title,
    lessonTitle: currentLesson.title,
    progressPercent,
    continueHref: subcategory
      ? getStudentAppPath(
          space,
          "korean",
          `/courses/korean/${subcategory.slug}/${course.slug}/${currentLesson.slug}`,
        )
      : getStudentAppPath(space, "korean", "/courses"),
  };
}

export default async function StudentPortalPage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  const access = await requireDashboardAccess("tenant", space);

  if (access.auth.profile?.role !== "student") {
    redirect(access.dashboardBasePath);
  }

  const { user, profile, tenant, supabase } = access.auth;
  if (!tenant) redirect(access.dashboardBasePath);

  const portalPath = getStudentPortalPath(space);
  const userName =
    profile?.full_name || user.user_metadata?.name || user.email || "同学";
  const accountLabel =
    MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile?.membership_tier)];
  const tenantName = tenant.name ?? space;
  const [portalApps, announcementResult] = await Promise.all([
    getPortalApps({
      supabase,
      tenantId: tenant.id,
      userId: user.id,
    }),
    getPublishedAnnouncementsForTenant(tenant.id)
      .then((result) => ({ announcements: result.data, failed: false }))
      .catch((error: unknown) => {
        console.error("[student-portal] 平台提示读取失败", error);
        return { announcements: [], failed: true };
      }),
  ]);
  const koreanApp = portalApps.find((app) => app.slug === "korean");
  const primaryApp =
    portalApps.find((app) => app.portalStatus === "active") ?? portalApps[0];
  const koreanAppPath = koreanApp
    ? getStudentAppBasePath(space, "korean")
    : portalPath;
  const announcementHref = koreanApp
    ? getStudentAppPath(space, "korean", "/announcements")
    : `${access.dashboardBasePath}/announcements`;
  const portalNow = new Date();
  let currentCourse: CurrentCourse | null = null;
  let learningSummaryLoadFailed = false;
  let learningSummary: PortalHomeLearningSummary =
    selectPortalHomeLearningSummary([], null, portalNow);
  let abilityPortrait: AbilityPortraitData | null = null;
  if (koreanApp) {
    const [loadedCurrentCourse, learningSummaryResult, loadedAbilityPortrait] =
      await Promise.all([
        getCurrentKoreanCourse({ supabase, userId: user.id, space }),
        loadPortalHomeLearningSummary({
          supabase,
          tenantId: tenant.id,
          studentId: user.id,
          studentAppId: STUDENT_APP_IDS.korean,
          appSlug: "korean",
          appLabel: koreanApp.portalTitle,
          space,
          now: portalNow,
        })
          .then((summary) => ({ summary, failed: false }))
          .catch((error: unknown) => {
            console.error("[student-portal] 今日学习摘要读取失败", error);
            return {
              summary: selectPortalHomeLearningSummary([], null, portalNow),
              failed: true,
            };
          }),
        loadAbilityPortrait({
          supabase,
          tenantId: tenant.id,
          studentId: user.id,
          now: portalNow,
        }).catch((error: unknown) => {
          console.error("[student-portal] 能力画像读取失败", error);
          return null;
        }),
      ]);
    currentCourse = loadedCurrentCourse;
    learningSummary = learningSummaryResult.summary;
    learningSummaryLoadFailed = learningSummaryResult.failed;
    abilityPortrait = loadedAbilityPortrait;
  }
  const primaryTask = learningSummary.mostImportant;
  const notifications: PortalNotificationItem[] = [];
  announcementResult.announcements.slice(0, 3).forEach((announcement) => {
    notifications.push({
      id: `platform:${announcement.id}`,
      kind: "platform",
      title: announcement.title,
      description: announcement.content,
      meta: announcement.published_at
        ? formatPortalDateTime(announcement.published_at)
        : "时间待确认",
      href: announcementHref,
    });
  });
  const nearestDeadline = learningSummary.nearestDeadline;
  if (nearestDeadline) {
    notifications.push({
      id: `deadline:${nearestDeadline.taskKey}`,
      kind: "deadline",
      title: nearestDeadline.title,
      description: nearestDeadline.reason,
      meta: `${formatPortalDateTime(nearestDeadline.dueAt!)} 截止`,
      href: nearestDeadline.href,
    });
  }
  if (primaryTask && primaryTask.taskKey !== nearestDeadline?.taskKey) {
    notifications.push({
      id: `task:${primaryTask.taskKey}`,
      kind: "task",
      title: primaryTask.title,
      description: primaryTask.reason,
      meta: getTaskTiming(primaryTask),
      href: primaryTask.href,
    });
  }
  if (learningSummary.latestFeedback) {
    notifications.push({
      id: `feedback:${learningSummary.latestFeedback.id}`,
      kind: "feedback",
      title: learningSummary.latestFeedback.title,
      description: learningSummary.latestFeedback.feedback,
      meta: formatPortalDateTime(learningSummary.latestFeedback.publishedAt),
      href: learningSummary.latestFeedback.href,
    });
  }
  const emptyStateHref = currentCourse?.continueHref ??
    (koreanApp
      ? getCourseLearningPath(space)
      : primaryApp
        ? getStudentAppBasePath(space, primaryApp.slug)
        : portalPath);
  const abilityPortraitToolboxHref = getStudentAppPath(space, "korean", "/toolbox");
  const abilityPortraitUniversityTargetHref = getStudentAppPath(
    space,
    "study-abroad",
    "/universities/targets",
  );

  return (
    <>
      <a
        href="#tenant-portal-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-950 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        跳到主要内容
      </a>
      <PortalTopbar
        portalPath={portalPath}
        dashboardBasePath={koreanAppPath}
        tenantName={tenantName}
        userName={userName}
        accountLabel={accountLabel}
        studentId={user.id}
        notifications={notifications}
        learningNotificationsLoadFailed={learningSummaryLoadFailed}
        platformNotificationsLoadFailed={announcementResult.failed}
        apps={portalApps
          .filter((app) => app.portalStatus === "active")
          .map((app) => ({
            slug: app.slug,
            title: app.portalTitle,
            kind: app.kind,
            href: getStudentAppBasePath(space, app.slug),
          }))}
        profileContent={<ProfileContent embedded />}
        settingsContent={<PortalSettingsPanel />}
      />

      <main
        id="tenant-portal-main-content"
        tabIndex={-1}
        className="min-h-screen scroll-mt-24 bg-[linear-gradient(180deg,#fbfbf7_0%,#f3f6f1_45%,#fbfbf7_100%)] px-4 pb-12 pt-28 text-slate-950 sm:px-6 lg:px-8"
      >
        <div className="w-full space-y-8">
          {koreanApp && abilityPortrait ? (
            <AbilityPortrait
              data={abilityPortrait}
              studentName={userName}
              toolboxHref={abilityPortraitToolboxHref}
              universityTargetHref={abilityPortraitUniversityTargetHref}
            />
          ) : null}

          <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/90 bg-white/82 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-8 lg:p-10">
            <div aria-hidden="true" className="absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full bg-emerald-300/16 blur-3xl" />
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-700">
                  {getGreeting()}，{userName}
                </p>
                <h1 className="mt-2 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                  选择今天要进入的学习应用
                </h1>
                <div className="mt-7 flex flex-wrap gap-3">
                  {currentCourse ? (
                    <Link
                      href={currentCourse.continueHref}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                    >
                      <PlayCircle size={18} aria-hidden="true" />
                      继续韩语学习
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  ) : koreanApp ? (
                    <Link
                      href={getStudentAppPath(space, "korean", "/courses")}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                    >
                      <Languages size={18} aria-hidden="true" />
                      开始韩语学习
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  ) : primaryApp ? (
                    <Link
                      href={getStudentAppBasePath(space, primaryApp.slug)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                    >
                      <PlayCircle size={18} aria-hidden="true" />
                      进入{primaryApp.portalTitle}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="inline-flex min-h-11 items-center rounded-xl bg-slate-200 px-5 text-sm font-bold text-slate-500">
                      暂无已开通应用
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-slate-50/85 p-5 shadow-inner shadow-white/70">
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Clock3 size={14} aria-hidden="true" />
                    最近学习
                  </span>
                  <strong className="text-2xl font-black tabular-nums text-emerald-700">
                    {currentCourse?.progressPercent ?? 0}%
                  </strong>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="最近韩语课程进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={currentCourse?.progressPercent ?? 0}>
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${currentCourse?.progressPercent ?? 0}%` }} />
                </div>
                <p className="mt-5 truncate text-base font-bold text-slate-900">
                  {currentCourse?.courseTitle ?? (koreanApp ? "还没有开始韩语课程" : "暂无韩语学习记录")}
                </p>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {currentCourse?.lessonTitle ?? (koreanApp ? "进入韩语应用选择第一门课程" : "开通韩语应用后在这里显示进度")}
                </p>
              </div>
            </div>
          </section>

          <section
            id="learning-summary"
            aria-labelledby="portal-learning-summary-title"
            className="scroll-mt-24 overflow-hidden rounded-[2rem] border border-white/90 bg-white/82 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-2xl"
          >
            <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)]">
              <div className="p-6 sm:p-8">
                <h2
                  id="portal-learning-summary-title"
                  className="text-2xl font-black tracking-tight text-slate-950"
                >
                  今天最重要
                </h2>

                {learningSummaryLoadFailed ? (
                  <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50/80 p-5 sm:p-6" role="alert">
                    <span className="inline-flex items-center gap-2 text-sm font-black text-amber-800">
                      <CircleAlert size={17} aria-hidden="true" />
                      摘要加载失败
                    </span>
                    <CardTitleWithHint
                      className="mt-3"
                      headingLevel={3}
                      title="今日学习摘要暂时无法加载"
                      titleClassName="text-xl font-black tracking-tight text-slate-950"
                      description="任务数据读取失败，应用目录和课程入口仍可正常使用。"
                      hintLabel="查看加载失败说明"
                    />
                    <div className="mt-5 flex flex-wrap gap-2">
                      <a
                        href={portalPath}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
                      >
                        重新加载
                      </a>
                      <Link
                        href={emptyStateHref}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-white px-5 text-sm font-black text-slate-800 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
                      >
                        继续学习
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                ) : primaryTask ? (
                  <div className="mt-6">
                    <p className="text-sm font-bold text-emerald-700">
                      {primaryTask.appLabel}
                    </p>
                    <CardTitleWithHint
                      className="mt-2"
                      headingLevel={3}
                      title={primaryTask.title}
                      titleClassName="text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl"
                      description={primaryTask.description}
                      hintLabel="查看任务说明"
                    />
                    <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-slate-600">
                      <CalendarClock size={17} aria-hidden="true" />
                      {getTaskTiming(primaryTask)}
                    </p>
                    <div className="mt-5 rounded-2xl bg-emerald-50/80 p-4 text-sm leading-6 text-slate-700">
                      <span className="font-black text-emerald-800">推荐原因：</span>
                      {primaryTask.reason}
                    </div>
                    <Link
                      href={primaryTask.href}
                      className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                    >
                      进入任务
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                ) : (
                  <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-5 sm:p-6">
                    <CardTitleWithHint
                      headingLevel={3}
                      title="今天没有待处理的学习任务"
                      titleClassName="text-xl font-black tracking-tight text-slate-950"
                      description="新的必做任务、截止提醒和学习建议会在这里优先显示。"
                      hintLabel="查看摘要说明"
                    />
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      可以继续最近的课程，保持今天的学习节奏。
                    </p>
                    <Link
                      href={emptyStateHref}
                      className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                    >
                      {currentCourse ? "继续课程" : koreanApp ? "进入课程" : "查看应用"}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-px bg-slate-200/80 sm:grid-cols-3 lg:grid-cols-1">
                <div className="flex min-h-32 flex-col justify-center bg-slate-50/90 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <CheckCircle2 size={17} className="text-emerald-700" aria-hidden="true" />
                    今日剩余必做
                  </div>
                  {learningSummaryLoadFailed ? (
                    <strong className="mt-2 text-3xl font-black tabular-nums text-slate-950">—</strong>
                  ) : learningSummary.requiredTodayCount > 0 ? (
                    <strong className="mt-2 text-3xl font-black tabular-nums text-slate-950">
                      {learningSummary.requiredTodayCount}
                      <span className="ml-1 text-sm font-bold text-slate-500">项</span>
                    </strong>
                  ) : (
                    <p className="mt-2.5 text-sm font-semibold text-slate-400">今天没有必做任务</p>
                  )}
                </div>

                <div className="flex min-h-32 flex-col justify-center bg-slate-50/90 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <CalendarClock size={17} className="text-amber-700" aria-hidden="true" />
                    即将截止
                  </div>
                  {learningSummaryLoadFailed ? (
                    <strong className="mt-2 text-3xl font-black tabular-nums text-slate-950">—</strong>
                  ) : learningSummary.nearestDeadline ? (
                    <>
                      <strong className="mt-2 text-3xl font-black tabular-nums text-slate-950">
                        1<span className="ml-1 text-sm font-bold text-slate-500">项</span>
                      </strong>
                      <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">
                        {formatPortalDateTime(learningSummary.nearestDeadline.dueAt!)} · {learningSummary.nearestDeadline.title}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2.5 text-sm font-semibold text-slate-400">近期没有截止提醒</p>
                  )}
                </div>

                <div className="flex min-h-32 flex-col justify-center bg-slate-50/90 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <MessageSquareText size={17} className="text-sky-700" aria-hidden="true" />
                    新反馈
                  </div>
                  {learningSummaryLoadFailed ? (
                    <strong className="mt-2 text-3xl font-black tabular-nums text-slate-950">—</strong>
                  ) : learningSummary.latestFeedback ? (
                    <>
                      <strong className="mt-2 text-3xl font-black tabular-nums text-slate-950">
                        1<span className="ml-1 text-sm font-bold text-slate-500">条</span>
                      </strong>
                      <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">
                        {learningSummary.latestFeedback.title} · {formatPortalDateTime(learningSummary.latestFeedback.publishedAt)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2.5 text-sm font-semibold text-slate-400">暂无新反馈</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section id="student-apps" aria-labelledby="student-apps-title" className="scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-4 px-1">
              <div>
                <h2 id="student-apps-title" className="text-2xl font-black tracking-tight">
                  学习与服务应用
                </h2>
              </div>
              <p className="text-sm font-semibold text-slate-500">共 {portalApps.length} 个应用</p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {portalApps.map((app) => {
                const Icon = appIconMap[app.slug];
                const iconAccent = appAccentClasses[app.accent];
                const active = app.portalStatus === "active";
                const isKorean = app.slug === "korean";
                const cardClassName = `group relative isolate flex min-h-64 flex-col overflow-hidden rounded-[1.75rem] border border-white/90 bg-white/78 p-6 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.55)] backdrop-blur-xl transition duration-300 ${active ? "hover:-translate-y-1 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2" : "cursor-not-allowed opacity-75"} ${isKorean ? "md:col-span-2 xl:col-span-1" : ""}`;
                const cardContent = (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${iconAccent}`}>
                        <Icon size={23} aria-hidden="true" />
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                          active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {active ? (
                          <CheckCircle2 size={14} aria-hidden="true" />
                        ) : (
                          <Clock3 size={14} aria-hidden="true" />
                        )}
                        {active ? "可进入" : "建设中"}
                      </span>
                    </div>
                    <CardTitleWithHint
                      className="mt-7"
                      headingLevel={3}
                      title={app.portalTitle}
                      titleClassName="text-xl font-black tracking-tight"
                      description={app.description}
                    />
                    <div className="mt-auto flex items-center justify-between gap-3 pt-7">
                      <span className="text-xs font-semibold text-slate-500">
                        {app.kind === "service" ? "独立服务空间" : "独立学习空间"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                        {active ? "打开应用" : "等待开放"}
                        {active ? (
                          <ArrowRight size={15} className="transition group-hover:translate-x-1" aria-hidden="true" />
                        ) : null}
                      </span>
                    </div>
                  </>
                );

                return active ? (
                  <Link
                    key={app.slug}
                    href={getStudentAppBasePath(space, app.slug)}
                    className={cardClassName}
                  >
                    {cardContent}
                  </Link>
                ) : (
                  <article key={app.slug} className={cardClassName}>
                    {cardContent}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
