import { ImageOff } from "lucide-react";

import type {
  CourseCatalogLesson,
  CourseLessonResource,
} from "../api/types";
import { LessonResourcesTable } from "./lesson-resources-table";

const CONTENT_FIELDS: Array<{
  key: keyof Pick<
    CourseCatalogLesson,
    | "content_text"
    | "learning_objectives"
    | "lesson_tasks"
    | "key_points"
    | "case_study"
    | "common_mistakes"
    | "summary_text"
    | "reflection_questions"
    | "teacher_note"
    | "extra_note"
  >;
  label: string;
}> = [
  { key: "content_text", label: "课时正文" },
  { key: "learning_objectives", label: "学习目标" },
  { key: "lesson_tasks", label: "学习任务" },
  { key: "key_points", label: "重点内容" },
  { key: "case_study", label: "案例" },
  { key: "common_mistakes", label: "易错点" },
  { key: "summary_text", label: "课时总结" },
  { key: "reflection_questions", label: "思考问题" },
  { key: "teacher_note", label: "教师备注" },
  { key: "extra_note", label: "补充说明" },
];

function LessonCover({ lesson }: { lesson: CourseCatalogLesson }) {
  return (
    <div className="overflow-hidden border border-[var(--app-border)] bg-[var(--app-soft-bg)]">
      {lesson.cover_object_key ? (
        // 复用现有按请求鉴权并生成签名地址的封面接口。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/course-assets/lesson/${lesson.id}`}
          alt={lesson.cover_alt ?? lesson.title}
          className="aspect-video h-full w-full object-cover"
          style={{ objectPosition: lesson.cover_focal_point ?? "center" }}
        />
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 text-xs text-[var(--app-muted)]">
          <ImageOff size={20} strokeWidth={1.6} />
          暂无课时封面
        </div>
      )}
    </div>
  );
}

function ContentRows({ lesson }: { lesson: CourseCatalogLesson }) {
  return (
    <div className="border-t border-[var(--app-border)]">
      {CONTENT_FIELDS.map(({ key, label }) => (
        <div
          key={key}
          className="grid border-b border-[var(--app-border)] md:grid-cols-[150px_minmax(0,1fr)]"
        >
          <div className="bg-[var(--app-soft-bg)] px-4 py-3 text-xs font-semibold text-[var(--app-text-soft)]">
            {label}
          </div>
          <div className="whitespace-pre-wrap px-4 py-3 text-xs leading-6 text-[var(--app-text)]">
            {lesson[key]?.trim() || "暂未填写"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CourseLessonView({
  lesson,
  resources,
  resourceErrorMessage,
}: {
  lesson: CourseCatalogLesson;
  resources: CourseLessonResource[];
  resourceErrorMessage?: string | null;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-5 border-y border-[var(--app-border)] py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <LessonCover lesson={lesson} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--app-muted)]">课时内容预览</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--app-text)]">
            {lesson.title}
          </h2>
          <p className="mt-1 font-mono text-[11px] text-[var(--app-muted)]">
            {lesson.slug}
          </p>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--app-text-soft)]">
            {lesson.description || "暂无课时简介"}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden border border-[var(--app-border)] bg-[var(--app-border)] sm:grid-cols-4">
            <div className="bg-[var(--app-card-bg)] px-3 py-2">
              <dt className="text-[10px] text-[var(--app-muted)]">课时类型</dt>
              <dd className="mt-1 text-xs font-semibold">{lesson.lesson_type || "未设置"}</dd>
            </div>
            <div className="bg-[var(--app-card-bg)] px-3 py-2">
              <dt className="text-[10px] text-[var(--app-muted)]">预计时长</dt>
              <dd className="mt-1 text-xs font-semibold">
                {lesson.duration_minutes ? `${lesson.duration_minutes} 分钟` : "未设置"}
              </dd>
            </div>
            <div className="bg-[var(--app-card-bg)] px-3 py-2">
              <dt className="text-[10px] text-[var(--app-muted)]">发布状态</dt>
              <dd className="mt-1 text-xs font-semibold">
                {lesson.is_published ? "已发布" : "草稿"}
              </dd>
            </div>
            <div className="bg-[var(--app-card-bg)] px-3 py-2">
              <dt className="text-[10px] text-[var(--app-muted)]">试看权限</dt>
              <dd className="mt-1 text-xs font-semibold">
                {lesson.is_free_preview ? "允许试看" : "不允许试看"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h3 className="text-base font-semibold text-[var(--app-text)]">
            课时内容
          </h3>
          <p className="mt-1 text-xs text-[var(--app-muted)]">
            当前仅展示已保存的课时正文与教学信息。
          </p>
        </div>
        <ContentRows lesson={lesson} />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--app-text)]">
            课时资料
          </h3>
          <p className="mt-1 text-xs text-[var(--app-muted)]">
            展示文件、链接、模板、清单和参考资料及其当前状态。
          </p>
        </div>
        {resourceErrorMessage && (
          <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            课时资料读取失败：{resourceErrorMessage}
          </p>
        )}
        <LessonResourcesTable data={resources} />
      </section>
    </div>
  );
}
