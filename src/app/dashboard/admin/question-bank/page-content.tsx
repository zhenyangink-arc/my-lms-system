import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers3,
  LibraryBig,
  ListChecks,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

import {
  questionOptions,
  questionTags,
  requireStandardQuestionBankManager,
  standardQuestionAnswer,
  type StandardQuestion,
  type StandardQuestionGroup,
} from "@/lib/question-bank";
import { ChapterQuestionBankActions } from "./ChapterQuestionBankActions";
import {
  CreateStandardQuestionForm,
  EditStandardQuestionForm,
} from "./QuestionBankForms";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { LanguageQuestionBankWorkspace } from "./LanguageQuestionBankWorkspace";
import { QuestionBankSectionNav } from "./QuestionBankSectionNav";
import {
  koreanEbookSectionLabel,
} from "@/lib/korean-ebook-sections";

const QUESTIONS_PER_PAGE = 8;

const QUESTION_TYPE_LABELS: Record<StandardQuestion["question_type"], string> = {
  single_choice: "单选题",
  short_text: "简答题",
  long_text: "论述题",
  file_link: "文件链接题",
};

const CHAPTER_DIFFICULTIES = ["foundation", "medium"] as const;

const DIFFICULTY_LABELS: Record<
  (typeof CHAPTER_DIFFICULTIES)[number],
  string
> = {
  foundation: "基础",
  medium: "中等",
};

const STATUS_LABELS: Record<StandardQuestion["status"], string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

const SKILL_LABELS: Record<string, string> = {
  vocabulary: "词汇",
  grammar: "语法",
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
  communication: "交际",
  mixed: "综合",
};

type PageMode = "browse" | "create";

type PageSearchParams = {
  bank?: string;
  skill?: string;
  mode?: string;
  q?: string;
  group?: string;
  difficulty?: string;
  status?: string;
  page?: string;
};

type CatalogLessonRow = {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
};

type CatalogCourseRow = {
  id: string;
  category_id: string;
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

function pageHref(
  values: {
    mode: PageMode;
    group: string;
    q: string;
    difficulty: string;
    status: string;
    page: number;
  },
  patch: Partial<{
    mode: PageMode;
    group: string;
    q: string;
    difficulty: string;
    status: string;
    page: number;
  }>
) {
  const next = { ...values, ...patch };
  const params = new URLSearchParams();
  if (next.mode !== "browse") params.set("mode", next.mode);
  if (next.group) params.set("group", next.group);
  if (next.q) params.set("q", next.q);
  if (next.difficulty !== "all") {
    params.set("difficulty", next.difficulty);
  }
  if (next.status !== "all") params.set("status", next.status);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `?${query}` : "?";
}

export default async function StandardQuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  const requestedBank = String(params.bank ?? "chapter");
  if (requestedBank === "homework" || requestedBank === "exam") {
    return <LanguageQuestionBankWorkspace bank={requestedBank} />;
  }
  const access = await requireStandardQuestionBankManager();
  const requestedMode = String(params.mode ?? "browse");
  const mode: PageMode = requestedMode === "create" ? "create" : "browse";
  const queryText = String(params.q ?? "").trim().toLowerCase();
  const difficultyFilter = String(params.difficulty ?? "all");
  const statusFilter = String(params.status ?? "all");
  const requestedPage = Math.max(1, Number(params.page) || 1);

  const [
    groupsResult,
    questionsResult,
    lessonsResult,
    coursesResult,
    categoriesResult,
  ] = await Promise.all([
    access.supabase
      .from("chapter_tests")
      .select(
        "id,lesson_id,slug,course_key,chapter_number,title,korean_title,status"
      )
      .order("course_key", { ascending: true })
      .order("chapter_number", { ascending: true }),
    access.supabase
      .from("chapter_test_questions")
      .select(
        "id,test_id,question_key,question_type,prompt,options,correct_option,correct_answer,explanation,skill,ebook_section_step,ebook_page_reference,default_points,difficulty,tags,status,version,sort_order,updated_at"
      )
      .order("test_id", { ascending: true })
      .order("sort_order", { ascending: true }),
    access.supabase
      .from("lessons")
      .select("id,course_id,title,sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    access.supabase
      .from("courses")
      .select("id,category_id,title,sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    access.supabase
      .from("course_categories")
      .select("id,parent_id,slug,title,sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
  ]);

  const groups = (groupsResult.data ?? []) as StandardQuestionGroup[];
  const questions = (questionsResult.data ?? []) as StandardQuestion[];
  const lessons = (lessonsResult.data ?? []) as CatalogLessonRow[];
  const courses = (coursesResult.data ?? []) as CatalogCourseRow[];
  const categories = (categoriesResult.data ?? []) as CatalogCategoryRow[];
  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  );
  const groupsByLessonId = new Map<string, StandardQuestionGroup[]>();
  groups.forEach((group) => {
    const current = groupsByLessonId.get(group.lesson_id) ?? [];
    current.push(group);
    groupsByLessonId.set(group.lesson_id, current);
  });
  const koreanCategory = categories.find(
    (category) => category.slug === "korean" && category.parent_id === null
  );
  const koreanSubcategories = categories.filter(
    (category) => category.parent_id === koreanCategory?.id
  );
  const curriculumChannels = koreanSubcategories.map((subcategory) => {
    const channelCourses = courses
      .filter((course) => course.category_id === subcategory.id)
      .map((course) => ({
        ...course,
        lessons: lessons
          .filter((lesson) => lesson.course_id === course.id)
          .map((lesson) => ({
            ...lesson,
            groups: groupsByLessonId.get(lesson.id) ?? [],
          })),
      }));

    return {
      ...subcategory,
      courses: channelCourses,
      groupCount: channelCourses.reduce(
        (total, course) =>
          total +
          course.lessons.reduce(
            (lessonTotal, lesson) => lessonTotal + lesson.groups.length,
            0
          ),
        0
      ),
    };
  });
  const labeledGroups = groups.map((group) => {
    const lesson = lessonsById.get(group.lesson_id);
    const course = lesson ? coursesById.get(lesson.course_id) : undefined;
    const subcategory = course
      ? categoriesById.get(course.category_id)
      : undefined;

    return {
      ...group,
      curriculum_label: [
        subcategory?.title,
        course?.title,
        lesson?.title,
        `第 ${group.chapter_number} 章 · ${group.title}`,
      ]
        .filter(Boolean)
        .join(" / "),
    };
  });
  const requestedGroup = String(params.group ?? "");
  const activeGroup =
    groups.find((group) => group.id === requestedGroup) ?? null;
  const groupFilter = activeGroup?.id ?? "";
  const groupsById = new Map(groups.map((group) => [group.id, group]));

  const filteredQuestions = activeGroup
    ? questions.filter((question) => {
        const haystack = [
          question.prompt,
          question.skill,
          questionTags(question.tags).join(" "),
        ]
          .join(" ")
          .toLowerCase();

        return (
          question.test_id === activeGroup.id &&
          (!queryText || haystack.includes(queryText)) &&
          (difficultyFilter === "all" ||
            question.difficulty === difficultyFilter) &&
          (statusFilter === "all" || question.status === statusFilter)
        );
      })
    : [];
  const totalPages = Math.max(
    1,
    Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE)
  );
  const currentPage = Math.min(requestedPage, totalPages);
  const visibleQuestions = filteredQuestions.slice(
    (currentPage - 1) * QUESTIONS_PER_PAGE,
    currentPage * QUESTIONS_PER_PAGE
  );

  const draftCount = questions.filter(
    (question) => question.status === "draft"
  ).length;
  const averageQuestionsPerGroup =
    groups.length > 0 ? Math.round(questions.length / groups.length) : 0;
  const ebookSectionCoverage = new Set(
    questions.map((question) => question.ebook_section_step)
  ).size;
  const currentValues = {
    mode,
    group: groupFilter,
    q: queryText,
    difficulty: difficultyFilter,
    status: statusFilter,
    page: currentPage,
  };
  const activeLabeledGroup =
    labeledGroups.find((group) => group.id === activeGroup?.id) ?? null;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-6 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        <QuestionBankSectionNav active="chapter" />
        {mode === "create" && (
          <Link
            href={pageHref(currentValues, {
              mode: "browse",
              page: 1,
            })}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold"
          >
            <ArrowLeft size={15} />
            返回题目管理
          </Link>
        )}
        <section className="border-y py-4">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight">
                章节测试题库
              </h2>
            </div>
            <dl className="flex flex-wrap items-center">
              {[
                ["课程章节", groups.length, "章", Layers3],
                ["平均每章", averageQuestionsPerGroup, "题", LibraryBig],
                ["目录覆盖", `${ebookSectionCoverage}/8`, "", Sparkles],
                ["草稿待发布", draftCount, "题", ListChecks],
              ].map(([label, value, unit, Icon]) => {
                const MetricIcon = Icon as typeof LibraryBig;
                return (
                  <div
                    key={String(label)}
                    className="min-w-28 border-l px-5 first:border-l-0 xl:first:border-l"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <dd className="flex items-center justify-center gap-1.5">
                      <MetricIcon className="app-muted-text" size={14} />
                      <span className="font-mono text-lg font-semibold tabular-nums">
                        {String(value)}
                        <span className="ml-0.5 text-[10px]">{String(unit)}</span>
                      </span>
                    </dd>
                    <dt className="app-muted-text mt-0.5 text-center text-[10px] font-bold">
                      {String(label)}
                    </dt>
                  </div>
                );
              })}
            </dl>
          </div>
        </section>

        {(groupsResult.error ||
          questionsResult.error ||
          lessonsResult.error ||
          coursesResult.error ||
          categoriesResult.error) && (
          <section
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{
              color: "#c94f45",
              backgroundColor: "#fff0ed",
              borderColor: "#c94f45",
            }}
          >
            标准题库暂时无法读取，请稍后重试或联系管理员。
          </section>
        )}

        {mode === "create" && (
          <div className="space-y-4">
            {activeLabeledGroup ? (
              <>
                <section className="flex items-start gap-3 border-y py-4">
                  <span className="mt-0.5 text-[var(--primary)]">
                    <Plus size={15} />
                  </span>
                  <div>
                    <DashboardTitleWithHint headingLevel={2} titleClassName="text-sm font-semibold" title={<>创建新的标准题目</>} description={<>当前章节已固定为
                      “{activeLabeledGroup.curriculum_label}”，填写题目、标准答案和解析即可。</>} />
                  </div>
                </section>
                <CreateStandardQuestionForm
                  groups={[activeLabeledGroup]}
                  lockedGroup={activeLabeledGroup}
                />
              </>
            ) : (
              <section className="border-y py-10 text-center">
                <h2 className="text-base font-semibold">请先选择具体章节</h2>
                <Link
                  href={pageHref(currentValues, {
                    mode: "browse",
                    page: 1,
                  })}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                  style={{ backgroundColor: "var(--support)" }}
                >
                  <ArrowLeft size={15} />
                  返回选择章节
                </Link>
              </section>
            )}
          </div>
        )}

        {mode === "browse" && (
          <>
            <section className="border-y">
              <div>
                {curriculumChannels.map((channel) => {
                  const channelHasActiveGroup = channel.courses.some((course) =>
                    course.lessons.some((lesson) =>
                      lesson.groups.some(
                        (group) => group.id === activeGroup?.id
                      )
                    )
                  );

                  return (
                    <details
                      key={channel.id}
                      open={channelHasActiveGroup}
                      className="group border-b last:border-b-0"
                    >
                      <summary className="cursor-pointer list-none bg-[var(--card)] px-4 py-3 transition-colors hover:bg-[var(--surface-soft)]">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[11px] font-semibold text-[var(--support)]">
                              {String(channel.sort_order).padStart(2, "0")}
                            </span>
                            <div>
                              <p className="app-muted-text text-[10px] font-semibold">
                                {koreanCategory?.title ?? "韩语课程"} · 题库通道
                              </p>
                              <h3 className="mt-0.5 font-semibold">
                                {channel.title}
                              </h3>
                            </div>
                          </div>
                          <span className="app-muted-text text-xs font-semibold">
                            {channel.courses.length} 门课程 ·{" "}
                            {channel.groupCount} 个章节
                          </span>
                        </div>
                      </summary>

                      <div
                        className="border-t"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        {channel.courses.map((course) => (
                          <section key={course.id} className="border-b last:border-b-0">
                            <h3 className="border-b bg-[var(--surface-soft)] px-4 py-2.5 text-sm font-semibold">
                              {course.title}
                            </h3>

                            {course.lessons.map((lesson, lessonIndex) => {
                              const lessonHasActiveGroup = lesson.groups.some(
                                (group) => group.id === activeGroup?.id
                              );

                              return (
                              <details
                                key={lesson.id}
                                open={lessonHasActiveGroup}
                                className="group relative border-b last:border-b-0"
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none absolute left-4 border-l ${
                                    lessonIndex === course.lessons.length - 1
                                      ? "top-0 h-1/2"
                                      : "bottom-0 top-0"
                                  }`}
                                  style={{ borderColor: "var(--border-subtle)" }}
                                />
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute left-4 top-6 w-4 border-t"
                                  style={{ borderColor: "var(--border-subtle)" }}
                                />
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-[var(--card)] py-3 pl-10 pr-4 hover:bg-[var(--surface-soft)]">
                                  <h4 className="text-sm font-semibold">{lesson.title}</h4>
                                  <span className="ml-auto app-muted-text text-[11px] font-semibold">
                                    {lesson.groups.length} 个章节
                                  </span>
                                  <ChevronDown
                                    className="app-muted-text transition-transform group-open:rotate-180"
                                    size={15}
                                  />
                                </summary>

                              <div className="overflow-x-auto border-t bg-[var(--card)]">
                                <table className="w-full min-w-[980px] border-collapse text-left">
                                  <thead>
                                    <tr className="border-b bg-[var(--surface-soft)] app-muted-text">
                                      <th className="px-4 py-2.5 text-[11px] font-bold">章节</th>
                                      <th className="border-l px-4 py-2.5 text-[11px] font-bold">章节标题</th>
                                      <th className="border-l px-4 py-2.5 text-center text-[11px] font-bold">题目</th>
                                      <th className="border-l px-4 py-2.5 text-center text-[11px] font-bold">基础</th>
                                      <th className="border-l px-4 py-2.5 text-center text-[11px] font-bold">中等</th>
                                      <th className="border-l px-4 py-2.5 text-[11px] font-bold">电子书目录覆盖</th>
                                      <th className="border-l px-4 py-2.5 text-right text-[11px] font-bold">操作</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                  {lesson.groups.map((group) => {
                                    const groupQuestions = questions.filter(
                                      (question) =>
                                        question.test_id === group.id
                                    );
                                    const groupPublished =
                                      groupQuestions.filter(
                                        (question) =>
                                          question.status === "published"
                                      ).length;
                                    const groupDrafts =
                                      groupQuestions.length - groupPublished;
                                    const difficultyCounts = Object.fromEntries(
                                      CHAPTER_DIFFICULTIES.map(
                                        (difficulty) => [
                                          difficulty,
                                          groupQuestions.filter(
                                            (question) =>
                                              question.difficulty === difficulty
                                          ).length,
                                        ]
                                      )
                                    );
                                    const active =
                                      group.id === activeGroup?.id;
                                    const ebookSections = [
                                      ...new Set(
                                        groupQuestions.map(
                                          (question) => question.ebook_section_step
                                        )
                                      ),
                                    ].sort();

                                    return (
                                      <tr
                                        key={group.id}
                                        className="border-b last:border-b-0 hover:bg-[var(--surface-soft)]"
                                        style={
                                          active
                                            ? {
                                                backgroundColor:
                                                  "var(--support-surface)",
                                              }
                                            : undefined
                                        }
                                      >
                                        <td className="px-4 py-3 font-mono text-[11px] font-semibold app-muted-text">
                                          CH {String(group.chapter_number).padStart(2, "0")}
                                        </td>
                                        <td className="border-l px-4 py-3"><p className="text-sm font-semibold">{group.title}</p><p className="app-muted-text mt-0.5 text-[10px]">{group.korean_title}{groupDrafts > 0 ? ` · ${groupDrafts} 题待发布` : ""}</p></td>
                                        <td className="border-l px-4 py-3 text-center font-mono text-xs font-semibold">{groupQuestions.length}</td>
                                        <td className="border-l px-4 py-3 text-center font-mono text-xs">{difficultyCounts.foundation ?? 0}</td>
                                        <td className="border-l px-4 py-3 text-center font-mono text-xs">{difficultyCounts.medium ?? 0}</td>
                                        <td className="border-l px-4 py-3 text-[11px] leading-5">{ebookSections.map(koreanEbookSectionLabel).join("、") || "未标注"}</td>
                                        <td className="border-l px-4 py-3 text-right"><ChapterQuestionBankActions
                                          group={
                                            labeledGroups.find(
                                              (item) => item.id === group.id
                                            ) ?? group
                                          }
                                          questions={groupQuestions}
                                        /></td>
                                      </tr>
                                    );
                                  })}

                                  {lesson.groups.length === 0 && (
                                    <tr><td colSpan={7} className="app-muted-text px-4 py-6 text-center text-xs">该课题库通道已保留，暂未建立章节题库。</td></tr>
                                  )}
                                  </tbody>
                                </table>
                              </div>
                              </details>
                              );
                            })}

                            {course.lessons.length === 0 && (
                              <p className="app-muted-text px-4 py-6 text-center text-xs">
                                该课程暂未建立课时。
                              </p>
                            )}
                          </section>
                        ))}

                        {channel.courses.length === 0 && (
                          <p className="app-muted-text px-4 py-8 text-center text-xs">
                            {channel.title}题库通道已经建立，暂无课程。
                          </p>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>

            {activeGroup && (
              <>
                <section className="border-y px-4 py-3">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="app-muted-text text-[11px] font-semibold">
                        第二步 · 第 {activeGroup.chapter_number} 章
                      </p>
                      <h2 className="mt-1 text-xl font-semibold">
                        {activeGroup.title}
                      </h2>
                      <p className="app-muted-text mt-1 text-xs">
                        找到 {filteredQuestions.length} 道题，每页最多{" "}
                        {QUESTIONS_PER_PAGE} 道。
                      </p>
                    </div>
                    <form className="grid min-w-0 gap-2 sm:grid-cols-[minmax(220px,1fr)_130px_130px_auto] lg:w-[760px]">
                      <input type="hidden" name="group" value={activeGroup.id} />
                      <label className="app-input flex items-center gap-2 rounded-md border px-3 py-2">
                        <Search className="app-muted-text" size={14} />
                        <span className="sr-only">搜索当前章节题目</span>
                        <input
                          name="q"
                          defaultValue={params.q ?? ""}
                          placeholder="搜索题目、知识点或标签"
                          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                        />
                      </label>
                      <label className="app-input flex items-center gap-2 rounded-md border px-3 py-2">
                        <Filter className="app-muted-text" size={13} />
                        <select
                          name="difficulty"
                          defaultValue={difficultyFilter}
                          className="min-w-0 flex-1 bg-transparent text-xs font-bold"
                          aria-label="难度"
                        >
                          <option value="all">全部难度</option>
                          {CHAPTER_DIFFICULTIES.map(
                            (value) => (
                              <option key={value} value={value}>
                                {DIFFICULTY_LABELS[value]}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                      <select
                        name="status"
                        defaultValue={statusFilter}
                        className="app-input rounded-md border px-3 py-2 text-xs font-bold"
                        aria-label="发布状态"
                      >
                        <option value="all">全部状态</option>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md px-4 py-2 text-xs font-semibold text-white"
                        style={{ backgroundColor: "var(--support)" }}
                      >
                        筛选
                      </button>
                    </form>
                  </div>
                </section>

                <section className="overflow-x-auto border-y">
                  <table className="w-full min-w-[1350px] border-collapse text-left">
                    <thead>
                      <tr className="border-b bg-[var(--surface-soft)] app-muted-text">
                        <th className="px-3 py-2.5 text-[11px]">序号</th>
                        <th className="border-l px-3 py-2.5 text-[11px]">电子书目录</th>
                        <th className="border-l px-3 py-2.5 text-center text-[11px]">难度</th>
                        <th className="border-l px-3 py-2.5 text-[11px]">题目</th>
                        <th className="border-l px-3 py-2.5 text-[11px]">四个选项</th>
                        <th className="border-l px-3 py-2.5 text-[11px]">答案与解析</th>
                        <th className="border-l px-3 py-2.5 text-[11px]">知识点／状态</th>
                        <th className="border-l px-3 py-2.5 text-right text-[11px]">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                  {visibleQuestions.map((question, index) => {
                    const group = groupsById.get(question.test_id);
                    const options = questionOptions(question.options);
                    const answer = standardQuestionAnswer(question);
                    const absoluteIndex =
                      (currentPage - 1) * QUESTIONS_PER_PAGE + index + 1;

                    return (
                      <tr
                        key={question.id}
                        className="border-b align-top last:border-b-0"
                      >
                        <td className="px-3 py-3 text-center font-mono text-[11px] font-semibold text-[var(--support)]">{String(absoluteIndex).padStart(2, "0")}</td>
                        <td className="border-l px-3 py-3 text-[11px] leading-5"><span className="font-semibold">{koreanEbookSectionLabel(question.ebook_section_step)}</span>{question.ebook_page_reference && <span className="app-muted-text block">{question.ebook_page_reference}</span>}</td>
                        <td className="border-l px-3 py-3 text-center text-xs font-bold">{question.difficulty === "foundation" || question.difficulty === "medium" ? DIFFICULTY_LABELS[question.difficulty] : question.difficulty}</td>
                        <td className="border-l px-3 py-3"><p className="whitespace-pre-wrap text-sm font-semibold leading-6">{question.prompt}</p><p className="app-muted-text mt-1 text-[10px]">{QUESTION_TYPE_LABELS[question.question_type]} · {group ? `第 ${group.chapter_number} 章` : "课程题目"}</p></td>
                        <td className="border-l px-3 py-3 text-xs leading-5">{options.map((option, optionIndex) => <p key={`${question.id}-${optionIndex}`} className={optionIndex === question.correct_option ? "font-semibold text-[var(--status-success)]" : ""}><span className="mr-1 font-mono">{String.fromCharCode(65 + optionIndex)}.</span>{option}</p>)}</td>
                        <td className="border-l px-3 py-3 text-xs leading-5"><p className="font-semibold text-[var(--status-success)]">{answer || "人工批改"}</p>{question.explanation && <p className="app-muted-text mt-1.5">{question.explanation}</p>}</td>
                        <td className="border-l px-3 py-3 text-xs"><p className="font-semibold">{SKILL_LABELS[question.skill] ?? "综合"}</p><p className="app-muted-text mt-1">{STATUS_LABELS[question.status]} · 版本 {question.version} · {question.default_points} 分</p></td>
                        <td className="border-l px-3 py-3 text-right"><EditStandardQuestionForm groups={labeledGroups} question={question} compact /></td>
                      </tr>
                    );
                  })}

                  {visibleQuestions.length === 0 && (
                    <tr><td colSpan={8} className="app-muted-text px-4 py-12 text-center text-xs">当前章节没有符合条件的题目，请调整搜索、难度或状态筛选。</td></tr>
                  )}
                    </tbody>
                  </table>
                </section>

                {filteredQuestions.length > 0 && (
                  <nav
                    className="flex items-center justify-between gap-3 border-y px-3 py-2.5"
                    aria-label="题目分页"
                  >
                    <p className="app-muted-text text-xs">
                      第 {currentPage} / {totalPages} 页
                    </p>
                    <div className="flex items-center gap-2">
                      {currentPage > 1 ? (
                        <Link
                          href={pageHref(currentValues, {
                            page: currentPage - 1,
                          })}
                          className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-semibold"
                        >
                          <ChevronLeft size={13} />
                          上一页
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-semibold opacity-30">
                          <ChevronLeft size={13} />
                          上一页
                        </span>
                      )}
                      {currentPage < totalPages ? (
                        <Link
                          href={pageHref(currentValues, {
                            page: currentPage + 1,
                          })}
                          className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-semibold"
                        >
                          下一页
                          <ChevronRight size={13} />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-semibold opacity-30">
                          下一页
                          <ChevronRight size={13} />
                        </span>
                      )}
                    </div>
                  </nav>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
