import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("student home refresh is centralized around scoped tags and home routes", async () => {
  const refresh = await source(
    "src/features/student-home-learning/api/refresh.ts",
  );

  assert.match(refresh, /student-home-learning:\$\{tenantId\}:\$\{studentId\}/);
  assert.match(
    refresh,
    /student-app-home:\$\{tenantId\}:\$\{studentId\}:\$\{studentAppId\}/,
  );
  assert.match(refresh, /revalidateTag\(tag, \{ expire: 0 \}\)/);
  assert.match(refresh, /revalidatePath\(getStudentPortalPath\(scope\.space\)\)/);
  assert.match(
    refresh,
    /revalidatePath\(getStudentAppBasePath\(scope\.space, scope\.appSlug\)\)/,
  );
});

test("assignment draft, assignment submission, and chapter exam refresh home", async () => {
  const [draftRoute, assignmentActions, chapterTestActions] = await Promise.all([
    source("src/app/api/assignments/[assignmentId]/draft/route.ts"),
    source("src/app/dashboard/assignments/actions.ts"),
    source("src/app/dashboard/assignments/korean/actions.ts"),
  ]);

  assert.match(draftRoute, /save_learning_assignment_draft[\s\S]*refreshStudentHomeLearning/);
  assert.match(assignmentActions, /submit_learning_assignment[\s\S]*refreshStudentHomeLearning/);
  assert.match(chapterTestActions, /submit_course_test[\s\S]*refreshStudentHomeLearning/);
});

test("course, consolidation, training, and review completions refresh home", async () => {
  const [
    courseActions,
    smartTextbookActions,
    videoPlayer,
    chapterProgress,
    chapterListening,
    toolboxActions,
    reviewActions,
  ] = await Promise.all([
    source("src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/actions.ts"),
    source("src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions.ts"),
    source("src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/LessonVideoPlayer.tsx"),
    source("src/features/chapter-practice/progress-actions.ts"),
    source("src/features/chapter-practice/listening-actions.ts"),
    source("src/app/dashboard/toolbox/actions.ts"),
    source("src/features/student-review-center/actions.ts"),
  ]);

  assert.match(courseActions, /record_ebook_progress[\s\S]*refreshStudentHomeLearning/);
  assert.match(smartTextbookActions, /submitSmartTextbookActivityForContext[\s\S]*refreshStudentHomeLearning/);
  assert.match(videoPlayer, /status === "completed"[\s\S]*refreshCurrentStudentHomeLearningAction/);
  assert.match(chapterProgress, /recordStudentChapterPracticeProgress[\s\S]*refreshStudentHomeLearning/);
  assert.match(chapterListening, /recordStudentChapterPracticeProgress[\s\S]*refreshStudentHomeLearning/);
  assert.match(toolboxActions, /submit_toolbox_practice[\s\S]*refreshStudentHomeLearning/);
  assert.match(reviewActions, /status: "mastered"[\s\S]*refreshStudentHomeLearning/);
});
