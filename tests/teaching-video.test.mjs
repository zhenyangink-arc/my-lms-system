import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { isTeacherVideoKey, normalizeTeachingVideo, teacherVideoForTurn, teachingVideoIssues, teachingScriptSegments, activeTeacherVideoBindings } from "../src/lib/teaching-video.ts";

test("video classroom uses an inline answer region and keeps legacy modal behavior", async () => {
  const source = await readFile(new URL('../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('role={tutorUsesVideo ? "region" : "dialog"}'));
  assert.ok(source.includes('aria-modal={tutorUsesVideo ? undefined : true}'));
  assert.ok(source.includes('if (tutorUsesVideo || event.key !== "Tab") return;'));
  assert.ok(source.includes('button[data-student-answer-option]:not(:disabled)'));
  assert.ok(source.includes('tutorContinueReady && !tutorUsesVideo'));
  assert.ok(source.includes('data-student-answer-option'));
});

test("explicit segments retain internal blank lines through save, reload and publication", () => {
  const lines = ["第一段\n\n仍是同一个片段", "第二段"];
  const script = { "zh-CN": lines.join("\n\n"), "ko-KR": "다른 대사" };
  const configuration = { scriptSegments: { "zh-CN": lines }, teacherVideo: { mode: "video", explanations: lines.map((transcript, index) => ({ objectKey: `teacher-video/${index}.mp4`, transcript })) } };
  for (const locale of ["zh-CN", "ko-KR"]) {
    const reloaded = teachingScriptSegments(script, JSON.parse(JSON.stringify(configuration)), locale);
    assert.deepEqual(reloaded, lines);
    assert.equal(teachingVideoIssues({ video: configuration.teacherVideo, lines: reloaded }).length, 0);
    assert.equal(teacherVideoForTurn({ configuration, nodeId: "n", segmentIndex: 0, phase: "explanation", answerCorrect: null, intent: "start", authoredText: reloaded[0] }).status, "ready");
  }
  assert.deepEqual(teachingScriptSegments({ "zh-CN": "旧一\n\n旧二" }, null), ["旧一", "旧二"]);
  assert.deepEqual(teachingScriptSegments(script, { teacherVideo: { mode: "legacy" } }, "ko-KR"), ["다른 대사"]);
  assert.deepEqual(teachingScriptSegments({ "zh-CN": "外部修改" }, configuration), ["外部修改"]);
});

test("publication ignores inactive bindings without deleting them", () => {
  const clip = (name) => ({ objectKey: `teacher-video/${name}.mp4`, transcript: name });
  const configuration = { teacherVideo: { mode: "video", explanations: [clip("lecture"), clip("unused")], taskInExplanation: true, questionInExplanation: true, turns: { task: clip("task"), question: clip("question"), operationFeedback: clip("operation"), correctFeedback: clip("correct"), incorrectFeedback: clip("incorrect") } } };
  const keys = (c, ref) => activeTeacherVideoBindings(c, 1, ref).map((b) => b.objectKey);
  assert.deepEqual(keys(configuration), ["teacher-video/lecture.mp4"]);
  assert.deepEqual(keys({ ...configuration, studentTask: { kind: "none" }, interaction: { kind: "none" } }), keys(configuration));
  assert.deepEqual(keys({ ...configuration, studentTask: { kind: "play_expression_audio" } }), ["teacher-video/lecture.mp4", "teacher-video/operation.mp4"]);
  assert.deepEqual(keys(configuration, "activity"), ["teacher-video/lecture.mp4", "teacher-video/correct.mp4", "teacher-video/incorrect.mp4"]);
  assert.equal(configuration.teacherVideo.turns.task.objectKey, "teacher-video/task.mp4");
  assert.deepEqual(keys({ ...configuration, teacherVideo: { ...configuration.teacherVideo, mode: "legacy" } }), []);
});

test("authoring and publication share missing, stale and required-turn checks", () => {
  assert.equal(teachingVideoIssues({ video: { mode: "legacy" }, lines: [] }).length, 0);
  assert.equal(teachingVideoIssues({ video: { mode: "video" }, lines: [] }).length, 1);
  assert.equal(teachingVideoIssues({ video: { mode: "video" }, lines: ["讲解"], hasTask: true, hasQuestion: true }).length, 3);
  const video = { mode: "video", explanations: [{ objectKey: "teacher-video/a.mp4", transcript: "讲解" }], taskInExplanation: true, questionInExplanation: true };
  assert.equal(teachingVideoIssues({ video, lines: ["讲解"], hasTask: true, hasQuestion: true }).length, 0);
  assert.match(teachingVideoIssues({ video, lines: ["新讲解"] })[0].message, /台词已修改/);
  assert.equal(teachingVideoIssues({ video: { ...video, explanations: [{ objectKey: "invalid.mp4", transcript: "讲解" }] }, lines: ["讲解"] }).length, 1);
});

const binding = (name) => ({ objectKey: `teacher-video/${name}.mp4`, title: name, transcript: "原始台词" });
const config = { mode: "video", explanations: [binding("opening"), binding("explanation")], turns: { task: binding("task"), question: binding("question"), operationFeedback: binding("complete"), correctFeedback: binding("correct"), incorrectFeedback: binding("incorrect") } };
const turn = (overrides = {}) => teacherVideoForTurn({ configuration: { teacherVideo: config }, nodeId: "node", segmentIndex: 0, phase: "explanation", answerCorrect: null, intent: "start", authoredText: "原始台词", ...overrides });

test("only teacher MP4 assets can be requested", () => {
  assert.equal(isTeacherVideoKey("teacher-video/第一章/开场.mp4"), true);
  for (const key of ["other/a.mp4", "teacher-video/../private.mp4", "teacher-video/%2e%2e/a.mp4", "teacher-video//a.mp4", "teacher-video/a.mp4?x", "teacher-video/a.webm", "teacher-video/\\a.mp4"]) assert.equal(isTeacherVideoKey(key), false, key);
});
test("selects explanation clips by segment, task and question by teaching phase", () => {
  assert.equal(turn({ segmentIndex: 1 }).objectKey, binding("explanation").objectKey);
  assert.equal(turn({ phase: "task" }).objectKey, binding("task").objectKey);
  assert.equal(turn({ phase: "question" }).objectKey, binding("question").objectKey);
  assert.equal(turn({ phase: "task" }).continuous, false);
});
test("correct, incorrect and operation feedback never share the wrong clip", () => {
  assert.equal(turn({ phase: "task_feedback", intent: "answer", answerCorrect: true }).objectKey, binding("correct").objectKey);
  assert.equal(turn({ phase: "task_feedback", intent: "answer", answerCorrect: false }).objectKey, binding("incorrect").objectKey);
  assert.equal(turn({ phase: "task_feedback", intent: "ready" }).objectKey, binding("complete").objectKey);
});
test("editing the narration invalidates its old video without replacing it", () => {
  const playback = turn({ authoredText: "修改后的台词" });
  assert.equal(playback.status, "stale");
  assert.equal(playback.objectKey, null);
  assert.equal(config.explanations[0].objectKey, binding("opening").objectKey);
});
test("supplemental questions use text, never replay an unrelated lecture", () => {
  for (const intent of ["hint", "example", "ask"]) {
    assert.equal(turn({ intent }).status, "text");
    assert.equal(turn({ intent }).objectKey, null);
    assert.equal(turn({ intent }).continuous, false);
  }
});
test("question already included in lecture opens the native response without replay", () => {
  const playback = turn({ configuration: { teacherVideo: { ...config, questionInExplanation: true } }, phase: "question" });
  assert.equal(playback.objectKey, null);
  assert.equal(playback.status, "text");
});
test("missing feedback can use text but missing lecture remains explicit", () => {
  const configuration = { teacherVideo: { mode: "video" } };
  assert.equal(turn({ configuration }).status, "missing");
  assert.equal(turn({ configuration, phase: "task_feedback", answerCorrect: false }).status, "text");
  assert.equal(teacherVideoForTurn({ configuration: {}, nodeId: "old", segmentIndex: 0, phase: "explanation", answerCorrect: null, intent: "start" }), null);
  assert.deepEqual(normalizeTeachingVideo({ mode: "video", explanations: [binding("opening"), { objectKey: "private/a.mp4" }] }).explanations, [binding("opening"), null]);
});
