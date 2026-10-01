import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  MAX_ANSWERS_PER_RUN,
  MAX_SUBMISSIONS_PER_RUN,
  gradeAnswer,
  gradePendingMathAnswers,
} from "../src/features/subjects/math/grading/machine-grading.ts";
import { prepareMachineGradesFor, renderSubmissionReviewActions } from "../src/features/subjects/admin-slot-contract.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");

const exprSpec = { expected: "2x+2", variables: [{ name: "x", min: -5, max: 5 }], seed: 7, tolerance: { abs: 1e-9, rel: 1e-9 } };
const numSpec = { expected: 0.3333, tolerance: { abs: 0.001, rel: 0 } };
const answer = (over = {}) => ({ answerId: "a1", questionType: "math.expression", points: 5, answerText: "2(x+1)", spec: exprSpec, ...over });

test("单题：判对给满分，判错给 0，附判题器键与依据", () => {
  const ok = gradeAnswer(answer());
  assert.equal(ok.verdict, "correct");
  assert.equal(ok.suggestedPoints, 5);
  assert.equal(ok.graderKey, "math.expression-equivalence");
  assert.equal(ok.graderVersion, "1.0.0");
  assert.ok(Array.isArray(ok.evidence.points));
  const bad = gradeAnswer(answer({ answerText: "2x+1" }));
  assert.equal(bad.verdict, "incorrect");
  assert.equal(bad.suggestedPoints, 0);
  const num = gradeAnswer(answer({ questionType: "math.numeric", spec: numSpec, answerText: "1/3", points: 2 }));
  assert.equal(num.verdict, "correct");
  assert.equal(num.suggestedPoints, 2);
  assert.equal(num.graderKey, "math.numeric");
});

test("空白作答建议 0 分；缺少规格、恶意或畸形作答无法判定且不给分（转人工）", () => {
  const blank = gradeAnswer(answer({ answerText: "   " }));
  assert.deepEqual([blank.verdict, blank.suggestedPoints, blank.reason], ["incorrect", 0, "blank_answer"]);
  const noSpec = gradeAnswer(answer({ spec: null }));
  assert.deepEqual([noSpec.verdict, noSpec.suggestedPoints, noSpec.reason], ["error", null, "invalid_spec"]);
  for (const text of ["process.exit(1)", "x".repeat(500), "2x+", "constructor", "__proto__"]) {
    const r = gradeAnswer(answer({ answerText: text }));
    assert.equal(r.verdict, "error", text);
    assert.equal(r.suggestedPoints, null, text);
  }
  for (const spec of [{}, [], "x", 5, { ...exprSpec, seed: 1.5 }]) {
    const r = gradeAnswer(answer({ spec }));
    assert.equal(r.verdict, "error");
    assert.equal(r.suggestedPoints, null);
  }
});

test("非数学题型不判（返回 null）", () => {
  for (const type of ["single_choice", "short_text", "math.steps", "constructor", ""]) {
    assert.equal(gradeAnswer(answer({ questionType: type })), null, type);
  }
});

function makeStore(answers, over = {}) {
  const calls = { listed: [], recorded: [] };
  return {
    calls,
    store: {
      async listUngraded(ids, options) { calls.listed.push(ids); calls.options = options; return answers; },
      async record(r) { calls.recorded.push(r); return { error: undefined }; },
      ...over,
    },
  };
}

test("流程：逐条判题并记录；提交 ID 去重并设上限；失败只计数不中断", async () => {
  const { store, calls } = makeStore([answer({ answerId: "a1" }), answer({ answerId: "a2", answerText: "2x+1" }), answer({ answerId: "a3", questionType: "single_choice" })]);
  const result = await gradePendingMathAnswers(store, ["s1", "s1", "s2"]);
  assert.deepEqual(result, { recorded: 2, failed: 0 });
  assert.deepEqual(calls.listed[0], ["s1", "s2"]);
  assert.deepEqual(calls.recorded.map((r) => [r.answerId, r.verdict]), [["a1", "correct"], ["a2", "incorrect"]]);

  const many = Array.from({ length: MAX_SUBMISSIONS_PER_RUN + 50 }, (_, i) => `s${i}`);
  const big = makeStore([]);
  await gradePendingMathAnswers(big.store, many);
  assert.equal(big.calls.listed[0].length, MAX_SUBMISSIONS_PER_RUN);

  const flaky = makeStore([answer({ answerId: "a1" }), answer({ answerId: "a2" })], {
    async record(r) { return r.answerId === "a1" ? { error: "提交不在待批改阶段，不能写入机器判题结果" } : { error: undefined }; },
  });
  assert.deepEqual(await gradePendingMathAnswers(flaky.store, ["s1"]), { recorded: 1, failed: 1 });
  assert.deepEqual(await gradePendingMathAnswers(makeStore([]).store, []), { recorded: 0, failed: 0 });

  const overflow = makeStore(Array.from({ length: MAX_ANSWERS_PER_RUN + 10 }, (_, i) => answer({ answerId: `a${i}` })));
  const r = await gradePendingMathAnswers(overflow.store, ["s1"]);
  assert.equal(r.recorded, MAX_ANSWERS_PER_RUN);
});

test("插槽：没有注册或没有机器判题的学科返回空；注册了则透传输入", async () => {
  const input = { supabase: {}, pendingSubmissionIds: ["s"], answerIds: ["a"] };
  assert.equal((await prepareMachineGradesFor({}, "math", input)).size, 0);
  assert.equal((await prepareMachineGradesFor({ math: {} }, "math", input)).size, 0);
  for (const slug of ["constructor", "__proto__", "korean"]) {
    assert.equal((await prepareMachineGradesFor({ math: { prepareMachineGrades: async () => new Map([["a", {}]]) } }, slug, input)).size, 0, slug);
  }
  let seen;
  const slots = { math: { prepareMachineGrades: async (i) => { seen = i; return new Map([["a", { verdict: "correct", suggestedPoints: 5, message: "m" }]]); } } };
  assert.equal((await prepareMachineGradesFor(slots, "math", input)).get("a").suggestedPoints, 5);
  assert.equal(seen, input);
});

test("教师批改页：只在作业含学科题型时才调用学科判题；建议只作为预填值，不自动写分", () => {
  const page = read("src/app/dashboard/admin/assignments/[assignmentId]/page-content.tsx");
  assert.match(page, /question\.question_type\.includes\("\."\)/);
  assert.match(page, /subjectSlug && subjectQuestionIds\.size > 0\s*\?\s*await prepareSubjectMachineGrades\(subjectSlug/);
  assert.match(page, /submission\.submission_state === "submitted_pending_grading" \|\| submission\.submission_state === "objective_graded_pending_manual"/);
  const form = read("src/app/dashboard/admin/assignments/SubmissionGradingForm.tsx");
  assert.match(form, /defaultValue=\{answer\.awardedPoints \?\? answer\.suggestedPoints \?\? 0\}/);
  // 建议不写入隐藏的正式得分字段，评分仍由教师提交
  assert.doesNotMatch(form, /type="hidden" name=\{`score_\$\{answer\.id\}`\} value=\{answer\.suggestedPoints/);
});

test("机器判题服务端模块：服务端权限只用于读写判题数据，页面连接读取建议且失败不抛出", () => {
  const server = read("src/features/subjects/math/grading/machine-grading.server.ts");
  assert.match(server, /^import "server-only";/);
  assert.match(server, /createAdminClient\(\)/);
  assert.match(server, /record_learning_machine_grade/);
  assert.match(server, /input\.supabase\s*\.from\("learning_submission_machine_grades"\)/);
  assert.match(server, /catch \{/);
  assert.doesNotMatch(server, /from "@\/app\//);
});

test("重判：默认只判没有结果的；regrade 时让存储连已有结果的一起返回（新增修订，不改旧结果）", async () => {
  const normal = makeStore([answer()]);
  await gradePendingMathAnswers(normal.store, ["s1"]);
  assert.deepEqual(normal.calls.options, { includeGraded: false });
  const regrade = makeStore([answer({ answerId: "a1" }), answer({ answerId: "a2", answerText: "2x+1" })]);
  const result = await gradePendingMathAnswers(regrade.store, ["s1"], { regrade: true });
  assert.deepEqual(regrade.calls.options, { includeGraded: true });
  assert.deepEqual(result, { recorded: 2, failed: 0 });
  assert.equal((await gradePendingMathAnswers(makeStore([]).store, [], { regrade: true })).recorded, 0);
});

test("插槽：批改页操作只对注册了的学科生效，原型属性名不会误命中", () => {
  const Component = () => null;
  const slots = { math: { SubmissionReviewActions: Component }, english: {} };
  const element = renderSubmissionReviewActions(slots, "math", { assignmentId: "a" });
  assert.equal(element.type, Component);
  assert.deepEqual(element.props, { assignmentId: "a" });
  for (const slug of ["english", "korean", "constructor", "__proto__", ""]) {
    assert.equal(renderSubmissionReviewActions(slots, slug, { assignmentId: "a" }), null, slug);
  }
});

test("重判动作：先校验作业编号与数学应用，再校验“管理测评”权限；只重算待批改提交；不引用 app 层", () => {
  const text = read("src/features/subjects/math/grading/rejudge-actions.ts");
  assert.match(text, /^"use server";/);
  assert.match(text, /UUID\.test\(assignmentId\)/);
  assert.match(text, /getStudentAppSlugById\([^)]*\) !== "math"/);
  assert.match(text, /getTenantAppCapabilityContext\([^)]*"manageAssessments"\)/);
  assert.match(text, /\.in\("submission_state", PENDING_STATES\)/);
  assert.match(text, /PENDING_STATES = \["submitted_pending_grading", "objective_graded_pending_manual"\]/);
  assert.match(text, /\{ regrade: true \}/);
  // 提交列表用有权限的连接读取（受 RLS 约束），服务端权限只用于判题数据
  assert.match(text, /context\.supabase\s*\.from\("learning_submissions"\)/);
  assert.doesNotMatch(text, /from ["']@\/app\//);
  assert.equal((text.match(/^export /gm) ?? []).length, 1, "use server 文件只能导出异步函数");
  const page = read("src/app/dashboard/admin/assignments/[assignmentId]/page-content.tsx");
  assert.match(page, /subjectSlug && subjectQuestionIds\.size > 0 \? renderSubjectReviewActions\(/);
});
