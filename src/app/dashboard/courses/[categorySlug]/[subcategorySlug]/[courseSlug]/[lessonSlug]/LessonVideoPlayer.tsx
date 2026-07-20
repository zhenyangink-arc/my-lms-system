"use client";

import { useRef } from "react";
import type { SyntheticEvent } from "react";
import { Maximize2, Video } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type LessonProgressStatus = "not_started" | "in_progress" | "completed";

type LessonVideoPlayerProps = {
  courseId: string;
  lessonId: string;
  videoUrl: string | null;
  videoProvider: string | null;
  initialStatus: LessonProgressStatus;
  initialProgress: number;
  trackingDisabled?: boolean;
};

const COMPLETE_THRESHOLD = 90;

function dispatchProgressUpdate(
  lessonId: string,
  status: LessonProgressStatus,
  progressPercent: number
) {
  window.dispatchEvent(
    new CustomEvent("lesson-progress-updated", {
      detail: {
        lessonId,
        status,
        progressPercent,
      },
    })
  );
}

export function LessonVideoPlayer({
  courseId,
  lessonId,
  videoUrl,
  videoProvider,
  initialStatus,
  initialProgress,
  trackingDisabled = false,
}: LessonVideoPlayerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const statusRef = useRef<LessonProgressStatus>(initialStatus);
  const completedRef = useRef(initialStatus === "completed");
  const lastSavedPercentRef = useRef(initialProgress);
  const lastSavedAtRef = useRef(0);
  const isSavingRef = useRef(false);

  /**
   * upload 和 r2 都使用 HTML <video>
   * 这样才能监听 onTimeUpdate，并在观看到 90% 时自动完成
   */
  const isHtmlVideo = Boolean(
    videoUrl && (videoProvider === "upload" || videoProvider === "r2")
  );

  async function saveProgress(
    status: LessonProgressStatus,
    progressPercent: number
  ) {
    if (trackingDisabled) return;
    if (completedRef.current && status !== "completed") {
      return;
    }

    if (status !== "completed" && isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      isSavingRef.current = false;
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase.from("lesson_progress").upsert(
      {
        user_id: user.id,
        course_id: courseId,
        lesson_id: lessonId,
        status,
        progress_percent: progressPercent,
        started_at: now,
        last_viewed_at: now,
        completed_at: status === "completed" ? now : null,
        updated_at: now,
      },
      {
        onConflict: "user_id,lesson_id",
      }
    );

    isSavingRef.current = false;

    if (error) {
      return;
    }

    statusRef.current = status;
    lastSavedPercentRef.current = progressPercent;
    lastSavedAtRef.current = Date.now();

    if (status === "completed") {
      completedRef.current = true;
    }

    dispatchProgressUpdate(lessonId, status, progressPercent);
  }

  function handleVideoPlay() {
    if (trackingDisabled) return;
    if (completedRef.current) {
      return;
    }

    const nextProgress = Math.max(initialProgress, 1);

    dispatchProgressUpdate(lessonId, "in_progress", nextProgress);
    void saveProgress("in_progress", nextProgress);
  }

  function handleVideoTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    if (trackingDisabled) return;
    if (completedRef.current) {
      return;
    }

    const video = event.currentTarget;

    if (!video.duration || Number.isNaN(video.duration)) {
      return;
    }

    const currentProgress = Math.min(
      100,
      Math.floor((video.currentTime / video.duration) * 100)
    );

    if (currentProgress >= COMPLETE_THRESHOLD) {
      dispatchProgressUpdate(lessonId, "completed", 100);
      void saveProgress("completed", 100);
      return;
    }

    dispatchProgressUpdate(lessonId, "in_progress", currentProgress);

    const now = Date.now();

    const shouldSave =
      currentProgress >= lastSavedPercentRef.current + 10 &&
      now - lastSavedAtRef.current > 10000;

    if (shouldSave) {
      void saveProgress("in_progress", currentProgress);
    }
  }

  function handleVideoEnded() {
    if (trackingDisabled) return;
    dispatchProgressUpdate(lessonId, "completed", 100);
    void saveProgress("completed", 100);
  }

  async function handleFullscreen() {
    if (!wrapperRef.current) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await wrapperRef.current.requestFullscreen();
    } catch {
      // 某些浏览器可能阻止全屏，这里不影响正常播放
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Video size={18} className="text-gray-700" />
            <h3 className="font-bold text-gray-900">视频内容</h3>
          </div>

          {videoUrl && (
            <button
              type="button"
              onClick={handleFullscreen}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-200"
            >
              <Maximize2 size={13} />
              放大观看
            </button>
          )}
        </div>
      </div>

      {videoUrl ? (
        <div ref={wrapperRef} className="aspect-video bg-black">
          {isHtmlVideo ? (
            <video
              src={videoUrl}
              controls
              className="h-full w-full"
              onPlay={handleVideoPlay}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
            />
          ) : (
            <iframe
              src={videoUrl}
              className="h-full w-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            />
          )}
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center bg-gray-50 px-6">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm">
              <Video size={28} />
            </div>

            <p className="mt-4 font-semibold text-gray-900">视频暂未上传</p>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              当前课时已经预留视频区域。后续在 Supabase 的 lessons
              表中填写 video_url 或 video_object_key 后，这里会自动显示视频。
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
