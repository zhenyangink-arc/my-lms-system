"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Eye,
  LoaderCircle,
  Monitor,
  PencilLine,
  RotateCcw,
  Save,
  Send,
  Smartphone,
  Upload,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { cn } from "@/lib/utils";
import {
  CHAPTER_PRACTICE_BLOCK_LABELS,
} from "../api/model";
import type {
  ChapterPracticeBlock,
  ChapterPracticePublishInspection,
  ChapterPracticeUnitDetail,
  ChapterPracticeUnitStatus,
} from "../api/types";
import {
  INITIAL_CHAPTER_PRACTICE_ACTION_STATE,
  createNextChapterPracticeVersionAction,
  moveChapterPracticeBlockAction,
  publishChapterPracticeAction,
  returnChapterPracticeToDraftAction,
  saveChapterPracticeBlockAction,
  saveChapterPracticeUnitAction,
  submitChapterPracticeForReviewAction,
  type ChapterPracticeActionState,
} from "../actions";

const statusLabels: Record<ChapterPracticeUnitStatus, string> = {
  not_generated: "未生成",
  draft: "草稿",
  pending_review: "待检查",
  published: "已发布",
  needs_update: "需更新",
  disabled: "已停用",
};

const fieldClass =
  "min-h-11 w-full rounded-lg border bg-[var(--background)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]";

function ActionFeedback({ state }: { state: ChapterPracticeActionState }) {
  if (!state.message) return null;
  const Icon = state.ok ? CheckCircle2 : CircleAlert;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs leading-5"
      style={{
        color: state.ok ? "var(--status-success)" : "var(--status-danger)",
        backgroundColor: state.ok
          ? "var(--status-success-surface)"
          : "var(--status-danger-surface)",
        borderColor: state.ok ? "var(--status-success)" : "var(--status-danger)",
      }}
      role={state.ok ? "status" : "alert"}
      aria-live="polite"
    >
      <p className="flex items-start gap-1.5 font-semibold">
        <Icon className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
        {state.message}
      </p>
      {state.reasons.length ? (
        <ul className="mt-1 list-disc pl-5">
          {state.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SubmitButton({
  label,
  icon: Icon = Save,
  tone = "primary",
}: {
  label: string;
  icon?: typeof Save;
  tone?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-50",
        tone === "primary"
          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "border bg-[var(--card)] text-[var(--foreground)]",
      )}
    >
      {pending ? (
        <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />
      ) : (
        <Icon size={15} aria-hidden="true" />
      )}
      {pending ? "正在处理" : label}
    </button>
  );
}

function HiddenContext({
  unit,
  space,
}: {
  unit: ChapterPracticeUnitDetail;
  space: string;
}) {
  return (
    <>
      <input type="hidden" name="space" value={space} />
      <input type="hidden" name="appSlug" value="korean" />
      <input type="hidden" name="courseChapterId" value={unit.courseChapterId} />
      <input type="hidden" name="unitId" value={unit.id} />
    </>
  );
}

function UnitSettings({
  unit,
  space,
}: {
  unit: ChapterPracticeUnitDetail;
  space: string;
}) {
  const [state, action] = useActionState(
    saveChapterPracticeUnitAction,
    INITIAL_CHAPTER_PRACTICE_ACTION_STATE,
  );
  return (
    <form action={action} className="space-y-4 rounded-lg border bg-[var(--card)] p-4">
      <HiddenContext unit={unit} space={space} />
      <CardTitleWithHint
        title="巩固包设置"
        description="标题会直接显示给学习者；完成规则只统计已启用且标记为必做的内容块。"
        headingLevel={2}
        titleClassName="text-sm font-semibold"
      />
      <div className="grid gap-4 lg:grid-cols-4">
        <label className="grid gap-1.5 text-xs font-medium">
          标题
          <input className={fieldClass} name="title" defaultValue={unit.title} required maxLength={200} />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          至少完成必做块数
          <input
            className={fieldClass}
            name="minimumRequiredBlocks"
            type="number"
            min={1}
            max={unit.blocks.filter((block) => block.status !== "disabled" && block.isRequired).length || 1}
            defaultValue={unit.completionRule.minimumRequiredBlocks}
            required
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          练习正确率达标线
          <input
            className={fieldClass}
            name="minimumAccuracyPercent"
            type="number"
            min={0}
            max={100}
            defaultValue={unit.completionRule.minimumAccuracyPercent}
            required
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          必须完成自我检测
          <select className={fieldClass} name="requireSelfCheck" defaultValue={String(unit.completionRule.requireSelfCheck)}>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </label>
      </div>
      <ActionFeedback state={state} />
      <SubmitButton label="保存设置" />
    </form>
  );
}

function MoveButton({
  unit,
  block,
  space,
  direction,
  disabled,
}: {
  unit: ChapterPracticeUnitDetail;
  block: ChapterPracticeBlock;
  space: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  return (
    <form action={moveChapterPracticeBlockAction}>
      <HiddenContext unit={unit} space={space} />
      <input type="hidden" name="blockId" value={block.id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={`${direction === "up" ? "上移" : "下移"}${block.title}`}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border hover:bg-[var(--muted)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Icon size={16} aria-hidden="true" />
      </button>
    </form>
  );
}

function BlockEditor({
  unit,
  block,
  index,
  blockCount,
  space,
}: {
  unit: ChapterPracticeUnitDetail;
  block: ChapterPracticeBlock;
  index: number;
  blockCount: number;
  space: string;
}) {
  const [state, action] = useActionState(
    saveChapterPracticeBlockAction,
    INITIAL_CHAPTER_PRACTICE_ACTION_STATE,
  );
  return (
    <article className="rounded-lg border bg-[var(--card)] p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{CHAPTER_PRACTICE_BLOCK_LABELS[block.blockType]}</p>
          <p className="mt-1 text-[11px] text-[var(--foreground-muted)]">
            顺序 {index + 1} · 来源 {block.sourceType ?? "未关联"}
          </p>
        </div>
        <div className="flex gap-2">
          <MoveButton unit={unit} block={block} space={space} direction="up" disabled={index === 0} />
          <MoveButton unit={unit} block={block} space={space} direction="down" disabled={index === blockCount - 1} />
        </div>
      </div>
      {block.missingReasons.length ? (
        <div className="mb-4 rounded-lg border px-3 py-2 text-xs leading-5 text-[var(--status-danger)]" style={{ backgroundColor: "var(--status-danger-surface)", borderColor: "var(--status-danger)" }} role="alert">
          <p className="flex items-start gap-1.5 font-semibold">
            <CircleAlert className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
            数据缺失
          </p>
          {block.missingReasons.map((reason) => <p key={reason} className="mt-1">{reason}</p>)}
        </div>
      ) : null}
      <form action={action} className="space-y-4">
        <HiddenContext unit={unit} space={space} />
        <input type="hidden" name="blockId" value={block.id} />
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-medium">
            标题
            <input className={fieldClass} name="title" defaultValue={block.title} required maxLength={200} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium">
            学习者是否可见
            <select className={fieldClass} name="enabled" defaultValue={String(block.status !== "disabled")}>
              <option value="true">启用</option>
              <option value="false">停用</option>
            </select>
          </label>
        </div>
        <label className="grid gap-1.5 text-xs font-medium">
          操作说明
          <textarea className={`${fieldClass} min-h-24 resize-y py-3 leading-6`} name="instructions" defaultValue={block.instructions} maxLength={4000} />
        </label>
        <label className="grid max-w-xs gap-1.5 text-xs font-medium">
          完成规则
          <select className={fieldClass} name="isRequired" defaultValue={String(block.isRequired)}>
            <option value="true">必做</option>
            <option value="false">选做</option>
          </select>
        </label>
        <ActionFeedback state={state} />
        <SubmitButton label="保存内容块" />
      </form>
    </article>
  );
}

function stringsFromPayload(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const payload = value as Record<string, unknown>;
  return Object.values(payload).flatMap((item) =>
    typeof item === "string" && item.trim() ? [item.trim()] : [],
  );
}

function PreviewContent({ block }: { block: ChapterPracticeBlock }) {
  const payload = block.contentPayload;
  const questions = Array.isArray(payload.questions)
    ? (payload.questions as Array<Record<string, unknown>>)
    : [];
  const nodes = Array.isArray(payload.nodes)
    ? (payload.nodes as Array<Record<string, unknown>>)
    : [];
  const texts = stringsFromPayload(payload).slice(0, 3);
  return (
    <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--foreground-secondary)]">
      {texts.map((text) => (
        <p key={text} className="whitespace-pre-line">{text}</p>
      ))}
      {nodes.length ? (
        <ul className="grid gap-2">
          {nodes.slice(0, 4).map((node, index) => (
            <li key={String(node.id ?? index)} className="rounded-lg bg-[var(--muted)] px-3 py-2">
              {String(node.title || `学习内容 ${index + 1}`)}
            </li>
          ))}
        </ul>
      ) : null}
      {questions.length ? (
        <ol className="grid list-decimal gap-2 pl-5">
          {questions.slice(0, 3).map((question, index) => (
            <li key={String(question.id ?? index)}>{String(question.prompt || "练习题")}</li>
          ))}
        </ol>
      ) : null}
      {!texts.length && !nodes.length && !questions.length ? (
        <p className="text-[var(--foreground-muted)]">内容将从已关联来源载入。</p>
      ) : null}
    </div>
  );
}

function PracticePreview({ unit }: { unit: ChapterPracticeUnitDetail }) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const enabledBlocks = unit.blocks.filter((block) => block.status !== "disabled");
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-[var(--card)] p-3">
        <p className="text-xs font-semibold">选择预览宽度</p>
        <div className="flex gap-2" role="group" aria-label="选择预览宽度">
          {[
            ["desktop", "桌面", Monitor],
            ["mobile", "手机", Smartphone],
          ].map(([value, label, Icon]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setViewport(value as "desktop" | "mobile")}
              aria-pressed={viewport === value}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2",
                viewport === value && "bg-[var(--primary)] text-[var(--primary-foreground)]",
              )}
            >
              <Icon size={15} aria-hidden="true" />
              {String(label)}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-[var(--muted)] p-3 sm:p-6">
        <div
          className={cn(
            "mx-auto space-y-4 rounded-2xl border bg-[var(--background)] p-4 shadow-sm transition-[max-width] sm:p-6",
            viewport === "mobile" ? "max-w-[390px]" : "max-w-5xl",
          )}
        >
          <header className="border-b pb-5">
            <p className="text-xs text-[var(--foreground-muted)]">{unit.courseTitle}　›　{unit.lessonTitle}</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight">{unit.title}</h2>
          </header>
          {enabledBlocks.map((block) => (
            <article key={block.id} className="rounded-xl border bg-[var(--card)] p-4 sm:p-5">
              <CardTitleWithHint
                title={block.title}
                description={block.instructions}
                headingLevel={3}
                titleClassName="text-base font-semibold"
                hintLabel={`查看${block.title}说明`}
              />
              <PreviewContent block={block} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function InspectionPanel({ inspection }: { inspection: ChapterPracticePublishInspection }) {
  return (
    <section className="rounded-lg border bg-[var(--card)] p-4">
      <CardTitleWithHint
        title="发布前检查"
        description="提交检查和正式发布时都会重新读取权威来源，不使用页面加载时的旧结果。"
        headingLevel={2}
        titleClassName="text-sm font-semibold"
      />
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {inspection.checks.map((item) => {
          const Icon = item.passed ? CheckCircle2 : CircleAlert;
          return (
            <li key={item.code} className="rounded-lg border px-3 py-2 text-xs">
              <p className="flex items-start gap-1.5 font-semibold" style={{ color: item.passed ? "var(--status-success)" : "var(--status-danger)" }}>
                <Icon className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
                {item.label}：{item.passed ? "通过" : "未通过"}
              </p>
              {item.reasons.map((reason) => <p key={reason} className="mt-1 leading-5 text-[var(--foreground-muted)]">{reason}</p>)}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TransitionForm({
  unit,
  space,
  action,
  label,
  icon,
  tone,
}: {
  unit: ChapterPracticeUnitDetail;
  space: string;
  action: (state: ChapterPracticeActionState, formData: FormData) => Promise<ChapterPracticeActionState>;
  label: string;
  icon: typeof Save;
  tone?: "primary" | "secondary";
}) {
  const [state, formAction] = useActionState(action, INITIAL_CHAPTER_PRACTICE_ACTION_STATE);
  return (
    <div className="grid gap-2">
      <form action={formAction}>
        <HiddenContext unit={unit} space={space} />
        <SubmitButton label={label} icon={icon} tone={tone} />
      </form>
      <ActionFeedback state={state} />
    </div>
  );
}

function NewVersionForm({ unit, space }: { unit: ChapterPracticeUnitDetail; space: string }) {
  const router = useRouter();
  const [state, action] = useActionState(createNextChapterPracticeVersionAction, INITIAL_CHAPTER_PRACTICE_ACTION_STATE);
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.completedAt, state.ok]);
  return (
    <div className="grid gap-2">
      <form action={action}>
        <HiddenContext unit={unit} space={space} />
        <SubmitButton label="创建新版本" icon={WandSparkles} />
      </form>
      <ActionFeedback state={state} />
    </div>
  );
}

export function ChapterPracticeEditor({
  unit,
  inspection,
  space,
}: {
  unit: ChapterPracticeUnitDetail;
  inspection: ChapterPracticePublishInspection;
  space: string;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const editable = unit.status === "draft";
  const basePath = `/${space}/dashboard/admin/apps/korean/practice-center`;
  const StatusIcon = unit.status === "published" ? CheckCircle2 : unit.status === "pending_review" ? CircleDashed : PencilLine;
  return (
    <div className="space-y-5">
      <Link href={basePath} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-[var(--foreground-secondary)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2">
        <ArrowLeft size={16} aria-hidden="true" />
        返回覆盖矩阵
      </Link>
      <header className="rounded-lg border bg-[var(--card)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--foreground-muted)]">{unit.courseTitle}　›　{unit.lessonTitle}　›　{unit.chapterTitle}</p>
            <h1 className="mt-2 text-xl font-bold tracking-tight">{unit.title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground-secondary)]">
              <StatusIcon size={14} aria-hidden="true" />
              v{unit.version} · {statusLabels[unit.status]}
            </p>
          </div>
          <div className="flex gap-2" role="group" aria-label="编辑与预览">
            <button type="button" onClick={() => setMode("edit")} aria-pressed={mode === "edit"} className={cn("inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2", mode === "edit" && "bg-[var(--primary)] text-[var(--primary-foreground)]")}>
              <PencilLine size={15} aria-hidden="true" />编辑
            </button>
            <button type="button" onClick={() => setMode("preview")} aria-pressed={mode === "preview"} className={cn("inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2", mode === "preview" && "bg-[var(--primary)] text-[var(--primary-foreground)]")}>
              <Eye size={15} aria-hidden="true" />预览
            </button>
          </div>
        </div>
      </header>

      {mode === "preview" ? (
        <PracticePreview unit={unit} />
      ) : editable ? (
        <div className="space-y-4">
          <UnitSettings unit={unit} space={space} />
          <section className="space-y-3" aria-label="内容块编辑">
            <div className="px-1">
              <CardTitleWithHint title="内容块" description="使用上移、下移按钮调整顺序；停用的内容块不会出现在预览和学生端。" headingLevel={2} titleClassName="text-sm font-semibold" />
            </div>
            {unit.blocks.map((block, index) => (
              <BlockEditor key={block.id} unit={unit} block={block} index={index} blockCount={unit.blocks.length} space={space} />
            ))}
          </section>
        </div>
      ) : (
        <section className="rounded-lg border bg-[var(--muted)] p-5 text-sm leading-6 text-[var(--foreground-secondary)]">
          当前版本为{statusLabels[unit.status]}状态，内容只读。{unit.status === "published" ? "如需修改，请创建新版本。" : "退回草稿后可继续编辑。"}
        </section>
      )}

      <InspectionPanel inspection={inspection} />
      <section className="flex flex-wrap items-start gap-3 rounded-lg border bg-[var(--card)] p-4" aria-label="版本操作">
        {unit.status === "draft" ? (
          <TransitionForm unit={unit} space={space} action={submitChapterPracticeForReviewAction} label="检查并提交" icon={Send} />
        ) : null}
        {unit.status === "pending_review" ? (
          <>
            <TransitionForm unit={unit} space={space} action={returnChapterPracticeToDraftAction} label="退回草稿" icon={RotateCcw} tone="secondary" />
            <TransitionForm unit={unit} space={space} action={publishChapterPracticeAction} label="发布新版本" icon={Upload} />
          </>
        ) : null}
        {["published", "needs_update", "disabled"].includes(unit.status) ? (
          <NewVersionForm unit={unit} space={space} />
        ) : null}
      </section>
    </div>
  );
}
