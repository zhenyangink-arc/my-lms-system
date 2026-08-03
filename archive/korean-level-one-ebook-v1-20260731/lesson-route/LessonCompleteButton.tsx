"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type LessonProgressStatus = "not_started" | "in_progress" | "completed";

type LessonCompleteButtonProps = {
  courseId: string;
  lessonId: string;
  initialStatus: LessonProgressStatus;
};

function dispatchProgressUpdate(lessonId: string) {
  window.dispatchEvent(
    new CustomEvent("lesson-progress-updated", {
      detail: {
        lessonId,
        status: "completed",
        progressPercent: 100,
      },
    })
  );
}

export function LessonCompleteButton({
  courseId,
  lessonId,
  initialStatus,
}: LessonCompleteButtonProps) {
  const router = useRouter();

  const [status, setStatus] = useState<LessonProgressStatus>(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isCompleted = status === "completed";

  async function handleComplete() {
    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsSubmitting(false);
      setErrorMessage("请先登录后再记录学习进度。");
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase.from("lesson_progress").upsert(
      {
        user_id: user.id,
        course_id: courseId,
        lesson_id: lessonId,
        status: "completed",
        progress_percent: 100,
        started_at: now,
        last_viewed_at: now,
        completed_at: now,
        updated_at: now,
      },
      {
        onConflict: "user_id,lesson_id",
      }
    );

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(`保存失败：${error.message}`);
      return;
    }

    setStatus("completed");
    dispatchProgressUpdate(lessonId);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleComplete}
        disabled={isSubmitting || isCompleted}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
          isCompleted
            ? "bg-green-50 text-green-700"
            : "bg-gray-900 text-white hover:bg-gray-800"
        } disabled:cursor-not-allowed`}
      >
        <CheckCircle2 size={16} />
        {isSubmitting
          ? "保存中..."
          : isCompleted
            ? "已完成"
            : "标记为已完成"}
      </button>

      {errorMessage && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}