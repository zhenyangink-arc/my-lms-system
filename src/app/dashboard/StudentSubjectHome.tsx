import Link from "next/link";
import { ArrowRight, BookOpen, CalendarClock, CircleAlert } from "lucide-react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import {
  AbilityPortrait,
  AbilityPortraitLoadFailed,
} from "@/features/student-ability-portrait/components/AbilityPortrait";
import type { StudentCurrentCourse } from "@/features/student-current-course/api/service";
import { selectRequiredTodayTasks } from "@/features/student-home-learning/api/service";
import type { HomeLearningTask } from "@/features/student-home-learning/api/types";
import {
  getLessonDisplayTitle,
  getTaskTiming,
} from "@/features/student-home-learning/presentation";
import { getCourseLearningPath } from "@/features/student-home-learning/routes";
import { loadStudentHomeBlocks } from "@/features/student-subject-home/api/load-home-blocks";
import { getSubjectManifest, type SubjectSlug } from "@/features/subjects";
import { requireDashboardAccess } from "@/lib/dashboard-access";
import {
  getStudentAppBasePath,
  getStudentAppDefinition,
} from "@/lib/student-apps";

const TASK_LIMIT = 5;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2";

function BlockLoadFailed({ message, reloadHref }: { message: string; reloadHref: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border p-4" role="alert">
      <CircleAlert size={18} style={{ color: "var(--status-warning)" }} aria-hidden="true" />
      <p className="flex-1 text-sm font-semibold">{message}</p>
      <a
        href={reloadHref}
        className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold ${focusRing}`}
        style={{ color: "var(--primary-hover)", backgroundColor: "var(--accent)" }}
      >
        重新加载
      </a>
    </div>
  );
}

function TodayTasksBlock({
  tasks,
  requiredTodayCount,
  failed,
  coursesHref,
  homeHref,
}: {
  tasks: HomeLearningTask[];
  requiredTodayCount: number;
  failed: boolean;
  coursesHref: string;
  homeHref: string;
}) {
  return (
    <section className="app-card rounded-3xl border p-5 sm:p-6" data-card-level="1" aria-label="今日任务">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardTitleWithHint
          headingLevel={2}
          title="今日任务"
          titleClassName="text-xl font-bold tracking-tight"
          description="作业、考试和课程学习按截止时间与重要程度排序。"
          hintLabel="查看今日任务说明"
        />
        {!failed && requiredTodayCount > 0 ? (
          <span className="inline-flex min-h-8 items-center rounded-full px-3 text-xs font-bold" style={{ color: "var(--status-warning)", backgroundColor: "var(--status-warning-surface)" }}>
            今日必做 {requiredTodayCount} 项
          </span>
        ) : null}
      </div>

      {failed ? (
        <BlockLoadFailed message="今日任务暂时无法加载，课程入口仍可正常使用。" reloadHref={homeHref} />
      ) : tasks.length > 0 ? (
        <ul className="mt-4 divide-y" style={{ borderColor: "var(--border)" }}>
          {tasks.map((task) => (
            <li key={task.taskKey} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{task.title}</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs app-muted-text">
                  <CalendarClock size={13} aria-hidden="true" />
                  {getTaskTiming(task)}
                </p>
              </div>
              <Link
                href={task.href}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-bold ${focusRing}`}
                style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}
                aria-label={`进入任务：${task.title}`}
              >
                进入
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed p-5">
          <p className="text-sm font-bold">今天没有待处理的学习任务</p>
          <p className="mt-1 text-sm app-muted-text">可以从课程目录继续今天的学习。</p>
          <Link
            href={coursesHref}
            className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold ${focusRing}`}
            style={{ color: "var(--primary-hover)", backgroundColor: "var(--accent)" }}
          >
            进入课程
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}

function ContinueLearningBlock({
  course,
  failed,
  coursesHref,
}: {
  course: StudentCurrentCourse | null;
  failed: boolean;
  coursesHref: string;
}) {
  const progress = course ? Math.round(course.progressPercent) : 0;
  return (
    <section className="app-card rounded-3xl border p-5 sm:p-6" data-card-level="1" aria-label="继续学习">
      <CardTitleWithHint
        headingLevel={2}
        title="继续学习"
        titleClassName="text-xl font-bold tracking-tight"
        description="从最近学习的课时继续；还没有开始时可以从课程目录选择。"
        hintLabel="查看继续学习说明"
      />
      <Link
        href={course?.continueHref ?? coursesHref}
        className={`app-soft-card mt-4 flex flex-wrap items-center gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 ${focusRing}`}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}
        >
          <BookOpen size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold">
            {course ? getLessonDisplayTitle(course.lessonTitle) : "选择一门课程开始学习"}
          </span>
          <span className="mt-1 block text-xs app-muted-text">
            {course
              ? course.courseTitle
              : failed
                ? "课程进度暂时无法读取，可进入课程页查看"
                : "尚未开始课程"}
          </span>
        </span>
        {course ? (
          <span className="w-32 shrink-0">
            <span className="flex items-center justify-between text-xs font-semibold app-muted-text">
              <span>课程进度</span>
              <span className="tabular-nums">{progress}%</span>
            </span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-soft)" }}>
              <span className="block h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: "var(--status-success)" }} />
            </span>
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: "var(--primary-hover)" }}>
          {course ? (course.status === "completed" ? "查看" : "继续") : "课程目录"}
          <ArrowRight size={15} aria-hidden="true" />
        </span>
      </Link>
    </section>
  );
}

/**
 * 平台首页框架：由学科清单的 homeBlocks 决定显示哪些平台区块及其顺序。
 * 学科应用路由布局已完成身份、机构开放与报名校验。
 */
export async function StudentSubjectHome({
  space,
  appSlug,
}: {
  space: string;
  appSlug: SubjectSlug;
}) {
  const blocks = getSubjectManifest(appSlug)?.student.homeBlocks ?? [];

  const access = await requireDashboardAccess("tenant", space);
  const { supabase, user, tenant } = access.auth;
  const app = getStudentAppDefinition(appSlug);
  const homeHref = getStudentAppBasePath(space, appSlug);
  const coursesHref = getCourseLearningPath(space, null, appSlug);
  const now = new Date();

  const empty = { value: null, failed: false };
  const { tasks, currentCourse, abilityPortrait: portrait } = tenant
    ? await loadStudentHomeBlocks({
        supabase,
        tenantId: tenant.id,
        studentId: user.id,
        appSlug,
        appLabel: app.title,
        space,
        blocks,
        now,
      })
    : { tasks: { value: [], failed: false }, currentCourse: empty, abilityPortrait: empty };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {blocks.map((block) => {
        switch (block) {
          case "today-tasks":
            return (
              <TodayTasksBlock
                key={block}
                tasks={tasks.value.slice(0, TASK_LIMIT)}
                requiredTodayCount={selectRequiredTodayTasks(tasks.value, now).length}
                failed={tasks.failed}
                coursesHref={coursesHref}
                homeHref={homeHref}
              />
            );
          case "continue-learning":
            return (
              <ContinueLearningBlock
                key={block}
                course={currentCourse.value}
                failed={currentCourse.failed}
                coursesHref={coursesHref}
              />
            );
          case "ability-portrait":
            return portrait.value ? (
              <AbilityPortrait key={block} data={portrait.value} sourceLabel={app.title} />
            ) : portrait.failed ? (
              <AbilityPortraitLoadFailed key={block} sourceLabel={app.title} reloadHref={homeHref} />
            ) : null;
        }
      })}
    </div>
  );
}
