import assert from "node:assert/strict";
import { test } from "node:test";

import { createMathPaper, friendlyDatabaseError } from "../src/features/subjects/math/admin/create-paper.ts";
import { newPaper, newQuestion, parseDraftPaper } from "../src/features/subjects/math/admin/paper-model.ts";

const LESSON = "22000000-0000-4000-8000-0000000000e7";

function draft(over = {}) {
  const expression = { ...newQuestion("expression"), prompt: "化简", explanation: "展开", expected: "2x+2" };
  const numeric = { ...newQuestion("numeric"), prompt: "求值", explanation: "约 0.333", expected: "0.3333" };
  const choice = { ...newQuestion("choice"), prompt: "2+2", explanation: "四", options: ["3", "4"], correctIndex: 1 };
  return { ...newPaper(), title: "数学试卷", questions: [expression, numeric, choice], ...over };
}

function makeStore(over = {}) {
  const calls = { findLesson: 0, findContainer: 0, createContainer: [], createPaper: [], publish: [] };
  const store = {
    async findLesson(id) { calls.findLesson++; return id === LESSON ? { id, title: "极限", courseSlug: "math-1" } : null; },
    async findContainer() { calls.findContainer++; return store.container ?? null; },
    async createContainer(input) { calls.createContainer.push(input); return { id: "container-1" }; },
    async createPaper(input) { calls.createPaper.push(input); return { id: "paper-1" }; },
    async publish(id) { calls.publish.push(id); return { error: undefined }; },
    container: null,
    ...over,
  };
  return { store, calls };
}

let counter = 0;
const seed = () => 1000 + counter++;
function input(over = {}) {
  return {
    paperType: "exam", lessonId: LESSON, allowResubmission: false, intent: "draft",
    draftJson: JSON.stringify(draft()), canRelease: true, ...over,
  };
}

test("保存草稿：创建容器、调用 create_math_paper，种子由服务端生成且每题不同", async () => {
  counter = 0;
  const { store, calls } = makeStore();
  const result = await createMathPaper(store, seed, input());
  assert.deepEqual(result, { status: "success", message: "数学试卷草稿已经保存。" });
  assert.equal(calls.createContainer.length, 1);
  assert.equal(calls.createContainer[0].slug, `math-paper-${LESSON}`);
  assert.equal(calls.createContainer[0].courseKey, "math-1");
  const paper = calls.createPaper[0];
  assert.equal(paper.containerId, "container-1");
  assert.equal(paper.paperType, "exam");
  assert.equal(paper.durationMinutes, 30);
  assert.deepEqual(paper.questions.map((q) => q.type), ["math.expression", "math.numeric", "single_choice"]);
  assert.equal(paper.questions[0].mathSpec.seed, 1000);
  assert.equal(calls.publish.length, 0);
});

test("客户端传来的种子被忽略（草稿 JSON 里即使带 seed 字段也不生效）", async () => {
  counter = 0;
  const d = draft();
  d.questions[0].seed = 42;
  d.questions[0].mathSpec = { seed: 42 };
  const { store, calls } = makeStore();
  await createMathPaper(store, seed, input({ draftJson: JSON.stringify(d) }));
  assert.equal(calls.createPaper[0].questions[0].mathSpec.seed, 1000);
});

test("已有容器时复用，不再创建", async () => {
  const { store, calls } = makeStore({ container: "existing" });
  const result = await createMathPaper(store, seed, input());
  assert.equal(result.status, "success");
  assert.equal(calls.createContainer.length, 0);
  assert.equal(calls.createPaper[0].containerId, "existing");
});

test("并发创建容器冲突时改读已有的；仍读不到则报错", async () => {
  let reads = 0;
  const { store } = makeStore({
    async findContainer() { reads++; return reads >= 2 ? "winner" : null; },
    async createContainer() { return { conflict: true }; },
  });
  const ok = await createMathPaper(store, seed, input());
  assert.equal(ok.status, "success");
  const { store: s2 } = makeStore({ async createContainer() { return { conflict: true }; } });
  const bad = await createMathPaper(s2, seed, input());
  assert.equal(bad.status, "error");
});

test("容器创建失败：中文数据库提示原样显示，其他错误用兜底文案", async () => {
  const a = await createMathPaper(makeStore({ async createContainer() { return { error: "没有权限创建试卷容器" }; } }).store, seed, input());
  assert.equal(a.message, "没有权限创建试卷容器");
  const b = await createMathPaper(makeStore({ async createContainer() { return { error: 'duplicate key value violates unique constraint "x"' }; } }).store, seed, input());
  assert.equal(b.message, "试卷容器创建失败，请稍后重试。");
});

test("发布：只有 canRelease 为真才允许；发布失败时说明草稿已保存", async () => {
  const noRight = makeStore();
  const denied = await createMathPaper(noRight.store, seed, input({ intent: "publish", canRelease: false }));
  assert.equal(denied.status, "error");
  assert.match(denied.message, /只有平台负责人可以发布/);
  assert.equal(noRight.calls.createPaper.length, 0, "无权发布时不应创建任何东西");

  const ok = makeStore();
  const published = await createMathPaper(ok.store, seed, input({ intent: "publish" }));
  assert.equal(published.status, "success");
  assert.deepEqual(ok.calls.publish, ["paper-1"]);

  const failing = makeStore({ async publish() { return { error: "试卷发布质检未通过：有 1 道数学题缺少判题规格" }; } });
  const failed = await createMathPaper(failing.store, seed, input({ intent: "publish" }));
  assert.equal(failed.status, "error");
  assert.match(failed.message, /^草稿已保存，但发布失败：试卷发布质检未通过/);
});

test("数据库保存失败：中文提示原样、其他用兜底", async () => {
  const a = await createMathPaper(makeStore({ async createPaper() { return { error: "第 1 题缺少合法的判题规格" }; } }).store, seed, input());
  assert.equal(a.message, "第 1 题缺少合法的判题规格");
  const b = await createMathPaper(makeStore({ async createPaper() { return { error: "permission denied for table x" }; } }).store, seed, input());
  assert.equal(b.message, "数学试卷保存失败，请稍后重试。");
  assert.equal(friendlyDatabaseError("x".repeat(300) + "错", "兜底"), "兜底");
});

test("输入校验：每一类坏输入都在访问存储之前被拒", async () => {
  const bad = [
    input({ paperType: "quiz" }),
    input({ paperType: undefined }),
    input({ lessonId: "not-a-uuid" }),
    input({ lessonId: null }),
    input({ draftJson: null }),
    input({ draftJson: "{" }),
    input({ draftJson: "x".repeat(400_001) }),
    input({ draftJson: JSON.stringify([]) }),
    input({ draftJson: JSON.stringify({ title: 1 }) }),
    input({ draftJson: JSON.stringify(draft({ title: "" })) }),
    input({ draftJson: JSON.stringify(draft({ questions: [] })) }),
    input({ draftJson: JSON.stringify(draft({ questions: [{ ...newQuestion("expression"), prompt: "p", explanation: "e", expected: "2x+" }] })) }),
  ];
  for (const item of bad) {
    const { store, calls } = makeStore();
    const result = await createMathPaper(store, seed, item);
    assert.equal(result.status, "error", JSON.stringify(item).slice(0, 80));
    assert.equal(calls.findLesson, 0, "校验失败前不应访问存储");
  }
});

test("课时不存在或不属于数学应用时拒绝，不创建容器与试卷", async () => {
  const { store, calls } = makeStore();
  const result = await createMathPaper(store, seed, input({ lessonId: "22000000-0000-4000-8000-0000000000ff" }));
  assert.equal(result.status, "error");
  assert.match(result.message, /课时/);
  assert.equal(calls.createContainer.length + calls.createPaper.length, 0);
});

test("parseDraftPaper：严格结构，忽略多余字段，拒绝越界与类型错误", () => {
  const good = parseDraftPaper(JSON.parse(JSON.stringify({ ...draft(), extra: 1, __proto__: { x: 1 } })));
  assert.equal(good.ok, true);
  assert.equal(Object.hasOwn(good.value, "extra"), false);
  const bad = [
    null, [], "x", 1,
    { ...draft(), title: 5 },
    { ...draft(), questions: "x" },
    { ...draft(), questions: Array.from({ length: 101 }, () => draft().questions[0]) },
    { ...draft(), questions: [null] },
    { ...draft(), questions: [{ ...draft().questions[0], kind: "other" }] },
    { ...draft(), questions: [{ ...draft().questions[0], difficulty: "easy" }] },
    { ...draft(), questions: [{ ...draft().questions[0], points: 5 }] },
    { ...draft(), questions: [{ ...draft().questions[0], variables: Array.from({ length: 5 }, () => ({ name: "x", min: "0", max: "1" })) }] },
    { ...draft(), questions: [{ ...draft().questions[0], variables: [{ name: "x", min: 0, max: "1" }] }] },
    { ...draft(), questions: [{ ...draft().questions[2], options: Array.from({ length: 9 }, () => "a") }] },
    { ...draft(), questions: [{ ...draft().questions[2], correctIndex: "1" }] },
    { ...draft(), questions: [{ ...draft().questions[0], prompt: "x".repeat(6001) }] },
  ];
  for (const raw of bad) assert.equal(parseDraftPaper(raw).ok, false, JSON.stringify(raw)?.slice(0, 60));
});

function editStore(over = {}) {
  const calls = { replace: [], publish: [], findLesson: 0, createPaper: 0, createContainer: 0 };
  const store = {
    async findLesson() { calls.findLesson++; return null; },
    async findContainer() { return null; },
    async createContainer() { calls.createContainer++; return { id: "c" }; },
    async createPaper() { calls.createPaper++; return { id: "p" }; },
    async replacePaper(i) { calls.replace.push(i); return { error: undefined }; },
    async publish(id) { calls.publish.push(id); return { error: undefined }; },
    ...over,
  };
  return { store, calls };
}
const PAPER = "24000000-0000-4000-8000-0000000000aa";

test("编辑草稿：整体替换，不查课时也不创建容器；种子仍由服务端生成", async () => {
  counter = 0;
  const { store, calls } = editStore();
  const result = await createMathPaper(store, seed, input({ paperId: PAPER, lessonId: null }));
  assert.deepEqual(result, { status: "success", message: "数学试卷草稿已经更新。" });
  assert.equal(calls.findLesson + calls.createContainer + calls.createPaper, 0);
  assert.equal(calls.replace.length, 1);
  assert.equal(calls.replace[0].paperId, PAPER);
  assert.equal(calls.replace[0].questions[0].mathSpec.seed, 1000);
  assert.equal(calls.replace[0].title, "数学试卷");
});

test("编辑草稿：发布权限、发布失败说明、数据库提示", async () => {
  const noRight = editStore();
  const denied = await createMathPaper(noRight.store, seed, input({ paperId: PAPER, intent: "publish", canRelease: false }));
  assert.equal(denied.status, "error");
  assert.equal(noRight.calls.replace.length, 0);

  const ok = editStore();
  const published = await createMathPaper(ok.store, seed, input({ paperId: PAPER, intent: "publish" }));
  assert.equal(published.status, "success");
  assert.deepEqual(ok.calls.publish, [PAPER]);

  const failing = editStore({ async publish() { return { error: "试卷发布质检未通过：有 1 道数学题缺少判题规格" }; } });
  const failed = await createMathPaper(failing.store, seed, input({ paperId: PAPER, intent: "publish" }));
  assert.match(failed.message, /^草稿已更新，但发布失败：/);

  const published2 = editStore({ async replacePaper() { return { error: "只有草稿试卷可以修改，请先复制为新草稿" }; } });
  const stale = await createMathPaper(published2.store, seed, input({ paperId: PAPER }));
  assert.equal(stale.message, "只有草稿试卷可以修改，请先复制为新草稿");
  assert.equal(published2.calls.publish.length, 0);

  const other = editStore({ async replacePaper() { return { error: "permission denied for function" }; } });
  assert.equal((await createMathPaper(other.store, seed, input({ paperId: PAPER }))).message, "数学试卷草稿保存失败，请稍后重试。");
});

test("编辑草稿：坏输入在访问存储之前被拒", async () => {
  for (const bad of [input({ paperId: "not-a-uuid" }), input({ paperId: 5 }), input({ paperId: PAPER, draftJson: "{" }), input({ paperId: PAPER, paperType: "quiz" }), input({ paperId: PAPER, draftJson: JSON.stringify(draft({ title: "" })) })]) {
    const { store, calls } = editStore();
    const result = await createMathPaper(store, seed, bad);
    assert.equal(result.status, "error");
    assert.equal(calls.replace.length, 0);
  }
  // 空 paperId 视为新建（需要课时）
  const { store } = editStore();
  const create = await createMathPaper(store, seed, input({ paperId: "", lessonId: "bad" }));
  assert.match(create.message, /课时/);
});

test("种子挑选：取值范围内只有部分点有定义时（sqrt(x) 在 [-5, 5]），保存的种子必须让标准答案自己判对", async () => {
  const { gradeExpression } = await import("../src/features/subjects/math/grading/equivalence.ts");
  const { selfCheck } = await import("../src/features/subjects/math/admin/paper-model.ts");
  const q = { ...newQuestion("expression"), prompt: "根号", explanation: "e", expected: "sqrt(x)", variables: [{ name: "x", min: "-5", max: "5" }] };
  // 复现审查发现的问题：固定种子 1 对这道题自检失败
  assert.equal(selfCheck(q, 1).verdict, "error");
  // 从种子 1 开始依次给出，服务端应跳过不可用的种子
  let n = 0;
  const { store, calls } = makeStore();
  const result = await createMathPaper(store, () => (n += 1), input({ draftJson: JSON.stringify(draft({ questions: [q] })) }));
  assert.equal(result.status, "success", result.message);
  const spec = calls.createPaper[0].questions[0].mathSpec;
  assert.notEqual(spec.seed, 1);
  assert.equal(gradeExpression("sqrt(x)", spec).verdict, "correct");
  assert.equal(gradeExpression("sqrt(x)+0", spec).verdict, "correct");
  assert.equal(gradeExpression("x", spec).verdict, "incorrect");
});

test("种子挑选：确实无法判定的规格（取值范围内函数处处无定义）仍然被拒，且给出原因", async () => {
  const q = { ...newQuestion("expression"), prompt: "无定义", explanation: "e", expected: "sqrt(x)", variables: [{ name: "x", min: "-100", max: "-50" }] };
  let n = 0;
  const { store, calls } = makeStore();
  const result = await createMathPaper(store, () => (n += 1), input({ draftJson: JSON.stringify(draft({ questions: [q] })) }));
  assert.equal(result.status, "error");
  assert.match(result.message, /取值范围内两边都有定义的点太少/);
  assert.equal(calls.createPaper.length, 0);
});
