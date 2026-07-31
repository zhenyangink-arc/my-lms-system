import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";

import { requireAssessmentPaperManager } from "@/lib/assessment-papers";
import { questionOptions } from "@/lib/question-bank";
import {
  ChapterTestRandomPicker,
  type ChapterPoolQuestion,
} from "../ChapterTestRandomPicker";
import { ChapterTestQuestionViewer } from "./ChapterTestQuestionViewer";

type ChapterTestRow = {
  id: string;
  lesson_id: string;
  slug: string;
  course_key: string;
  chapter_number: number;
  title: string;
  korean_title: string;
  description: string;
  duration_minutes: number;
  passing_score: number;
  version: number;
  status: "draft" | "published" | "archived";
};

type ChapterQuestionRow = {
  id: string;
  test_id: string;
  prompt: string;
  options: unknown;
  difficulty: "foundation" | "medium" | "hard" | "expert";
  sort_order: number;
  is_chapter_test_item: boolean;
};

type CatalogLessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  sort_order: number;
};

type CatalogCourseRow = {
  id: string;
  category_id: string;
  slug: string;
  title: string;
  sort_order: number;
};

type CatalogCategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  sort_order: number;
};

const difficultyLabels = {
  foundation: "基础",
  medium: "中等",
  hard: "困难",
  expert: "极难",
} as const;

function lessonLabel(title: string, order: number) {
  return /^第\s*\d+\s*课[：:]/u.test(title)
    ? title
    : `第 ${order} 课：${title}`;
}

export default async function ChapterTestManagementPage() {
  const { supabase } = await requireAssessmentPaperManager();
  const [
    testsResult,
    questionsResult,
    lessonsResult,
    coursesResult,
    categoriesResult,
  ] = await Promise.all([
    supabase
      .from("course_tests")
      .select(
        "id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,duration_minutes,passing_score,version,status"
      )
      .order("course_key", { ascending: true })
      .order("chapter_number", { ascending: true }),
    supabase
      .from("course_test_questions")
      .select(
        "id,test_id,prompt,options,difficulty,sort_order,is_chapter_test_item,status,question_type"
      )
      .eq("status", "published")
      .eq("question_type", "single_choice")
      .order("sort_order", { ascending: true }),
    supabase
      .from("lessons")
      .select("id,course_id,slug,title,sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("courses")
      .select("id,category_id,slug,title,sort_order")
      .eq("is_published", true),
    supabase
      .from("course_categories")
      .select("id,parent_id,slug,title,sort_order")
      .eq("is_published", true),
  ]);
  const tests = (testsResult.data ?? []) as ChapterTestRow[];
  const questions = (questionsResult.data ?? []) as ChapterQuestionRow[];
  const lessons = (lessonsResult.data ?? []) as CatalogLessonRow[];
  const courses = (coursesResult.data ?? []) as CatalogCourseRow[];
  const categories = (categoriesResult.data ?? []) as CatalogCategoryRow[];
  const questionsByTest = new Map<string, ChapterQuestionRow[]>();
  questions.forEach((question) => {
    const current = questionsByTest.get(question.test_id) ?? [];
    current.push(question);
    questionsByTest.set(question.test_id, current);
  });
  const publishedCount = tests.filter(
    (test) => test.status === "published"
  ).length;
  const lessonsBySlug = new Map(
    lessons.map((lesson) => [lesson.slug, lesson])
  );
  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  );
  const testsByLessonId = new Map<string, ChapterTestRow[]>();
  const unlinkedTests: ChapterTestRow[] = [];

  tests.forEach((test) => {
    const lesson =
      lessonsById.get(test.lesson_id) ?? lessonsBySlug.get(test.course_key);
    if (!lesson) {
      unlinkedTests.push(test);
      return;
    }

    const current = testsByLessonId.get(lesson.id) ?? [];
    current.push(test);
    testsByLessonId.set(lesson.id, current);
  });

  const koreanCategory = categories.find(
    (category) => category.slug === "korean" && category.parent_id === null
  );
  const koreanSubcategories = categories
    .filter((category) => category.parent_id === koreanCategory?.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const koreanSubcategoryIds = new Set(
    koreanSubcategories.map((subcategory) => subcategory.id)
  );
  const koreanCourses = courses
    .filter((course) => koreanSubcategoryIds.has(course.category_id))
    .sort((a, b) => a.sort_order - b.sort_order);
  const koreanCourseIds = new Set(koreanCourses.map((course) => course.id));

  const curriculumGroups = lessons
    .filter((lesson) => koreanCourseIds.has(lesson.course_id))
    .map((lesson) => {
      const course = coursesById.get(lesson.course_id);
      const subcategory = course
        ? categoriesById.get(course.category_id)
        : undefined;
      const category = subcategory?.parent_id
        ? categoriesById.get(subcategory.parent_id)
        : undefined;

      return {
        key: lesson.id,
        categoryTitle: category?.title ?? "课程目录",
        subcategoryId: subcategory?.id ?? "",
        subcategoryTitle: subcategory?.title ?? "",
        subcategoryOrder: subcategory?.sort_order ?? Number.MAX_SAFE_INTEGER,
        courseId: course?.id ?? "",
        courseTitle: course?.title ?? "未关联课程",
        courseOrder: course?.sort_order ?? Number.MAX_SAFE_INTEGER,
        lessonTitle: lesson.title,
        lessonOrder: lesson.sort_order,
        tests: testsByLessonId.get(lesson.id) ?? [],
      };
    });

  unlinkedTests.forEach((test) => {
    curriculumGroups.push({
      key: `unlinked:${test.id}`,
      categoryTitle: "课程目录",
      subcategoryId: "",
      subcategoryTitle: "",
      subcategoryOrder: Number.MAX_SAFE_INTEGER,
      courseId: "",
      courseTitle: "未关联课程",
      courseOrder: Number.MAX_SAFE_INTEGER,
      lessonTitle: test.course_key,
      lessonOrder: Number.MAX_SAFE_INTEGER,
      tests: [test],
    });
  });

  curriculumGroups.sort(
    (a, b) =>
      a.subcategoryOrder - b.subcategoryOrder ||
      a.courseOrder - b.courseOrder ||
      a.lessonOrder - b.lessonOrder
  );
  const curriculumChannels = koreanSubcategories.map((subcategory) => {
    const channelCourses = koreanCourses.filter(
      (course) => course.category_id === subcategory.id
    );
    const channelCourseIds = new Set(channelCourses.map((course) => course.id));
    const groups = curriculumGroups.filter((group) =>
      channelCourseIds.has(group.courseId)
    );

    return {
      id: subcategory.id,
      title: subcategory.title,
      order: subcategory.sort_order,
      courses: channelCourses,
      groups,
      testCount: groups.reduce(
        (total, group) => total + group.tests.length,
        0
      ),
    };
  });
  const unlinkedGroups = curriculumGroups.filter(
    (group) => group.courseId === ""
  );

  return (
    <div className="pb-12">
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/admin/assignments"
          className="app-muted-text inline-flex items-center gap-2 text-xs font-black"
        >
          <ArrowLeft size={14} />
          返回作业考试管理
        </Link>

        <section
          className="app-card rounded-3xl border p-5 sm:p-6"
          style={{
            background:
              "linear-gradient(125deg, var(--app-card-bg), var(--app-success-soft), var(--app-accent-soft))",
          }}
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px] xl:items-center">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{
                  color: "var(--app-success)",
                  backgroundColor: "var(--app-success-soft)",
                }}
              >
                <ShieldCheck size={15} />
                平台专属管理
              </span>
              <div className="mt-3 flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">
                  章节测试管理
                </h1>
                <span className="group relative shrink-0">
                  <CircleAlert
                    className="app-muted-text cursor-help"
                    size={16}
                    aria-hidden="true"
                  />
                  <span className="invisible absolute left-1/2 top-full z-20 w-80 -translate-x-1/2 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                    <span
                      role="tooltip"
                      className="app-card block rounded-2xl border p-3 text-xs font-normal leading-5 app-muted-text shadow-lg"
                    >
                      平台统一控制课程章节测试；机构负责人、机构管理员和老师没有此入口。
                    </span>
                  </span>
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["全部章节", tests.length, BookOpenCheck],
                ["已发布", publishedCount, CheckCircle2],
                [
                  "当前题目",
                  questions.filter((question) => question.is_chapter_test_item)
                    .length,
                  FlaskConical,
                ],
              ].map(([label, value, Icon]) => {
                const MetricIcon = Icon as typeof FlaskConical;
                return (
                  <div
                    key={String(label)}
                    className="app-card rounded-2xl border p-4 text-center"
                  >
                    <MetricIcon
                      className="mx-auto"
                      size={17}
                      style={{ color: "var(--app-success)" }}
                    />
                    <p className="mt-2 text-2xl font-black">{String(value)}</p>
                    <p className="app-muted-text text-[11px] font-black">
                      {String(label)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {(testsResult.error ||
          questionsResult.error ||
          lessonsResult.error ||
          coursesResult.error ||
          categoriesResult.error) && (
          <section
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
              borderColor: "var(--app-warm)",
            }}
          >
            章节测试暂时无法完整读取，请稍后刷新页面。
          </section>
        )}

        <section className="space-y-6">
          {curriculumChannels.map((channel, channelIndex) => (
            <details
              key={channel.id}
              open={channelIndex === 0}
              className="app-card rounded-3xl border"
            >
              <summary className="cursor-pointer list-none p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black"
                      style={{
                        color: "var(--app-success)",
                        backgroundColor: "var(--app-success-soft)",
                      }}
                    >
                      {String(channel.order).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="app-muted-text text-[10px] font-black">
                        {koreanCategory?.title ?? "韩语课程"} · 课程通道
                      </p>
                      <h2 className="mt-1 text-xl font-black">
                        {channel.title}
                      </h2>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                    <span className="app-soft-card rounded-full border px-3 py-1.5">
                      {channel.courses.length} 门课程
                    </span>
                    <span
                      className="rounded-full px-3 py-1.5"
                      style={{
                        color: "var(--app-success)",
                        backgroundColor: "var(--app-success-soft)",
                      }}
                    >
                      {channel.testCount} 个章节测试
                    </span>
                  </div>
                </div>
              </summary>

              <div
                className="space-y-6 border-t p-4 sm:p-5"
                style={{ borderColor: "var(--app-border-soft)" }}
              >
                {channel.groups.map((group) => (
                  <details
                    key={group.key}
                    open
                    className="space-y-4 rounded-3xl"
                  >
              <summary className="app-card cursor-pointer list-none rounded-3xl border p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="app-muted-text text-[11px] font-black">
                      {[group.categoryTitle, group.subcategoryTitle]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black">
                        {group.courseTitle}
                      </h2>
                      <ArrowRight
                        className="app-muted-text"
                        size={15}
                        aria-hidden="true"
                      />
                      <p className="font-black text-[var(--app-success)]">
                        {lessonLabel(group.lessonTitle, group.lessonOrder)}
                      </p>
                    </div>
                  </div>
                  <span
                    className="w-fit rounded-full px-3 py-1.5 text-xs font-black"
                    style={{
                      color: "var(--app-success)",
                      backgroundColor: "var(--app-success-soft)",
                    }}
                  >
                    {group.tests.length} 个章节测试
                  </span>
                </div>
              </summary>

              <div className="grid gap-4 pt-4 md:grid-cols-2 xl:grid-cols-4">
                {group.tests.map((test) => {
            const poolQuestions = questionsByTest.get(test.id) ?? [];
            const testQuestions = poolQuestions.filter(
              (question) => question.is_chapter_test_item
            );
            const difficultyCount = new Map<string, number>();
            testQuestions.forEach((question) =>
              difficultyCount.set(
                question.difficulty,
                (difficultyCount.get(question.difficulty) ?? 0) + 1
              )
            );
            return (
              <article
                key={test.id}
                className="app-card rounded-3xl border p-4 sm:p-5"
              >
                <div className="flex flex-col gap-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-black"
                        style={{
                          color: "var(--app-accent)",
                          backgroundColor: "var(--app-accent-soft)",
                        }}
                      >
                        CHAPTER {String(test.chapter_number).padStart(2, "0")}
                      </span>
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-black"
                        style={{
                          color:
                            test.status === "published"
                              ? "var(--app-success)"
                              : "var(--app-muted)",
                          backgroundColor:
                            test.status === "published"
                              ? "var(--app-success-soft)"
                              : "var(--app-soft-bg)",
                        }}
                      >
                        {test.status === "published"
                          ? "学生端已开放"
                          : test.status === "draft"
                            ? "草稿"
                            : "已归档"}
                      </span>
                      <span className="app-muted-text text-[10px] font-black">
                        v{test.version}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5">
                      <h2 className="text-xl font-black">{test.title}</h2>
                      <span className="group/note relative shrink-0">
                        <CircleAlert
                          className="app-muted-text cursor-help"
                          size={14}
                          aria-hidden="true"
                        />
                        <span className="invisible absolute left-1/2 top-full z-30 w-64 -translate-x-1/2 pt-2 opacity-0 transition group-hover/note:visible group-hover/note:opacity-100">
                          <span
                            role="tooltip"
                            className="app-card block rounded-2xl border p-3 text-xs font-normal leading-5 app-muted-text shadow-lg"
                          >
                            {test.description || "暂未填写章节测试说明。"}
                          </span>
                        </span>
                      </span>
                    </div>
                    <div className="app-muted-text mt-4 flex flex-wrap gap-3 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <FlaskConical size={13} />
                        当前 {testQuestions.length} 题
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={13} />
                        {test.duration_minutes} 分钟
                      </span>
                      <span>分数：100分</span>
                    </div>
                  </div>

                  <div className="grid shrink-0 grid-cols-4 gap-2">
                    {Object.entries(difficultyLabels).map(([value, label]) => (
                      <div
                        key={value}
                        className="app-soft-card rounded-xl border p-2.5 text-center"
                      >
                        <p className="text-lg font-black">
                          {difficultyCount.get(value) ?? 0}
                        </p>
                        <p className="app-muted-text text-[10px]">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <ChapterTestQuestionViewer
                  testTitle={test.title}
                  questions={testQuestions.map((question) => ({
                    id: question.id,
                    prompt: question.prompt,
                    options: questionOptions(question.options),
                    difficulty: question.difficulty,
                  }))}
                />

                <div
                  className="mt-4 flex flex-wrap justify-end gap-3 border-t pt-4"
                  style={{ borderColor: "var(--app-border-soft)" }}
                >
                  <ChapterTestRandomPicker
                    testId={test.id}
                    testTitle={test.title}
                    questions={poolQuestions.map(
                      (question): ChapterPoolQuestion => ({
                        id: question.id,
                        prompt: question.prompt,
                        options: questionOptions(question.options),
                        difficulty: question.difficulty,
                      })
                    )}
                    initialQuestionIds={testQuestions.map(
                      (question) => question.id
                    )}
                  />
                  {test.status === "published" && (
                    <Link
                      href={`/dashboard/assignments/korean/${test.slug}`}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white"
                      style={{ backgroundColor: "var(--app-secondary)" }}
                    >
                      预览学生端
                      <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              </article>
            );
                })}
                {group.tests.length === 0 && (
                  <div className="app-card rounded-3xl border border-dashed p-8 text-center md:col-span-2 xl:col-span-4">
                    <FlaskConical className="mx-auto opacity-30" size={30} />
                    <p className="mt-3 font-black">该课暂未建立章节测试</p>
                    <p className="app-muted-text mt-2 text-xs">
                      课时通道已经保留；后续新增章节测试后会自动显示在这里。
                    </p>
                  </div>
                )}
              </div>
                  </details>
                ))}

                {channel.groups.length === 0 && (
                  <div className="app-soft-card rounded-3xl border border-dashed p-10 text-center">
                    <BookOpenCheck className="mx-auto opacity-30" size={34} />
                    <p className="mt-3 font-black">
                      {channel.title}通道已经建立
                    </p>
                    <p className="app-muted-text mt-2 text-xs">
                      暂无已发布课程；以后添加课程、课时和章节测试后会自动进入此通道。
                    </p>
                  </div>
                )}
              </div>
            </details>
          ))}

          {unlinkedGroups.length > 0 && (
            <section className="rounded-3xl border border-dashed p-5">
              <p className="font-black">待整理数据</p>
              <p className="app-muted-text mt-1 text-xs">
                有 {unlinkedGroups.length} 组历史测试尚未关联到正式课程课时。
              </p>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}
