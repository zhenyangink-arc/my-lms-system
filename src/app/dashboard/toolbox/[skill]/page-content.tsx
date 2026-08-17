import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Circle,
  Ear,
  Layers3,
  LockKeyhole,
  Mic,
  PenTool,
  Shapes,
} from "lucide-react";

import { ToolboxStudyTimer } from "@/app/dashboard/toolbox/StudyTimer";
import { isPlatformTenantManagerRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import {
  getUnlockedChapterSlugs,
  isCourseUnlocked,
  isLessonUnlocked,
} from "@/lib/course-unlocks";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";
import { withStudentAppSchemaFallback } from "@/lib/student-app-data";
import {
  getStudentAppBasePath,
  STUDENT_APP_IDS,
} from "@/lib/student-apps";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ToolboxPracticeRunner,
  type ToolboxExercise,
  type ToolboxQuestion,
} from "./ToolboxPracticeRunner";

const skillMap: Record<
  string,
  {
    title: string;
    subtitle: string;
    description: string;
    icon: LucideIcon;
    accent: string;
    soft: string;
  }
> = {
  listening: {
    title: "听力训练",
    subtitle: "按课程章节练听辨",
    description: "重复播放本章韩语材料，训练关键信息捕捉和即时理解。",
    icon: Ear,
    accent: "var(--status-success)",
    soft: "var(--status-success-surface)",
  },
  speaking: {
    title: "口语训练",
    subtitle: "按课程章节练表达",
    description: "先开口说，再完成情境表达判断，让本章句型真正进入口语。",
    icon: Mic,
    accent: "var(--status-warning)",
    soft: "var(--status-warning-surface)",
  },
  reading: {
    title: "阅读训练",
    subtitle: "按课程章节练理解",
    description: "围绕本章字词、句型和语境完成信息定位与规则理解。",
    icon: BookOpen,
    accent: "var(--support)",
    soft: "var(--support-surface)",
  },
  writing: {
    title: "写作训练",
    subtitle: "按课程章节练书写",
    description: "先独立写出本章表达，再输入答案完成准确性核验。",
    icon: PenTool,
    accent: "var(--primary)",
    soft: "var(--accent)",
  },
  grammar: {
    title: "语法训练",
    subtitle: "按课程章节练结构",
    description: "把本章助词、句型和发音规则拆成短练习，逐项形成语感。",
    icon: Shapes,
    accent: "var(--support)",
    soft: "var(--support-surface)",
  },
  vocabulary: {
    title: "词汇训练",
    subtitle: "按课程章节练字词",
    description: "按本章语境辨认核心词语、韩文字母和常用搭配。",
    icon: BookOpen,
    accent: "var(--primary)",
    soft: "var(--accent)",
  },
};

type CourseRow = {
  id: string;
  category_id: string;
  slug: string;
  title: string;
  description: string;
  level: string;
  sort_order: number;
  unlock_mode: string | null;
  prerequisite_course_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
};

type LessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string;
  sort_order: number;
  unlock_mode: string | null;
  prerequisite_lesson_id: string | null;
  prerequisite_chapter_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
};

type CourseChapterRow = {
  id: string;
  lesson_id: string;
  chapter_test_id: string | null;
  slug: string;
  title: string;
  description: string;
  sort_order: number;
  unlock_mode: string | null;
  prerequisite_chapter_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean | null;
};

type ChapterTestRow = {
  id: string;
  slug: string;
  course_key: string;
  chapter_number: number;
  title: string;
  korean_title: string;
  skills: unknown;
};

type ExerciseRow = {
  id: string;
  skill: ToolboxExercise["skill"];
  title: string;
  description: string;
  instructions: string;
  content_payload: unknown;
  course_id: string | null;
  course_chapter_id: string | null;
  chapter_test_id: string | null;
};

type QuestionRow = {
  id: string;
  question_type: string;
  prompt: string;
  content_payload: unknown;
  max_score: number | string;
};

type AttemptRow = {
  test_slug: string;
  passed: boolean;
};

type PracticeSessionRow = {
  exercise_id: string | null;
  status: string;
};

type LessonProgressRow = {
  lesson_id: string;
  status: string;
};

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function parseOptions(value: unknown): Array<{ value: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const option = objectPayload(item);
    const value = stringValue(option.value);
    const label = stringValue(option.label);
    return value && label ? [{ value, label }] : [];
  });
}

function chapterFocus(test: ChapterTestRow | null, exercise: ExerciseRow | null) {
  const formalFocus = test
    ? Object.values(objectPayload(test.skills)).filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      )
    : [];
  if (formalFocus.length > 0) return formalFocus.slice(0, 3);

  return stringList(objectPayload(exercise?.content_payload).focus).slice(0, 2);
}

function levelLabel(level: string) {
  if (level === "advanced") return "高级";
  if (level === "intermediate") return "中级";
  return "入门";
}

export async function ToolboxSkillPage({
  params,
  searchParams,
  skillsBasePath = "/dashboard/toolbox",
  exerciseBasePath = "/dashboard/training",
  renderExercisePage = false,
}: {
  params: Promise<{ skill: string; space?: string }>;
  searchParams?: Promise<{ course?: string; lesson?: string; chapter?: string }>;
  skillsBasePath?: string;
  exerciseBasePath?: string;
  renderExercisePage?: boolean;
}) {
  const [{ skill }, selection, auth] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<{ course?: string; lesson?: string; chapter?: string }>({}),
    requireActiveUser(),
  ]);
  const { supabase, tenant, user, profile, platformProfile } = auth;
  const entry = skillMap[skill];
  if (!entry) notFound();

  const dashboardBasePath = tenant?.slug
    ? getStudentAppBasePath(tenant.slug, "korean")
    : getDashboardBasePath(null);
  const toolboxHref = scopeDashboardPath(skillsBasePath, dashboardBasePath);
  const skillCatalogHref = `${toolboxHref}/${encodeURIComponent(skill)}`;
  const skillExerciseBasePath = scopeDashboardPath(
    `${exerciseBasePath}/${encodeURIComponent(skill)}`,
    dashboardBasePath,
  );
  if (
    !renderExercisePage &&
    selection.course &&
    selection.lesson &&
    selection.chapter
  ) {
    redirect(
      `${skillExerciseBasePath}/${encodeURIComponent(selection.course)}/${encodeURIComponent(selection.lesson)}/${encodeURIComponent(selection.chapter)}`,
    );
  }
  const admin = createAdminClient();
  const bypassLearningSequence = isPlatformTenantManagerRole(
    platformProfile?.role ?? profile?.role,
  );

  const { data: courseData, error: courseError } = await admin
    .from("courses")
    .select(
      "id,category_id,slug,title,description,level,sort_order,unlock_mode,prerequisite_course_id,available_from,is_manually_locked",
    )
    .eq("student_app_id", STUDENT_APP_IDS.korean)
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  const courses = (courseData ?? []) as CourseRow[];
  const courseIds = courses.map((course) => course.id);

  const { data: lessonData, error: lessonError } = courseIds.length
    ? await admin
        .from("lessons")
        .select(
          "id,course_id,slug,title,description,sort_order,unlock_mode,prerequisite_lesson_id,prerequisite_chapter_id,available_from,is_manually_locked",
        )
        .in("course_id", courseIds)
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };
  const lessons = (lessonData ?? []) as LessonRow[];
  const lessonIds = lessons.map((lesson) => lesson.id);

  const [
    { data: courseChapterData, error: courseChapterError },
    { data: exerciseData, error: exerciseError },
    { data: attemptData, error: attemptError },
    { data: sessionData, error: sessionError },
    { data: lessonProgressData, error: lessonProgressError },
  ] = await Promise.all([
    lessonIds.length
      ? admin
          .from("course_chapters")
          .select(
            "id,lesson_id,chapter_test_id,slug,title,description,sort_order,unlock_mode,prerequisite_chapter_id,available_from,is_manually_locked",
          )
          .in("lesson_id", lessonIds)
          .eq("is_published", true)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    withStudentAppSchemaFallback(
      supabase
        .from("growth_toolbox_exercises")
        .select(
          "id,skill,title,description,instructions,content_payload,course_id,course_chapter_id,chapter_test_id",
        )
        .eq("student_app_id", STUDENT_APP_IDS.korean)
        .eq("skill", skill)
        .eq("status", "published")
        .not("course_chapter_id", "is", null)
        .order("sort_order", { ascending: true }),
      () =>
        supabase
          .from("growth_toolbox_exercises")
          .select(
            "id,skill,title,description,instructions,content_payload,course_id,course_chapter_id,chapter_test_id",
          )
          .eq("skill", skill)
          .eq("status", "published")
          .not("course_chapter_id", "is", null)
          .order("sort_order", { ascending: true }),
    ),
    supabase
      .from("chapter_test_attempts")
      .select("test_slug,passed")
      .eq("student_id", user.id)
      .eq("passed", true),
    withStudentAppSchemaFallback(
      supabase
        .from("toolbox_practice_sessions")
        .select("exercise_id,status")
        .eq("student_id", user.id)
        .eq("student_app_id", STUDENT_APP_IDS.korean)
        .eq("status", "completed"),
      () =>
        supabase
          .from("toolbox_practice_sessions")
          .select("exercise_id,status")
          .eq("student_id", user.id)
          .eq("status", "completed"),
    ),
    lessonIds.length
      ? supabase
          .from("lesson_progress")
          .select("lesson_id,status")
          .eq("user_id", user.id)
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const courseChapters = (courseChapterData ?? []) as CourseChapterRow[];
  const chapterTestIds = courseChapters.flatMap((chapter) =>
    chapter.chapter_test_id ? [chapter.chapter_test_id] : [],
  );
  const { data: chapterTestData, error: chapterTestError } = chapterTestIds.length
    ? await admin
        .from("chapter_tests")
        .select("id,slug,course_key,chapter_number,title,korean_title,skills")
        .in("id", chapterTestIds)
        .eq("student_app_id", STUDENT_APP_IDS.korean)
        .eq("status", "published")
    : { data: [], error: null };

  const chapterTests = (chapterTestData ?? []) as ChapterTestRow[];
  const chapterTestById = new Map(chapterTests.map((test) => [test.id, test]));
  const exercises = (exerciseData ?? []) as ExerciseRow[];
  const exerciseByCourseChapterId = new Map(
    exercises.flatMap((exercise) =>
      exercise.course_chapter_id
        ? [[exercise.course_chapter_id, exercise] as const]
        : [],
    ),
  );
  const completedExerciseIds = new Set(
    ((sessionData ?? []) as PracticeSessionRow[]).flatMap((session) =>
      session.exercise_id ? [session.exercise_id] : [],
    ),
  );
  const passedChapterSlugs = new Set(
    ((attemptData ?? []) as AttemptRow[]).map((attempt) => attempt.test_slug),
  );
  const completedLessonIds = new Set(
    ((lessonProgressData ?? []) as LessonProgressRow[])
      .filter((progress) => progress.status === "completed")
      .map((progress) => progress.lesson_id),
  );
  const completedCourseIds = new Set(
    courses.flatMap((course) => {
      const courseLessons = lessons.filter((lesson) => lesson.course_id === course.id);
      return courseLessons.length > 0 &&
        courseLessons.every((lesson) => completedLessonIds.has(lesson.id))
        ? [course.id]
        : [];
    }),
  );
  const chapterSlugById = new Map(
    courseChapters.map((chapter) => [chapter.id, chapter.slug]),
  );

  const courseUnlocked = new Map<string, boolean>();
  for (const course of courses) {
    const orderedCourses = courses.filter(
      (candidate) => candidate.category_id === course.category_id,
    );
    const courseIndex = orderedCourses.findIndex((candidate) => candidate.id === course.id);
    courseUnlocked.set(
      course.id,
      bypassLearningSequence ||
        isCourseUnlocked({
          course,
          courseIndex: Math.max(0, courseIndex),
          orderedCourses,
          completedCourseIds,
        }),
    );
  }

  const lessonUnlocked = new Map<string, boolean>();
  const chapterUnlocked = new Map<string, boolean>();
  for (const lesson of lessons) {
    const orderedLessons = lessons.filter(
      (candidate) => candidate.course_id === lesson.course_id,
    );
    const lessonIndex = orderedLessons.findIndex((candidate) => candidate.id === lesson.id);
    lessonUnlocked.set(
      lesson.id,
      bypassLearningSequence ||
        isLessonUnlocked({
          lesson,
          lessonIndex: Math.max(0, lessonIndex),
          orderedLessons,
          completedLessonIds,
          prerequisiteChapterSlugById: chapterSlugById,
          passedChapterSlugs,
        }),
    );

    const orderedChapters = courseChapters.filter(
      (chapter) => chapter.lesson_id === lesson.id,
    );
    const unlockedSlugs = getUnlockedChapterSlugs({
      chapters: orderedChapters,
      passedChapterSlugs,
    });
    for (const chapter of orderedChapters) {
      chapterUnlocked.set(
        chapter.id,
        bypassLearningSequence || unlockedSlugs.has(chapter.slug),
      );
    }
  }

  const catalogDataError = Boolean(
    courseError ||
      lessonError ||
      courseChapterError ||
      exerciseError ||
      attemptError ||
      sessionError ||
      lessonProgressError ||
      chapterTestError,
  );
  if (catalogDataError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <section role="alert" className="app-card rounded-3xl border p-8 text-center">
          <Circle className="mx-auto opacity-50" size={32} aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold">专项训练暂时无法读取</h2>
          <p className="app-muted-text mt-2 text-sm leading-6">
            课程或练习数据加载失败，请稍后刷新页面；你也可以先返回专项训练目录。
          </p>
          <Link
            href={toolboxHref}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
            style={{ borderColor: "var(--border)", outlineColor: "var(--primary)" }}
          >
            返回专项训练目录
          </Link>
        </section>
      </div>
    );
  }

  const selectedUnit = selection.course && selection.chapter
    ? courseChapters.flatMap((chapter) => {
        const lesson = lessons.find((candidate) => candidate.id === chapter.lesson_id);
        const course = lesson
          ? courses.find((candidate) => candidate.id === lesson.course_id)
          : null;
        const test = chapter.chapter_test_id
          ? chapterTestById.get(chapter.chapter_test_id) ?? null
          : null;
        const currentRouteMatches =
          course?.slug === selection.course &&
          (!selection.lesson || lesson?.slug === selection.lesson) &&
          chapter.slug === selection.chapter;
        const legacyRouteMatches =
          !selection.lesson &&
          test?.course_key === selection.course &&
          test?.slug === selection.chapter;
        return course && lesson && (currentRouteMatches || legacyRouteMatches)
          ? [{ course, lesson, chapter, test }]
          : [];
      })[0] ?? null
    : null;
  const hasIncompleteSelection = Boolean(
    selection.course || selection.lesson || selection.chapter,
  ) && !selectedUnit;
  if (hasIncompleteSelection) notFound();
  if (
    selectedUnit &&
    !bypassLearningSequence &&
    (!courseUnlocked.get(selectedUnit.course.id) ||
      !lessonUnlocked.get(selectedUnit.lesson.id) ||
      !chapterUnlocked.get(selectedUnit.chapter.id))
  ) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <section className="app-card rounded-3xl border p-8 text-center">
          <LockKeyhole className="mx-auto" size={32} aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold">本章训练尚未开放</h2>
          <p className="app-muted-text mt-2 text-sm leading-6">
            请先完成前置课程、课时或章节，再返回这里继续训练。
          </p>
          <Link
            href={skillCatalogHref}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
            style={{ borderColor: "var(--border)", outlineColor: "var(--primary)" }}
          >
            返回{entry.title}课程目录
          </Link>
        </section>
      </div>
    );
  }
  if (selectedUnit && !renderExercisePage) {
    redirect(
      `${skillExerciseBasePath}/${encodeURIComponent(selectedUnit.course.slug)}/${encodeURIComponent(selectedUnit.lesson.slug)}/${encodeURIComponent(selectedUnit.chapter.slug)}`,
    );
  }
  if (renderExercisePage && !selectedUnit) notFound();

  const selectedExercise = selectedUnit
    ? exerciseByCourseChapterId.get(selectedUnit.chapter.id) ?? null
    : null;
  const { data: questionData, error: questionError } = selectedExercise
    ? await supabase
        .from("growth_toolbox_questions")
        .select("id,question_type,prompt,content_payload,max_score")
        .eq("exercise_id", selectedExercise.id)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };

  const exercisePayload = objectPayload(selectedExercise?.content_payload);
  const exercise: ToolboxExercise | null = selectedExercise
    ? {
        id: selectedExercise.id,
        skill: selectedExercise.skill,
        title: selectedExercise.title,
        description: selectedExercise.description,
        instructions: selectedExercise.instructions,
        passageTitle: stringValue(exercisePayload.passageTitle),
        passage: stringValue(exercisePayload.passage),
        helper: stringValue(exercisePayload.helper),
      }
    : null;
  const questions: ToolboxQuestion[] = ((questionData ?? []) as QuestionRow[])
    .filter(
      (question) =>
        question.question_type === "single_choice" ||
        question.question_type === "true_false" ||
        question.question_type === "short_text",
    )
    .map((question) => {
      const payload = objectPayload(question.content_payload);
      return {
        id: question.id,
        questionType: question.question_type as ToolboxQuestion["questionType"],
        prompt: question.prompt,
        options: parseOptions(payload.options),
        hint: stringValue(payload.hint),
        stimulus: stringValue(payload.stimulus),
        speakBeforeAnswer: payload.speakBeforeAnswer === true,
        maxScore: Number(question.max_score) || 0,
      };
    });

  const catalog = courses.map((course) => ({
    ...course,
    lessons: lessons
      .filter((lesson) => lesson.course_id === course.id)
      .map((lesson) => ({
        ...lesson,
        chapters: courseChapters.filter((chapter) => chapter.lesson_id === lesson.id),
      })),
  }));
  const Icon = entry.icon;

  if (!selectedUnit) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Link
          href={toolboxHref}
          className="app-muted-text inline-flex min-h-11 items-center gap-2 rounded-lg text-xs font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
          style={{ outlineColor: "var(--primary)" }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          返回专项训练
        </Link>

        <header className="app-card rounded-3xl border p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4 sm:items-center">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                style={{ color: entry.accent, backgroundColor: entry.soft }}
              >
                <Icon size={26} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-bold tracking-[0.1em]" style={{ color: entry.accent }}>
                  专项训练 · {entry.subtitle}
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">{entry.title}</h2>
                <p className="app-muted-text mt-2 max-w-2xl text-sm font-bold leading-6">
                  {entry.description}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 lg:shrink-0">
              {[
                [courses.length, "门课程"],
                [lessons.length, "个课时"],
                [exercises.length, "章可练"],
              ].map(([value, label]) => (
                <span key={label} className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: "var(--surface-soft)" }}>
                  <strong className="block text-lg font-bold tabular-nums">{value}</strong>
                  <small className="app-muted-text text-[10px] font-bold">{label}</small>
                </span>
              ))}
            </div>
          </div>
        </header>

        <section aria-labelledby="skill-chapter-title">
          <div className="mb-3 px-1">
            <h2 id="skill-chapter-title" className="text-lg font-bold">选择课程、课时与章节</h2>
            <p className="app-muted-text mt-1 text-xs font-bold">
              与韩语课程目录一一对应；正式章节遵循学习顺序，新课程首批课时直接进入对应训练。
            </p>
          </div>
          <div className="space-y-3">
            {catalog.length === 0 && (
              <div className="app-soft-card rounded-3xl border border-dashed p-8 text-center">
                <BookOpen className="mx-auto opacity-40" size={30} aria-hidden="true" />
                <p className="mt-3 text-sm font-bold">暂无可训练课程</p>
                <p className="app-muted-text mt-2 text-xs leading-5">
                  课程与训练章节发布后会显示在这里。
                </p>
              </div>
            )}
            {catalog.map((course, courseIndex) => {
              const courseChapterCount = course.lessons.reduce(
                (total, lesson) => total + lesson.chapters.length,
                0,
              );
              const isCourseAvailable = courseUnlocked.get(course.id) ?? false;
              return (
                <details
                  key={course.id}
                  className="app-card group overflow-hidden rounded-3xl border"
                  open={courseIndex === 0}
                >
                  <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-[-3px] [&::-webkit-details-marker]:hidden">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: entry.accent, backgroundColor: entry.soft }}>
                      {isCourseAvailable ? <Layers3 size={18} aria-hidden="true" /> : <LockKeyhole size={17} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm font-bold">{course.title}</strong>
                        <small className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: entry.accent, backgroundColor: entry.soft }}>
                          {levelLabel(course.level)}
                        </small>
                      </span>
                      <small className="app-muted-text mt-1 block text-[11px] font-bold">
                        {course.lessons.length} 个课时 · {courseChapterCount} 个训练章节
                      </small>
                    </span>
                    <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>

                  <div className="space-y-3 border-t p-3" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-soft)" }}>
                    {course.lessons.length === 0 && (
                      <p className="app-muted-text rounded-2xl border border-dashed p-5 text-center text-xs font-bold">
                        本课程暂无已发布课时。
                      </p>
                    )}
                    {course.lessons.map((lesson, lessonIndex) => {
                      const isLessonAvailable = isCourseAvailable && (lessonUnlocked.get(lesson.id) ?? false);
                      return (
                        <section key={lesson.id} className="app-card overflow-hidden rounded-2xl border">
                          <header className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
                            <span className="app-muted-text text-[11px] font-bold tabular-nums">
                              {String(lessonIndex + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-bold">{lesson.title}</h3>
                              <p className="app-muted-text mt-0.5 line-clamp-1 text-[11px] font-bold">{lesson.description}</p>
                            </div>
                            <small className="app-muted-text shrink-0 text-[10px] font-bold">
                              {lesson.chapters.length} 章
                            </small>
                          </header>

                          <div className="grid gap-2 p-3 sm:grid-cols-2">
                            {lesson.chapters.length === 0 && (
                              <p className="app-muted-text p-3 text-xs font-bold sm:col-span-2">
                                本课时暂无训练章节。
                              </p>
                            )}
                            {lesson.chapters.map((chapter) => {
                              const chapterExercise = exerciseByCourseChapterId.get(chapter.id) ?? null;
                              const test = chapter.chapter_test_id
                                ? chapterTestById.get(chapter.chapter_test_id) ?? null
                                : null;
                              const available = Boolean(chapterExercise);
                              const unlocked = isLessonAvailable && (chapterUnlocked.get(chapter.id) ?? false);
                              const completed = chapterExercise
                                ? completedExerciseIds.has(chapterExercise.id)
                                : false;
                              const focus = chapterFocus(test, chapterExercise);
                              const displayTitle = test?.title ?? "本课专项训练";
                              const displayNumber = test?.chapter_number ?? chapter.sort_order;
                              const content = (
                                <>
                                  <span
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold"
                                    style={{ color: unlocked ? entry.accent : "var(--foreground-muted)", backgroundColor: "var(--surface-soft)" }}
                                  >
                                    {!unlocked ? <LockKeyhole size={15} aria-hidden="true" /> : completed ? <CheckCircle2 size={16} aria-hidden="true" /> : String(displayNumber).padStart(2, "0")}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <strong className="block text-sm font-bold">{displayTitle}</strong>
                                    <small className="app-muted-text mt-0.5 block text-[11px] font-bold">
                                      {test?.korean_title || (test ? "正式章节题库" : "与本课正文同步")}
                                    </small>
                                    {focus.length > 0 && (
                                      <span className="mt-2 flex flex-wrap gap-1.5">
                                        {focus.map((item, focusIndex) => (
                                          <small key={`${focusIndex}-${item}`} className="max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: entry.accent, backgroundColor: entry.soft }}>
                                            {item}
                                          </small>
                                        ))}
                                      </span>
                                    )}
                                  </span>
                                  <span className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-bold" style={{ color: unlocked && available ? entry.accent : "var(--foreground-muted)" }}>
                                    {!unlocked ? "未开放" : !available ? "同步中" : completed ? "再练" : "开始"}
                                    {unlocked && available && <ArrowRight size={13} aria-hidden="true" />}
                                  </span>
                                </>
                              );

                              return unlocked && available ? (
                                <Link
                                  key={chapter.id}
                                  href={`${skillExerciseBasePath}/${encodeURIComponent(course.slug)}/${encodeURIComponent(lesson.slug)}/${encodeURIComponent(chapter.slug)}`}
                                  className="app-card flex min-h-24 items-center gap-3 rounded-2xl border p-3 transition-[border-color,box-shadow] hover:shadow-sm focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                                  style={{ outlineColor: entry.accent }}
                                >
                                  {content}
                                </Link>
                              ) : (
                                <article key={chapter.id} className="app-card flex min-h-24 items-center gap-3 rounded-2xl border p-3 opacity-60">
                                  {content}
                                </article>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  const selectedNumber = selectedUnit.test?.chapter_number ?? selectedUnit.chapter.sort_order;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {exercise && questions.length > 0 && <ToolboxStudyTimer skill={skill} />}
      <Link
        href={skillCatalogHref}
        className="app-muted-text inline-flex min-h-11 items-center gap-2 rounded-lg text-xs font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
        style={{ outlineColor: "var(--primary)" }}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        返回{entry.title}课程目录
      </Link>

      <header className="app-card rounded-3xl border p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:items-center">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ color: entry.accent, backgroundColor: entry.soft }}>
              <Icon size={26} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-bold tracking-[0.08em]" style={{ color: entry.accent }}>
                {entry.title} · {selectedUnit.course.title} · {selectedUnit.lesson.title} · 第 {String(selectedNumber).padStart(2, "0")} 章
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                {selectedUnit.test?.title ?? "本课专项训练"}
              </h2>
              <p className="app-muted-text mt-1 text-sm font-bold">
                {selectedUnit.test?.korean_title || selectedUnit.chapter.description}
              </p>
            </div>
          </div>
          {exercise && (
            <span className="rounded-full px-3 py-2 text-[11px] font-bold" style={{ color: entry.accent, backgroundColor: entry.soft }}>
              {questions.length} 题 · 结果独立记录
            </span>
          )}
        </div>
        {exercise?.instructions && (
          <p className="app-muted-text mt-4 border-t pt-4 text-sm font-bold leading-6" style={{ borderColor: "var(--border-subtle)" }}>
            {exercise.instructions}
          </p>
        )}
      </header>

      {questionError ? (
        <section role="alert" className="app-card flex min-h-56 flex-col items-center justify-center rounded-3xl border p-8 text-center">
          <Circle className="opacity-50" size={28} aria-hidden="true" />
          <h2 className="mt-3 text-base font-bold">练习题暂时无法读取</h2>
          <p className="app-muted-text mt-2 max-w-md text-sm font-bold leading-6">
            题目加载失败，请稍后刷新页面；已完成的学习进度不会受影响。
          </p>
        </section>
      ) : !exercise || questions.length === 0 ? (
        <section className="app-soft-card flex min-h-56 flex-col items-center justify-center rounded-3xl border p-8 text-center">
          <Circle size={28} className="opacity-40" aria-hidden="true" />
          <h2 className="mt-3 text-base font-bold">本章练习正在同步</h2>
          <p className="app-muted-text mt-2 max-w-md text-sm font-bold leading-6">
            课程、课时与章节关系已经建立，题目发布后会直接显示在这里。
          </p>
        </section>
      ) : (
        <ToolboxPracticeRunner
          exercise={exercise}
          questions={questions}
          backHref={skillCatalogHref}
          accent={entry.accent}
          soft={entry.soft}
        />
      )}
    </div>
  );
}

export default function LegacyToolboxSkillPage({
  params,
  searchParams,
}: {
  params: Promise<{ skill: string; space?: string }>;
  searchParams?: Promise<{ course?: string; lesson?: string; chapter?: string }>;
}) {
  return <ToolboxSkillPage params={params} searchParams={searchParams} />;
}
