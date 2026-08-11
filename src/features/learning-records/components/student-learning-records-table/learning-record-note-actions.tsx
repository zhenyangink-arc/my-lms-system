"use client";

import { useActionState, useEffect } from "react";
import { Archive, ArchiveRestore, Save } from "lucide-react";

import { initialLearningRecordActionState } from "@/app/dashboard/records/action-state";
import {
  changeLearningRecordNoteStatusAction,
  createLearningRecordNoteAction,
  updateLearningRecordNoteAction,
} from "@/app/dashboard/records/actions";
import {
  LEARNING_RECORD_TYPE_LABELS,
  LEARNING_RECORD_VISIBILITY_LABELS,
} from "@/app/dashboard/records/config";
import type { LearningRecordNote } from "../../api/types";

function localDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const inputClass =
  "h-9 w-full border border-[var(--app-border)] bg-[var(--app-card-bg)] px-3 text-xs outline-none focus:border-[var(--app-secondary)]";

export function LearningRecordNoteEditor({
  studentId,
  studentName,
  note,
  onDone,
  onCancel,
}: {
  studentId: string;
  studentName: string;
  note?: LearningRecordNote;
  onDone: () => void;
  onCancel: () => void;
}) {
  const action = note
    ? updateLearningRecordNoteAction.bind(null, note.id)
    : createLearningRecordNoteAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialLearningRecordActionState,
  );

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [onDone, state.status]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="student_id" value={studentId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-medium">
          <span>学生</span>
          <span className="flex h-9 items-center border border-[var(--app-border)] bg-[var(--app-soft-bg)] px-3 text-[var(--app-muted)]">
            {studentName}
          </span>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          <span>备注类型</span>
          <select
            name="record_type"
            defaultValue={note?.record_type ?? "coaching"}
            className={inputClass}
          >
            {Object.entries(LEARNING_RECORD_TYPE_LABELS).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          <span>可见范围</span>
          <select
            name="visibility"
            defaultValue={note?.visibility ?? "student_visible"}
            className={inputClass}
          >
            {Object.entries(LEARNING_RECORD_VISIBILITY_LABELS).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          <span>备注时间</span>
          <input
            type="datetime-local"
            name="occurred_at"
            required
            defaultValue={localDate(note?.occurred_at)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="block space-y-1.5 text-xs font-medium">
        <span>标题</span>
        <input
          name="title"
          required
          minLength={2}
          maxLength={120}
          defaultValue={note?.title}
          placeholder="填写本次人工辅导备注主题"
          className={inputClass}
        />
      </label>

      <label className="block space-y-1.5 text-xs font-medium">
        <span>备注内容</span>
        <textarea
          name="content"
          required
          minLength={2}
          maxLength={5000}
          rows={5}
          defaultValue={note?.content}
          placeholder="记录学生当前表现、辅导过程或阶段评价"
          className={`${inputClass} h-auto resize-y py-2 leading-5`}
        />
      </label>

      <label className="block space-y-1.5 text-xs font-medium">
        <span>下一步建议</span>
        <textarea
          name="next_action"
          maxLength={2000}
          rows={3}
          defaultValue={note?.next_action}
          placeholder="可选：填写后续学习安排或关注事项"
          className={`${inputClass} h-auto resize-y py-2 leading-5`}
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] pt-4">
        <p
          className={`text-xs ${
            state.status === "error"
              ? "text-red-600"
              : "text-[var(--app-muted)]"
          }`}
          role={state.status === "error" ? "alert" : undefined}
        >
          {state.message ||
            "学生可见备注会同步到学生端；内部备注仅供机构工作人员查看。"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-9 border border-[var(--app-border)] px-4 text-xs font-semibold disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 bg-[var(--app-secondary)] px-4 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Save size={14} />
            {pending ? "正在保存…" : note ? "保存修改" : "新增人工辅导备注"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function LearningRecordNoteStatusAction({
  note,
}: {
  note: LearningRecordNote;
}) {
  const nextStatus = note.status === "active" ? "archived" : "active";
  const action = changeLearningRecordNoteStatusAction.bind(
    null,
    note.id,
    nextStatus,
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialLearningRecordActionState,
  );
  const Icon = nextStatus === "archived" ? Archive : ArchiveRestore;

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      {state.message && (
        <span
          className={
            state.status === "error"
              ? "text-[10px] text-red-600"
              : "text-[10px] text-emerald-700"
          }
          role={state.status === "error" ? "alert" : undefined}
        >
          {state.message}
        </span>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-8 items-center gap-1.5 border border-[var(--app-border)] px-2.5 text-xs font-semibold transition-colors hover:bg-[var(--app-soft-bg)] disabled:opacity-50"
      >
        <Icon size={13} />
        {pending ? "处理中…" : nextStatus === "archived" ? "归档" : "恢复"}
      </button>
    </form>
  );
}
