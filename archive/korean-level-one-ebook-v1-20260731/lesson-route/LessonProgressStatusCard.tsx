"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, PlayCircle } from "lucide-react";

type LessonProgressStatus = "not_started" | "in_progress" | "completed";

type LessonProgressStatusCardProps = {
  lessonId: string;
  initialStatus: LessonProgressStatus;
  initialProgress: number;
  autoProgressEnabled: boolean;
};

type LessonProgressEventDetail = {
  lessonId: string;
  status: LessonProgressStatus;
  progressPercent: number;
};

const statusLabelMap: Record<LessonProgressStatus, string> = {
  not_started: "未完成",
  in_progress: "进行中",
  completed: "已完成",
};

export function LessonProgressStatusCard({
  lessonId,
  initialStatus,
  initialProgress,
  autoProgressEnabled,
}: LessonProgressStatusCardProps) {
  const [status, setStatus] = useState<LessonProgressStatus>(initialStatus);
  const [progressPercent, setProgressPercent] = useState(initialProgress);

  useEffect(() => {
    function handleProgressUpdate(event: Event) {
      const customEvent = event as CustomEvent<LessonProgressEventDetail>;

      if (customEvent.detail.lessonId !== lessonId) {
        return;
      }

      setStatus(customEvent.detail.status);
      setProgressPercent(customEvent.detail.progressPercent);
    }

    window.addEventListener("lesson-progress-updated", handleProgressUpdate);

    return () => {
      window.removeEventListener(
        "lesson-progress-updated",
        handleProgressUpdate
      );
    };
  }, [lessonId]);

  const statusClass =
    status === "completed"
      ? "bg-green-50 text-green-700"
      : status === "in_progress"
        ? "bg-blue-50 text-blue-700"
        : "bg-gray-100 text-gray-600";

  const Icon =
    status === "completed"
      ? CheckCircle2
      : status === "in_progress"
        ? PlayCircle
        : Clock3;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-900">学习状态</span>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}
        >
          <Icon size={13} />
          {statusLabelMap[status]}
        </span>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
          <span>学习进度</span>
          <span>{progressPercent}%</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${
              status === "completed" ? "bg-green-500" : "bg-gray-900"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {autoProgressEnabled && (
        <p className="mt-3 text-xs leading-5 text-gray-400">
          视频观看进度达到 90% 后，系统会自动标记为已完成。
        </p>
      )}
    </div>
  );
}