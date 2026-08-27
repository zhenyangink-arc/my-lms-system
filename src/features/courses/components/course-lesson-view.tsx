import { ImageOff } from "lucide-react";
import Link from "next/link";

import type {
  CourseCatalogLesson,
  CourseLessonResource,
} from "../api/types";
import { LessonResourcesTable } from "./lesson-resources-table";
import { CreateLessonResourceDialog } from "./lesson-resource-action-dialogs";

function LessonCover({ lesson }: { lesson: CourseCatalogLesson }) {
  return (
    <div className="overflow-hidden border border-[var(--border)] bg-[var(--surface-soft)]">
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
        <div className="flex aspect-video flex-col items-center justify-center gap-2 text-xs text-[var(--foreground-muted)]">
          <ImageOff size={20} strokeWidth={1.6} />
          暂无课时封面
        </div>
      )}
    </div>
  );
}

export function CourseLessonView({
  lesson,
  resources,
  resourceErrorMessage,
  canManage,
  canPermanentlyDeleteResources,
  textbookHref,
}: {
  lesson: CourseCatalogLesson;
  resources: CourseLessonResource[];
  resourceErrorMessage?: string | null;
  canManage: boolean;
  canPermanentlyDeleteResources: boolean;
  textbookHref?: string;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-5 border-y border-[var(--border)] py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <LessonCover lesson={lesson} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--foreground-muted)]">课时结构预览</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
            {lesson.title}
          </h2>
          <p className="mt-1 font-mono text-[11px] text-[var(--foreground-muted)]">
            {lesson.slug}
          </p>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground-secondary)]">
            {lesson.description || "暂无课时简介"}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
            <div className="bg-[var(--card)] px-3 py-2">
              <dt className="text-[10px] text-[var(--foreground-muted)]">课时类型</dt>
              <dd className="mt-1 text-xs font-semibold">{lesson.lesson_type || "未设置"}</dd>
            </div>
            <div className="bg-[var(--card)] px-3 py-2">
              <dt className="text-[10px] text-[var(--foreground-muted)]">预计时长</dt>
              <dd className="mt-1 text-xs font-semibold">
                {lesson.duration_minutes ? `${lesson.duration_minutes} 分钟` : "未设置"}
              </dd>
            </div>
            <div className="bg-[var(--card)] px-3 py-2">
              <dt className="text-[10px] text-[var(--foreground-muted)]">学生端状态</dt>
              <dd className="mt-1 text-xs font-semibold">
                {lesson.is_published ? "已上架" : "未上架"}
              </dd>
            </div>
            <div className="bg-[var(--card)] px-3 py-2">
              <dt className="text-[10px] text-[var(--foreground-muted)]">试看权限</dt>
              <dd className="mt-1 text-xs font-semibold">
                {lesson.is_free_preview ? "允许试看" : "不允许试看"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {textbookHref && (
        <section className="flex flex-wrap items-center justify-between gap-4 border-y border-[var(--border)] py-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">教学内容由教材制作统一管理</h3>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">学习目标、场景、词汇、语法、活动和音频不再在课程结构中重复编辑。</p>
          </div>
          <Link href={textbookHref} className="inline-flex h-9 items-center bg-[var(--primary)] px-4 text-xs font-semibold text-white hover:opacity-90">
            进入教材制作
          </Link>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--foreground)]">
              课时资料
            </h3>
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
              管理文件、链接、模板、清单和参考资料及其当前状态。
            </p>
          </div>
          {canManage && (
            <CreateLessonResourceDialog
              lessonId={lesson.id}
              defaultSortOrder={resources.length * 10 + 10}
            />
          )}
        </div>
        {resourceErrorMessage && (
          <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            课时资料读取失败：{resourceErrorMessage}
          </p>
        )}
        <LessonResourcesTable
          data={resources}
          canManage={canManage}
          canPermanentlyDelete={canPermanentlyDeleteResources}
        />
      </section>
    </div>
  );
}
