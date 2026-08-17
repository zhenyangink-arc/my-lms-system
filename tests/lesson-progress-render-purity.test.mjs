import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const lessonDirectory = new URL(
  "../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/",
  import.meta.url
);

test("lesson render stays read-only and activity writes require a client event", async () => {
  const [pageSource, boundarySource, actionSource] = await Promise.all([
    readFile(new URL("page-content.tsx", lessonDirectory), "utf8"),
    readFile(new URL("LessonActivityBoundary.tsx", lessonDirectory), "utf8"),
    readFile(new URL("actions.ts", lessonDirectory), "utf8"),
  ]);

  assert.doesNotMatch(
    pageSource,
    /from\(["']lesson_progress["']\)[\s\S]{0,80}\.upsert/,
    "Server Component render path must not write lesson_progress"
  );
  assert.doesNotMatch(
    boundarySource,
    /useEffect/,
    "mounting or prefetching the Client Component must not dispatch activity"
  );
  assert.match(boundarySource, /onPointerDownCapture=\{handlePointerDown\}/);
  assert.match(boundarySource, /onKeyDownCapture=\{handleKeyDown\}/);
  assert.match(boundarySource, /onWheelCapture=\{handleWheel\}/);
  assert.match(
    boundarySource,
    /function recordActivity\(\)[\s\S]*recordLessonActivityAction\(lessonId\)/,
    "the Server Action must only be dispatched from the interaction handler"
  );

  assert.match(actionSource, /^"use server";/);
  assert.match(actionSource, /await requireActiveUser\(\)/);
  assert.match(actionSource, /\.eq\("user_id", user\.id\)/);
  assert.match(actionSource, /user_id: user\.id/);
  assert.match(actionSource, /course_id: lessonData\.course_id/);
  assert.match(actionSource, /onConflict: "user_id,lesson_id"/);
  assert.doesNotMatch(
    actionSource,
    /recordLessonActivityAction\([\s\S]{0,120}userId/,
    "the activity action must never accept a client-selected user id"
  );
});
