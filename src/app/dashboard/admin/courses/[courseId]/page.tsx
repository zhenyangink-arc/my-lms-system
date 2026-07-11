import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  EyeOff,
  FileVideo,
  Plus,
  Save,
  Video,
} from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { DashboardPageHeader } from "../../../DashboardPageHeader";
import {
  createLessonAction,
  hideLessonAction,
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

export default async function AdminCourseLessonsPage({
  params,
}: {
  params: Promise<{
    courseId: string;
  }>;
}) {
  const { courseId } = await params;

  const { supabase } = await requireAdmin();

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

  const { data: lessonData } = await supabase
    .from("lessons")
    .select(
      "id, course_id, slug, title, description, lesson_type, duration_minutes, is_free_preview, is_published, sort_order, video_provider, video_object_key, video_mime_type, content_text, teacher_note, learning_objectives, lesson_tasks, key_points, case_study, common_mistakes, summary_text, reflection_questions, extra_note"
    )
    .eq("course_id", course.id)
    .order("sort_order", { ascending: true });

  const lessons = (lessonData ?? []) as Lesson[];

  return (
    <>
      <DashboardPageHeader
        title="课时管理"
        description={`管理课程：${course.title}`}
      />

      <div className="space-y-6 p-6">
        <div>
          <Link
            href="/dashboard/admin/courses"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            返回课程管理
          </Link>
        </div>

        {/* 课程基本信息 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black tracking-tight text-gray-900">
                课程基本信息
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                修改课程标题、简介、等级和发布状态。
              </p>
            </div>

            <BookOpen className="text-gray-300" size={28} />
          </div>

          <form action={updateCourseAction} className="space-y-4">
            <input type="hidden" name="course_id" value={course.id} />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-gray-700">
                  课程标题
                </span>
                <input
                  name="title"
                  defaultValue={course.title}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-gray-700">
                  课程等级
                </span>
                <select
                  name="level"
                  defaultValue={course.level ?? "basic"}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                >
                  <option value="basic">基础</option>
                  <option value="beginner">入门</option>
                  <option value="intermediate">进阶</option>
                  <option value="advanced">高级</option>
                </select>
              </label>
            </div>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-gray-700">
                课程简介
              </span>
              <textarea
                name="description"
                defaultValue={course.description ?? ""}
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm leading-6 outline-none transition focus:border-gray-400"
              />
            </label>

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
              保存课程信息
            </button>
          </form>
        </section>

        {/* 新增课时 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black tracking-tight text-gray-900">
                新增课时
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                先创建课时，再在下面绑定 R2 视频路径。
              </p>
            </div>

            <Plus className="text-gray-300" size={28} />
          </div>

          <form action={createLessonAction} className="space-y-4">
            <input type="hidden" name="course_id" value={course.id} />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-gray-700">
                  课时标题
                </span>
                <input
                  name="title"
                  placeholder="例如：E-7 工作签证申请"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-gray-700">
                  课时 slug
                </span>
                <input
                  name="slug"
                  placeholder="例如：e7-work-visa-application"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                />
              </label>
            </div>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-gray-700">
                课时简介
              </span>
              <textarea
                name="description"
                rows={2}
                placeholder="简单说明这个课时学习什么内容。"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm leading-6 outline-none transition focus:border-gray-400"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-gray-700">
                  预计时长（分钟）
                </span>
                <input
                  name="duration_minutes"
                  type="number"
                  defaultValue={10}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-gray-700">
                  排序
                </span>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={lessons.length + 1}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                />
              </label>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              <Plus size={16} />
              新增课时
            </button>
          </form>
        </section>

        {/* 课时列表 */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black tracking-tight text-gray-900">
                课时列表
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                修改课时信息、R2 视频路径和发布状态。
              </p>
            </div>

            <FileVideo className="text-gray-300" size={28} />
          </div>

          {lessons.length > 0 ? (
            <div className="space-y-5">
              {lessons.map((lesson, index) => {
                const hasR2Video =
                  lesson.video_provider === "r2" && lesson.video_object_key;

                return (
                  <form
                    key={lesson.id}
                    action={updateLessonAction}
                    className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <input type="hidden" name="course_id" value={course.id} />
                    <input type="hidden" name="lesson_id" value={lesson.id} />

                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                            {index + 1}. {lesson.slug}
                          </span>

                          {lesson.is_published ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                              <CheckCircle2 size={13} />
                              已发布
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                              未发布
                            </span>
                          )}

                          {hasR2Video ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                              <Video size={13} />
                              已绑定 R2
                            </span>
                          ) : (
                            <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
                              未绑定视频
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-black text-gray-900">
                          {lesson.title}
                        </h3>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className="text-sm font-semibold text-gray-700">
                          课时标题
                        </span>
                        <input
                          name="title"
                          defaultValue={lesson.title}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-sm font-semibold text-gray-700">
                          课时 slug
                        </span>
                        <input
                          name="slug"
                          defaultValue={lesson.slug}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                        />
                      </label>
                    </div>

                    <label className="mt-4 block space-y-1.5">
                      <span className="text-sm font-semibold text-gray-700">
                        课时简介
                      </span>
                      <textarea
                        name="description"
                        defaultValue={lesson.description ?? ""}
                        rows={2}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm leading-6 outline-none transition focus:border-gray-400"
                      />
                    </label>

                    <div className="mt-4 grid gap-4 md:grid-cols-4">
                      <label className="space-y-1.5">
                        <span className="text-sm font-semibold text-gray-700">
                          类型
                        </span>
                        <select
                          name="lesson_type"
                          defaultValue={lesson.lesson_type}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                        >
                          <option value="video">视频课</option>
                          <option value="text">文字课</option>
                          <option value="quiz">测验</option>
                          <option value="document">资料</option>
                        </select>
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-sm font-semibold text-gray-700">
                          时长
                        </span>
                        <input
                          name="duration_minutes"
                          type="number"
                          defaultValue={lesson.duration_minutes}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-sm font-semibold text-gray-700">
                          排序
                        </span>
                        <input
                          name="sort_order"
                          type="number"
                          defaultValue={lesson.sort_order}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-sm font-semibold text-gray-700">
                          视频来源
                        </span>
                        <select
                          name="video_provider"
                          defaultValue={lesson.video_provider ?? "r2"}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                        >
                          <option value="r2">Cloudflare R2</option>
                          <option value="upload">上传链接</option>
                          <option value="youtube">YouTube</option>
                        </select>
                      </label>
                    </div>
                    {/* 
  课时内容编辑区
  这里控制学生端课时页面里的学习目标、任务、正文、重点、案例、小结等内容
*/}
                    <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="mb-4">
                        <h4 className="text-sm font-black text-gray-900">课时内容编辑</h4>
                        <p className="mt-1 text-xs text-gray-500">
                          这里的内容会显示在学生端课时学习页面。
                        </p>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-bold text-gray-600">本课学习目标</span>
                          <textarea
                            name="learning_objectives"
                            defaultValue={lesson.learning_objectives ?? ""}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                            placeholder="例如：理解为什么申请前要先确定目标大学。"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-gray-600">本课任务</span>
                          <textarea
                            name="lesson_tasks"
                            defaultValue={lesson.lesson_tasks ?? ""}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                            placeholder="例如：列出 3 所目标大学，并说明选择理由。"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-gray-600">老师提示</span>
                          <textarea
                            name="teacher_note"
                            defaultValue={lesson.teacher_note ?? ""}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                            placeholder="给学生的提醒、建议或注意事项。"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-gray-600">学习内容</span>
                          <textarea
                            name="content_text"
                            defaultValue={lesson.content_text ?? ""}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                            placeholder="本课主要讲解内容。"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-gray-600">本课重点</span>
                          <textarea
                            name="key_points"
                            defaultValue={lesson.key_points ?? ""}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                            placeholder="本课需要重点掌握的内容。"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-gray-600">案例分析</span>
                          <textarea
                            name="case_study"
                            defaultValue={lesson.case_study ?? ""}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                            placeholder="可以写一个学生选校案例。"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-gray-600">常见错误</span>
                          <textarea
                            name="common_mistakes"
                            defaultValue={lesson.common_mistakes ?? ""}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                            placeholder="学生在本课内容中常犯的错误。"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-gray-600">本课小结</span>
                          <textarea
                            name="summary_text"
                            defaultValue={lesson.summary_text ?? ""}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                            placeholder="对本课内容进行总结。"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-gray-600">课后思考</span>
                          <textarea
                            name="reflection_questions"
                            defaultValue={lesson.reflection_questions ?? ""}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                            placeholder="例如：你的目标大学选择是否符合自身条件？"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-bold text-gray-600">补充说明</span>
                          <textarea
                            name="extra_note"
                            defaultValue={lesson.extra_note ?? ""}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-gray-900"
                            placeholder="补充说明、扩展提醒或其他备注。"
                          />
                        </label>
                      </div>
                    </div>

                    <label className="mt-4 block space-y-1.5">
                      <span className="text-sm font-semibold text-gray-700">
                        R2 视频 Object Key
                      </span>
                      <input
                        name="video_object_key"
                        defaultValue={lesson.video_object_key ?? ""}
                        placeholder="例如：courses/service-application-university-selection/introduction.mp4"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400"
                      />
                      <p className="text-xs text-gray-400">
                        不要填写 bucket 名，也不要在最后加 /。
                      </p>
                    </label>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
                          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                        >
                          <Save size={16} />
                          保存课时
                        </button>
                      </div>
                    </div>
                  </form>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <p className="font-semibold text-gray-900">暂无课时</p>
              <p className="mt-2 text-sm text-gray-500">
                可以先在上方新增一个课时。
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}