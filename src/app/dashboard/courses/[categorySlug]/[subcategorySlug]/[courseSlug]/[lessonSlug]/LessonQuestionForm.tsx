"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * 提问目标类型
 * teacher：提交给老师
 * ai：提交给 AI 助教
 * both：AI 优先，必要时转老师
 */
type QuestionTarget = "teacher" | "ai" | "both";

type LessonQuestionFormProps = {
  courseId: string;
  lessonId: string;
  teacherName: string | null;
  defaultTarget: QuestionTarget;
  aiSupportEnabled: boolean;
};

const targetLabelMap: Record<QuestionTarget, string> = {
  teacher: "提交给老师",
  ai: "向 AI 助教提问",
  both: "AI 先回答，必要时转老师",
};

export function LessonQuestionForm({
  courseId,
  lessonId,
  teacherName,
  defaultTarget,
  aiSupportEnabled,
}: LessonQuestionFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<QuestionTarget>(defaultTarget);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setResultMessage(null);
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage("请输入问题标题。");
      return;
    }

    if (!message.trim()) {
      setErrorMessage("请输入问题内容。");
      return;
    }

    setIsSubmitting(true);

    const supabase = createClient();

    /**
     * 先获取当前登录用户
     * lesson_questions 表的 student_id 必须是当前用户 id
     */
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsSubmitting(false);
      setErrorMessage("请先登录后再提交问题。");
      return;
    }

    /**
     * 第一版：
     * 先把问题保存到 lesson_questions 表。
     * AI 真正自动回答功能以后再接入。
     */
    const { error } = await supabase.from("lesson_questions").insert({
      student_id: user.id,
      course_id: courseId,
      lesson_id: lessonId,
      question_target: target,
      title: title.trim(),
      message: message.trim(),
      status: "pending",
      teacher_name: teacherName,
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(`提交失败：${error.message}`);
      return;
    }

    setTitle("");
    setMessage("");

    if (target === "teacher") {
      setResultMessage("问题已提交给老师。");
    } else if (target === "ai") {
      setResultMessage("问题已提交到 AI 助教队列。AI 自动回答功能后续接入。");
    } else {
      setResultMessage("问题已提交。AI 助教优先处理，必要时可转老师。");
    }

    /**
     * 刷新服务端页面
     * 这样下面的“我的提问记录”会马上更新
     */
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 提问目标 */}
      <div>
        <label className="text-sm font-semibold text-gray-900">
          提问方式
        </label>

        <select
          value={target}
          onChange={(event) => setTarget(event.target.value as QuestionTarget)}
          className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900"
        >
          <option value="teacher">{targetLabelMap.teacher}</option>

          {aiSupportEnabled && (
            <option value="ai">{targetLabelMap.ai}</option>
          )}

          {aiSupportEnabled && (
            <option value="both">{targetLabelMap.both}</option>
          )}
        </select>
      </div>

      {/* 问题标题 */}
      <div>
        <label className="text-sm font-semibold text-gray-900">
          问题标题
        </label>

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例如：这个申请条件怎么判断？"
          className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900"
        />
      </div>

      {/* 问题内容 */}
      <div>
        <label className="text-sm font-semibold text-gray-900">
          问题内容
        </label>

        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="请描述你不理解的地方，老师或 AI 助教会根据本课内容帮助你。"
          rows={5}
          className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-gray-900"
        />
      </div>

      {errorMessage && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      {resultMessage && (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-600">
          {resultMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "提交中..." : "提交问题"}
      </button>
    </form>
  );
}