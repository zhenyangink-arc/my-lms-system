import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  FlaskConical,
} from "lucide-react";

import { requireAssessmentPaperManager } from "@/lib/assessment-papers";
import { questionOptions } from "@/lib/question-bank";
import {
  ChapterTestRandomPicker,
  type ChapterPoolQuestion,
} from "./ChapterTestRandomPicker";
import { ChapterTestDurationEditor } from "./ChapterTestDurationEditor";
import { CollapsibleTableGroup } from "./CollapsibleTableGroup";
import { ChapterTestQuestionViewer } from "./chapter-tests/ChapterTestQuestionViewer";

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
  correct_option: number | null;
  difficulty: "foundation" | "medium";
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
} as const;

function lessonLabel(title: string, order: number) {
  return /^第\s*\d+\s*课[：:]/u.test(title)
    ? title
    : `第 ${order} 课：${title}`;
}

export async function ChapterTestWorkspace({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { supabase } = await requireAssessmentPaperManager();
  const [
    testsResult,
    questionsResult,
    lessonsResult,
    coursesResult,
    categoriesResult,
  ] = await Promise.all([
    supabase
      .from("chapter_tests")
      .select(
        "id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,duration_minutes,passing_score,version,status"
      )
      .order("course_key", { ascending: true })
      .order("chapter_number", { ascending: true }),
    supabase
      .from("chapter_test_questions")
      .select(
        "id,test_id,prompt,options,correct_option,difficulty,sort_order,is_chapter_test_item,status,question_type"
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
  const tableChannels = [
    ...curriculumChannels,
    ...(unlinkedGroups.length > 0
      ? [
          {
            id: "unlinked",
            title: "待整理",
            order: Number.MAX_SAFE_INTEGER,
            courses: [],
            groups: unlinkedGroups,
            testCount: unlinkedGroups.reduce(
              (total, group) => total + group.tests.length,
              0
            ),
          },
        ]
      : []),
  ];
  const activeQuestionCount = questions.filter(
    (question) => question.is_chapter_test_item
  ).length;
  const chapterReadError = Boolean(
    testsResult.error ||
      questionsResult.error ||
      lessonsResult.error ||
      coursesResult.error ||
      categoriesResult.error
  );

  return (
    <div className={embedded ? "" : "pb-12"}>
      <div
        className={`mx-auto w-full max-w-[1500px] space-y-4 px-4 sm:px-6 lg:px-8 ${
          embedded ? "" : "pt-6"
        }`}
      >
        {!embedded && (
          <Link
            href="/dashboard/admin/assignments"
            className="app-muted-text inline-flex items-center gap-2 rounded-md text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--support)]"
          >
            <ArrowLeft aria-hidden="true" size={14} />
            返回作业考试管理
          </Link>
        )}

        <section className="border-y py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold">课程章节树</h2>
            </div>
            <dl className="flex flex-wrap items-center gap-y-3 text-sm">
              {[
                ["全部章节", chapterReadError ? "—" : tests.length],
                ["已发布", chapterReadError ? "—" : publishedCount],
                ["当前题目", chapterReadError ? "—" : activeQuestionCount],
              ].map(([label, value], index) => (
                <div
                  key={String(label)}
                  className={`min-w-28 px-5 text-center ${
                    index === 0 ? "" : "border-l"
                  }`}
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <dd className="font-mono text-xl font-bold tabular-nums">
                    {String(value)}
                  </dd>
                  <dt className="app-muted-text mt-0.5 text-[11px]">
                    {String(label)}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {chapterReadError && (
          <section
            role="alert"
            aria-labelledby="chapter-test-read-error"
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{
              color: "var(--status-warning)",
              backgroundColor: "var(--status-warning-surface)",
              borderColor: "var(--status-warning)",
            }}
          >
            <h2 id="chapter-test-read-error" className="text-sm font-semibold">
              章节测试读取失败
            </h2>
            <p className="mt-1 font-normal">
              章节测试暂时无法完整读取，请稍后刷新页面。
            </p>
          </section>
        )}

        {!chapterReadError && (
          <section
            aria-labelledby="chapter-test-table-heading"
            className="border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
            }}
          >
            <h2 id="chapter-test-table-heading" className="sr-only">
              章节测试列表
            </h2>
            {tableChannels.map((channel) => (
            <details
              key={channel.id}
              className="group border-b last:border-b-0"
              style={{ borderColor: "var(--border)" }}
            >
              <summary
                className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-soft)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--support)]"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <ChevronDown
                  aria-hidden="true"
                  className="app-muted-text shrink-0 transition-transform group-open:rotate-180"
                  size={15}
                />
                <span className="min-w-0 text-sm font-semibold">
                  {channel.title}
                </span>
                <span className="app-muted-text text-xs">
                  {channel.id === "unlinked"
                    ? "历史数据"
                    : `${koreanCategory?.title ?? "韩语课程"} · 课程通道`}
                </span>
                <span className="app-muted-text ml-auto whitespace-nowrap font-mono text-xs tabular-nums">
                  {channel.courses.length} 门课程 · {channel.testCount} 个章节
                </span>
              </summary>

              <div
                className="overflow-x-auto border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
                  <caption className="sr-only">
                    {channel.title}课程通道的章节测试，按课程和课时目录顺序排列
                  </caption>
                  <colgroup>
                    <col className="w-[23%]" />
                    <col className="w-[20%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                    <col className="w-[15%]" />
                    <col className="w-[8%]" />
                    <col className="w-[18%]" />
                  </colgroup>
                  <thead
                    className="sticky top-14 z-20 backdrop-blur-xl backdrop-saturate-150"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--card) 78%, transparent)",
                      boxShadow: "0 1px 0 var(--border)",
                    }}
                  >
                    <tr
                      className="border-b text-[11px] font-bold uppercase tracking-[0.08em] app-muted-text"
                      style={{
                        borderColor: "var(--border-subtle)",
                        backgroundColor: "var(--surface-soft)",
                      }}
                    >
                      <th className="px-4 py-2.5 font-bold">课程 / 课时</th>
                      <th className="border-l px-4 py-2.5 font-bold">章节测试</th>
                      <th className="border-l px-3 py-2.5 text-center font-bold">
                        状态
                      </th>
                      <th className="border-l px-3 py-2.5 text-center font-bold">
                        题量
                      </th>
                      <th className="border-l px-3 py-2.5 text-center font-bold">
                        基础 / 中等
                      </th>
                      <th className="border-l px-3 py-2.5 text-center font-bold">
                        时长
                      </th>
                      <th className="border-l px-4 py-2.5 text-right font-bold">
                        快捷操作
                      </th>
                    </tr>
                  </thead>
                  {channel.groups.map((group) => (
                    <CollapsibleTableGroup
                      key={group.key}
                      title={group.courseTitle}
                      subtitle={lessonLabel(
                        group.lessonTitle,
                        group.lessonOrder
                      )}
                      count={group.tests.length}
                      defaultOpen={false}
                    >
                      {(() => {
                      if (group.tests.length === 0) {
                        return (
                          <tr
                            className="border-b last:border-b-0"
                            style={{ borderColor: "var(--border-subtle)" }}
                          >
                            <td className="app-muted-text relative px-4 py-3.5 text-xs">
                              <span
                                aria-hidden="true"
                                className="absolute left-[22px] top-0 h-1/2 border-l"
                                style={{
                                  borderColor:
                                    "color-mix(in srgb, var(--foreground-muted) 38%, transparent)",
                                }}
                              />
                              <span
                                aria-hidden="true"
                                className="absolute left-[22px] top-1/2 w-4 border-t"
                                style={{
                                  borderColor:
                                    "color-mix(in srgb, var(--foreground-muted) 38%, transparent)",
                                }}
                              />
                              <span className="inline-block pl-8">暂无章节</span>
                            </td>
                            <td
                              className="app-muted-text border-l px-4 py-3.5 text-xs"
                              colSpan={6}
                            >
                              暂未建立章节测试
                            </td>
                          </tr>
                        );
                      }

                      return group.tests.map((test, testIndex) => {
                        const poolQuestions =
                          questionsByTest.get(test.id) ?? [];
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
                          <tr
                            key={test.id}
                            className="border-b align-middle transition-colors last:border-b-0 hover:bg-[var(--surface-soft)]"
                            style={{
                              borderColor: "var(--border-subtle)",
                            }}
                          >
                            <td className="relative px-4 py-3.5">
                              <span
                                aria-hidden="true"
                                className={`absolute left-[22px] top-0 border-l ${
                                  testIndex === group.tests.length - 1
                                    ? "h-1/2"
                                    : "bottom-0"
                                }`}
                                style={{
                                  borderColor:
                                    "color-mix(in srgb, var(--foreground-muted) 38%, transparent)",
                                }}
                              />
                              <span
                                aria-hidden="true"
                                className="absolute left-[22px] top-1/2 w-4 border-t"
                                style={{
                                  borderColor:
                                    "color-mix(in srgb, var(--foreground-muted) 38%, transparent)",
                                }}
                              />
                              <span className="app-muted-text inline-flex items-center gap-2 pl-8 font-mono text-[11px]">
                                第 {String(test.chapter_number).padStart(2, "0")} 章
                              </span>
                            </td>
                            <td className="border-l px-4 py-3.5">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-bold">
                                  {test.title}
                                </span>
                                <span className="app-muted-text shrink-0 font-mono text-[10px]">
                                  版本 {test.version}
                                </span>
                              </div>
                            </td>
                            <td className="border-l px-3 py-3.5 text-center">
                              <span
                                className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold"
                                style={{
                                  color:
                                    test.status === "published"
                                      ? "var(--status-success)"
                                      : "var(--foreground-muted)",
                                }}
                              >
                                <span
                                  aria-hidden="true"
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      test.status === "published"
                                        ? "var(--status-success)"
                                        : "var(--foreground-muted)",
                                  }}
                                />
                                {test.status === "published"
                                  ? "已发布"
                                  : test.status === "draft"
                                    ? "草稿"
                                    : "已归档"}
                              </span>
                            </td>
                            <td className="border-l px-3 py-3.5 text-center font-mono text-sm font-bold tabular-nums">
                              {testQuestions.length}
                            </td>
                            <td className="border-l px-3 py-3.5 text-center font-mono text-sm font-semibold tabular-nums">
                              {Object.keys(difficultyLabels)
                                .map(
                                  (difficulty) =>
                                    difficultyCount.get(difficulty) ?? 0
                                )
                                .join(" / ")}
                            </td>
                            <td className="border-l px-2 py-2.5 text-center">
                              <ChapterTestDurationEditor
                                testId={test.id}
                                durationMinutes={test.duration_minutes}
                              />
                            </td>
                            <td className="border-l px-4 py-3.5">
                              <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                <ChapterTestQuestionViewer
                                  testTitle={test.title}
                                  questions={testQuestions.map((question) => ({
                                    id: question.id,
                                    prompt: question.prompt,
                                    options: questionOptions(question.options),
                                    correctOption: question.correct_option,
                                    difficulty: question.difficulty,
                                  }))}
                                />
                                <span className="app-muted-text">·</span>
                                <ChapterTestRandomPicker
                                  testId={test.id}
                                  testTitle={test.title}
                                  questions={poolQuestions.map(
                                    (question): ChapterPoolQuestion => ({
                                      id: question.id,
                                      prompt: question.prompt,
                                      options: questionOptions(
                                        question.options
                                      ),
                                      correctOption: question.correct_option,
                                      difficulty: question.difficulty,
                                    })
                                  )}
                                  initialQuestionIds={testQuestions.map(
                                    (question) => question.id
                                  )}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      });
                      })()}
                    </CollapsibleTableGroup>
                  ))}
                  {channel.groups.length === 0 && (
                    <tbody>
                      <tr>
                        <td
                          colSpan={7}
                          className="app-muted-text px-5 py-12 text-center text-xs"
                        >
                          当前课程通道暂无已发布课程。
                        </td>
                      </tr>
                    </tbody>
                  )}
                </table>
              </div>
            </details>
            ))}

            {tableChannels.length === 0 && (
              <div className="px-5 py-16 text-center">
                <FlaskConical
                  aria-hidden="true"
                  className="mx-auto opacity-30"
                  size={28}
                />
                <p className="mt-3 text-sm font-bold">暂无章节测试数据</p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
