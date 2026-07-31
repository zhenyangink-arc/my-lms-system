import Link from "next/link";
import {
  ArrowLeft,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  KeyRound,
  Layers3,
  LibraryBig,
  ListChecks,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { createAdminClient } from "@/lib/supabase/admin";
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
  QuestionBankAdminManager,
} from "./QuestionBankForms";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";

const QUESTIONS_PER_PAGE = 8;

const QUESTION_TYPE_LABELS: Record<StandardQuestion["question_type"], string> = {
  single_choice: "单选题",
  short_text: "简答题",
  long_text: "论述题",
  file_link: "文件链接题",
};

const DIFFICULTY_LABELS: Record<StandardQuestion["difficulty"], string> = {
  foundation: "基础",
  medium: "中等",
  hard: "困难",
  expert: "极难",
};

const STATUS_LABELS: Record<StandardQuestion["status"], string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

type PageMode = "browse" | "create" | "permissions";

type PageSearchParams = {
  mode?: string;
  q?: string;
  group?: string;
  difficulty?: string;
  status?: string;
  page?: string;
};

type PlatformAdminRow = {
  id: string;
  full_name: string | null;
  login_id: string | null;
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
  const access = await requireStandardQuestionBankManager();
  const params = await searchParams;
  const requestedMode = String(params.mode ?? "browse");
  const mode: PageMode =
    requestedMode === "create" ||
    (requestedMode === "permissions" && access.canAssignManagers)
      ? requestedMode
      : "browse";
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
      .from("course_tests")
      .select(
        "id,lesson_id,slug,course_key,chapter_number,title,korean_title,status"
      )
      .order("course_key", { ascending: true })
      .order("chapter_number", { ascending: true }),
    access.supabase
      .from("course_test_questions")
      .select(
        "id,test_id,question_key,question_type,prompt,options,correct_option,correct_answer,explanation,skill,default_points,difficulty,tags,status,version,sort_order,updated_at"
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

  let platformAdmins: Array<{
    id: string;
    name: string;
    loginId: string;
    assigned: boolean;
  }> = [];

  if (mode === "permissions" && access.canAssignManagers) {
    const admin = createAdminClient();
    const [profilesResult, assignmentsResult] = await Promise.all([
      admin
        .from("profiles")
        .select("id,full_name,login_id")
        .eq("global_role", "platform_deputy")
        .eq("role", "tenant_operator")
        .eq("status", "active")
        .order("full_name", { ascending: true }),
      admin
        .from("question_bank_admin_assignments")
        .select("admin_id")
        .is("revoked_at", null),
    ]);
    const assignedIds = new Set(
      (assignmentsResult.data ?? []).map((item) => String(item.admin_id))
    );
    platformAdmins = ((profilesResult.data ?? []) as PlatformAdminRow[]).map(
      (profile) => ({
        id: profile.id,
        name: profile.full_name?.trim() || "平台管理员",
        loginId: profile.login_id || `账号 …${profile.id.slice(-6)}`,
        assigned: assignedIds.has(profile.id),
      })
    );
  }

  const draftCount = questions.filter(
    (question) => question.status === "draft"
  ).length;
  const averageQuestionsPerGroup =
    groups.length > 0 ? Math.round(questions.length / groups.length) : 0;
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
      <DashboardPageHeader
        title="平台标准题库"
        action={
          mode === "create" ? (
            <Link
              href={pageHref(currentValues, {
                mode: "browse",
                page: 1,
              })}
              className="app-soft-card inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black"
            >
              <ArrowLeft size={15} />
              返回题目管理
            </Link>
          ) : undefined
        }
      />

      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        <section
          className="app-card rounded-3xl border p-5 sm:p-6"
          style={{
            background:
              "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-secondary-soft))",
          }}
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-center">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{
                  color: "var(--app-accent)",
                  backgroundColor: "var(--app-accent-soft)",
                }}
              >
                <ShieldCheck size={14} />
                平台题库维护权限
              </span>
              <div className="group relative mt-3 flex w-fit items-center gap-1.5">
                <h2 className="text-2xl font-black tracking-tight">
                  先确定范围，再维护具体题目
                </h2>
                <Info className="app-muted-text shrink-0 cursor-help" size={15} />
                <div className="invisible absolute left-0 top-full z-20 w-80 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                  <div role="tooltip" className="app-card rounded-2xl border p-3 text-xs leading-5 app-muted-text shadow-lg">
                    默认只展示章节概况，不铺开全部题目。进入章节后，每页最多显示{" "}
                    {QUESTIONS_PER_PAGE} 道；答案、解析和编辑表单默认收起。
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                ["课程章节", groups.length, "章", Layers3],
                ["平均每章", averageQuestionsPerGroup, "题", LibraryBig],
                ["草稿待发布", draftCount, "题", ListChecks],
              ].map(([label, value, unit, Icon]) => {
                const MetricIcon = Icon as typeof LibraryBig;
                return (
                  <div
                    key={String(label)}
                    className="app-card rounded-xl border p-3 text-center"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <MetricIcon className="app-muted-text" size={14} />
                      <p className="text-lg font-black">
                        {String(value)}
                        <span className="ml-0.5 text-xs">{String(unit)}</span>
                      </p>
                    </div>
                    <p className="app-muted-text mt-1 text-[11px] font-black">
                      {String(label)}
                    </p>
                  </div>
                );
              })}
            </div>
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
            标准题库暂时无法读取，请确认最新数据库迁移已经执行。
          </section>
        )}

        <nav
          className="app-card flex flex-wrap gap-2 rounded-2xl border p-2"
          aria-label="题库管理功能"
        >
          <Link
            href={pageHref(currentValues, {
              mode: "browse",
              page: 1,
            })}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black"
            style={
              mode === "browse"
                ? {
                    color: "var(--app-secondary)",
                    backgroundColor: "var(--app-secondary-soft)",
                  }
                : undefined
            }
          >
            <ListChecks size={14} />
            题目管理
          </Link>
          {access.canAssignManagers && (
            <Link
              href={pageHref(currentValues, {
                mode: "permissions",
                page: 1,
              })}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black"
              style={
                mode === "permissions"
                  ? {
                      color: "var(--app-warm)",
                      backgroundColor: "var(--app-warm-soft)",
                    }
                  : undefined
              }
            >
              <Settings size={14} />
              权限设置
            </Link>
          )}
        </nav>

        {mode === "create" && (
          <div className="space-y-4">
            {activeLabeledGroup ? (
              <>
                <section className="app-soft-card flex items-start gap-3 rounded-2xl border p-4">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      color: "var(--app-accent)",
                      backgroundColor: "var(--app-accent-soft)",
                    }}
                  >
                    <Plus size={15} />
                  </span>
                  <div>
                    <DashboardTitleWithHint headingLevel={2} titleClassName="text-sm font-black" title={<>创建新的标准题目</>} description={<>当前章节已固定为
                      “{activeLabeledGroup.curriculum_label}”，填写题目、标准答案和解析即可。</>} />
                  </div>
                </section>
                <CreateStandardQuestionForm
                  groups={[activeLabeledGroup]}
                  lockedGroup={activeLabeledGroup}
                />
              </>
            ) : (
              <section className="app-card rounded-3xl border border-dashed p-8 text-center">
                <h2 className="text-base font-black">请先选择具体章节</h2>
                <p className="app-muted-text mt-2 text-xs leading-5">
                  新增入口已放到每个章节卡片中，避免在全部课程范围内重复选择。
                </p>
                <Link
                  href={pageHref(currentValues, {
                    mode: "browse",
                    page: 1,
                  })}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white"
                  style={{ backgroundColor: "var(--app-secondary)" }}
                >
                  <ArrowLeft size={15} />
                  返回选择章节
                </Link>
              </section>
            )}
          </div>
        )}

        {mode === "permissions" && access.canAssignManagers && (
          <div className="space-y-4">
            <section className="app-soft-card flex items-start gap-3 rounded-2xl border p-4">
              <Settings
                className="mt-0.5 shrink-0"
                size={17}
                style={{ color: "var(--app-warm)" }}
              />
              <div>
                <DashboardTitleWithHint headingLevel={2} titleClassName="text-sm font-black" title={<>题库权限设置</>} description={<>这里仅管理平台内部题库维护人员，不管理机构的选题权限。</>} />
              </div>
            </section>
            <QuestionBankAdminManager admins={platformAdmins} />
          </div>
        )}

        {mode === "browse" && (
          <>
            <section className="app-card rounded-3xl border p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    color: "var(--app-secondary)",
                    backgroundColor: "var(--app-secondary-soft)",
                  }}
                >
                  <Layers3 size={17} />
                </span>
                <div>
                  <p className="app-muted-text text-[11px] font-black">
                    第一步
                  </p>
                  <h2 className="mt-0.5 text-lg font-black">选择课程章节</h2>
                  <p className="app-muted-text mt-1 text-xs">
                    先展开课程通道，再进入课程、课时和具体章节题库。
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
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
                      className="app-soft-card rounded-2xl border"
                    >
                      <summary className="cursor-pointer list-none p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black"
                              style={{
                                color: "var(--app-secondary)",
                                backgroundColor: "var(--app-secondary-soft)",
                              }}
                            >
                              {String(channel.sort_order).padStart(2, "0")}
                            </span>
                            <div>
                              <p className="app-muted-text text-[10px] font-black">
                                {koreanCategory?.title ?? "韩语课程"} · 题库通道
                              </p>
                              <h3 className="mt-0.5 font-black">
                                {channel.title}
                              </h3>
                            </div>
                          </div>
                          <span className="app-muted-text text-xs font-black">
                            {channel.courses.length} 门课程 ·{" "}
                            {channel.groupCount} 个章节
                          </span>
                        </div>
                      </summary>

                      <div
                        className="space-y-5 border-t p-4"
                        style={{ borderColor: "var(--app-border-soft)" }}
                      >
                        {channel.courses.map((course) => (
                          <section key={course.id} className="space-y-3">
                            <h3 className="text-lg font-black">
                              {course.title}
                            </h3>

                            {course.lessons.map((lesson) => (
                              <div
                                key={lesson.id}
                                className="app-card rounded-2xl border p-4"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <h4 className="font-black">{lesson.title}</h4>
                                  <span className="app-muted-text text-[11px] font-black">
                                    {lesson.groups.length} 个章节
                                  </span>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                                      Object.keys(DIFFICULTY_LABELS).map(
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

                                    return (
                                      <div
                                        key={group.id}
                                        className="rounded-2xl border p-4 transition"
                                        style={
                                          active
                                            ? {
                                                borderColor:
                                                  "var(--app-secondary)",
                                                backgroundColor:
                                                  "var(--app-secondary-soft)",
                                                boxShadow:
                                                  "inset 0 0 0 1px var(--app-secondary)",
                                              }
                                            : {
                                                backgroundColor:
                                                  "var(--app-card-bg)",
                                            }
                                        }
                                      >
                                        <div>
                                          <div className="flex items-start justify-between gap-3">
                                            <span className="app-muted-text text-[11px] font-black">
                                              第 {group.chapter_number} 章 ·{" "}
                                              {groupQuestions.length} 题
                                            </span>
                                            <BookOpenText
                                              size={15}
                                              className="app-muted-text"
                                            />
                                          </div>
                                          <h5 className="mt-2 font-black">
                                            {group.title}
                                          </h5>
                                          <div className="mt-4 grid grid-cols-2 gap-1.5 text-[10px] font-bold">
                                            {Object.entries(
                                              DIFFICULTY_LABELS
                                            ).map(([difficulty, label]) => (
                                              <span
                                                key={difficulty}
                                                className="app-soft-card rounded-lg border px-2 py-1.5 text-center"
                                              >
                                                {label}{" "}
                                                {difficultyCounts[difficulty] ??
                                                  0}
                                              </span>
                                            ))}
                                          </div>
                                          <div className="app-muted-text mt-3 flex items-center justify-between text-[11px]">
                                            <span>标准题目 {groupQuestions.length} 道</span>
                                            {groupDrafts > 0 && (
                                              <span
                                                style={{
                                                  color: "var(--app-warm)",
                                                }}
                                              >
                                                {groupDrafts} 题待发布
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <ChapterQuestionBankActions
                                          group={
                                            labeledGroups.find(
                                              (item) => item.id === group.id
                                            ) ?? group
                                          }
                                          questions={groupQuestions}
                                        />
                                      </div>
                                    );
                                  })}

                                  {lesson.groups.length === 0 && (
                                    <p className="app-muted-text rounded-2xl border border-dashed p-5 text-center text-xs sm:col-span-2 xl:col-span-4">
                                      该课题库通道已保留，暂未建立章节题库。
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}

                            {course.lessons.length === 0 && (
                              <p className="app-muted-text rounded-2xl border border-dashed p-5 text-center text-xs">
                                该课程暂未建立课时。
                              </p>
                            )}
                          </section>
                        ))}

                        {channel.courses.length === 0 && (
                          <p className="app-muted-text rounded-2xl border border-dashed p-6 text-center text-xs">
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
                <section className="app-card rounded-3xl border p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                    <div className="min-w-0 flex-1">
                      <p className="app-muted-text text-[11px] font-black">
                        第二步 · 第 {activeGroup.chapter_number} 章
                      </p>
                      <h2 className="mt-1 text-xl font-black">
                        {activeGroup.title}
                      </h2>
                      <p className="app-muted-text mt-1 text-xs">
                        找到 {filteredQuestions.length} 道题，每页最多{" "}
                        {QUESTIONS_PER_PAGE} 道。
                      </p>
                    </div>
                    <form className="grid min-w-0 gap-2 sm:grid-cols-[minmax(220px,1fr)_130px_130px_auto] lg:w-[760px]">
                      <input type="hidden" name="group" value={activeGroup.id} />
                      <label className="app-input flex items-center gap-2 rounded-xl border px-3 py-2.5">
                        <Search className="app-muted-text" size={14} />
                        <span className="sr-only">搜索当前章节题目</span>
                        <input
                          name="q"
                          defaultValue={params.q ?? ""}
                          placeholder="搜索题目、知识点或标签"
                          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                        />
                      </label>
                      <label className="app-input flex items-center gap-2 rounded-xl border px-3 py-2.5">
                        <Filter className="app-muted-text" size={13} />
                        <select
                          name="difficulty"
                          defaultValue={difficultyFilter}
                          className="min-w-0 flex-1 bg-transparent text-xs font-bold"
                          aria-label="难度"
                        >
                          <option value="all">全部难度</option>
                          {Object.entries(DIFFICULTY_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                      <select
                        name="status"
                        defaultValue={statusFilter}
                        className="app-input rounded-xl border px-3 py-2.5 text-xs font-bold"
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
                        className="rounded-xl px-4 py-2.5 text-xs font-black text-white"
                        style={{ backgroundColor: "var(--app-secondary)" }}
                      >
                        筛选
                      </button>
                    </form>
                  </div>
                </section>

                <section className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visibleQuestions.map((question, index) => {
                    const group = groupsById.get(question.test_id);
                    const options = questionOptions(question.options);
                    const tags = questionTags(question.tags);
                    const answer = standardQuestionAnswer(question);
                    const absoluteIndex =
                      (currentPage - 1) * QUESTIONS_PER_PAGE + index + 1;

                    return (
                      <article
                        key={question.id}
                        className="app-card rounded-2xl border p-4 sm:p-5"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black"
                            style={{
                              color: "var(--app-secondary)",
                              backgroundColor: "var(--app-secondary-soft)",
                            }}
                          >
                            {absoluteIndex}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="app-muted-text text-xs font-black">
                                {QUESTION_TYPE_LABELS[question.question_type]}
                              </span>
                              <span className="app-muted-text rounded-full border px-2 py-0.5 text-[10px] font-bold">
                                {DIFFICULTY_LABELS[question.difficulty]}
                              </span>
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-black"
                                style={{
                                  color:
                                    question.status === "published"
                                      ? "var(--app-success)"
                                      : question.status === "draft"
                                        ? "var(--app-warm)"
                                        : "var(--app-muted)",
                                  backgroundColor:
                                    question.status === "published"
                                      ? "var(--app-success-soft)"
                                      : question.status === "draft"
                                        ? "var(--app-warm-soft)"
                                        : "var(--app-soft-bg)",
                                }}
                              >
                                {STATUS_LABELS[question.status]} · v
                                {question.version}
                              </span>
                              <span className="app-muted-text ml-auto text-xs font-bold">
                                默认 {question.default_points} 分
                              </span>
                            </div>
                            <h3 className="mt-2 whitespace-pre-wrap text-sm font-black leading-6">
                              {question.prompt}
                            </h3>
                            <div className="app-muted-text mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                              <span className="inline-flex items-center gap-1">
                                <Sparkles size={11} />
                                {question.skill}
                              </span>
                              {tags.map((tag) => (
                                <span key={tag}>#{tag}</span>
                              ))}
                              <span>
                                {group
                                  ? `第 ${group.chapter_number} 章`
                                  : "课程题目"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <details
                          className="mt-4 border-t pt-3"
                          style={{ borderColor: "var(--app-border-soft)" }}
                        >
                          <summary className="cursor-pointer text-xs font-black" style={{ color: "var(--app-success)" }}>
                            查看选项、标准答案与解析
                          </summary>
                          <div className="mt-3 grid gap-3">
                            <div className="space-y-2">
                              {question.question_type === "single_choice" ? (
                                options.map((option, optionIndex) => (
                                  <div
                                    key={`${question.id}-${optionIndex}`}
                                    className="app-soft-card flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"
                                  >
                                    <span
                                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-black"
                                      style={
                                        optionIndex === question.correct_option
                                          ? {
                                              color: "var(--app-success)",
                                              backgroundColor:
                                                "var(--app-success-soft)",
                                            }
                                          : undefined
                                      }
                                    >
                                      {String.fromCharCode(65 + optionIndex)}
                                    </span>
                                    {option}
                                  </div>
                                ))
                              ) : (
                                <p className="app-muted-text rounded-xl border border-dashed p-4 text-xs">
                                  本题不是选择题。
                                </p>
                              )}
                            </div>
                            <div
                              className="rounded-2xl border p-4"
                              style={{
                                borderColor: "var(--app-success)",
                                backgroundColor: "var(--app-success-soft)",
                              }}
                            >
                              <p
                                className="flex items-center gap-1.5 text-xs font-black"
                                style={{ color: "var(--app-success)" }}
                              >
                                <KeyRound size={13} />
                                标准答案
                              </p>
                              <p className="mt-2 text-xs leading-5">
                                {answer || "本题由机构人工批改"}
                              </p>
                              {question.explanation && (
                                <p className="app-muted-text mt-3 border-t pt-3 text-xs leading-5">
                                  解析：{question.explanation}
                                </p>
                              )}
                            </div>
                          </div>
                        </details>

                        <EditStandardQuestionForm
                          groups={labeledGroups}
                          question={question}
                        />
                      </article>
                    );
                  })}

                  {visibleQuestions.length === 0 && (
                    <div className="app-card rounded-3xl border border-dashed p-10 text-center md:col-span-2 xl:col-span-3">
                      <LibraryBig className="mx-auto opacity-30" size={34} />
                      <p className="mt-3 font-black">
                        当前章节没有符合条件的题目
                      </p>
                      <p className="app-muted-text mt-2 text-xs">
                        请调整搜索、难度或状态筛选。
                      </p>
                    </div>
                  )}
                </section>

                {filteredQuestions.length > 0 && (
                  <nav
                    className="app-card flex items-center justify-between gap-3 rounded-2xl border p-3"
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
                          className="app-soft-card inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-black"
                        >
                          <ChevronLeft size={13} />
                          上一页
                        </Link>
                      ) : (
                        <span className="app-soft-card inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-black opacity-30">
                          <ChevronLeft size={13} />
                          上一页
                        </span>
                      )}
                      {currentPage < totalPages ? (
                        <Link
                          href={pageHref(currentValues, {
                            page: currentPage + 1,
                          })}
                          className="app-soft-card inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-black"
                        >
                          下一页
                          <ChevronRight size={13} />
                        </Link>
                      ) : (
                        <span className="app-soft-card inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-black opacity-30">
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
