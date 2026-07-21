/**
 * 管理端单门课程管理页
 *
 * 路由位置：
 * src/app/dashboard/admin/courses/[courseId]/page.tsx
 *
 * 这个页面只负责“课程结构管理”，不要再把每个课时的完整编辑表单塞进来。
 *
 * 当前页面负责：
 * 1. 编辑课程基本信息
 * 2. 新增课时
 * 3. 用三列卡片展示已有课时
 * 4. 每张课时卡片只显示概要信息
 * 5. 点击“编辑课时”进入单独课时编辑页
 *
 * 单独课时编辑页：
 * /dashboard/admin/courses/[courseId]/lessons/[lessonId]
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileVideo,
  GraduationCap,
  Plus,
  Save,
  Settings2,
  Video,
} from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import {
  createLessonAction,
  updateCourseAction,
} from "../actions";
import { FocusCourseQualityPanel } from "../FocusCourseManagement";

export const runtime = "edge";

/*
  课程类型

  对应数据库表：
  public.courses
*/
type Course = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  is_published: boolean;
  sort_order: number;
};

/*
  课程分类类型

  这里会用到：
  1. 二级分类 subcategory
  2. 一级分类 parentCategory

  目的是生成返回路径和学生端预览路径。
*/
type CourseCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
};

/*
  课时类型

  课程管理页只显示课时概要，不直接编辑全部内容。
  但是为了统计完成度，仍然需要查询课时内容字段。
*/
type Lesson = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  lesson_type: string;
  duration_minutes: number;
  is_free_preview: boolean;
  is_published: boolean;
  sort_order: number;
  video_provider: string | null;
  video_object_key: string | null;
  video_mime_type: string | null;
  video_url: string | null;

  // 学生端课时页面内容字段，用于计算填写完成度
  content_text: string | null;
  teacher_note: string | null;
  learning_objectives: string | null;
  lesson_tasks: string | null;
  key_points: string | null;
  case_study: string | null;
  common_mistakes: string | null;
  summary_text: string | null;
  reflection_questions: string | null;
  extra_note: string | null;
};

/*
  课时资料类型

  课程管理页只需要知道每个课时有多少个已发布资料。
*/
type LessonResource = {
  id: string;
  lesson_id: string;
  title: string;
  is_required: boolean;
  sort_order: number;
};

function getLevelLabel(level: string | null) {
  if (level === "basic") return "基础";
  if (level === "beginner") return "入门";
  if (level === "intermediate") return "进阶";
  if (level === "advanced") return "高级";

  return level || "未设置";
}

/*
  判断文本字段是否已经填写

  null、undefined、空字符串都算未填写。
*/
function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

/*
  统计课时基本信息完成度

  基本 3/3：
  1. 课时标题
  2. 课时简介
  3. 课时时长
*/
function getLessonBasicCount(lesson: Lesson) {
  const items = [
    hasText(lesson.title),
    hasText(lesson.description),
    lesson.duration_minutes > 0,
  ];

  return items.filter(Boolean).length;
}

/*
  统计学习引导完成度

  引导 3/3：
  1. 本课学习目标
  2. 本课任务
  3. 老师提示
*/
function getLessonGuideCount(lesson: Lesson) {
  const items = [
    hasText(lesson.learning_objectives),
    hasText(lesson.lesson_tasks),
    hasText(lesson.teacher_note),
  ];

  return items.filter(Boolean).length;
}

/*
  统计核心学习完成度

  核心 4/4：
  1. 学习内容
  2. 本课重点
  3. 案例分析
  4. 常见错误
*/
function getLessonCoreCount(lesson: Lesson) {
  const items = [
    hasText(lesson.content_text),
    hasText(lesson.key_points),
    hasText(lesson.case_study),
    hasText(lesson.common_mistakes),
  ];

  return items.filter(Boolean).length;
}

/*
  统计学习完成区完成度

  完成 3/3：
  1. 本课小结
  2. 课后思考
  3. 补充说明
*/
function getLessonFinishCount(lesson: Lesson) {
  const items = [
    hasText(lesson.summary_text),
    hasText(lesson.reflection_questions),
    hasText(lesson.extra_note),
  ];

  return items.filter(Boolean).length;
}

/*
  完成度标签样式

  全部填完显示绿色；否则显示灰色。
*/
function getCompletionBadgeClass(current: number, total: number) {
  if (current === total) {
    return "bg-green-50 text-green-700";
  }

  return "bg-gray-100 text-gray-600";
}

export default async function AdminCourseLessonsPage({
  params,
}: {
  params: Promise<{
    courseId: string;
  }>;
}) {
  const { courseId } = await params;

  const { supabase } = await requireAdmin();

  /**
   * 1. 查询当前课程
   */
  const { data: courseData } = await supabase
    .from("courses")
    .select(
      "id, category_id, slug, title, description, level, is_published, sort_order"
    )
    .eq("id", courseId)
    .maybeSingle();

  if (!courseData) {
    notFound();
  }

  const course = courseData as Course;

  /**
   * 2. 查询当前课程所属分类
   *
   * 这里要拿到：
   * 1. 二级分类 subcategory
   * 2. 一级分类 parentCategory
   *
   * 用途：
   * 1. 返回课程列表
   * 2. 生成学生端前台预览路径
   */
  let subcategory: CourseCategory | null = null;
  let parentCategory: CourseCategory | null = null;

  if (course.category_id) {
    const { data: subcategoryData } = await supabase
      .from("course_categories")
      .select("id, parent_id, slug, title")
      .eq("id", course.category_id)
      .maybeSingle();

    subcategory = subcategoryData as CourseCategory | null;

    if (subcategory?.parent_id) {
      const { data: parentCategoryData } = await supabase
        .from("course_categories")
        .select("id, parent_id, slug, title")
        .eq("id", subcategory.parent_id)
        .maybeSingle();

      parentCategory = parentCategoryData as CourseCategory | null;
    }
  }

  /**
   * 3. 查询当前课程下面的所有课时
   *
   * 管理端要显示已发布和已隐藏课时，
   * 所以这里不要加 is_published=true 过滤。
   */
  const { data: lessonData } = await supabase
    .from("lessons")
    .select(
      "id, course_id, slug, title, description, lesson_type, duration_minutes, is_free_preview, is_published, sort_order, video_provider, video_url, video_object_key, video_mime_type, content_text, teacher_note, learning_objectives, lesson_tasks, key_points, case_study, common_mistakes, summary_text, reflection_questions, extra_note"
    )
    .eq("course_id", course.id)
    .order("sort_order", { ascending: true });

  const lessons = (lessonData ?? []) as Lesson[];

  /**
   * 4. 查询当前课程所有课时下面的资料
   *
   * lesson_resources 表里没有 course_id，只有 lesson_id。
   * 所以先从 lessons 里拿 lessonIds，再用 in 查询资料。
   */
  const lessonIds = lessons.map((lesson) => lesson.id);

  let lessonResources: LessonResource[] = [];

  if (lessonIds.length > 0) {
    const { data: lessonResourceData } = await supabase
      .from("lesson_resources")
      .select("id, lesson_id, title, is_required, sort_order")
      .in("lesson_id", lessonIds)
      .eq("is_published", true)
      .order("lesson_id", { ascending: true })
      .order("sort_order", { ascending: true });

    lessonResources = (lessonResourceData ?? []) as LessonResource[];
  }

  /**
   * 5. 把资料按 lesson_id 分组
   *
   * 这样每张课时卡片可以快速显示“资料数量”。
   */
  const resourcesByLessonId = new Map<string, LessonResource[]>();

  lessonResources.forEach((resource) => {
    const currentResources = resourcesByLessonId.get(resource.lesson_id) ?? [];
    currentResources.push(resource);
    resourcesByLessonId.set(resource.lesson_id, currentResources);
  });

  const publishedLessons = lessons.filter((lesson) => lesson.is_published);
  const r2Lessons = lessons.filter(
    (lesson) => lesson.video_provider === "r2" && lesson.video_object_key
  );

  const nextSortOrder =
    lessons.length > 0
      ? Math.max(...lessons.map((lesson) => lesson.sort_order)) + 1
      : 1;

  const backToSubcategoryHref =
    parentCategory && subcategory
      ? `/dashboard/admin/courses/category/${parentCategory.slug}/${subcategory.slug}`
      : "/dashboard/admin/courses";

  return (
    <>
      <DashboardPageHeader
        title="课时管理"
        description="管理当前课程的基本信息、课时结构和课时编辑入口。"
      />

      <div className="space-y-5 p-5">
        {/* 返回路径 */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={backToSubcategoryHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            返回课程列表
          </Link>

          {parentCategory && subcategory && (
            <>
              <span className="text-sm text-gray-300">/</span>

              <span className="text-sm font-medium text-gray-500">
                {parentCategory.title}
              </span>

              <span className="text-sm text-gray-300">/</span>

              <span className="text-sm font-medium text-gray-500">
                {subcategory.title}
              </span>
            </>
          )}
        </div>

        {/* 两条重点业务线额外显示内容健康度，其他课程不改变。 */}
        {(parentCategory?.slug === "service" ||
          parentCategory?.slug === "korean") && (
          <FocusCourseQualityPanel
            kind={parentCategory.slug}
            lessonCount={lessons.length}
            publishedCount={publishedLessons.length}
            videoCount={r2Lessons.length}
          />
        )}

        {/* 顶部课程概览 */}
        <section className="h-full app-card rounded-3xl border p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                {subcategory && (
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                    {subcategory.title}
                  </span>
                )}

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {getLevelLabel(course.level)}
                </span>

                {course.is_published ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    <CheckCircle2 size={13} />
                    已发布
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    未发布
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-black tracking-tight text-gray-900">
                {course.title}
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
                {course.description || "暂无课程简介"}
              </p>
            </div>

            <div className="app-card rounded-2xl border p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-gray-900">课时概览</p>

                  <p className="mt-1 text-xs text-gray-500">
                    已发布 {publishedLessons.length} / {lessons.length} 个课时
                  </p>
                </div>

                <BookOpen className="text-gray-300" size={24} />
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all"
                  style={{
                    width:
                      lessons.length > 0
                        ? `${Math.round(
                            (publishedLessons.length / lessons.length) * 100
                          )}%`
                        : "0%",
                  }}
                />
              </div>

              <p className="mt-3 text-xs text-gray-400">
                已绑定 R2 视频 {r2Lessons.length} 个课时
              </p>
            </div>
          </div>
        </section>

        {/*
          上半部分：课程基本信息 + 新增课时

          这里保留两列布局。
          下面的“已有课时”单独占满整行，做成 3 列卡片。
        */}
        <div className="grid gap-5 xl:grid-cols-2">
          {/* 课程基本信息 */}
          <section className="app-card rounded-3xl border p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black tracking-tight text-gray-900">
                  课程基本信息
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  这里控制这门具体课程的标题、简介、等级和发布状态。
                </p>
              </div>

              <GraduationCap className="text-gray-300" size={28} />
            </div>

            <form action={updateCourseAction} className="space-y-4">
              <input type="hidden" name="course_id" value={course.id} />

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold text-gray-600">
                    课程标题
                  </span>

                  <input
                    name="title"
                    defaultValue={course.title}
                    className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-gray-600">
                    课程等级
                  </span>

                  <select
                    name="level"
                    defaultValue={course.level ?? "beginner"}
                    className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                  >
                    <option value="basic">基础</option>
                    <option value="beginner">入门</option>
                    <option value="intermediate">进阶</option>
                    <option value="advanced">高级</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-gray-600">课程简介</span>

                <textarea
                  name="description"
                  defaultValue={course.description ?? ""}
                  rows={4}
                  className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    name="is_published"
                    defaultChecked={course.is_published}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  发布课程
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  <Save size={16} />
                  保存课程
                </button>
              </div>
            </form>
          </section>

          {/* 新增课时 */}
          <section className="h-full app-card rounded-3xl border p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black tracking-tight text-gray-900">
                  新增课时
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  新增课时后，可以点击下方卡片中的“编辑课时”继续完善内容。
                </p>
              </div>

              <Plus className="text-gray-300" size={28} />
            </div>

            <form action={createLessonAction} className="space-y-4">
              <input type="hidden" name="course_id" value={course.id} />

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold text-gray-600">
                    课时标题
                  </span>

                  <input
                    name="title"
                    className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                    placeholder="例如：为什么要先确定目标大学"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-gray-600">
                    课时 slug
                  </span>

                  <input
                    name="slug"
                    className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                    placeholder="例如：target-university-reason"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-gray-600">
                    时长，分钟
                  </span>

                  <input
                    type="number"
                    name="duration_minutes"
                    defaultValue={10}
                    min={1}
                    className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-gray-600">排序</span>

                  <input
                    type="number"
                    name="sort_order"
                    defaultValue={nextSortOrder}
                    min={1}
                    className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-gray-600">课时简介</span>

                <textarea
                  name="description"
                  rows={3}
                  className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                  placeholder="简单说明这个课时要学习什么。"
                />
              </label>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  <Plus size={16} />
                  创建课时
                </button>
              </div>
            </form>
          </section>
        </div>

        {/*
          下半部分：已有课时

          这个区域单独占满屏幕宽度。
          课时不再在当前页展开完整表单，而是以 3 列卡片显示概要。
        */}
        <section className="app-card rounded-3xl border p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black tracking-tight text-gray-900">
                已有课时
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                这里显示课时概要。点击“编辑课时”进入单独页面维护完整内容。
              </p>
            </div>

            <FileVideo className="text-gray-300" size={28} />
          </div>

          {lessons.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {lessons.map((lesson) => {
                const resources = resourcesByLessonId.get(lesson.id) ?? [];

                const previewHref = parentCategory && subcategory
                  ? `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${lesson.slug}`
                  : `/dashboard/admin/courses/${course.id}/lessons/${lesson.id}/preview`;

                const editHref = `/dashboard/admin/courses/${course.id}/lessons/${lesson.id}`;

                const videoBound = Boolean(
                  hasText(lesson.video_object_key) || hasText(lesson.video_url)
                );

                const basicCount = getLessonBasicCount(lesson);
                const guideCount = getLessonGuideCount(lesson);
                const coreCount = getLessonCoreCount(lesson);
                const finishCount = getLessonFinishCount(lesson);

                return (
                  <article
                    key={lesson.id}
                    className="app-soft-card flex min-h-[330px] flex-col rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {lesson.is_published ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle2 size={13} />
                          已发布
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                          已隐藏
                        </span>
                      )}

                      {lesson.is_free_preview ? (
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          可试看
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                          不可试看
                        </span>
                      )}

                      {videoBound ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                          <Video size={13} />
                          视频绑定
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                          视频未绑定
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="rounded-full app-card px-3 py-1 text-xs font-semibold text-gray-600">
                          排序 {lesson.sort_order}
                        </span>

                        <span className="rounded-full app-card px-3 py-1 text-xs font-semibold text-gray-600">
                          资料 {resources.length}
                        </span>
                      </div>

                      <h4 className="line-clamp-2 text-base font-black text-gray-900">
                        {lesson.title}
                      </h4>

                      <p className="mt-1 truncate text-xs text-gray-500">
                        slug: {lesson.slug}
                      </p>

                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-500">
                        {lesson.description || "暂无课时简介"}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <span
                          className={`rounded-xl px-3 py-2 text-center text-xs font-semibold ${getCompletionBadgeClass(
                            basicCount,
                            3
                          )}`}
                        >
                          基本 {basicCount}/3
                        </span>

                        <span
                          className={`rounded-xl px-3 py-2 text-center text-xs font-semibold ${getCompletionBadgeClass(
                            guideCount,
                            3
                          )}`}
                        >
                          引导 {guideCount}/3
                        </span>

                        <span
                          className={`rounded-xl px-3 py-2 text-center text-xs font-semibold ${getCompletionBadgeClass(
                            coreCount,
                            4
                          )}`}
                        >
                          核心 {coreCount}/4
                        </span>

                        <span
                          className={`rounded-xl px-3 py-2 text-center text-xs font-semibold ${getCompletionBadgeClass(
                            finishCount,
                            3
                          )}`}
                        >
                          完成 {finishCount}/3
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <Link
                        href={editHref}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                      >
                        <Settings2 size={16} />
                        编辑课时
                      </Link>

                      <Link
                          href={previewHref}
                          target="_blank"
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-900 hover:text-white"
                        >
                          <ExternalLink size={15} />
                          学生端巡检
                        </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
              <p className="font-semibold text-gray-900">暂无课时</p>

              <p className="mt-2 text-sm text-gray-500">
                可以先在上方新增第一个课时。
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
