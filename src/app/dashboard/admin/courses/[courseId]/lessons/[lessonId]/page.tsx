/**
 * 管理端单个课时编辑页
 *
 * 路由位置：
 * src/app/dashboard/admin/courses/[courseId]/lessons/[lessonId]/page.tsx
 *
 * 这个页面只负责编辑一个具体课时。
 *
 * 专业化拆分后的职责：
 * 1. 课程管理页只负责课程信息、新增课时、三列课时卡片
 * 2. 本页面负责单个课时的完整编辑
 *
 * 本页面功能：
 * 1. 编辑课时基本信息
 * 2. 编辑视频设置
 * 3. 编辑学习引导
 * 4. 编辑核心学习内容
 * 5. 编辑学习完成内容
 * 6. 管理课时资料：新增、编辑、隐藏、恢复、删除（回收站）、彻底删除
 * 7. 课时内容编辑区使用两列折叠卡片，默认收起，减少页面长度
 * 8. 学习完成右侧放置紧凑型发布设置，视觉上保持同一编辑区域
 * 9. 课时资料管理放在课时内容编辑区下方，默认收起
 * 10. 已发布 / 已隐藏 / 回收站资料使用弹窗展示，避免资料列表撑长页面
 * 11. 保存课时 / 隐藏课时
 * 12. 回收站：删除资料先进回收站（is_deleted=true），可恢复；只有老板能彻底删除（真正 DELETE）
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  EyeOff,
  FileText,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Video,
} from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";


import {
  createLessonResourceAction,
  hideLessonAction,
  hideLessonResourceAction,
  moveLessonResourceToRecycleBinAction,
  permanentlyDeleteLessonResourceAction,
  restoreLessonResourceAction,
  restoreLessonResourceFromRecycleBinAction,
  updateLessonAction,
  updateLessonResourceAction,
} from "../../../actions";

import { ResourceFileOrLinkField } from "../../../ResourceFileOrLinkField";


import { EditResourceFileOrLinkField } from "../../../EditResourceFileOrLinkField";
/*
  课程类型

  当前页面需要课程信息来：
  1. 显示课程标题
  2. 生成返回课程管理页链接
  3. 生成学生端前台预览链接
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

  用于生成 breadcrumb 和前台预览路径。
*/
type CourseCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
};

/*
  课时类型

  对应数据库表：
  public.lessons
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

/*
  课时资料类型

  对应数据库表：
  public.lesson_resources
*/
type LessonResource = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  resource_type: string;
  resource_url: string | null;
  resource_object_key: string | null;
  original_file_name: string | null;
  is_required: boolean;
  is_published: boolean;
  sort_order: number;
  is_deleted: boolean;
  deleted_at: string | null;
  delete_reason: string | null;
};

/*
  资料类型中文显示
*/
const resourceTypeLabelMap: Record<string, string> = {
  file: "文件",
  link: "链接",
  template: "模板",
  checklist: "清单",
  reference: "参考资料",
};

/*
  可折叠编辑分区组件

  使用位置：
  1. 课时基本信息
  2. 视频设置
  3. 学习引导
  4. 核心学习
  5. 学习完成

  为什么要单独做这个组件？
  - 课时编辑页字段很多，如果全部展开，页面会很长。
  - 折叠后只显示标题、说明和完成状态。
  - 点开后再编辑具体内容，管理端更清爽。
*/
function AdminCollapsibleSection({
  title,
  description,
  icon,
  statusLabel,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  statusLabel?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="app-soft-card rounded-2xl border">
      <CollapsibleTrigger className="group flex w-full items-start justify-between gap-3 p-4 text-left transition hover:opacity-90">
        <div className="flex min-w-0 items-start gap-3">
          <div className="app-card flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-gray-600 shadow-sm">
            {icon}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-black text-gray-900">{title}</h4>

              {statusLabel && (
                <span className="rounded-full border px-2.5 py-1 text-xs font-semibold app-muted-text">
                  {statusLabel}
                </span>
              )}
            </div>

            {description && (
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {description}
              </p>
            )}
          </div>
        </div>

        <ChevronDown
          size={18}
          className="mt-2 shrink-0 text-gray-400 transition group-data-[state=open]:rotate-180"
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-gray-100 p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/*
  判断文本字段是否已经填写
*/
function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}


/*
  课时基本信息完成度

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
  学习引导完成度

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
  核心学习完成度

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
  学习完成区完成度

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

export default async function AdminLessonEditPage({
  params,
}: {
  params: Promise<{
    courseId: string;
    lessonId: string;
  }>;
}) {
  const { courseId, lessonId } = await params;

  const { supabase } = await requireAdmin();

  /*
    是否是老板（super_admin）。

    只有老板能在回收站里“彻底删除”资料。
    这里只是用来决定要不要把按钮显示出来，
    真正的安全边界仍然是 SQL 24 里 is_owner_account() 那条 DELETE policy。
  */
  const { data: viewerRoleData } = await supabase.rpc("current_profile_role");
  const isOwner = viewerRoleData === "super_admin";

  /**
   * 1. 查询课程
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
   * 2. 查询课程分类
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
   * 3. 查询当前课时
   *
   * 注意：
   * 这里同时用 id 和 course_id 查询。
   * 这样可以防止用户手动改 URL，把别的课程课时打开。
   */
  const { data: lessonData } = await supabase
    .from("lessons")
    .select(
      "id, course_id, slug, title, description, lesson_type, duration_minutes, is_free_preview, is_published, sort_order, video_provider, video_url, video_object_key, video_mime_type, content_text, teacher_note, learning_objectives, lesson_tasks, key_points, case_study, common_mistakes, summary_text, reflection_questions, extra_note"
    )
    .eq("id", lessonId)
    .eq("course_id", course.id)
    .maybeSingle();

  if (!lessonData) {
    notFound();
  }

  const lesson = lessonData as Lesson;

  /**
   * 4. 查询当前课时下面的所有资料
   *
   * 这次不再只查 is_published=true。
   * 原因：
   * 1. 已发布资料需要显示在“已发布资料”区，可以编辑和隐藏
   * 2. 已隐藏资料需要显示在“已隐藏资料”区，可以恢复
   * 3. 回收站资料需要显示在“回收站”区，可以恢复或彻底删除
   * 4. 这样“软隐藏 / 软删除”逻辑才完整
   */
  const { data: lessonResourceData } = await supabase
    .from("lesson_resources")
    .select(
      "id, lesson_id, title, description, resource_type, resource_url, resource_object_key, original_file_name, is_required, is_published, sort_order, is_deleted, deleted_at, delete_reason"
    )
    .eq("lesson_id", lesson.id)
    .order("is_published", { ascending: false })
    .order("sort_order", { ascending: true });

  const allResources = (lessonResourceData ?? []) as LessonResource[];

  /*
    已发布资料

    这些资料会显示在学生端。
    管理员可以继续编辑，也可以点击“隐藏资料”。
  */
  const resources = allResources.filter(
    (resource) => resource.is_published && !resource.is_deleted
  );

  /*
    已隐藏资料

    这些资料不会显示在学生端。
    管理员可以在这里点击“恢复资料”，让它重新发布。

    注意：必须排除 is_deleted，否则回收站资料会混进这里显示。
  */
  const hiddenResources = allResources.filter(
    (resource) => !resource.is_published && !resource.is_deleted
  );

  /*
    回收站资料

    只有这里能看到 is_deleted = true 的资料。
    可以恢复到“已隐藏资料”，或者由老板彻底删除。
  */
  const recycleBinResources = allResources.filter(
    (resource) => resource.is_deleted
  );

  const backToCourseHref = `/dashboard/admin/courses/${course.id}`;

  const previewHref =
    parentCategory && subcategory
      ? `/dashboard/courses/${parentCategory.slug}/${subcategory.slug}/${course.slug}/${lesson.slug}`
      : null;

  const videoBound = Boolean(
    hasText(lesson.video_object_key) || hasText(lesson.video_url)
  );

  /*
    各编辑区完成度

    这些数字显示在折叠卡片标题旁边，帮助管理员快速判断哪里还没填写。
  */
  const basicCount = getLessonBasicCount(lesson);
  const guideCount = getLessonGuideCount(lesson);
  const coreCount = getLessonCoreCount(lesson);
  const finishCount = getLessonFinishCount(lesson);

  return (
    <>
      <DashboardPageHeader
        title="编辑课时"
        description="单独管理当前课时的内容、视频、学习资料和发布状态。"
      />

      <div className="space-y-6 p-6">
        {/* 返回路径和前台预览 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={backToCourseHref}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
            >
              <ArrowLeft size={16} />
              返回课程管理页
            </Link>

            <span className="text-sm text-gray-300">/</span>

            <span className="text-sm font-medium text-gray-500">
              {course.title}
            </span>
          </div>

          {previewHref && (
            <Link
              href={previewHref}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-900 hover:text-white"
            >
              <ExternalLink size={15} />
              前台预览
            </Link>
          )}
        </div>

        {/* 当前课时概览 */}
        <section className="app-card rounded-3xl border p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap gap-2">
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

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  资料 {resources.length} / 隐藏 {hiddenResources.length} / 回收站 {recycleBinResources.length}
                </span>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  排序 {lesson.sort_order}
                </span>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-gray-900">
                {lesson.title}
              </h2>

              <p className="mt-2 text-sm text-gray-500">slug: {lesson.slug}</p>

              <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-500">
                {lesson.description || "暂无课时简介"}
              </p>
            </div>
          </div>
        </section>

        {/*
          课时主编辑表单

          这个 form 只负责更新 lessons 表。
          主要编辑区改成“两列 + 可折叠”，这样页面不会一次性显示所有大文本框。
          课时资料管理放在下面单独区域，避免 required 校验互相影响。
        */}
        <form action={updateLessonAction} className="space-y-5">
          <input type="hidden" name="course_id" value={course.id} />
          <input type="hidden" name="lesson_id" value={lesson.id} />

          {/*
            课时内容编辑区域

            这个大框只负责 lessons 表相关内容：
            1. 课时基本信息
            2. 视频设置
            3. 学习引导
            4. 核心学习
            5. 学习完成
            6. 发布设置

            课时资料属于 lesson_resources 表，所以放在这个 form 外面，
            避免资料表单的 required 校验影响“保存课时”。
          */}
          <section className="app-card rounded-3xl border p-5 shadow-sm">
            <div className="mb-5 flex items-start gap-3">
              <div className="app-soft-card flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-gray-600 shadow-sm">
                <FileText size={18} />
              </div>

              <div>
                <h3 className="text-base font-black text-gray-900">
                  课时内容编辑区域
                </h3>

                <p className="mt-1 text-sm leading-6 text-gray-500">
                  这里集中管理课时正文、视频和发布状态。各编辑卡片默认收起，需要时再展开。
                </p>
              </div>
            </div>

            {/*
              两列折叠编辑区

              大屏幕：2 列
              小屏幕：1 列
            */}
            <div className="grid items-start gap-5 xl:grid-cols-2">
              {/* 课时基本信息 */}
              <AdminCollapsibleSection
                title="课时基本信息"
                description="控制课时标题、路径、简介、类型、时长和排序。"
                icon={<FileText size={17} />}
                statusLabel={`基本 ${basicCount}/3`}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-bold text-gray-600">课时标题</span>

                    <input
                      name="title"
                      defaultValue={lesson.title}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-gray-600">课时 slug</span>

                    <input
                      name="slug"
                      defaultValue={lesson.slug}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-gray-600">课时类型</span>

                    <select
                      name="lesson_type"
                      defaultValue={lesson.lesson_type}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
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
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-gray-600">排序</span>

                    <input
                      type="number"
                      name="sort_order"
                      defaultValue={lesson.sort_order}
                      min={1}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                    />
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="text-xs font-bold text-gray-600">课时简介</span>

                  <textarea
                    name="description"
                    defaultValue={lesson.description ?? ""}
                    rows={3}
                    className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                  />
                </label>
              </AdminCollapsibleSection>

              {/* 视频设置 */}
              <AdminCollapsibleSection
                title="视频设置"
                description="控制当前课时的视频来源和 Cloudflare R2 Object Key。"
                icon={<Video size={17} />}
                statusLabel={videoBound ? "视频已绑定" : "视频未绑定"}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-bold text-gray-600">视频来源</span>

                    <select
                      name="video_provider"
                      defaultValue={lesson.video_provider ?? "r2"}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
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
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
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
              </AdminCollapsibleSection>

              {/* 学习引导区 */}
              <AdminCollapsibleSection
                title="学习引导"
                description="控制学生端课时页面中的本课学习目标、本课任务和老师提示。"
                icon={<BookOpen size={17} />}
                statusLabel={`引导 ${guideCount}/3`}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-bold text-gray-600">
                      本课学习目标
                    </span>

                    <textarea
                      name="learning_objectives"
                      defaultValue={lesson.learning_objectives ?? ""}
                      rows={5}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                      placeholder="例如：理解为什么申请前要先确定目标大学，并掌握目标大学筛选的基本逻辑。"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-gray-600">本课任务</span>

                    <textarea
                      name="lesson_tasks"
                      defaultValue={lesson.lesson_tasks ?? ""}
                      rows={5}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                      placeholder="例如：列出 3 所目标大学，并写出每所学校的选择理由。"
                    />
                  </label>

                  <label className="block lg:col-span-2">
                    <span className="text-xs font-bold text-gray-600">老师提示</span>

                    <textarea
                      name="teacher_note"
                      defaultValue={lesson.teacher_note ?? ""}
                      rows={4}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                      placeholder="例如：不要只看学校排名，还要结合专业方向、语言要求、学费和录取可能性。"
                    />
                  </label>
                </div>
              </AdminCollapsibleSection>

              {/* 核心学习区 */}
              <AdminCollapsibleSection
                title="核心学习"
                description="控制学生端课时页面中的学习内容、本课重点、案例分析和常见错误。"
                icon={<FileText size={17} />}
                statusLabel={`核心 ${coreCount}/4`}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block lg:col-span-2">
                    <span className="text-xs font-bold text-gray-600">学习内容</span>

                    <textarea
                      name="content_text"
                      defaultValue={lesson.content_text ?? ""}
                      rows={6}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                      placeholder="这里填写本课的主要学习正文内容。"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-gray-600">本课重点</span>

                    <textarea
                      name="key_points"
                      defaultValue={lesson.key_points ?? ""}
                      rows={5}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                      placeholder="例如：目标大学选择要同时考虑排名、专业、语言要求、费用和录取可能性。"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-gray-600">案例分析</span>

                    <textarea
                      name="case_study"
                      defaultValue={lesson.case_study ?? ""}
                      rows={5}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                      placeholder="例如：某学生只选择排名高的大学，忽略语言要求，导致申请风险增加。"
                    />
                  </label>

                  <label className="block lg:col-span-2">
                    <span className="text-xs font-bold text-gray-600">常见错误</span>

                    <textarea
                      name="common_mistakes"
                      defaultValue={lesson.common_mistakes ?? ""}
                      rows={4}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                      placeholder="例如：只看学校排名、不确认申请条件、不提前准备语言成绩。"
                    />
                  </label>
                </div>
              </AdminCollapsibleSection>

              {/* 学习完成区 */}
              <AdminCollapsibleSection
                title="学习完成"
                description="控制学生端课时页面中的本课小结、课后思考和补充说明。"
                icon={<CheckCircle2 size={17} />}
                statusLabel={`完成 ${finishCount}/3`}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-bold text-gray-600">本课小结</span>

                    <textarea
                      name="summary_text"
                      defaultValue={lesson.summary_text ?? ""}
                      rows={5}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                      placeholder="例如：确定目标大学是整个留学申请流程的起点，会影响后续材料、语言成绩和申请策略。"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-gray-600">课后思考</span>

                    <textarea
                      name="reflection_questions"
                      defaultValue={lesson.reflection_questions ?? ""}
                      rows={5}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                      placeholder="例如：你目前选择的目标大学是否符合自己的成绩、语言水平和经济条件？"
                    />
                  </label>

                  <label className="block lg:col-span-2">
                    <span className="text-xs font-bold text-gray-600">补充说明</span>

                    <textarea
                      name="extra_note"
                      defaultValue={lesson.extra_note ?? ""}
                      rows={4}
                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                      placeholder="这里可以填写补充提醒、扩展说明或其他备注。"
                    />
                  </label>
                </div>
              </AdminCollapsibleSection>
              {/*
              发布设置

              用户修正后的要求：
              1. 发布设置不要做得太高
              2. 它放在“学习完成”右侧
              3. 外观尺寸尽量接近左侧“学习完成”的收起状态
              4. 所有按钮和勾选项横向压缩显示，避免把这一行撑高
            */}
              <section className="app-soft-card rounded-2xl border p-[22px]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="app-card flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-gray-600 shadow-sm">
                      <Settings2 size={17} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4
                          className="text-sm font-black"
                          style={{ color: "var(--app-text)" }}
                        >
                          发布设置
                        </h4>

                        <span className="rounded-full border px-2.5 py-1 text-xs font-semibold app-muted-text">
                          直接控制
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold app-muted-text">
                      <input
                        type="checkbox"
                        name="is_free_preview"
                        defaultChecked={lesson.is_free_preview}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      可试看
                    </label>

                    <label className="inline-flex items-center gap-2 text-sm font-semibold app-muted-text">
                      <input
                        type="checkbox"
                        name="is_published"
                        defaultChecked={lesson.is_published}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      发布课时
                    </label>

                    {lesson.is_published ? (
                      <button
                        type="submit"
                        formNoValidate
                        formAction={hideLessonAction}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                      >
                        <EyeOff size={15} />
                        隐藏课时
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-500">
                        <EyeOff size={15} />
                        已隐藏
                      </span>
                    )}

                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800"
                    >
                      <Save size={15} />
                      保存课时
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </form>

        {/*
          课时资料管理

          这个区块故意放在 updateLessonAction 的 form 外面。

          原因：
          1. 保存课时只更新 lessons 表
          2. 新增 / 编辑 / 隐藏 / 恢复 / 删除资料只操作 lesson_resources 表
          3. 两者分开后，资料表单的 required 校验不会影响“保存课时”

          视觉上它仍然属于课时编辑页的一部分，
          但数据提交逻辑保持独立，这是更稳定的后台结构。
        */}
        {/*
          课时资料管理区域

          用户修正后的要求：
          1. 这个大板块的颜色和“课时内容编辑区域”对应起来
          2. 因此外层使用 app-card rounded-3xl border p-5 shadow-sm
          3. 内部仍然是可收起 / 展开的资料管理卡片
          4. 资料操作继续使用独立 form，不受“保存课时”控制
        */}
        <section className="app-card rounded-3xl border p-5 shadow-sm">
          <Collapsible defaultOpen={false} className="app-soft-card rounded-2xl border">
            <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 p-4 text-left transition hover:opacity-90">
              <div className="flex min-w-0 items-center gap-3">
                <div className="app-card flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-gray-600 shadow-sm">
                  <Download size={17} />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4
                      className="text-sm font-black"
                      style={{ color: "var(--app-text)" }}
                    >
                      课时资料管理
                    </h4>

                    <span className="rounded-full border px-2.5 py-1 text-xs font-semibold app-muted-text">
                      已发布 {resources.length} / 已隐藏 {hiddenResources.length} / 回收站 {recycleBinResources.length}
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-5 app-muted-text">
                    为当前课时添加、修改、隐藏、删除或恢复学习资料。
                  </p>
                </div>
              </div>

              <ChevronDown
                size={18}
                className="shrink-0 text-gray-400 transition group-data-[state=open]:rotate-180"
              />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="border-t border-gray-100 p-4">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                  {/* 新增资料表单 */}
                  <form
                    action={createLessonResourceAction}
                    className="app-soft-card rounded-2xl border p-4"
                  >
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="lesson_id" value={lesson.id} />

                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h5
                          className="text-sm font-black"
                          style={{ color: "var(--app-text)" }}
                        >
                          新增资料
                        </h5>

                        <p
                          className="mt-1 text-xs"
                          style={{ color: "var(--app-muted)" }}
                        >
                          当前先支持链接资料。后面可以继续扩展为 R2 文件上传。
                        </p>
                      </div>

                      <span className="rounded-full border px-3 py-1 text-xs font-semibold app-muted-text">
                        已发布 {resources.length} 个 / 已隐藏 {hiddenResources.length} 个
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

                      <ResourceFileOrLinkField lessonId={lesson.id} />

                      <label className="block md:col-span-2">
                        <span className="text-xs font-bold app-muted-text">资料说明</span>

                        <textarea
                          name="resource_description"
                          required
                          rows={3}
                          placeholder="简单说明这个资料的用途"
                          className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-bold app-muted-text">排序</span>

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
                        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                        style={{
                          backgroundColor: "var(--app-accent)",
                          borderColor: "var(--app-accent)",
                        }}
                      >
                        新增资料
                      </button>
                    </div>
                  </form>

                  {/*
              资料状态区

              用户要求：
              1. 放在新增资料右侧
              2. 已发布资料在上面
              3. 已隐藏资料在已发布资料下面
              4. 回收站在已隐藏资料下面
              5. 危险操作（彻底删除）在最下面，只有老板能看到
              6. 所有列表都通过弹窗打开，避免页面变长
            */}
                  <div className="space-y-4">
                    {/* 已发布资料弹窗 */}
                    <div className="app-card rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h5
                            className="text-sm font-black"
                            style={{ color: "var(--app-text)" }}
                          >
                            已发布资料
                          </h5>

                          <p
                            className="mt-1 text-xs leading-5"
                            style={{ color: "var(--app-muted)" }}
                          >
                            这些资料会显示在学生端。点击按钮后在弹窗中编辑、保存或隐藏。
                          </p>
                        </div>

                        <span className="rounded-full border px-3 py-1 text-xs font-semibold app-muted-text">
                          {resources.length} 个
                        </span>
                      </div>

                      <Dialog>
                        <DialogTrigger
                          type="button"
                          className="mt-4 inline-flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                          style={{
                            backgroundColor: "var(--app-accent)",
                            borderColor: "var(--app-accent)",
                          }}
                        >
                          查看已发布资料
                        </DialogTrigger>

                        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[1200px]">
                          <DialogHeader>
                            <DialogTitle>已发布资料</DialogTitle>
                            <DialogDescription>
                              可在这里编辑、保存或隐藏当前课时的已发布资料。大屏幕下按 2 列显示。
                            </DialogDescription>
                          </DialogHeader>

                          {resources.length > 0 ? (
                            <div className="grid gap-4 lg:grid-cols-2">
                              {resources.map((resource) => (
                                <div
                                  key={resource.id}
                                  className="app-card rounded-2xl border p-4"
                                >
                                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap gap-2">
                                      <span className="rounded-full border px-3 py-1 text-xs font-semibold app-muted-text">
                                        {resourceTypeLabelMap[resource.resource_type] ?? "资料"}
                                      </span>

                                      <span className="rounded-full border px-3 py-1 text-xs font-semibold text-green-700">
                                        已发布
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
                                  </div>

                                  {/*
                              编辑资料表单

                              这里每一条资料都有自己的 form。
                              点击“保存资料”只会更新当前这一条资料。
                            */}
                                  <form
                                    action={updateLessonResourceAction.bind(null, resource.id)}
                                    className="space-y-4"
                                  >
                                    <input type="hidden" name="course_id" value={course.id} />

                                    <div className="grid gap-4 md:grid-cols-2">
                                      <label className="block">
                                        <span className="text-xs font-bold app-muted-text">
                                          资料标题
                                        </span>

                                        <input
                                          name="resource_title"
                                          required
                                          defaultValue={resource.title}
                                          className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                                        />
                                      </label>

                                        <EditResourceFileOrLinkField
                                        lessonId={lesson.id}
                                        resource={resource}
                                      />

                                      <label className="block md:col-span-2">
                                        <span className="text-xs font-bold app-muted-text">
                                          资料说明
                                        </span>

                                        <textarea
                                          name="resource_description"
                                          required
                                          rows={3}
                                          defaultValue={resource.description ?? ""}
                                          className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                                        />
                                      </label>

                                      <label className="block">
                                        <span className="text-xs font-bold app-muted-text">排序</span>

                                        <input
                                          type="number"
                                          name="resource_sort_order"
                                          defaultValue={resource.sort_order}
                                          className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                                        />
                                      </label>

                                      <label className="flex items-center gap-2 pt-6 text-sm font-semibold app-muted-text">
                                        <input
                                          type="checkbox"
                                          name="resource_is_required"
                                          defaultChecked={resource.is_required}
                                          className="h-4 w-4 rounded border-gray-300"
                                        />
                                        必看资料
                                      </label>
                                    </div>

                                    <div className="flex flex-wrap justify-end gap-2">
                                      {resource.resource_url && (
                                        
                                       <a   href={resource.resource_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-80"
                                          style={{
                                            borderColor: "var(--app-border)",
                                            color: "var(--app-accent)",
                                          }}
                                        >
                                          打开资料
                                        </a>
                                      )}

                                      {resource.resource_object_key && (
                                        
                                        <a href={`/api/lesson-resources/${resource.id}/download`}
                                          className="inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-80"
                                          style={{
                                            borderColor: "var(--app-border)",
                                            color: "var(--app-accent)",
                                          }}
                                        >
                                          下载文件（{resource.original_file_name}）
                                        </a>
                                      )}

                                      <button
                                        type="submit"
                                        className="inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                                        style={{
                                          backgroundColor: "var(--app-accent)",
                                          borderColor: "var(--app-accent)",
                                        }}
                                      >
                                        保存资料
                                      </button>
                                    </div>
                                  </form>

                                  {/*
                              隐藏资料表单

                              单独使用 form，避免触发编辑表单里的 required 校验。
                            */}
                                  <form
                                    action={hideLessonResourceAction.bind(null, resource.id)}
                                    className="mt-3 flex justify-end"
                                  >
                                    <input type="hidden" name="course_id" value={course.id} />

                                    <button
                                      type="submit"
                                      className="rounded-xl border px-3 py-2 text-xs font-semibold transition hover:opacity-80"
                                      style={{
                                        borderColor: "var(--app-border)",
                                        color: "var(--app-muted)",
                                      }}
                                    >
                                      隐藏资料
                                    </button>
                                  </form>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="app-soft-card rounded-2xl border border-dashed p-5 text-center">
                              <p className="text-sm font-semibold app-muted-text">
                                当前课时还没有已发布资料
                              </p>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* 已隐藏资料弹窗 */}
                    <div className="app-card rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h5
                            className="text-sm font-black"
                            style={{ color: "var(--app-text)" }}
                          >
                            已隐藏资料
                          </h5>

                          <p
                            className="mt-1 text-xs leading-5"
                            style={{ color: "var(--app-muted)" }}
                          >
                            这些资料不会显示在学生端。点击按钮后可以在弹窗中恢复或删除（进回收站）。
                          </p>
                        </div>

                        <span className="rounded-full border px-3 py-1 text-xs font-semibold app-muted-text">
                          {hiddenResources.length} 个
                        </span>
                      </div>

                      <Dialog>
                        <DialogTrigger
                          type="button"
                          className="mt-4 inline-flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-80"
                          style={{
                            borderColor: "var(--app-border)",
                            color: "var(--app-accent)",
                          }}
                        >
                          查看已隐藏资料
                        </DialogTrigger>

                        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[1000px]">
                          <DialogHeader>
                            <DialogTitle>已隐藏资料</DialogTitle>
                            <DialogDescription>
                              已隐藏资料不会显示在学生端。可以在这里恢复需要重新发布的资料，或者删除进回收站。
                            </DialogDescription>
                          </DialogHeader>

                          {hiddenResources.length > 0 ? (
                            <div className="grid gap-4 lg:grid-cols-2">
                              {hiddenResources.map((resource) => (
                                <div
                                  key={resource.id}
                                  className="app-soft-card rounded-2xl border border-dashed p-4"
                                >
                                  <div className="flex flex-col gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="mb-2 flex flex-wrap gap-2">
                                        <span className="rounded-full border px-3 py-1 text-xs font-semibold app-muted-text">
                                          {resourceTypeLabelMap[resource.resource_type] ?? "资料"}
                                        </span>

                                        <span className="rounded-full border px-3 py-1 text-xs font-semibold app-muted-text">
                                          已隐藏
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

                                      <div className="mt-2 flex flex-wrap gap-3">
                                        {resource.resource_url && (
                                          <a href={resource.resource_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex text-xs font-semibold underline"
                                            style={{ color: "var(--app-accent)" }}
                                          >
                                            打开资料
                                          </a>
                                        )}

                                        {resource.resource_object_key && (
                                          <a href={`/api/lesson-resources/${resource.id}/download`}
                                            className="inline-flex text-xs font-semibold underline"
                                            style={{ color: "var(--app-accent)" }}
                                          >
                                            下载文件（{resource.original_file_name}）
                                          </a>
                                        )}

                                        {!resource.resource_url &&
                                          !resource.resource_object_key && (
                                            <p className="text-xs app-muted-text">
                                              暂无资料链接
                                            </p>
                                          )}
                                      </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                      <form
                                        action={restoreLessonResourceAction.bind(null, resource.id)}
                                        className="flex justify-end"
                                      >
                                        <input type="hidden" name="course_id" value={course.id} />

                                        <button
                                          type="submit"
                                          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                                          style={{
                                            backgroundColor: "var(--app-accent)",
                                            borderColor: "var(--app-accent)",
                                          }}
                                        >
                                          <RotateCcw size={15} />
                                          恢复资料
                                        </button>
                                      </form>

                                      {/*
                                        删除资料（进回收站）
                                        单独 form，避免 required 的删除原因影响“恢复资料”
                                      */}
                                      <form
                                        action={moveLessonResourceToRecycleBinAction.bind(null, resource.id)}
                                        className="flex flex-col gap-2 rounded-xl border border-dashed p-3"
                                        style={{ borderColor: "rgba(239, 68, 68, 0.35)" }}
                                      >
                                        <input type="hidden" name="course_id" value={course.id} />
                                        <input type="hidden" name="lesson_id" value={lesson.id} />

                                        <label className="block">
                                          <span className="text-xs font-bold app-muted-text">
                                            删除原因（必填）
                                          </span>

                                          <textarea
                                            name="delete_reason"
                                            required
                                            rows={2}
                                            placeholder="例如：内容已过期，替换为新版资料"
                                            className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                                          />
                                        </label>

                                        <button
                                          type="submit"
                                          className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition hover:opacity-80"
                                          style={{
                                            borderColor: "rgba(239, 68, 68, 0.45)",
                                            color: "rgb(185, 28, 28)",
                                          }}
                                        >
                                          <Trash2 size={14} />
                                          删除资料（进回收站）
                                        </button>
                                      </form>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="app-soft-card rounded-2xl border border-dashed p-5 text-center">
                              <p className="text-sm font-semibold app-muted-text">
                                当前没有已隐藏资料
                              </p>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* 回收站弹窗 */}
                    <div className="app-card rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h5
                            className="text-sm font-black"
                            style={{ color: "var(--app-text)" }}
                          >
                            回收站
                          </h5>

                          <p
                            className="mt-1 text-xs leading-5"
                            style={{ color: "var(--app-muted)" }}
                          >
                            已删除的资料保留在这里，可以恢复到“已隐藏资料”。
                          </p>
                        </div>

                        <span className="rounded-full border px-3 py-1 text-xs font-semibold app-muted-text">
                          {recycleBinResources.length} 个
                        </span>
                      </div>

                      <Dialog>
                        <DialogTrigger
                          type="button"
                          className="mt-4 inline-flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-80"
                          style={{
                            borderColor: "var(--app-border)",
                            color: "var(--app-accent)",
                          }}
                        >
                          <Archive size={15} className="mr-1.5" />
                          查看回收站
                        </DialogTrigger>

                        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[1000px]">
                          <DialogHeader>
                            <DialogTitle>回收站</DialogTitle>
                            <DialogDescription>
                              这些资料已被删除，可以恢复到“已隐藏资料”，恢复后需要再手动点“恢复资料”才会重新发布。
                            </DialogDescription>
                          </DialogHeader>

                          {recycleBinResources.length > 0 ? (
                            <div className="grid gap-4 lg:grid-cols-2">
                              {recycleBinResources.map((resource) => (
                                <div
                                  key={resource.id}
                                  className="app-soft-card rounded-2xl border border-dashed p-4"
                                >
                                  <div className="mb-2 flex flex-wrap gap-2">
                                    <span className="rounded-full border px-3 py-1 text-xs font-semibold app-muted-text">
                                      {resourceTypeLabelMap[resource.resource_type] ?? "资料"}
                                    </span>

                                    <span className="rounded-full border px-3 py-1 text-xs font-semibold text-red-600">
                                      已删除
                                    </span>
                                  </div>

                                  <p
                                    className="font-bold"
                                    style={{ color: "var(--app-text)" }}
                                  >
                                    {resource.title}
                                  </p>

                                  {resource.delete_reason && (
                                    <p className="mt-1 text-xs leading-5 app-muted-text">
                                      删除原因：{resource.delete_reason}
                                    </p>
                                  )}

                                  {resource.deleted_at && (
                                    <p className="mt-1 text-xs app-muted-text">
                                      删除时间：
                                      {new Date(resource.deleted_at).toLocaleString("zh-CN", {
                                        timeZone: "Asia/Shanghai",
                                      })}
                                    </p>
                                  )}

                                  <form
                                    action={restoreLessonResourceFromRecycleBinAction.bind(
                                      null,
                                      resource.id
                                    )}
                                    className="mt-3 flex justify-end"
                                  >
                                    <input type="hidden" name="course_id" value={course.id} />
                                    <input type="hidden" name="lesson_id" value={lesson.id} />

                                    <button
                                      type="submit"
                                      className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                                      style={{
                                        backgroundColor: "var(--app-accent)",
                                        borderColor: "var(--app-accent)",
                                      }}
                                    >
                                      <RotateCcw size={15} />
                                      恢复资料
                                    </button>
                                  </form>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="app-soft-card rounded-2xl border border-dashed p-5 text-center">
                              <p className="text-sm font-semibold app-muted-text">
                                回收站是空的
                              </p>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/*
                      危险操作

                      这里专门处理彻底删除。
                      只有老板（super_admin）能看到，且只能对“回收站”里的资料操作。

                      删除规则：
                      1. 只能选择回收站里的资料
                      2. 必须输入 delete
                      3. 删除后无法恢复
                    */}
                    {isOwner && (
                      <div
                        className="rounded-2xl border p-4"
                        style={{
                          borderColor: "rgba(239, 68, 68, 0.35)",
                          backgroundColor: "rgba(239, 68, 68, 0.06)",
                        }}
                      >
                        <div>
                          <p
                            className="text-sm font-black"
                            style={{ color: "rgb(185, 28, 28)" }}
                          >
                            危险操作
                          </p>

                          <p className="mt-1 text-xs leading-5 app-muted-text">
                            彻底删除只针对回收站里的资料，只有老板能操作，删除后无法恢复。
                          </p>
                        </div>

                        <div className="mt-4">
                          {recycleBinResources.length > 0 ? (
                            <Dialog>
                              <DialogTrigger
                                type="button"
                                className="inline-flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-80"
                                style={{
                                  borderColor: "rgba(239, 68, 68, 0.45)",
                                  color: "rgb(185, 28, 28)",
                                }}
                              >
                                <Trash2 size={15} className="mr-1.5" />
                                打开删除管理
                              </DialogTrigger>

                              <DialogContent className="max-w-xl">
                                <DialogHeader>
                                  <DialogTitle>彻底删除资料</DialogTitle>

                                  <DialogDescription>
                                    请选择回收站里的一条资料，并输入 delete 后彻底删除。这个操作无法恢复。
                                  </DialogDescription>
                                </DialogHeader>

                                <form
                                  action={permanentlyDeleteLessonResourceAction}
                                  className="space-y-4"
                                >
                                  <input type="hidden" name="course_id" value={course.id} />
                                  <input type="hidden" name="lesson_id" value={lesson.id} />

                                  <label className="block">
                                    <span className="text-xs font-bold app-muted-text">
                                      选择要彻底删除的回收站资料
                                    </span>

                                    <select
                                      name="resource_id"
                                      required
                                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                                    >
                                      <option value="">请选择资料</option>

                                      {recycleBinResources.map((resource) => (
                                        <option key={resource.id} value={resource.id}>
                                          {resource.title}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="text-xs font-bold app-muted-text">
                                      确认文字
                                    </span>

                                    <input
                                      name="delete_confirm"
                                      required
                                      pattern="[dD][eE][lL][eE][tT][eE]"
                                      placeholder="请输入 delete"
                                      title="请输入 delete 才能彻底删除"
                                      className="app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none transition"
                                    />
                                  </label>

                                  <div
                                    className="rounded-xl border px-3 py-2 text-xs leading-5"
                                    style={{
                                      borderColor: "rgba(239, 68, 68, 0.35)",
                                      color: "rgb(185, 28, 28)",
                                    }}
                                  >
                                    注意：这里会永久删除数据库中的资料记录。删除后不能通过“恢复资料”找回。
                                  </div>

                                  <div className="flex justify-end">
                                    <button
                                      type="submit"
                                      className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                                      style={{ backgroundColor: "rgb(220, 38, 38)" }}
                                    >
                                      确认彻底删除
                                    </button>
                                  </div>
                                </form>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <p className="rounded-xl border border-dashed px-3 py-2 text-center text-xs app-muted-text">
                              回收站是空的，没有可彻底删除的资料
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>
      </div>
    </>
  );
}
