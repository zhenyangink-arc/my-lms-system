"use client";

import {
  BookPlus,
  CheckCircle2,
  PencilLine,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRoundX,
  X,
} from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import type {
  StandardQuestion,
  StandardQuestionGroup,
} from "@/lib/question-bank";
import {
  deleteStandardQuestionAction,
  grantQuestionBankAdminAction,
  initialQuestionBankActionState,
  revokeQuestionBankAdminAction,
  saveStandardQuestionAction,
} from "./actions";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";

type PlatformAdmin = {
  id: string;
  name: string;
  loginId: string;
  assigned: boolean;
};

const fieldClass =
  "app-input mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs";

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function ActionMessage({
  state,
}: {
  state: typeof initialQuestionBankActionState;
}) {
  if (!state.message) return null;
  return (
    <p
      aria-live="polite"
      className="rounded-xl px-3 py-2 text-xs font-bold"
      style={{
        color:
          state.status === "error" ? "#c94f45" : "var(--app-success)",
        backgroundColor:
          state.status === "error" ? "#fff0ed" : "var(--app-success-soft)",
      }}
    >
      {state.message}
    </p>
  );
}

function QuestionFields({
  groups,
  question,
  lockedGroup,
}: {
  groups: StandardQuestionGroup[];
  question?: StandardQuestion;
  lockedGroup?: StandardQuestionGroup;
}) {
  const [questionType, setQuestionType] = useState(
    question?.question_type ?? "single_choice"
  );
  const options = stringArray(question?.options);

  return (
    <>
      <input type="hidden" name="question_id" value={question?.id ?? ""} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {lockedGroup ? (
          <div className="text-xs font-black">
            课程章节
            <input type="hidden" name="test_id" value={lockedGroup.id} />
            <div
              className={`${fieldClass} min-h-[42px] leading-5`}
              style={{ backgroundColor: "var(--app-secondary-soft)" }}
            >
              {lockedGroup.curriculum_label ??
                `第 ${lockedGroup.chapter_number} 章 · ${lockedGroup.title}`}
            </div>
          </div>
        ) : (
          <label className="text-xs font-black">
            课程章节
            <select
              name="test_id"
              required
              defaultValue={question?.test_id ?? groups[0]?.id ?? ""}
              className={fieldClass}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.curriculum_label ??
                    `第 ${group.chapter_number} 章 · ${group.title}`}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs font-black">
          题型
          <select
            name="question_type"
            value={questionType}
            onChange={(event) =>
              setQuestionType(
                event.target.value as StandardQuestion["question_type"]
              )
            }
            className={fieldClass}
          >
            <option value="single_choice">单选题</option>
            <option value="short_text">简答题</option>
            <option value="long_text">论述题</option>
            <option value="file_link">文件链接题</option>
          </select>
        </label>
        <label className="text-xs font-black">
          难度
          <select
            name="difficulty"
            defaultValue={question?.difficulty ?? "foundation"}
            className={fieldClass}
          >
            <option value="foundation">基础</option>
            <option value="medium">中等</option>
            <option value="hard">困难</option>
            <option value="expert">极难</option>
          </select>
        </label>
        <label className="text-xs font-black">
          默认分值
          <input
            name="default_points"
            type="number"
            min="0.5"
            max="1000"
            step="0.5"
            required
            defaultValue={question?.default_points ?? 10}
            className={fieldClass}
          />
        </label>
      </div>

      <label className="block text-xs font-black">
        题目
        <textarea
          name="prompt"
          required
          maxLength={3000}
          rows={3}
          defaultValue={question?.prompt ?? ""}
          placeholder="输入标准题目或作答要求"
          className={`${fieldClass} resize-y leading-6`}
        />
      </label>

      {questionType === "single_choice" ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="text-xs font-black">
            选项（每行一个，固定四项 A～D）
            <textarea
              name="options_text"
              required
              rows={5}
              defaultValue={options.join("\n")}
              placeholder={"选项 A\n选项 B\n选项 C\n选项 D"}
              className={`${fieldClass} leading-6`}
            />
          </label>
          <label className="text-xs font-black">
            正确选项序号
            <input
              name="correct_option_number"
              required
              type="number"
              min={1}
              defaultValue={
                question?.correct_option === null ||
                question?.correct_option === undefined
                  ? 1
                  : question.correct_option + 1
              }
              className={fieldClass}
            />
            <span className="app-muted-text mt-2 block text-[11px] leading-5">
              第一项填写 1，第二项填写 2。数据库保存答案位置，租户不能修改。
            </span>
          </label>
        </div>
      ) : (
        <>
          <input type="hidden" name="options_text" value="" />
          <input type="hidden" name="correct_option_number" value="" />
          <label className="block text-xs font-black">
            标准参考答案
            <textarea
              name="correct_answer"
              rows={3}
              defaultValue={question?.correct_answer ?? ""}
              placeholder="可填写批改时使用的标准参考答案"
              className={`${fieldClass} leading-6`}
            />
          </label>
        </>
      )}

      {questionType === "single_choice" && (
        <input type="hidden" name="correct_answer" value="" />
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <label className="text-xs font-black">
          知识点
          <input
            name="skill"
            required
            maxLength={80}
            defaultValue={question?.skill ?? ""}
            placeholder="例如：基础字母拼合"
            className={fieldClass}
          />
        </label>
        <label className="text-xs font-black">
          标签（逗号分隔）
          <input
            name="tags_text"
            defaultValue={stringArray(question?.tags).join("，")}
            placeholder="例如：韩语字母，第一章"
            className={fieldClass}
          />
        </label>
      </div>

      <label className="block text-xs font-black">
        标准解析
        <textarea
          name="explanation"
          maxLength={3000}
          rows={3}
          defaultValue={question?.explanation ?? ""}
          placeholder="填写学生交卷后或批改时使用的知识点解析"
          className={`${fieldClass} leading-6`}
        />
      </label>

      <label className="block max-w-xs text-xs font-black">
        发布状态
        <select
          name="status"
          defaultValue={question?.status ?? "draft"}
          className={fieldClass}
        >
          <option value="draft">草稿（租户不可见）</option>
          <option value="published">已发布（租户可看、可用）</option>
          <option value="archived">已归档（租户不可见）</option>
        </select>
      </label>
    </>
  );
}

export function CreateStandardQuestionForm({
  groups,
  lockedGroup,
}: {
  groups: StandardQuestionGroup[];
  lockedGroup: StandardQuestionGroup;
}) {
  const [state, formAction, pending] = useActionState(
    saveStandardQuestionAction,
    initialQuestionBankActionState
  );

  return (
    <section className="app-card rounded-3xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{
            color: "var(--app-accent)",
            backgroundColor: "var(--app-accent-soft)",
          }}
        >
          <BookPlus size={19} />
        </span>
        <div>
          <DashboardTitleWithHint headingLevel={2} titleClassName="text-lg font-black" title={<>新增标准题目</>} description={<>新题先保存为草稿，确认答案和解析后再发布给机构使用。</>} />
        </div>
      </div>
      <form action={formAction} className="mt-5 space-y-4">
        <QuestionFields groups={groups} lockedGroup={lockedGroup} />
        <ActionMessage state={state} />
        <button
          type="submit"
          disabled={pending || groups.length === 0}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--app-accent)" }}
        >
          <Save size={15} />
          {pending ? "正在保存…" : "保存标准题目"}
        </button>
      </form>
    </section>
  );
}

function DeleteStandardQuestionButton({ questionId }: { questionId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteStandardQuestionAction.bind(null, questionId),
    initialQuestionBankActionState
  );

  return (
    <div>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm("确定删除这道标准题吗？已生成的作业快照不会改变。")) {
            event.preventDefault();
          }
        }}
      >
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50"
          style={{ color: "#c94f45", backgroundColor: "#fff0ed" }}
        >
          <Trash2 size={13} />
          {pending ? "删除中…" : "删除"}
        </button>
      </form>
      <ActionMessage state={state} />
    </div>
  );
}

export function EditStandardQuestionForm({
  groups,
  question,
}: {
  groups: StandardQuestionGroup[];
  question: StandardQuestion;
}) {
  const [state, formAction, pending] = useActionState(
    saveStandardQuestionAction,
    initialQuestionBankActionState
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (state.status === "success") dialogRef.current?.close();
  }, [state.status]);

  return (
    <div
      className="mt-4 flex justify-end border-t pt-3"
      style={{ borderColor: "var(--app-border-soft)" }}
    >
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="app-soft-card inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black"
        style={{ color: "var(--app-accent)" }}
      >
        <PencilLine size={13} />
        编辑标准题目
      </button>

      <dialog
        ref={dialogRef}
        aria-label="编辑标准题目"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="m-auto max-h-[90dvh] w-[min(1100px,calc(100vw-2rem))] overflow-hidden rounded-3xl border p-0 shadow-2xl backdrop:bg-black/45"
        style={{
          color: "var(--app-text)",
          backgroundColor: "var(--app-card-bg)",
          borderColor: "var(--app-border)",
        }}
      >
        <div
          className="flex items-center gap-3 border-b px-5 py-4 sm:px-6"
          style={{ borderColor: "var(--app-border-soft)" }}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              color: "var(--app-accent)",
              backgroundColor: "var(--app-accent-soft)",
            }}
          >
            <PencilLine size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-black">编辑标准题目</h2>
            <p className="app-muted-text mt-0.5 truncate text-xs">
              保存后自动生成新版本，机构已创建的作业快照不会改变。
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="app-soft-card rounded-xl border p-2.5"
            aria-label="关闭编辑对话框"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[calc(90dvh-74px)] overflow-y-auto p-5 sm:p-6">
          <form action={formAction} className="space-y-4">
            <QuestionFields groups={groups} question={question} />
            <ActionMessage state={state} />
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
              style={{ borderColor: "var(--app-border-soft)" }}
            >
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="app-soft-card rounded-xl border px-4 py-2.5 text-xs font-black"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--app-accent)" }}
              >
                <Save size={14} />
                {pending ? "正在更新…" : "保存并生成新版本"}
              </button>
            </div>
          </form>
          <div
            className="mt-5 flex items-center justify-between gap-3 border-t pt-4"
            style={{ borderColor: "var(--app-border-soft)" }}
          >
            <p className="app-muted-text text-xs">
              删除只影响标准题库，不改变已经生成的作业快照。
            </p>
            <DeleteStandardQuestionButton questionId={question.id} />
          </div>
        </div>
      </dialog>
    </div>
  );
}

function RevokeQuestionBankAdminButton({ adminId }: { adminId: string }) {
  const [state, formAction, pending] = useActionState(
    revokeQuestionBankAdminAction.bind(null, adminId),
    initialQuestionBankActionState
  );

  return (
    <div className="text-right">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50"
          style={{ color: "#c94f45", backgroundColor: "#fff0ed" }}
        >
          <UserRoundX size={13} />
          收回权限
        </button>
      </form>
      <ActionMessage state={state} />
    </div>
  );
}

export function QuestionBankAdminManager({
  admins,
}: {
  admins: PlatformAdmin[];
}) {
  const [state, formAction, pending] = useActionState(
    grantQuestionBankAdminAction,
    initialQuestionBankActionState
  );
  const available = admins.filter((admin) => !admin.assigned);
  const assigned = admins.filter((admin) => admin.assigned);

  return (
    <section className="app-card rounded-3xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{
            color: "var(--app-secondary)",
            backgroundColor: "var(--app-secondary-soft)",
          }}
        >
          <ShieldCheck size={19} />
        </span>
        <div>
          <DashboardTitleWithHint headingLevel={2} titleClassName="text-lg font-black" title={<>平台题库管理员</>} description={<>只有平台负责人可以授权。被授权者拥有题库增、删、改权限，不因此获得任何机构数据权限。</>} />
        </div>
      </div>

      <form action={formAction} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <select
          name="admin_id"
          required
          defaultValue=""
          className="app-input min-w-0 flex-1 rounded-xl border px-3 py-3 text-xs"
        >
          <option value="" disabled>
            选择平台副负责人
          </option>
          {available.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.name} · {admin.loginId}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || available.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--app-secondary)" }}
        >
          <UserPlus size={14} />
          授权管理
        </button>
      </form>
      <div className="mt-2">
        <ActionMessage state={state} />
      </div>

      <div className="mt-4 space-y-2">
        {assigned.map((admin) => (
          <div
            key={admin.id}
            className="app-soft-card flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{
                color: "var(--app-success)",
                backgroundColor: "var(--app-success-soft)",
              }}
            >
              <CheckCircle2 size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black">{admin.name}</p>
              <p className="app-muted-text truncate text-xs">{admin.loginId}</p>
            </div>
            <RevokeQuestionBankAdminButton adminId={admin.id} />
          </div>
        ))}
        {assigned.length === 0 && (
          <p className="app-muted-text rounded-xl border border-dashed p-4 text-center text-xs">
            暂未指定其他平台题库管理员。
          </p>
        )}
      </div>
    </section>
  );
}
