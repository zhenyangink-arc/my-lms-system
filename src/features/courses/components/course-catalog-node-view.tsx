import { ImageOff } from "lucide-react";

import type {
  CourseCatalogChapter,
  CourseCatalogCourse,
  CourseCatalogLesson,
  CourseCatalogNodeKind,
  CourseCategory,
  CourseLessonResource,
} from "../api/types";
import { CourseLessonView } from "./course-lesson-view";

type CourseCatalogNodeViewProps =
  | {
      kind: "category";
      node: CourseCategory;
      resources?: never;
      resourceErrorMessage?: never;
    }
  | {
      kind: "course";
      node: CourseCatalogCourse;
      resources?: never;
      resourceErrorMessage?: never;
    }
  | {
      kind: "lesson";
      node: CourseCatalogLesson;
      resources: CourseLessonResource[];
      resourceErrorMessage?: string | null;
      canManage: boolean;
      canPermanentlyDeleteResources: boolean;
    }
  | {
      kind: "chapter";
      node: CourseCatalogChapter;
      resources?: never;
      resourceErrorMessage?: never;
    };

const NODE_LABELS: Record<CourseCatalogNodeKind, string> = {
  category: "课程分类",
  course: "课程",
  lesson: "课时",
  chapter: "章节",
};

function NodeCover({
  kind,
  node,
}: {
  kind: CourseCatalogNodeKind;
  node:
    | CourseCategory
    | CourseCatalogCourse
    | CourseCatalogLesson
    | CourseCatalogChapter;
}) {
  return (
    <div className="overflow-hidden border border-[var(--border)] bg-[var(--surface-soft)]">
      {node.cover_object_key ? (
        // 复用现有按请求鉴权并生成签名地址的封面接口。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/course-assets/${kind}/${node.id}`}
          alt={node.cover_alt ?? node.title}
          className="aspect-video h-full w-full object-cover"
          style={{ objectPosition: node.cover_focal_point ?? "center" }}
        />
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center gap-2 text-xs text-[var(--foreground-muted)]">
          <ImageOff size={20} strokeWidth={1.6} />
          暂无封面
        </div>
      )}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid border-b border-[var(--border)] md:grid-cols-[150px_minmax(0,1fr)]">
      <div className="bg-[var(--surface-soft)] px-4 py-3 text-xs font-semibold text-[var(--foreground-secondary)]">
        {label}
      </div>
      <div className="whitespace-pre-wrap px-4 py-3 text-xs leading-6 text-[var(--foreground)]">
        {value || "暂未填写"}
      </div>
    </div>
  );
}

export function CourseCatalogNodeView(props: CourseCatalogNodeViewProps) {
  if (props.kind === "lesson") {
    return (
      <CourseLessonView
        lesson={props.node}
        resources={props.resources}
        resourceErrorMessage={props.resourceErrorMessage}
        canManage={props.canManage}
        canPermanentlyDeleteResources={props.canPermanentlyDeleteResources}
      />
    );
  }

  const { kind, node } = props;
  const detailRows =
    kind === "category"
      ? [
          ["简介", node.description ?? ""],
          ["导航图标", node.icon_name ?? ""],
          ["强调色", node.accent_color ?? ""],
        ]
      : kind === "course"
        ? [
            ["简介", node.description ?? ""],
            ["课程等级", node.level ?? ""],
            ["开放方式", node.unlock_mode],
            ["开放时间", node.available_from ?? ""],
          ]
        : [
            ["简介", node.description ?? ""],
            ["预计时长", `${node.duration_minutes} 分钟`],
            ["完成条件", node.completion_rule],
            ["开放方式", node.unlock_mode],
            ["开放时间", node.available_from ?? ""],
            ["章节测试", node.chapter_test_id ? "已关联" : "未关联"],
          ];

  return (
    <div className="space-y-6">
      <section className="grid gap-5 border-y border-[var(--border)] py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <NodeCover kind={kind} node={node} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--foreground-muted)]">
            {NODE_LABELS[kind]}预览
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
            {node.title}
          </h2>
          <p className="mt-1 font-mono text-[11px] text-[var(--foreground-muted)]">
            {node.slug}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
            <div className="bg-[var(--card)] px-3 py-2">
              <dt className="text-[10px] text-[var(--foreground-muted)]">类型</dt>
              <dd className="mt-1 text-xs font-semibold">{NODE_LABELS[kind]}</dd>
            </div>
            <div className="bg-[var(--card)] px-3 py-2">
              <dt className="text-[10px] text-[var(--foreground-muted)]">发布状态</dt>
              <dd className="mt-1 text-xs font-semibold">
                {node.is_published ? "已发布" : "草稿"}
              </dd>
            </div>
            <div className="bg-[var(--card)] px-3 py-2">
              <dt className="text-[10px] text-[var(--foreground-muted)]">排序</dt>
              <dd className="mt-1 font-mono text-xs font-semibold">
                {node.sort_order}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h3 className="text-base font-semibold text-[var(--foreground)]">
            基本信息
          </h3>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            当前步骤只读展示已保存的信息。
          </p>
        </div>
        <div className="border-t border-[var(--border)]">
          {detailRows.map(([label, value]) => (
            <ReadonlyField key={label} label={label} value={value} />
          ))}
        </div>
      </section>
    </div>
  );
}
