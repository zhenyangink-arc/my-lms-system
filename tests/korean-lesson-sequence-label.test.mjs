import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("课时卡片上的课程名和课次不再写死为韩语初级，且预备课不占第几课编号", async () => {
  const workspace = await read(
    "src/app/dashboard/courses/[categorySlug]/KoreanLearningCenter.tsx",
  );
  assert.doesNotMatch(workspace, /韩语初级 · 第 \{lessonIndex \+ 1\} 课/);
  assert.match(workspace, /\{item\.course\.title\} · \{getLessonSequenceLabel\(visibleLessonItems, lessonIndex\)\}/);
  assert.match(workspace, /function isPrepLesson\(lesson: Lesson\)/);
  assert.match(workspace, /lesson\.title\.startsWith\("预备课"\)/);
  assert.match(workspace, /function getLessonSequenceLabel/);
});
