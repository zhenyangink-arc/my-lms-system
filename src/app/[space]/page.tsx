import { getViewerTimeZone } from "@/lib/viewer-time-zone.server";
import { hourInTimeZone } from "@/lib/viewer-time-zone";
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
} from "lucide-react";
import { redirect } from "next/navigation";

import { ProfileContent } from "@/app/dashboard/profile/page-content";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import {
  loadStudentCurrentCourse,
  type StudentCurrentCourse,
} from "@/features/student-current-course/api/service";
import {
  loadPortalHomeLearningSummaryForApps,
  selectPortalHomeLearningSummary,
  type PortalHomeLearningSummary,
} from "@/features/student-home-learning/api/service";
import {
  formatLearningDateTime,
  getLessonDisplayTitle,
  getTaskTiming,
} from "@/features/student-home-learning/presentation";
import { getCourseLearningPath } from "@/features/student-home-learning/routes";
import {
  isStudentHomeBlockEnabled,
  isStudentNavItemEnabled,
  isSubjectSlug,
} from "@/features/subjects";
import { requireDashboardAccess } from "@/lib/dashboard-access";
import { getPublishedAnnouncementsForTenant } from "@/lib/published-tenant-content";
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
import { PortalAskBar } from "./PortalAskBar";
import { PortalAvatarCard } from "./PortalAvatarCard";
import { PortalMottoCard } from "./PortalMottoCard";
import { PortalPersonalInfoCard } from "./PortalPersonalInfoCard";
import { PortalSettingsPanel } from "./PortalSettingsPanel";
import { PortalTagsCard } from "./PortalTagsCard";
import { isInterestTag } from "./interest-tags";
import type { PortalNotificationItem } from "./PortalNotificationMenu";
import { PortalTopbar } from "./PortalTopbar";

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

type PortalAppContinuation = {
  course: StudentCurrentCourse | null;
  failed: boolean;
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

function getGreeting(timeZone: string) {
  const hour = hourInTimeZone(new Date(), timeZone);

  if (hour < 6) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function PortalAppsSection({
  apps,
  space,
  continuations,
}: {
  apps: PortalApp[];
  space: string;
  continuations: Map<StudentAppSlug, PortalAppContinuation>;
}) {
  return (
    <section
      id="student-apps"
      aria-labelledby="student-apps-title"
      className="scroll-mt-24 rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_22px_60px_-44px_rgba(15,23,42,0.38)] sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <h2
          id="student-apps-title"
          className="text-2xl font-bold tracking-[-0.03em] text-slate-950"
        >
          学习与服务应用
        </h2>
        <p className="text-sm font-medium text-slate-500">
          共 {apps.length} 个应用
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        {apps.map((app) => {
          const Icon = appIconMap[app.slug];
          const iconAccent = appAccentClasses[app.accent];
          const active = app.portalStatus === "active";
          const continuation = active ? continuations.get(app.slug) : undefined;

          return (
            <article
              key={app.slug}
              className={`relative flex min-h-44 min-w-0 flex-col rounded-[1.35rem] border p-4 transition-colors motion-reduce:transition-none sm:min-h-48 sm:p-5 ${
                active
                  ? "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                  : "border-slate-200/60 bg-slate-50/70 text-slate-500"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${iconAccent}`}
                >
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span
                  className={`inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${
                    active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-200/70 text-slate-600"
                  }`}
                >
                  {active ? (
                    <CheckCircle2 size={13} aria-hidden="true" />
                  ) : (
                    <Clock3 size={13} aria-hidden="true" />
                  )}
                  {active ? "可进入" : "建设中"}
                </span>
              </div>

              <CardTitleWithHint
                className="mt-5"
                headingLevel={3}
                title={app.portalTitle}
                titleClassName="text-lg font-bold tracking-tight text-slate-950"
                description={app.description}
                hintClassName="relative z-10"
                hintLabel={`查看${app.portalTitle}说明`}
              />

              {continuation ? (
                continuation.course ? (
                  <Link
                    href={continuation.course.continueHref}
                    aria-label={`继续学习${app.portalTitle}：${getLessonDisplayTitle(continuation.course.lessonTitle)}`}
                    className="mt-4 block rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/80 transition-colors hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 motion-reduce:transition-none"
                  >
                    <span className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                      <span>继续学习</span>
                      <span className="tabular-nums text-emerald-700">
                        {Math.round(continuation.course.progressPercent)}%
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-bold text-slate-900">
                      {getLessonDisplayTitle(continuation.course.lessonTitle)}
                    </span>
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-slate-200/80">
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{ width: `${continuation.course.progressPercent}%` }}
                      />
                    </span>
                  </Link>
                ) : (
                  <p className="mt-4 text-xs font-medium text-slate-500">
                    {continuation.failed ? "课程进度暂时无法读取" : "尚未开始课程"}
                  </p>
                )
              ) : null}

              <div className="mt-auto pt-5">
                {active ? (
                  <Link
                    href={getStudentAppBasePath(space, app.slug)}
                    className="inline-flex min-h-11 w-full items-center justify-between rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 motion-reduce:transition-none"
                  >
                    打开应用
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="flex min-h-11 items-center text-sm font-medium text-slate-500">
                    等待开放
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
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
  const accountLabel = "学生账户";
  const tenantName = tenant.name ?? space;
  const [
    portalApps,
    announcementResult,
    personalSpaceResult,
    primaryUniversityTargetResult,
  ] = await Promise.all([
    getPortalApps({
      supabase,
      tenantId: tenant.id,
      userId: user.id,
    }),
    getPublishedAnnouncementsForTenant(tenant.id)
      .then((result) => ({ announcements: result.data, failed: false }))
      .catch((error: unknown) => {
        console.warn("[student-portal] 平台提示读取失败", error);
        return { announcements: [], failed: true };
      }),
    supabase
      .from("profiles")
      .select("avatar_path, motto, interest_tags, address_city, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("student_university_targets")
      .select("university_name,program_name")
      .eq("user_id", user.id)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (personalSpaceResult.error) {
    console.warn("[student-portal] 个人资料读取失败", personalSpaceResult.error);
  }
  if (primaryUniversityTargetResult.error) {
    console.warn(
      "[student-portal] 目标学校读取失败",
      primaryUniversityTargetResult.error,
    );
  }
  const personalSpaceProfile = personalSpaceResult.data;
  let avatarUrl: string | null = null;
  if (personalSpaceProfile?.avatar_path) {
    const { data: signedAvatar } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(personalSpaceProfile.avatar_path, 60 * 60);
    avatarUrl = signedAvatar?.signedUrl ?? null;
  }
  const motto = personalSpaceProfile?.motto ?? null;
  const interestTags = (personalSpaceProfile?.interest_tags ?? []).filter(isInterestTag);
  const addressCity = personalSpaceProfile?.address_city ?? null;
  const primaryUniversityTarget = primaryUniversityTargetResult.data;
  const joinedAtLabel = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(personalSpaceProfile?.created_at ?? user.created_at));
  const koreanApp = portalApps.find((app) => app.slug === "korean");
  // 今日总览汇总所有已开放、已报名的学科应用；未开放的应用学生无法进入，不汇总其任务。
  const summaryApps = portalApps.filter(
    (app) =>
      app.kind === "learning" &&
      app.portalStatus === "active" &&
      isSubjectSlug(app.slug),
  );
  const showTaskAppLabels = summaryApps.length > 1;
  const primaryApp =
    portalApps.find((app) => app.portalStatus === "active") ?? portalApps[0];
  // 学习助手目前只服务韩语（是否扩展到其他学科待决定），入口仍指向韩语应用。
  const koreanAppPath = koreanApp
    ? getStudentAppBasePath(space, "korean")
    : portalPath;
  // 机构公告在每个学科应用中内容相同；链接到第一个提供公告栏目的已开放学科应用，
  // 避免只报名其他学科的学生被带到无法进入的应用。
  const announcementApp = summaryApps.find(
    (app) => isStudentNavItemEnabled(app.slug, "announcements"),
  );
  const announcementHref = announcementApp
    ? getStudentAppPath(space, announcementApp.slug, "/announcements")
    : `${access.dashboardBasePath}/announcements`;
  const portalNow = new Date();
  // 问候语、今天 / 明天与任务时间都按用户电脑的时区算（cookie；没有时是首尔）
  const viewerTimeZone = await getViewerTimeZone();
  let learningSummaryLoadFailed = false;
  let learningSummary: PortalHomeLearningSummary =
    selectPortalHomeLearningSummary([], null, portalNow, viewerTimeZone);
  const learningSummaryPromise =
    summaryApps.length > 0
      ? loadPortalHomeLearningSummaryForApps(
          summaryApps.map((app) => ({
            supabase,
            tenantId: tenant.id,
            studentId: user.id,
            studentAppId: STUDENT_APP_IDS[app.slug],
            appSlug: app.slug,
            appLabel: app.portalTitle,
            space,
          })),
          portalNow,
          viewerTimeZone,
        )
          .then((summary) => ({ summary, failed: false }))
          .catch((error: unknown) => {
            console.warn("[student-portal] 今日学习摘要读取失败", error);
            return {
              summary: selectPortalHomeLearningSummary([], null, portalNow, viewerTimeZone),
              failed: true,
            };
          })
      : null;
  // 每个学科应用卡片显示“继续学习”；能力画像已移到各学科首页。
  const appContinuationsPromise = Promise.all(
    summaryApps
      .filter((app) => isStudentHomeBlockEnabled(app.slug, "continue-learning"))
      .map((app) =>
        loadStudentCurrentCourse({
          supabase,
          studentId: user.id,
          studentAppId: STUDENT_APP_IDS[app.slug],
          appSlug: app.slug,
          space,
          now: portalNow,
        })
          .then((course): [StudentAppSlug, PortalAppContinuation] => [
            app.slug,
            { course, failed: false },
          ])
          .catch((error: unknown): [StudentAppSlug, PortalAppContinuation] => {
            console.warn("[student-portal] 当前课程读取失败", error);
            return [app.slug, { course: null, failed: true }];
          }),
      ),
  );
  const appContinuations = new Map(await appContinuationsPromise);
  const primaryContinuation =
    summaryApps
      .map((app) => appContinuations.get(app.slug)?.course ?? null)
      .find((course): course is StudentCurrentCourse => course !== null) ?? null;
  if (learningSummaryPromise) {
    const learningSummaryResult = await learningSummaryPromise;
    learningSummary = learningSummaryResult.summary;
    learningSummaryLoadFailed = learningSummaryResult.failed;
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
        ? formatLearningDateTime(announcement.published_at, viewerTimeZone)
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
      meta: `${formatLearningDateTime(nearestDeadline.dueAt!, viewerTimeZone)} 截止`,
      href: nearestDeadline.href,
    });
  }
  if (primaryTask && primaryTask.taskKey !== nearestDeadline?.taskKey) {
    notifications.push({
      id: `task:${primaryTask.taskKey}`,
      kind: "task",
      title: primaryTask.title,
      description: primaryTask.reason,
      meta: getTaskTiming(primaryTask, viewerTimeZone),
      href: primaryTask.href,
    });
  }
  if (learningSummary.latestFeedback) {
    notifications.push({
      id: `feedback:${learningSummary.latestFeedback.id}`,
      kind: "feedback",
      title: learningSummary.latestFeedback.title,
      description: learningSummary.latestFeedback.feedback,
      meta: formatLearningDateTime(learningSummary.latestFeedback.publishedAt, viewerTimeZone),
      href: learningSummary.latestFeedback.href,
    });
  }
  // 只指向开放了课程栏目的学科应用。
  const courseApp = summaryApps.find(
    (app) => isStudentNavItemEnabled(app.slug, "courses"),
  );
  const emptyStateHref = primaryContinuation?.continueHref ??
    (courseApp
      ? getCourseLearningPath(space, null, courseApp.slug)
      : primaryApp
        ? getStudentAppBasePath(space, primaryApp.slug)
        : portalPath);
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
        avatarUrl={avatarUrl}
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
        className="relative min-h-screen scroll-mt-24 overflow-hidden bg-[#f3f5f2] px-4 pb-12 pt-28 text-slate-950 sm:px-6 lg:px-8"
      >
        <span aria-hidden="true" className="pointer-events-none absolute -left-48 top-16 size-[30rem] rounded-full bg-emerald-100/55 blur-3xl" />
        <div className="relative mx-auto w-full max-w-[1680px] space-y-6">
          <PortalAskBar greeting={getGreeting(viewerTimeZone)} userName={userName} />

          <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(22rem,0.72fr)_minmax(0,1.28fr)]">
            <section
              id="personal-space"
              aria-label="我的个人资料"
              className={`flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/92 shadow-[0_22px_60px_-44px_rgba(15,23,42,0.38)] xl:col-span-2`}
            >
              <div className="grid sm:grid-cols-[12rem_minmax(0,1fr)]">
                <PortalAvatarCard
                  studentName={userName}
                  avatarUrl={avatarUrl}
                  embedded
                />
                <PortalPersonalInfoCard
                  studentName={userName}
                  targetUniversity={primaryUniversityTarget?.university_name ?? null}
                  targetProgram={primaryUniversityTarget?.program_name ?? null}
                  targetLoadFailed={Boolean(primaryUniversityTargetResult.error)}
                  addressCity={addressCity}
                  joinedAtLabel={joinedAtLabel}
                  embedded
                />
              </div>
              <div className="grid border-t border-slate-200/75 sm:grid-cols-2 sm:divide-x sm:divide-slate-200/75">
                <PortalTagsCard tags={interestTags} embedded />
                <PortalMottoCard motto={motto} embedded />
              </div>
            </section>

          </div>

          <section
            id="learning-summary"
            aria-labelledby="portal-learning-summary-title"
            className="scroll-mt-24 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/92 shadow-[0_22px_60px_-44px_rgba(15,23,42,0.38)]"
          >
            <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)]">
              <div className="p-6 sm:p-8">
                <h2
                  id="portal-learning-summary-title"
                  className="text-2xl font-bold tracking-[-0.03em] text-slate-950"
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
                      {getTaskTiming(primaryTask, viewerTimeZone)}
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
                      {primaryContinuation ? "继续课程" : courseApp ? "进入课程" : "查看应用"}
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
                    最近截止
                  </div>
                  {learningSummaryLoadFailed ? (
                    <strong className="mt-2 text-3xl font-black tabular-nums text-slate-950">—</strong>
                  ) : learningSummary.nearestDeadline ? (
                    <>
                      <strong className="mt-2 text-base font-bold text-slate-950">
                        {formatLearningDateTime(learningSummary.nearestDeadline.dueAt!, viewerTimeZone)}
                      </strong>
                      <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
                        {showTaskAppLabels
                          ? `${learningSummary.nearestDeadline.appLabel} · ${learningSummary.nearestDeadline.title}`
                          : learningSummary.nearestDeadline.title}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2.5 text-sm font-semibold text-slate-400">近期没有截止提醒</p>
                  )}
                </div>

                <div className="flex min-h-32 flex-col justify-center bg-slate-50/90 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <MessageSquareText size={17} className="text-sky-700" aria-hidden="true" />
                    最近反馈
                  </div>
                  {learningSummaryLoadFailed ? (
                    <strong className="mt-2 text-3xl font-black tabular-nums text-slate-950">—</strong>
                  ) : learningSummary.latestFeedback ? (
                    <>
                      <strong className="mt-2 text-base font-bold text-slate-950">
                        已发布
                      </strong>
                      <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
                        {showTaskAppLabels
                          ? `${learningSummary.latestFeedback.appLabel} · `
                          : null}
                        {learningSummary.latestFeedback.title} · {formatLearningDateTime(learningSummary.latestFeedback.publishedAt, viewerTimeZone)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2.5 text-sm font-semibold text-slate-400">暂无老师反馈</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <PortalAppsSection apps={portalApps} space={space} continuations={appContinuations} />

        </div>
      </main>
    </>
  );
}
