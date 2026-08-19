"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, LoaderCircle, WandSparkles } from "lucide-react";

import {
  INITIAL_CHAPTER_PRACTICE_ACTION_STATE,
  generateChapterPracticeAction,
} from "../actions";

export function ChapterPracticeGenerateButton({
  space,
  appSlug,
  courseChapterId,
}: {
  space: string;
  appSlug: "korean";
  courseChapterId: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    generateChapterPracticeAction,
    INITIAL_CHAPTER_PRACTICE_ACTION_STATE,
  );

  useEffect(() => {
    if (state.ok && state.unitId) {
      router.push(
        `/${space}/dashboard/admin/apps/${appSlug}/practice-center/${courseChapterId}`,
      );
    }
  }, [appSlug, courseChapterId, router, space, state.ok, state.unitId]);

  return (
    <div className="grid gap-1.5">
      <form action={action}>
        <input type="hidden" name="space" value={space} />
        <input type="hidden" name="appSlug" value={appSlug} />
        <input type="hidden" name="courseChapterId" value={courseChapterId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-50"
        >
          {pending ? (
            <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />
          ) : (
            <WandSparkles size={15} aria-hidden="true" />
          )}
          {pending ? "正在生成" : "生成草稿"}
        </button>
      </form>
      {!state.ok && state.message ? (
        <p className="flex max-w-48 items-start gap-1 text-[11px] leading-4 text-[var(--status-danger)]" role="alert">
          <CircleAlert className="mt-0.5 shrink-0" size={12} aria-hidden="true" />
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
