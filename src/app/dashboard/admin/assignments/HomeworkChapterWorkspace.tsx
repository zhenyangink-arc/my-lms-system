import Link from "next/link";
import { ArrowLeft, BookOpenCheck, ChevronDown } from "lucide-react";

import { requireAssessmentPaperManager } from "@/lib/assessment-papers";
import {
  ChapterHomeworkPlanEditor,
  type ChapterHomeworkPlanValue,
  type HomeworkLanguageSkill,
  type HomeworkQuestionPreview,
  type HomeworkSkillSetting,
} from "./ChapterHomeworkPlanEditor";
import { ChapterHomeworkPublishButton } from "./ChapterHomeworkPublishButton";
import { HomeworkCollapsibleTableGroup } from "./HomeworkCollapsibleTableGroup";

type ChapterRow = {
  id: string;
  lesson_id: string;
  course_key: string;
  chapter_number: number;
  title: string;
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

type HomeworkPlanRow = {
  id: string;
  test_id: string;
  title: string;
  duration_minutes: number;
  passing_score: number;
  allow_resubmission: boolean;
  status: "draft" | "published" | "archived";
  version: number;
};

type HomeworkSkillRow = {
  plan_id: string;
  language_skill: HomeworkLanguageSkill;
  enabled: boolean;
  response_mode: string;
  target_question_count: number;
  target_points: number;
  duration_minutes: number;
  instructions: string;
  sort_order: number;
};

type HomeworkPaperRow = {
  source_test_id: string;
  status: "draft" | "published" | "retired" | "archived";
};

type HomeworkQuestionRow = {
  id: string;
  plan_id: string;
  language_skill: HomeworkLanguageSkill;
  source_bank_version: number | null;
  question_type: string;
  stimulus_text: string;
  prompt: string;
  options: unknown;
  correct_answer: string | null;
  explanation: string;
  difficulty: string;
  source_skill: string;
  points: number;
  sort_order: number;
};

const skillOrder: HomeworkLanguageSkill[] = [
  "listening",
  "speaking",
  "reading",
  "writing",
];

const responseModeLabels: Record<string, string> = {
  single_choice: "选择",
  short_text: "短答",
  long_text: "长答",
  audio_recording: "录音",
  mixed: "混合",
};

function lessonLabel(title: string, order: number) {
  return /^第\s*\d+\s*课[：:]/u.test(title)
    ? title
    : `第 ${order} 课：${title}`;
}

function toPlanValue(
  plan: HomeworkPlanRow,
  settings: HomeworkSkillRow[],
  questions: HomeworkQuestionRow[]
): ChapterHomeworkPlanValue {
  return {
    id: plan.id,
    title: plan.title,
    durationMinutes: plan.duration_minutes,
    passingScore: Number(plan.passing_score),
    allowResubmission: plan.allow_resubmission,
    status: plan.status,
    settings: settings
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (setting): HomeworkSkillSetting => ({
          languageSkill: setting.language_skill,
          enabled: setting.enabled,
          responseMode: setting.response_mode,
          targetQuestionCount: setting.target_question_count,
          targetPoints: Number(setting.target_points),
          durationMinutes: setting.duration_minutes,
          instructions: setting.instructions,
        })
      ),
    questions: questions
      .sort(
        (a, b) =>
          skillOrder.indexOf(a.language_skill) -
            skillOrder.indexOf(b.language_skill) ||
          a.sort_order - b.sort_order
      )
      .map(
        (question): HomeworkQuestionPreview => ({
          id: question.id,
          languageSkill: question.language_skill,
          sourceBankVersion: question.source_bank_version,
          questionType: question.question_type,
          stimulusText: question.stimulus_text,
          prompt: question.prompt,
          options: Array.isArray(question.options)
            ? question.options.map(String)
            : [],
          correctAnswer: question.correct_answer ?? "",
          explanation: question.explanation,
          difficulty: question.difficulty,
          sourceSkill: question.source_skill,
          points: Number(question.points),
          sortOrder: question.sort_order,
        })
      ),
  };
}

export async function HomeworkChapterWorkspace({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { supabase } = await requireAssessmentPaperManager();
  const [
    chaptersResult,
    lessonsResult,
    coursesResult,
    categoriesResult,
    plansResult,
    skillSettingsResult,
    homeworkQuestionsResult,
    papersResult,
  ] = await Promise.all([
    supabase
      .from("chapter_tests")
      .select("id,lesson_id,course_key,chapter_number,title")
      .order("course_key", { ascending: true })
      .order("chapter_number", { ascending: true }),
    supabase
      .from("lessons")
      .select("id,course_id,slug,title,sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("courses")
      .select("id,category_id,title,sort_order")
      .eq("is_published", true),
    supabase
      .from("course_categories")
      .select("id,parent_id,slug,title,sort_order")
      .eq("is_published", true),
    supabase
      .from("chapter_homework_plans")
      .select(
        "id,test_id,title,duration_minutes,passing_score,allow_resubmission,status,version"
      ),
    supabase
      .from("chapter_homework_skill_settings")
      .select(
        "plan_id,language_skill,enabled,response_mode,target_question_count,target_points,duration_minutes,instructions,sort_order"
      ),
    supabase
      .from("chapter_homework_questions")
      .select(
        "id,plan_id,language_skill,source_bank_version,question_type,stimulus_text,prompt,options,correct_answer,explanation,difficulty,source_skill,points,sort_order"
      )
      .order("sort_order", { ascending: true }),
    supabase
      .from("assessment_papers")
      .select("source_test_id,status")
      .eq("paper_type", "homework"),
  ]);

  const chapters = (chaptersResult.data ?? []) as ChapterRow[];
  const lessons = (lessonsResult.data ?? []) as CatalogLessonRow[];
  const courses = (coursesResult.data ?? []) as CatalogCourseRow[];
  const categories = (categoriesResult.data ?? []) as CatalogCategoryRow[];
  const plans = (plansResult.data ?? []) as HomeworkPlanRow[];
  const settings = (skillSettingsResult.data ?? []) as HomeworkSkillRow[];
  const homeworkQuestions = (homeworkQuestionsResult.data ??
    []) as HomeworkQuestionRow[];
  const papers = (papersResult.data ?? []) as HomeworkPaperRow[];

  const planByChapterId = new Map(plans.map((plan) => [plan.test_id, plan]));
  const settingsByPlanId = new Map<string, HomeworkSkillRow[]>();
  settings.forEach((setting) => {
    const current = settingsByPlanId.get(setting.plan_id) ?? [];
    current.push(setting);
    settingsByPlanId.set(setting.plan_id, current);
  });
  const questionsByPlanId = new Map<string, HomeworkQuestionRow[]>();
  homeworkQuestions.forEach((question) => {
    const current = questionsByPlanId.get(question.plan_id) ?? [];
    current.push(question);
    questionsByPlanId.set(question.plan_id, current);
  });
  const paperCountByChapterId = new Map<string, number>();
  const publishedPaperCountByChapterId = new Map<string, number>();
  papers.forEach((paper) => {
    paperCountByChapterId.set(
      paper.source_test_id,
      (paperCountByChapterId.get(paper.source_test_id) ?? 0) + 1
    );
    if (paper.status === "published") {
      publishedPaperCountByChapterId.set(
        paper.source_test_id,
        (publishedPaperCountByChapterId.get(paper.source_test_id) ?? 0) + 1
      );
    }
  });

  const lessonsBySlug = new Map(
    lessons.map((lesson) => [lesson.slug, lesson])
  );
  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  );
  const chaptersByLessonId = new Map<string, ChapterRow[]>();
  const unlinkedChapters: ChapterRow[] = [];

  chapters.forEach((chapter) => {
    const lesson =
      lessonsById.get(chapter.lesson_id) ??
      lessonsBySlug.get(chapter.course_key);
    if (!lesson) {
      unlinkedChapters.push(chapter);
      return;
    }
    const current = chaptersByLessonId.get(lesson.id) ?? [];
    current.push(chapter);
    chaptersByLessonId.set(lesson.id, current);
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
      return {
        key: lesson.id,
        subcategoryId: subcategory?.id ?? "",
        subcategoryOrder: subcategory?.sort_order ?? Number.MAX_SAFE_INTEGER,
        courseId: course?.id ?? "",
        courseTitle: course?.title ?? "未关联课程",
        courseOrder: course?.sort_order ?? Number.MAX_SAFE_INTEGER,
        lessonTitle: lesson.title,
        lessonOrder: lesson.sort_order,
        chapters: chaptersByLessonId.get(lesson.id) ?? [],
      };
    });

  unlinkedChapters.forEach((chapter) => {
    curriculumGroups.push({
      key: `unlinked:${chapter.id}`,
      subcategoryId: "",
      subcategoryOrder: Number.MAX_SAFE_INTEGER,
      courseId: "",
      courseTitle: "未关联课程",
      courseOrder: Number.MAX_SAFE_INTEGER,
      lessonTitle: chapter.course_key,
      lessonOrder: Number.MAX_SAFE_INTEGER,
      chapters: [chapter],
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
      courses: channelCourses,
      groups,
      chapterCount: groups.reduce(
        (total, group) => total + group.chapters.length,
        0
      ),
    };
  });
  const unlinkedGroups = curriculumGroups.filter(
    (group) => group.courseId === ""
  );
  const tableChannels = [
    ...curriculumChannels,
    ...(unlinkedGroups.length
      ? [
          {
            id: "unlinked",
            title: "待整理",
            courses: [],
            groups: unlinkedGroups,
            chapterCount: unlinkedGroups.reduce(
              (total, group) => total + group.chapters.length,
              0
            ),
          },
        ]
      : []),
  ];

  const publishedPlans = plans.filter(
    (plan) => plan.status === "published"
  ).length;
  const completePlanCount = plans.filter((plan) => {
    const planSkills = settingsByPlanId.get(plan.id) ?? [];
    return skillOrder.every((skill) =>
      planSkills.some(
        (setting) => setting.language_skill === skill && setting.enabled
      )
    );
  }).length;
  const hasReadError = [
    chaptersResult,
    lessonsResult,
    coursesResult,
    categoriesResult,
    plansResult,
    skillSettingsResult,
    homeworkQuestionsResult,
    papersResult,
  ].some((result) => result.error);

  return (
    <div className={embedded ? "" : "pb-12"}>
      <div
        className={`mx-auto w-full max-w-[1500px] space-y-4 px-4 sm:px-6 lg:px-8 ${
          embedded ? "" : "pt-6"
        }`}
      >
        {!embedded && (
          <Link
            href="/dashboard/admin/assignments?workspace=homework"
            className="app-muted-text inline-flex items-center gap-2 text-xs font-black"
          >
            <ArrowLeft size={14} />
            返回作业管理
          </Link>
        )}

        <section className="border-y py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black">课程章节作业树</p>
              <p className="app-muted-text mt-1 text-xs">
                每个章节固定包含听、说、读、写四项，可分别设置题量、分值、作答方式和时长。
              </p>
            </div>
            <dl className="flex flex-wrap items-center gap-y-3 text-sm">
              {[
                ["全部章节", chapters.length],
                ["四项齐全", completePlanCount],
                ["已发布", publishedPlans],
                ["标准作业卷", papers.length],
              ].map(([label, value], index) => (
                <div
                  key={String(label)}
                  className={`min-w-24 px-4 text-center ${
                    index === 0 ? "" : "border-l"
                  }`}
                  style={{ borderColor: "var(--app-border-soft)" }}
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

        {hasReadError && (
          <section
            className="border p-4 text-sm font-bold"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
              borderColor: "var(--app-warm)",
            }}
          >
            章节作业暂时无法完整读取，请稍后刷新页面。
          </section>
        )}

        <section
          className="border"
          style={{
            borderColor: "var(--app-border)",
            backgroundColor: "var(--app-card-bg)",
          }}
        >
          {tableChannels.map((channel) => (
            <details
              key={channel.id}
              className="group border-b last:border-b-0"
              style={{ borderColor: "var(--app-border)" }}
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--app-soft-bg)]">
                <ChevronDown
                  className="app-muted-text shrink-0 transition-transform group-open:rotate-180"
                  size={15}
                />
                <span className="min-w-0 text-sm font-black">
                  {channel.title}
                </span>
                <span className="app-muted-text text-xs">
                  {channel.id === "unlinked"
                    ? "历史数据"
                    : `${koreanCategory?.title ?? "韩语课程"} · 作业通道`}
                </span>
                <span className="app-muted-text ml-auto whitespace-nowrap font-mono text-xs tabular-nums">
                  {channel.courses.length} 门课程 · {channel.chapterCount} 个章节
                </span>
              </summary>

              <div
                className="overflow-x-auto border-t"
                style={{ borderColor: "var(--app-border)" }}
              >
                <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-[13%]" />
                    <col className="w-[17%]" />
                    <col className="w-[7%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[11%]" />
                    <col className="w-[8%]" />
                    <col className="w-[11%]" />
                  </colgroup>
                  <thead
                    className="sticky top-0 z-20 backdrop-blur-xl backdrop-saturate-150"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--app-card-bg) 82%, transparent)",
                      boxShadow: "0 1px 0 var(--app-border)",
                    }}
                  >
                    <tr
                      className="border-b text-[11px] font-bold app-muted-text"
                      style={{
                        borderColor: "var(--app-border-soft)",
                        backgroundColor: "var(--app-soft-bg)",
                      }}
                    >
                      <th className="px-4 py-2.5">课程 / 课时</th>
                      <th className="border-l px-4 py-2.5">章节作业</th>
                      <th className="border-l px-3 py-2.5 text-center">状态</th>
                      <th className="border-l px-3 py-2.5 text-center">听</th>
                      <th className="border-l px-3 py-2.5 text-center">说</th>
                      <th className="border-l px-3 py-2.5 text-center">读</th>
                      <th className="border-l px-3 py-2.5 text-center">写</th>
                      <th className="border-l px-3 py-2.5 text-center">
                        标准卷
                      </th>
                      <th className="border-l px-2 py-2.5 text-right">操作</th>
                    </tr>
                  </thead>

                  {channel.groups.map((group) => (
                    <HomeworkCollapsibleTableGroup
                      key={group.key}
                      title={group.courseTitle}
                      subtitle={lessonLabel(
                        group.lessonTitle,
                        group.lessonOrder
                      )}
                      count={group.chapters.length}
                    >
                      {group.chapters.length === 0 ? (
                        <tr
                          className="border-b last:border-b-0"
                          style={{ borderColor: "var(--app-border-soft)" }}
                        >
                          <td className="app-muted-text relative px-4 py-3.5 text-xs">
                            <span
                              aria-hidden="true"
                              className="absolute left-[22px] top-0 h-1/2 border-l"
                              style={{
                                borderColor:
                                  "color-mix(in srgb, var(--app-muted) 38%, transparent)",
                              }}
                            />
                            <span
                              aria-hidden="true"
                              className="absolute left-[22px] top-1/2 w-4 border-t"
                              style={{
                                borderColor:
                                  "color-mix(in srgb, var(--app-muted) 38%, transparent)",
                              }}
                            />
                            <span className="inline-block pl-8">暂无章节</span>
                          </td>
                          <td
                            className="app-muted-text border-l px-4 py-3.5 text-xs"
                            colSpan={8}
                          >
                            暂未建立章节作业
                          </td>
                        </tr>
                      ) : (
                        group.chapters.map((chapter, chapterIndex) => {
                          const plan = planByChapterId.get(chapter.id);
                          const planSettings = plan
                            ? settingsByPlanId.get(plan.id) ?? []
                            : [];
                          const planSettingsBySkill = new Map(
                            planSettings.map((setting) => [
                              setting.language_skill,
                              setting,
                            ])
                          );

                          return (
                            <tr
                              key={chapter.id}
                              className="border-b align-middle transition-colors last:border-b-0 hover:bg-[var(--app-soft-bg)]"
                              style={{ borderColor: "var(--app-border-soft)" }}
                            >
                              <td className="relative px-4 py-3">
                                <span
                                  aria-hidden="true"
                                  className={`absolute left-[22px] top-0 border-l ${
                                    chapterIndex ===
                                    group.chapters.length - 1
                                      ? "h-1/2"
                                      : "bottom-0"
                                  }`}
                                  style={{
                                    borderColor:
                                      "color-mix(in srgb, var(--app-muted) 38%, transparent)",
                                  }}
                                />
                                <span
                                  aria-hidden="true"
                                  className="absolute left-[22px] top-1/2 w-4 border-t"
                                  style={{
                                    borderColor:
                                      "color-mix(in srgb, var(--app-muted) 38%, transparent)",
                                  }}
                                />
                                <span className="app-muted-text inline-flex pl-8 font-mono text-[11px]">
                                  CHAPTER{" "}
                                  {String(chapter.chapter_number).padStart(
                                    2,
                                    "0"
                                  )}
                                </span>
                              </td>
                              <td className="border-l px-4 py-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold">
                                    {plan?.title ?? chapter.title}
                                  </p>
                                  <p className="app-muted-text mt-0.5 truncate text-[11px]">
                                    {chapter.title}
                                    {plan
                                      ? ` · ${plan.duration_minutes} 分钟 · ${Number(
                                          plan.passing_score
                                        )} 分及格`
                                      : ""}
                                  </p>
                                </div>
                              </td>
                              <td className="border-l px-3 py-3 text-center">
                                <span
                                  className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold"
                                  style={{
                                    color:
                                      plan?.status === "published"
                                        ? "var(--app-success)"
                                        : "var(--app-muted)",
                                  }}
                                >
                                  <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{
                                      backgroundColor:
                                        plan?.status === "published"
                                          ? "var(--app-success)"
                                          : "var(--app-muted)",
                                    }}
                                  />
                                  {plan?.status === "published"
                                    ? "已发布"
                                    : plan?.status === "archived"
                                      ? "已归档"
                                      : plan
                                        ? "草稿"
                                        : "未创建"}
                                </span>
                              </td>
                              {skillOrder.map((skill) => {
                                const setting =
                                  planSettingsBySkill.get(skill);
                                return (
                                  <td
                                    key={skill}
                                    className="border-l px-2 py-3 text-center"
                                  >
                                    {setting ? (
                                      <>
                                        <p className="font-mono text-xs font-bold tabular-nums">
                                          {setting.target_question_count}题 ·{" "}
                                          {Number(setting.target_points)}分
                                        </p>
                                        <p className="app-muted-text mt-0.5 text-[10px]">
                                          {responseModeLabels[
                                            setting.response_mode
                                          ] ?? setting.response_mode}
                                          {" · "}
                                          {setting.duration_minutes}分钟
                                        </p>
                                      </>
                                    ) : (
                                      <span className="app-muted-text text-xs">
                                        —
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="border-l px-3 py-3 text-center">
                                <p className="font-mono text-sm font-bold tabular-nums">
                                  {paperCountByChapterId.get(chapter.id) ?? 0}
                                </p>
                                <p className="app-muted-text text-[10px]">
                                  {publishedPaperCountByChapterId.get(
                                    chapter.id
                                  ) ?? 0}{" "}
                                  套可用
                                </p>
                              </td>
                              <td className="border-l px-2 py-3 text-right">
                                {plan ? (
                                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                    <ChapterHomeworkPlanEditor
                                      chapterTitle={chapter.title}
                                      plan={toPlanValue(
                                        plan,
                                        planSettings,
                                        questionsByPlanId.get(plan.id) ?? []
                                      )}
                                    />
                                    <span className="app-muted-text">·</span>
                                    <ChapterHomeworkPublishButton
                                      planId={plan.id}
                                      isPublished={
                                        plan.status === "published"
                                      }
                                    />
                                  </div>
                                ) : (
                                  <span className="app-muted-text text-[11px]">
                                    待同步
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </HomeworkCollapsibleTableGroup>
                  ))}
                  {channel.groups.length === 0 && (
                    <tbody>
                      <tr>
                        <td
                          colSpan={9}
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
              <BookOpenCheck className="mx-auto opacity-30" size={28} />
              <p className="mt-3 text-sm font-bold">暂无章节作业数据</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
