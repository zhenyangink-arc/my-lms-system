/**
 * 管理端单门课程课时管理页
 *
 * 这个页面用于管理一门具体课程下面的课时。
 *
 * 功能：
 * 1. 编辑课程基本信息：标题、简介、等级、发布状态
 * 2. 新增课时：标题、slug、简介、时长、排序
 * 3. 管理已有课时
 * 4. 每个课时使用折叠面板显示，避免页面太乱
 * 5. 每个课时内部拆成：
 *    - 课时基本信息
 *    - 视频设置
 *    - 发布设置
 *    - 课时资料管理
 * 6. 支持保存课时、隐藏课时、恢复发布
 * 7. 支持为每个课时新增、查看、隐藏学习资料
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  EyeOff,
  FileText,
  FileVideo,
  GraduationCap,
  Plus,
  Save,
  Settings2,
  Video,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { requireAdmin } from "@/lib/admin";
import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import {
  createLessonAction,
  createLessonResourceAction,
  hideLessonAction,
  hideLessonResourceAction,
  updateCourseAction,
  updateLessonAction,
} from "../actions";

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

const resourceTypeLabelMap: Record<string, string> = {
  file: "文件",
  link: "链接",
  template: "模板",
  checklist: "清单",
  reference: "参考资料",
};

type CourseCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
};

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


  // 学生端课时页面内容字段
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

type LessonResource = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  resource_type: string;
  resource_url: string | null;
  is_required: boolean;
  sort_order: number;
};

/*
  管理端表单分区组件

  作用：
  1. 把很长的编辑表单拆成几个清楚的小区块
  2. 现在用于：课时基本信息、视频设置、学习引导、核心学习、学习完成、课时资料管理、发布设置
  3. icon 是必填参数；每个分区标题左侧都需要一个图标，方便管理端快速识别区域
*/
function AdminEditSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="app-soft-card rounded-2xl border p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="app-card flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-gray-600 shadow-sm">
          {icon}
        </div>

        <div>
          <h4 className="text-sm font-black text-gray-900">{title}</h4>

          {description && (
            <p className="mt-1 text-xs leading-5 text-gray-500">
              {description}
            </p>
          )}
        </div>
      </div>

      {children}
    </section>
  );
}

function getLevelLabel(level: string | null) {
  if (level === "basic") {
    return "基础";
  }

  if (level === "beginner") {
    return "入门";
  }

  if (level === "intermediate") {
    return "进阶";
  }

  if (level === "advanced") {
    return "高级";
  }

  return level || "未设置";
}

/*
  判断文本字段是否已经填写

  作用：
  1. null、undefined、空字符串都算未填写
  2. 有实际文字内容才算已填写
*/
function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

/*
  统计课时基本信息完成度

  基本 3/3 对应：
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

  引导 3/3 对应：
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

  核心 4/4 对应：
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

  完成 3/3 对应：
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

  规则：
  1. 全部填完：绿色
  2. 只要没填完：灰色
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
   * 2. 查询当前课程所属的二级分类
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
   * 管理端要显示已发布和已隐藏课时，所以这里不加 is_published 过滤。
   */
  const { data: lessonData } = await supabase
    .from("lessons")
    .select(
      "id, course_id, slug, title, description, lesson_type, duration_minutes, is_free_preview, is_published, sort_order, video_provider, video_url, video_object_key, video_mime_type, content_text, teacher_note, learning_objectives, lesson_tasks, key_points, case_study, common_mistakes, summary_text, reflection_questions, extra_note"
    )
    .eq("course_id", course.id)
    .order("sort_order", { ascending: true });

  const lessons = (lessonData ?? []) as Lesson[];

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

  /*
   * 4. 查询这些课时下面的学习资料
   *
   * 为什么要单独查询 lesson_resources？
   * - lessons 表只保存课时本身的信息，比如标题、视频、正文。
   * - lesson_resources 表保存“这个课时下面有哪些资料”，比如 PDF、外部链接、模板、清单。
   * - 一个课时可以有多个资料，所以这里先查出所有课时 id，再一次性查询所有资料。
   */
  const lessonIds = lessons.map((lesson) => lesson.id);

  let lessonResources: LessonResource[] = [];

  if (lessonIds.length > 0) {
    const { data: lessonResourceData } = await supabase
      .from("lesson_resources")
      .select(
        "id, lesson_id, title, description, resource_type, resource_url, is_required, sort_order"
      )
      .in("lesson_id", lessonIds)
      .eq("is_published", true)
      // 先按 lesson_id 分组，再按 sort_order 排序。
      // 这样同一个课时下面的资料顺序会更稳定。
      .order("lesson_id", { ascending: true })
      .order("sort_order", { ascending: true });

    lessonResources = (lessonResourceData ?? []) as LessonResource[];
  }

  /*
   * 5. 把资料按 lesson_id 分组
   *
   * resourcesByLessonId 的结构大概是：
   * {
   *   "lesson-1-id": [资料1, 资料2],
   *   "lesson-2-id": [资料3]
   * }
   *
   * 这样在下面 lessons.map((lesson) => ...) 里面，
   * 就可以通过 resourcesByLessonId.get(lesson.id)
   * 快速拿到当前课时自己的资料列表。
   */
  const resourcesByLessonId = new Map<string, LessonResource[]>();

  lessonResources.forEach((resource) => {
    const currentResources = resourcesByLessonId.get(resource.lesson_id) ?? [];
    currentResources.push(resource);
    resourcesByLessonId.set(resource.lesson_id, currentResources);
  });

  return (
    <>
      <DashboardPageHeader
        title="课时管理"
        description="管理当前课程的基本信息、课时结构和 R2 视频路径。"
      />

      <div className="space-y-6 p-6">
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

        {/* 顶部课程概览 */}
        <section className="h-full app-card rounded-3xl border p-6 shadow-sm">
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

        <div className="grid gap-6 xl:grid-cols-2">
          {/* 课程基本信息 */}
          <section className="app-card rounded-3xl border p-6 shadow-sm">
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
          <section className="h-full app-card rounded-3xl border p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black tracking-tight text-gray-900">
                  新增课时
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  新增课时后，可以在下方已有课时列表中继续编辑视频和发布设置。
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
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                    placeholder="例如：为什么要先确定目标大学"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-gray-600">
                    课时 slug
                  </span>

                  <input
                    name="slug"
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
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
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-bold text-gray-600">排序</span>

                  <input
                    type="number"
                    name="sort_order"
                    defaultValue={nextSortOrder}
                    min={1}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-gray-600">课时简介</span>

                <textarea
                  name="description"
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
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

          {/* 已有课时列表 */}
          <section className="app-card rounded-3xl border p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black tracking-tight text-gray-900">
                  已有课时
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  点击课时标题展开编辑。管理端会显示已发布和已隐藏的课时。
                </p>
              </div>

              <FileVideo className="text-gray-300" size={28} />
            </div>

            {lessons.length > 0 ? (
              <div className="space-y-4">
                {lessons.map((lesson) => {
                  const resources = resourcesByLessonId.get(lesson.id) ?? [];
                  const previewHref =
                    parentCategory && subcategory
                      ? `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${lesson.slug}`
                      : null;

                  const videoBound = Boolean(
                    hasText(lesson.video_object_key) || hasText(lesson.video_url)
                  );

                  const basicCount = getLessonBasicCount(lesson);
                  const guideCount = getLessonGuideCount(lesson);
                  const coreCount = getLessonCoreCount(lesson);
                  const finishCount = getLessonFinishCount(lesson);


                  return (
                    <Collapsible key={lesson.id} defaultOpen={false}>
                      <article className="app-card overflow-hidden rounded-3xl border shadow-sm">
                        <div className="flex items-stretch border-b-0">
                          <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-gray-50">
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
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
                                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                    视频绑定
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                                    视频未绑定
                                  </span>
                                )}

                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getCompletionBadgeClass(
                                    basicCount,
                                    3
                                  )}`}
                                >
                                  基本 {basicCount}/3
                                </span>

                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getCompletionBadgeClass(
                                    guideCount,
                                    3
                                  )}`}
                                >
                                  引导 {guideCount}/3
                                </span>

                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getCompletionBadgeClass(
                                    coreCount,
                                    4
                                  )}`}
                                >
                                  核心 {coreCount}/4
                                </span>

                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getCompletionBadgeClass(
                                    finishCount,
                                    3
                                  )}`}
                                >
                                  完成 {finishCount}/3
                                </span>

                                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-gray-600">
                                  排序 {lesson.sort_order}
                                </span>
                              </div>

                              <h3 className="truncate text-base font-black text-gray-900">
                                {lesson.title}
                              </h3>

                              <p className="mt-1 truncate text-xs text-gray-500">
                                slug: {lesson.slug}
                              </p>
                            </div>

                            <ChevronDown
                              size={18}
                              className="shrink-0 text-gray-400 transition group-data-[state=open]:rotate-180"
                            />
                          </CollapsibleTrigger>

                          {previewHref && (
                            <div className="flex shrink-0 items-center border-l border-gray-100 px-4">
                              <Link
                                href={previewHref}
                                target="_blank"
                                className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-900 hover:text-white"
                              >
                                <ExternalLink size={14} />
                                前台预览
                              </Link>
                            </div>
                          )}
                        </div>

                        <CollapsibleContent>
                          <div className="border-t border-gray-100 p-5">
                            <form
                              action={updateLessonAction}
                              className="space-y-5"
                            >
                              <input
                                type="hidden"
                                name="course_id"
                                value={course.id}
                              />

                              <input
                                type="hidden"
                                name="lesson_id"
                                value={lesson.id}
                              />

                              {/* 课时基本信息 */}
                              <AdminEditSection
                                title="课时基本信息"
                                description="控制课时标题、路径、简介、类型、时长和排序。"
                                icon={<FileText size={17} />}
                              >
                                <div className="grid gap-4 md:grid-cols-2">
                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">
                                      课时标题
                                    </span>

                                    <input
                                      name="title"
                                      defaultValue={lesson.title}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                    />
                                  </label>

                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">
                                      课时 slug
                                    </span>

                                    <input
                                      name="slug"
                                      defaultValue={lesson.slug}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                    />
                                  </label>

                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">
                                      课时类型
                                    </span>

                                    <select
                                      name="lesson_type"
                                      defaultValue={lesson.lesson_type}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                    >
                                      <option value="video">视频课</option>
                                      <option value="text">文字课</option>
                                      <option value="quiz">测验</option>
                                      <option value="document">资料</option>
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">
                                      时长，分钟
                                    </span>

                                    <input
                                      type="number"
                                      name="duration_minutes"
                                      defaultValue={lesson.duration_minutes}
                                      min={1}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                    />
                                  </label>

                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">
                                      排序
                                    </span>

                                    <input
                                      type="number"
                                      name="sort_order"
                                      defaultValue={lesson.sort_order}
                                      min={1}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                    />
                                  </label>
                                </div>

                                <label className="mt-4 block">
                                  <span className="text-xs font-bold text-gray-600">
                                    课时简介
                                  </span>

                                  <textarea
                                    name="description"
                                    defaultValue={lesson.description ?? ""}
                                    rows={3}
                                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                  />
                                </label>
                              </AdminEditSection>

                              {/* 视频设置 */}
                              <AdminEditSection
                                title="视频设置"
                                description="控制当前课时的视频来源和 Cloudflare R2 Object Key。"
                                icon={<Video size={17} />}
                              >
                                <div className="grid gap-4 md:grid-cols-2">
                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">
                                      视频来源
                                    </span>

                                    <select
                                      name="video_provider"
                                      defaultValue={lesson.video_provider ?? "r2"}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                    >
                                      <option value="">未设置</option>
                                      <option value="r2">Cloudflare R2</option>
                                      <option value="upload">上传视频</option>
                                      <option value="youtube">YouTube</option>
                                      <option value="vimeo">Vimeo</option>
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">
                                      R2 Object Key
                                    </span>

                                    <input
                                      name="video_object_key"
                                      defaultValue={lesson.video_object_key ?? ""}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                      placeholder="courses/service-application-university-selection/introduction.mp4"
                                    />
                                  </label>
                                </div>

                                <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-gray-500">
                                  正确示例：
                                  <span className="ml-1 font-mono text-gray-700">
                                    courses/service-application-university-selection/introduction.mp4
                                  </span>
                                  <br />
                                  不要写 bucket 名，不要在最后加 /。
                                </div>
                              </AdminEditSection>

                              {/* 
                                 学习引导区
                                  这里控制学生端课时页面右侧的学习目标、任务和老师提示
                                 */}
                              <AdminEditSection
                                title="学习引导"
                                description="控制学生端课时页面中的本课学习目标、本课任务和老师提示。"
                                icon={<BookOpen size={17} />}
                              >
                                <div className="grid gap-4 lg:grid-cols-2">
                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">本课学习目标</span>

                                    <textarea
                                      name="learning_objectives"
                                      defaultValue={lesson.learning_objectives ?? ""}
                                      rows={5}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                      placeholder="例如：理解为什么申请前要先确定目标大学，并掌握目标大学筛选的基本逻辑。"
                                    />
                                  </label>

                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">本课任务</span>

                                    <textarea
                                      name="lesson_tasks"
                                      defaultValue={lesson.lesson_tasks ?? ""}
                                      rows={5}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                      placeholder="例如：列出 3 所目标大学，并写出每所学校的选择理由。"
                                    />
                                  </label>

                                  <label className="block lg:col-span-2">
                                    <span className="text-xs font-bold text-gray-600">老师提示</span>

                                    <textarea
                                      name="teacher_note"
                                      defaultValue={lesson.teacher_note ?? ""}
                                      rows={4}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                      placeholder="例如：不要只看学校排名，还要结合专业方向、语言要求、学费和录取可能性。"
                                    />
                                  </label>
                                </div>
                              </AdminEditSection>

                              {/* 
  核心学习区
  这里控制学生端课时页面中的学习内容、重点、案例分析和常见错误
*/}
                              <AdminEditSection
                                title="核心学习"
                                description="控制学生端课时页面中的学习内容、本课重点、案例分析和常见错误。"
                                icon={<FileText size={17} />}
                              >
                                <div className="grid gap-4 lg:grid-cols-2">
                                  <label className="block lg:col-span-2">
                                    <span className="text-xs font-bold text-gray-600">学习内容</span>

                                    <textarea
                                      name="content_text"
                                      defaultValue={lesson.content_text ?? ""}
                                      rows={6}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                      placeholder="这里填写本课的主要学习正文内容。"
                                    />
                                  </label>

                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">本课重点</span>

                                    <textarea
                                      name="key_points"
                                      defaultValue={lesson.key_points ?? ""}
                                      rows={5}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                      placeholder="例如：目标大学选择要同时考虑排名、专业、语言要求、费用和录取可能性。"
                                    />
                                  </label>

                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">案例分析</span>

                                    <textarea
                                      name="case_study"
                                      defaultValue={lesson.case_study ?? ""}
                                      rows={5}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                      placeholder="例如：某学生只选择排名高的大学，忽略语言要求，导致申请风险增加。"
                                    />
                                  </label>

                                  <label className="block lg:col-span-2">
                                    <span className="text-xs font-bold text-gray-600">常见错误</span>

                                    <textarea
                                      name="common_mistakes"
                                      defaultValue={lesson.common_mistakes ?? ""}
                                      rows={4}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                      placeholder="例如：只看学校排名、不确认申请条件、不提前准备语言成绩。"
                                    />
                                  </label>
                                </div>
                              </AdminEditSection>

                              {/* 
  学习完成区
  这里控制学生端课时页面中的本课小结、课后思考和补充说明
*/}
                              <AdminEditSection
                                title="学习完成"
                                description="控制学生端课时页面中的本课小结、课后思考和补充说明。"
                                icon={<CheckCircle2 size={17} />}
                              >
                                <div className="grid gap-4 lg:grid-cols-2">
                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">本课小结</span>

                                    <textarea
                                      name="summary_text"
                                      defaultValue={lesson.summary_text ?? ""}
                                      rows={5}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                      placeholder="例如：确定目标大学是整个留学申请流程的起点，会影响后续材料、语言成绩和申请策略。"
                                    />
                                  </label>

                                  <label className="block">
                                    <span className="text-xs font-bold text-gray-600">课后思考</span>

                                    <textarea
                                      name="reflection_questions"
                                      defaultValue={lesson.reflection_questions ?? ""}
                                      rows={5}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                      placeholder="例如：你目前选择的目标大学是否符合自己的成绩、语言水平和经济条件？"
                                    />
                                  </label>

                                  <label className="block lg:col-span-2">
                                    <span className="text-xs font-bold text-gray-600">补充说明</span>

                                    <textarea
                                      name="extra_note"
                                      defaultValue={lesson.extra_note ?? ""}
                                      rows={4}
                                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                                      placeholder="这里可以填写补充提醒、扩展说明或其他备注。"
                                    />
                                  </label>
                                </div>
                              </AdminEditSection>

                              {/* 
                                课时资料管理区

                                这里不是编辑课时正文，而是管理当前课时下面的资料。
                                例如：
                                1. 外部链接
                                2. PDF 文件链接
                                3. 模板
                                4. 清单
                                5. 参考资料

                                注意：
                                - 这个区块仍然放在当前课时的 form 里面。
                                - form 顶部已经有 course_id 和 lesson_id 两个 hidden input。
                                - 所以点击“新增资料”或“隐藏资料”时，action 也能收到当前课程和课时 id。
                              */}
                              <AdminEditSection
                                title="课时资料管理"
                                description="为当前课时添加学习资料、外部链接、模板、清单或参考资料。"
                                icon={<Download size={17} />}
                              >
                                <div className="space-y-4">
                                  <div className="app-soft-card rounded-2xl border p-4">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                      <div>
                                        <h5 className="text-sm font-black" style={{ color: "var(--app-text)" }}>
                                          新增资料
                                        </h5>

                                        <p className="mt-1 text-xs" style={{ color: "var(--app-muted)" }}>
                                          先支持链接资料。后面可以继续扩展为 R2 文件上传。
                                        </p>
                                      </div>

                                      <span className="rounded-full border px-3 py-1 text-xs font-semibold app-muted-text">
                                        {resources.length} 个资料
                                      </span>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                      <label className="block">
                                        <span className="text-xs font-bold app-muted-text">
                                          资料标题
                                        </span>

                                        <input
                                          name="resource_title"
                                          required
                                          placeholder="例如：大学选择清单 PDF"
                                          className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                                        />
                                      </label>

                                      <label className="block">
                                        <span className="text-xs font-bold app-muted-text">
                                          资料类型
                                        </span>

                                        <select
                                          name="resource_type"
                                          defaultValue="link"
                                          className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                                        >
                                          <option value="link">链接</option>
                                          <option value="file">文件</option>
                                          <option value="template">模板</option>
                                          <option value="checklist">清单</option>
                                          <option value="reference">参考资料</option>
                                        </select>
                                      </label>

                                      <label className="block md:col-span-2">
                                        <span className="text-xs font-bold app-muted-text">
                                          资料 URL
                                        </span>

                                        <input
                                          name="resource_url"
                                          placeholder="https://..."
                                          className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                                        />
                                      </label>

                                      <label className="block md:col-span-2">
                                        <span className="text-xs font-bold app-muted-text">
                                          资料说明
                                        </span>

                                        <textarea
                                          name="resource_description"
                                          required
                                          rows={3}
                                          placeholder="简单说明这个资料的用途"
                                          className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                                        />
                                      </label>

                                      <label className="block">
                                        <span className="text-xs font-bold app-muted-text">
                                          排序
                                        </span>

                                        <input
                                          type="number"
                                          name="resource_sort_order"
                                          defaultValue={0}
                                          className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                                        />
                                      </label>

                                      <label className="flex items-center gap-2 pt-6 text-sm font-semibold app-muted-text">
                                        <input
                                          type="checkbox"
                                          name="resource_is_required"
                                          className="h-4 w-4 rounded border-gray-300"
                                        />
                                        必看资料
                                      </label>
                                    </div>

                                    <div className="mt-4 flex justify-end">
                                      <button
                                        type="submit"
                                        /*
                                          formAction 的作用：
                                          - 当前 form 默认提交到 updateLessonAction，也就是“保存课时”。
                                          - 但这个按钮不是保存课时，而是新增资料。
                                          - 所以这里用 formAction={createLessonResourceAction}
                                            覆盖当前按钮的提交目标。
                                        */
                                        formAction={createLessonResourceAction}
                                        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                                        style={{
                                          backgroundColor: "var(--app-accent)",
                                          borderColor: "var(--app-accent)",
                                        }}
                                      >
                                        新增资料
                                      </button>
                                    </div>
                                  </div>

                                  {resources.length > 0 ? (
                                    <div className="space-y-3">
                                      {resources.map((resource) => (
                                        <div
                                          key={resource.id}
                                          className="app-card rounded-2xl border p-4"
                                        >
                                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div className="min-w-0 flex-1">
                                              <div className="mb-2 flex flex-wrap gap-2">
                                                <span className="rounded-full border px-3 py-1 text-xs font-semibold app-muted-text">
                                                  {resourceTypeLabelMap[resource.resource_type] ?? "资料"}
                                                </span>

                                                {resource.is_required && (
                                                  <span
                                                    className="rounded-full border px-3 py-1 text-xs font-semibold"
                                                    style={{
                                                      borderColor: "var(--lesson-review-border)",
                                                      color: "var(--lesson-review-bg)",
                                                    }}
                                                  >
                                                    必看
                                                  </span>
                                                )}

                                                <span className="rounded-full border px-3 py-1 text-xs font-semibold app-muted-text">
                                                  排序 {resource.sort_order}
                                                </span>
                                              </div>

                                              <p
                                                className="font-bold"
                                                style={{ color: "var(--app-text)" }}
                                              >
                                                {resource.title}
                                              </p>

                                              {resource.description && (
                                                <p className="mt-1 text-sm leading-6 app-muted-text">
                                                  {resource.description}
                                                </p>
                                              )}

                                              {resource.resource_url ? (
                                                <a
                                                  href={resource.resource_url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="mt-2 inline-flex text-xs font-semibold underline"
                                                  style={{ color: "var(--app-accent)" }}
                                                >
                                                  打开资料
                                                </a>
                                              ) : (
                                                <p className="mt-2 text-xs app-muted-text">
                                                  暂无资料链接
                                                </p>
                                              )}
                                            </div>

                                            <button
                                              type="submit"
                                              formNoValidate
                                              /*
                                                这里不能写 name="resource_id"。
                                            
                                                原因：
                                                当前按钮使用了 Server Action：
                                                formAction={hideLessonResourceAction.bind(null, resource.id)}
                                            
                                                React 不允许这种按钮再使用 name 属性。
                                              */
                                              formAction={hideLessonResourceAction.bind(null, resource.id)}
                                              className="rounded-xl border px-3 py-2 text-xs font-semibold transition hover:opacity-80"
                                              style={{
                                                borderColor: "var(--app-border)",
                                                color: "var(--app-muted)",
                                              }}
                                            >
                                              隐藏
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="app-soft-card rounded-2xl border border-dashed p-5 text-center">
                                      <p className="text-sm font-semibold app-muted-text">
                                        当前课时还没有添加资料
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </AdminEditSection>

                              {/* 发布设置 */}
                              <AdminEditSection
                                title="发布设置"
                                description="控制课时是否发布、是否试看，以及保存或隐藏课时。"
                                icon={<Settings2 size={17} />}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex flex-wrap gap-4">
                                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                                      <input
                                        type="checkbox"
                                        name="is_free_preview"
                                        defaultChecked={lesson.is_free_preview}
                                        className="h-4 w-4 rounded border-gray-300"
                                      />
                                      可试看
                                    </label>

                                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                                      <input
                                        type="checkbox"
                                        name="is_published"
                                        defaultChecked={lesson.is_published}
                                        className="h-4 w-4 rounded border-gray-300"
                                      />
                                      发布课时
                                    </label>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {lesson.is_published ? (
                                      <button
                                        type="submit"
                                        formNoValidate
                                        formAction={hideLessonAction}
                                        className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                                      >
                                        <EyeOff size={16} />
                                        隐藏课时
                                      </button>
                                    ) : (
                                      <span className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-500">
                                        <EyeOff size={16} />
                                        已隐藏
                                      </span>
                                    )}

                                    <button
                                      type="submit"
                                      formNoValidate
                                      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                                    >
                                      <Save size={16} />
                                      保存课时
                                    </button>
                                  </div>
                                </div>
                              </AdminEditSection>
                            </form>
                          </div>
                        </CollapsibleContent>
                      </article>
                    </Collapsible>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <p className="font-semibold text-gray-900">暂无课时</p>

                <p className="mt-2 text-sm text-gray-500">
                  可以先在上方新增第一个课时。
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}