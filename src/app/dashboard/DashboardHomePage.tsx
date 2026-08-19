import { redirect } from "next/navigation";

import {
  type GrowthActivityItem as ActivityItem,
  type GrowthCourseProgressItem as CourseProgressItem,
  type GrowthReminderItem as ReminderItem,
  type GrowthWeekActivityDay as WeekActivityDay,
} from "@/app/dashboard/GrowthHomeView";
import { SystemGrowthHomeView } from "@/app/dashboard/SystemGrowthHomeView";
import {
  loadHomeLearningTasks,
  selectRequiredTodayTasks,
} from "@/features/student-home-learning/api/service";
import type { HomeLearningTask } from "@/features/student-home-learning/api/types";
import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";
import { getStudentAppBasePath } from "@/lib/student-apps";
import { getStudentAppCourseScope } from "@/lib/student-app-data";
import { withStudentAppSchemaFallback } from "@/lib/student-app-data";
import { STUDENT_APP_IDS } from "@/lib/student-apps";


type LessonProgressRow = {
  lesson_id: string;
  course_id: string;
  status: string;
  progress_percent: number;
  started_at: string | null;
  last_viewed_at: string | null;
  completed_at: string | null;
};

type LessonRow = {
  id: string;
  slug: string;
  title: string;
  course_id: string;
  is_published: boolean;
};

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  category_id: string | null;
  level: string | null;
  support_teacher_name: string | null;
};

type CategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
};

type AnsweredQuestionRow = {
  id: string;
  title: string;
  course_id: string;
  lesson_id: string;
  teacher_name: string | null;
  answered_at: string | null;
  student_read_at: string | null;
  teacher_answer: string | null;
};

const MONTHLY_DAY_STUDY_MINUTES_CAP = 8 * 60;
const YEARLY_MONTH_STUDY_MINUTES_CAP = 200 * 60;

function formatStudyMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
}
function toSeoulDateString(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function parseDateStringToUTC(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function getSeoulHour() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hour12: false,
  });

  return Number(formatter.format(new Date()));
}

function getGreeting() {
  const hour = getSeoulHour();

  if (hour < 6) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function getWeekStartISOString() {
  const todayString = toSeoulDateString(new Date());
  const todayUTC = parseDateStringToUTC(todayString);

  const weekday = new Date(todayUTC).getUTCDay();
  const diffToMonday = weekday === 0 ? 6 : weekday - 1;

  const mondayUTC = todayUTC - diffToMonday * 86400000;

  // 韩国标准时间为 UTC+9，周统计按首尔当地周一零点开始。
  return new Date(mondayUTC - 9 * 60 * 60 * 1000).toISOString();
}

function calculateStreak(completedDateStrings: string[]) {
  const daySet = new Set(completedDateStrings);
  const todayString = toSeoulDateString(new Date());

  let cursor = parseDateStringToUTC(todayString);

  if (!daySet.has(todayString)) {
    cursor -= 86400000;
  }

  let streak = 0;

  while (true) {
    const cursorString = new Date(cursor).toISOString().slice(0, 10);

    if (!daySet.has(cursorString)) {
      break;
    }

    streak += 1;
    cursor -= 86400000;
  }

  return streak;
}

export default async function DashboardHomePage() {
  const requestNow = new Date();
  const auth = await requireActiveUser();
  const { supabase, user, profile } = auth;
  const userRole = auth.profile?.role ?? "student";
  const dashboardBasePath =
    userRole === "student" && auth.tenant?.slug
      ? getStudentAppBasePath(auth.tenant.slug, "korean")
      : getDashboardBasePath(auth.tenant?.slug);

  if (userRole !== "student" && userRole !== "platform_course_inspector") {
    redirect(
      scopeDashboardPath(
        "/dashboard/admin",
        dashboardBasePath
      )
    );
  }

  let studentName = "同学";
  let recentActivity: ActivityItem[] = [];
  let completedLessonsCount = 0;
  let inProgressLessonsCount = 0;
  let streakDays = 0;
  let thisWeekCompletedCount = 0;
  let vocabularyThisWeekSeconds = 0;
  let hero: ActivityItem | null = null;
  let reminders: ReminderItem[] = [];
  const weekActivityDays: WeekActivityDay[] = [];
  let todayStudyMinutes = 0;
  let recentSevenDayStudyMinutes = 0;
  let recentSevenDayActiveDays = 0;
  let monthDailyMinutes: number[] = [];
  let monthDailyTips: string[] = [];
  let monthLabel = "本月";
  let monthTotalMinutes = 0;
  let yearMonthlyMinutes: number[] = [];
  let yearMonthlyTips: string[] = [];
  let yearLabel = "今年";
  let yearTotalMinutes = 0;
  let courseProgressList: CourseProgressItem[] = [];
  let dailyLearningTasks: HomeLearningTask[] = [];
  let dailyLearningLoadFailed = false;

  if (user) {
    studentName =
      profile?.full_name || user.user_metadata?.name || user.email || "同学";

    const dailyLearningTasksPromise = auth.tenant
      ? loadHomeLearningTasks({
          supabase,
          tenantId: auth.tenant.id,
          studentId: user.id,
          studentAppId: STUDENT_APP_IDS.korean,
          appSlug: "korean",
          appLabel: "韩语学习",
          space: auth.tenant.slug,
          now: requestNow,
        })
          .then((tasks) => ({ tasks, failed: false }))
          .catch((error: unknown) => {
            console.error("[student-home] 今日学习任务读取失败", error);
            return { tasks: [] as HomeLearningTask[], failed: true };
          })
      : Promise.resolve({ tasks: [] as HomeLearningTask[], failed: false });
    const [koreanScope, dailyLearningResult] = await Promise.all([
      getStudentAppCourseScope(supabase, "korean"),
      dailyLearningTasksPromise,
    ]);
    dailyLearningTasks = dailyLearningResult.tasks;
    dailyLearningLoadFailed = dailyLearningResult.failed;
    const weekStart = getWeekStartISOString();
    const seoulTodayString = toSeoulDateString(new Date());
    const [seoulYear, seoulMonth] = seoulTodayString.split("-").map(Number);
    const learningLogFromISO = new Date(
      Date.UTC(seoulYear, 0, 1) - 9 * 60 * 60 * 1000
    ).toISOString();

    const [
      { data: progressData },
      { data: learningTimeLogData },
      { data: allCoursesData },
      { data: allSubcategoriesData },
      { data: allParentCategoriesData },
      { data: answeredQuestionsData },
    ] = await Promise.all([
      koreanScope.courseIds.length
        ? supabase
            .from("lesson_progress")
            .select(
              "lesson_id, course_id, status, progress_percent, started_at, last_viewed_at, completed_at"
            )
            .eq("user_id", user.id)
            .in("course_id", koreanScope.courseIds)
        : Promise.resolve({ data: [] as LessonProgressRow[] }),
      withStudentAppSchemaFallback(
        supabase
          .from("learning_time_log")
          .select("seconds, recorded_at, test_slug, source")
          .eq("student_id", user.id)
          .eq("student_app_id", STUDENT_APP_IDS.korean)
          .gte("recorded_at", learningLogFromISO),
        () =>
          supabase
            .from("learning_time_log")
            .select("seconds, recorded_at, test_slug, source")
            .eq("student_id", user.id)
            .gte("recorded_at", learningLogFromISO),
      ),
      koreanScope.courseIds.length
        ? supabase
            .from("courses")
            .select("id, slug, title, category_id, level, support_teacher_name")
            .in("id", koreanScope.courseIds)
            .eq("is_published", true)
        : Promise.resolve({ data: [] as CourseRow[] }),
      koreanScope.categoryIds.length
        ? supabase
            .from("course_categories")
            .select("id, parent_id, slug")
            .in("id", koreanScope.categoryIds)
            .not("parent_id", "is", null)
            .eq("is_published", true)
        : Promise.resolve({ data: [] as CategoryRow[] }),
      koreanScope.categoryIds.length
        ? supabase
            .from("course_categories")
            .select("id, parent_id, slug")
            .in("id", koreanScope.categoryIds)
            .is("parent_id", null)
            .eq("is_published", true)
        : Promise.resolve({ data: [] as CategoryRow[] }),
      koreanScope.courseIds.length
        ? supabase
            .from("lesson_questions")
            .select(
              "id, title, course_id, lesson_id, teacher_name, answered_at, student_read_at, teacher_answer"
            )
            .eq("student_id", user.id)
            .in("course_id", koreanScope.courseIds)
            .not("teacher_answer", "is", null)
            .order("answered_at", { ascending: false, nullsFirst: false })
            .limit(10)
        : Promise.resolve({ data: [] as AnsweredQuestionRow[] }),
    ]);

    const progressRows = (progressData ?? []) as LessonProgressRow[];

    completedLessonsCount = progressRows.filter(
      (row) => row.status === "completed"
    ).length;

    inProgressLessonsCount = progressRows.filter(
      (row) => row.status === "in_progress"
    ).length;

    thisWeekCompletedCount = progressRows.filter(
      (row) =>
        row.status === "completed" &&
        row.completed_at &&
        row.completed_at >= weekStart
    ).length;

    const learningTimeLogs = (learningTimeLogData ?? []) as {
      seconds: number;
      recorded_at: string;
      test_slug: string | null;
      source: string | null;
    }[];

    vocabularyThisWeekSeconds = learningTimeLogs
      .filter(
        (row) =>
          row.source === "toolbox" &&
          row.test_slug === "toolbox-vocabulary" &&
          row.recorded_at >= weekStart
      )
      .reduce((sum, row) => sum + Number(row.seconds), 0);

    const buildMinutesByDate = (
      logs: { seconds: number; recorded_at: string }[],
      cap: number
    ) => {
      const map = new Map<string, number>();
      for (const log of logs) {
        const dateString = toSeoulDateString(new Date(log.recorded_at));
        const accumulated =
          (map.get(dateString) ?? 0) + Number(log.seconds) / 60;
        map.set(dateString, Math.min(accumulated, cap));
      }
      return map;
    };

    const daysInMonth = new Date(
      Date.UTC(seoulYear, seoulMonth, 0)
    ).getUTCDate();
    const monthPrefix = `${seoulYear}-${String(seoulMonth).padStart(2, "0")}`;
    const monthMinutesByDay = new Map<number, number>();

    if (learningTimeLogs.length > 0) {
      for (const [dateString, minutes] of buildMinutesByDate(
        learningTimeLogs,
        MONTHLY_DAY_STUDY_MINUTES_CAP
      )) {
        if (!dateString.startsWith(monthPrefix)) continue;
        monthMinutesByDay.set(Number(dateString.slice(8, 10)), minutes);
      }
    } else {
      for (const row of progressRows) {
        if (!row.started_at || !row.last_viewed_at) continue;
        const startTime = new Date(row.started_at).getTime();
        const endTime = new Date(row.last_viewed_at).getTime();
        if (!(endTime > startTime)) continue;
        const sessionMinutes = Math.min(
          (endTime - startTime) / 60000,
          MONTHLY_DAY_STUDY_MINUTES_CAP
        );
        const dateString = toSeoulDateString(new Date(endTime));
        if (!dateString.startsWith(monthPrefix)) continue;
        const day = Number(dateString.slice(8, 10));
        const accumulated = (monthMinutesByDay.get(day) ?? 0) + sessionMinutes;
        monthMinutesByDay.set(
          day,
          Math.min(accumulated, MONTHLY_DAY_STUDY_MINUTES_CAP)
        );
      }
    }

    monthDailyMinutes = Array.from(
      { length: daysInMonth },
      (_, index) => monthMinutesByDay.get(index + 1) ?? 0
    );
    monthTotalMinutes = monthDailyMinutes.reduce((sum, minutes) => sum + minutes, 0);
    monthLabel = `${seoulMonth}月`;
    monthDailyTips = monthDailyMinutes.map(
      (minutes, index) =>
        `${index + 1} 日 · 学习 ${formatStudyMinutes(minutes)}`
    );

    const yearMinutesByMonth = new Map<number, number>();
    for (const [dateString, minutes] of buildMinutesByDate(
      learningTimeLogs,
      YEARLY_MONTH_STUDY_MINUTES_CAP
    )) {
      const [logYear, logMonth] = dateString.split("-").map(Number);
      if (logYear !== seoulYear) continue;
      const accumulated = (yearMinutesByMonth.get(logMonth) ?? 0) + minutes;
      yearMinutesByMonth.set(
        logMonth,
        Math.min(accumulated, YEARLY_MONTH_STUDY_MINUTES_CAP)
      );
    }
    yearMonthlyMinutes = Array.from(
      { length: 12 },
      (_, index) => yearMinutesByMonth.get(index + 1) ?? 0
    );
    yearTotalMinutes = yearMonthlyMinutes.reduce(
      (sum, minutes) => sum + minutes,
      0
    );
    yearLabel = `${seoulYear}年`;
    yearMonthlyTips = yearMonthlyMinutes.map(
      (minutes, index) =>
        `${index + 1} 月 · 学习 ${formatStudyMinutes(minutes)}`
    );

    const completedDateStrings = progressRows
      .filter((row) => row.status === "completed" && row.completed_at)
      .map((row) => toSeoulDateString(new Date(row.completed_at as string)));

    streakDays = calculateStreak(completedDateStrings);

    const countByDate = new Map<string, number>();
    for (const dateString of completedDateStrings) {
      countByDate.set(dateString, (countByDate.get(dateString) ?? 0) + 1);
    }

    const learningMinutesByDate = buildMinutesByDate(
      learningTimeLogs,
      MONTHLY_DAY_STUDY_MINUTES_CAP
    );
    const todayString = toSeoulDateString(new Date());
    const todayUTC = parseDateStringToUTC(todayString);
    for (let i = 6; i >= 0; i--) {
      const dateString = new Date(todayUTC - i * 86400000)
        .toISOString()
        .slice(0, 10);
      weekActivityDays.push({
        dateString,
        minutes: Math.round(learningMinutesByDate.get(dateString) ?? 0),
        completedCount: countByDate.get(dateString) ?? 0,
      });
    }

    todayStudyMinutes = Math.round(learningMinutesByDate.get(todayString) ?? 0);
    recentSevenDayStudyMinutes = weekActivityDays.reduce(
      (sum, day) => sum + day.minutes,
      0
    );
    recentSevenDayActiveDays = weekActivityDays.filter(
      (day) => day.minutes > 0
    ).length;

    const sortedByRecent = [...progressRows]
      .filter((row) => row.last_viewed_at)
      .sort((a, b) =>
        (b.last_viewed_at as string).localeCompare(a.last_viewed_at as string)
      );

    const recentRows = sortedByRecent.slice(0, 5);

    const touchedCourseIdsInOrder = [
      ...new Set(sortedByRecent.map((row) => row.course_id)),
    ];

    const lessonIdsNeeded = [
      ...new Set(recentRows.map((row) => row.lesson_id)),
    ];

    const unreadQuestions = (
      (answeredQuestionsData ?? []) as AnsweredQuestionRow[]
    ).filter(
      (row) =>
        !row.student_read_at ||
        (row.answered_at && row.student_read_at < row.answered_at)
    );
    const questionLessonIds = [
      ...new Set(unreadQuestions.map((row) => row.lesson_id)),
    ];

    const [
      { data: lessonsData },
      { data: touchedLessonsData },
      { data: questionLessonsData },
    ] = await Promise.all([
      lessonIdsNeeded.length > 0
        ? supabase
            .from("lessons")
            .select("id, slug, title, course_id, is_published")
            .in("id", lessonIdsNeeded)
        : Promise.resolve({ data: [] as LessonRow[] }),
      touchedCourseIdsInOrder.length > 0
        ? supabase
            .from("lessons")
            .select("id, course_id")
            .in("course_id", touchedCourseIdsInOrder)
            .eq("is_published", true)
        : Promise.resolve({ data: [] as { id: string; course_id: string }[] }),
      questionLessonIds.length > 0
        ? supabase
            .from("lessons")
            .select("id, slug")
            .in("id", questionLessonIds)
        : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
    ]);

    const lessons = (lessonsData ?? []) as LessonRow[];
    const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson]));

    const allCourses = (allCoursesData ?? []) as CourseRow[];

    const subcategories = (allSubcategoriesData ?? []) as CategoryRow[];
    const parentCategories = (allParentCategoriesData ?? []) as CategoryRow[];

    const courseMap = new Map(allCourses.map((course) => [course.id, course]));
    const subcategoryMap = new Map(subcategories.map((sub) => [sub.id, sub]));
    const parentCategoryMap = new Map(
      parentCategories.map((parent) => [parent.id, parent])
    );

    function buildLessonHref(courseId: string, lessonSlug: string): string | null {
      const course = courseMap.get(courseId);
      if (!course || !course.category_id) return null;

      const subcategory = subcategoryMap.get(course.category_id);
      if (!subcategory || !subcategory.parent_id) return null;

      const parentCategory = parentCategoryMap.get(subcategory.parent_id);
      if (!parentCategory) return null;

      return `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${lessonSlug}`;
    }

    function buildCourseHref(courseId: string): string | null {
      const course = courseMap.get(courseId);
      if (!course || !course.category_id) return null;

      const subcategory = subcategoryMap.get(course.category_id);
      if (!subcategory || !subcategory.parent_id) return null;

      const parentCategory = parentCategoryMap.get(subcategory.parent_id);
      if (!parentCategory) return null;

      return `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}`;
    }

    recentActivity = recentRows
      .map((row) => {
        const lesson = lessonMap.get(row.lesson_id);
        const course = courseMap.get(row.course_id);
        if (!lesson || !course) return null;

        return {
          lessonId: row.lesson_id,
          courseId: row.course_id,
          lessonTitle: lesson.title,
          courseTitle: course.title,
          status: row.status,
          progressPercent: row.progress_percent,
          lastViewedAt: row.last_viewed_at as string,
          href: buildLessonHref(row.course_id, lesson.slug),
        };
      })
      .filter((item): item is ActivityItem => item !== null);

    hero = recentActivity[0] ?? null;

    if (touchedCourseIdsInOrder.length > 0) {
      const totalCountByCourse = new Map<string, number>();
      for (const row of touchedLessonsData ?? []) {
        totalCountByCourse.set(
          row.course_id,
          (totalCountByCourse.get(row.course_id) ?? 0) + 1
        );
      }

      const completedCountByCourse = new Map<string, number>();
      const progressPercentByCourse = new Map<string, number>();
      for (const row of progressRows) {
        const lessonProgress =
          row.status === "completed"
            ? 100
            : Math.max(0, Math.min(100, row.progress_percent ?? 0));
        progressPercentByCourse.set(
          row.course_id,
          (progressPercentByCourse.get(row.course_id) ?? 0) + lessonProgress
        );

        if (row.status === "completed") {
          completedCountByCourse.set(
            row.course_id,
            (completedCountByCourse.get(row.course_id) ?? 0) + 1
          );
        }
      }

      courseProgressList = touchedCourseIdsInOrder
        .map((courseId) => {
          const course = courseMap.get(courseId);
          if (!course) return null;

          const totalCount = totalCountByCourse.get(courseId) ?? 0;
          const completedCount = completedCountByCourse.get(courseId) ?? 0;
          const percent =
            totalCount > 0
              ? Math.round(
                  (progressPercentByCourse.get(courseId) ?? 0) / totalCount
                )
              : 0;

          return {
            courseId,
            title: course.title,
            teacherName: course.support_teacher_name,
            completedCount,
            totalCount,
            percent,
            href: buildCourseHref(courseId),
          };
        })
        .filter((item): item is CourseProgressItem => item !== null);
    }

    const questionLessonMap = new Map(
      (questionLessonsData ?? []).map((lesson) => [lesson.id, lesson.slug])
    );

    const teacherReplyReminders: ReminderItem[] = unreadQuestions
      .slice(0, 3)
      .map((row) => {
        const lessonSlug = questionLessonMap.get(row.lesson_id);
        const lessonHref = lessonSlug
          ? buildLessonHref(row.course_id, lessonSlug)
          : null;

        const href = lessonHref
          ? `/api/lesson-questions/${row.id}/mark-read?to=${encodeURIComponent(lessonHref)}`
          : null;

        return {
          id: `reply-${row.id}`,
          kind: "teacher_reply" as const,
          title: row.title,
          subtitle: row.teacher_name ? `${row.teacher_name} 老师已回复` : "老师已回复",
          href,
        };
      });

    reminders = teacherReplyReminders;
  }
  const vocabularyThisWeekMinutes =
    vocabularyThisWeekSeconds > 0
      ? Math.max(1, Math.round(vocabularyThisWeekSeconds / 60))
      : 0;
  const heroCourseProgress = hero
    ? courseProgressList.find((course) => course.courseId === hero.courseId) ?? null
    : null;
  const coursesMissingNavigation = courseProgressList.filter(
    (course) => !course.href,
  );
  if (coursesMissingNavigation.length > 0) {
    console.warn("[student-home] Published courses are missing a complete category route", {
      courseIds: coursesMissingNavigation.map((course) => course.courseId),
      dashboardBasePath,
    });
  }
  const heroLessonProgress = hero
    ? hero.status === "completed"
      ? 100
      : Math.max(0, Math.min(100, hero.progressPercent ?? 0))
    : 0;
  const coursesHref = scopeDashboardPath(
    "/dashboard/courses",
    dashboardBasePath
  );
  const toolboxHref = scopeDashboardPath(
    "/dashboard/practice/skills",
    dashboardBasePath
  );
  const vocabularyHref = scopeDashboardPath(
    "/dashboard/practice/skills/vocabulary",
    dashboardBasePath
  );
  const recordsHref = scopeDashboardPath(
    "/dashboard/records",
    dashboardBasePath
  );
  const assignmentsHref = scopeDashboardPath(
    "/dashboard/assignments",
    dashboardBasePath,
  );
  const coursePracticeHref = scopeDashboardPath(
    "/dashboard/practice/course",
    dashboardBasePath,
  );
  const reviewHref = scopeDashboardPath(
    "/dashboard/practice/review",
    dashboardBasePath,
  );
  const heroHref = hero?.href
    ? scopeDashboardPath(hero.href, dashboardBasePath)
    : null;

  return (
    <SystemGrowthHomeView
      dashboardBasePath={dashboardBasePath}
      studentName={studentName}
      greeting={getGreeting()}
      hero={hero}
      heroHref={heroHref}
      heroLessonProgress={heroLessonProgress}
      heroCourseProgress={heroCourseProgress}
      reminders={reminders}
      recentActivity={recentActivity}
      courseProgressList={courseProgressList}
      weekActivityDays={weekActivityDays}
      completedLessonsCount={completedLessonsCount}
      inProgressLessonsCount={inProgressLessonsCount}
      thisWeekCompletedCount={thisWeekCompletedCount}
      streakDays={streakDays}
      todayStudyMinutes={todayStudyMinutes}
      recentSevenDayStudyMinutes={recentSevenDayStudyMinutes}
      recentSevenDayActiveDays={recentSevenDayActiveDays}
      vocabularyThisWeekMinutes={vocabularyThisWeekMinutes}
      coursesHref={coursesHref}
      toolboxHref={toolboxHref}
      vocabularyHref={vocabularyHref}
      recordsHref={recordsHref}
      monthStudy={{
        label: monthLabel,
        values: monthDailyMinutes,
        tips: monthDailyTips,
        totalMinutes: monthTotalMinutes,
        maxMinutes: MONTHLY_DAY_STUDY_MINUTES_CAP,
      }}
      yearStudy={{
        label: yearLabel,
        values: yearMonthlyMinutes,
        tips: yearMonthlyTips,
        totalMinutes: yearTotalMinutes,
        maxMinutes: YEARLY_MONTH_STUDY_MINUTES_CAP,
        xLabelUnit: "月",
      }}
      dailyLearningTasks={dailyLearningTasks}
      requiredTodayTasks={selectRequiredTodayTasks(dailyLearningTasks, requestNow)}
      dailyLearningLoadFailed={dailyLearningLoadFailed}
      dailyLearningNowISOString={requestNow.toISOString()}
      assignmentsHref={assignmentsHref}
      coursePracticeHref={coursePracticeHref}
      reviewHref={reviewHref}
    />
  );
}
