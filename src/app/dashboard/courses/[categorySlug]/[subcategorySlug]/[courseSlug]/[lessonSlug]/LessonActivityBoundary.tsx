"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

import { recordLessonActivityAction } from "./actions";

export function LessonActivityBoundary({
  lessonId,
  children,
}: {
  lessonId: string;
  children: ReactNode;
}) {
  const isRecordingRef = useRef(false);
  const isRecordedRef = useRef(false);

  function recordActivity() {
    if (isRecordingRef.current || isRecordedRef.current) return;
    isRecordingRef.current = true;

    void recordLessonActivityAction(lessonId)
      .then((result) => {
        if (result.status === "error") return;
        isRecordedRef.current = true;
      })
      .finally(() => {
        isRecordingRef.current = false;
      });
  }

  function handlePointerDown() {
    recordActivity();
  }

  function handleKeyDown() {
    recordActivity();
  }

  function handleWheel() {
    recordActivity();
  }

  return (
    <div
      className="contents"
      onPointerDownCapture={handlePointerDown}
      onKeyDownCapture={handleKeyDown}
      onWheelCapture={handleWheel}
    >
      {children}
    </div>
  );
}
