import assert from "node:assert/strict";
import { test } from "node:test";

import {
  expressionToTex,
  newPaper,
  newQuestion,
  parseDecimal,
  selfCheck,
  trialGrade,
  validatePaperDraft,
} from "../src/features/subjects/math/admin/paper-model.ts";

const seed = () => 7;

function expression(over = {}) {
  return { ...newQuestion("expression"), prompt: "化简 2(x+1)", explanation: "展开", expected: "2x+2", ...over };
}
function numeric(over = {}) {
  return { ...newQuestion("numeric"), prompt: "求 1/3（三位小数）", explanation: "约 0.333", expected: "0.3333", ...over };
}
function choice(over = {}) {
  return { ...newQuestion("choice"), prompt: "2+2=?", explanation: "四", options: ["3", "4", "5"], correctIndex: 1, ...over };
}
function paper(questions, over = {}) {
  return { ...newPaper(), title: "数学试卷", questions, ...over };
}

test("parseDecimal 严格解析十进制数", () => {
  assert.equal(parseDecimal(" 1.5 "), 1.5);
  assert.equal(parseDecimal("-5"), -5);
  assert.equal(parseDecimal("1e-9"), 1e-9);
  assert.equal(parseDecimal(".5"), 0.5);
  for (const bad of ["", " ", "abc", "0x10", "1,5", "Infinity", "NaN", "1e999", "--1", "1 2", "١٢"]) {
    assert.equal(parseDecimal(bad), null, JSON.stringify(bad));
  }
});

test("合法草稿生成 create_math_paper 所需的题目（三种题型）", () => {
  const result = validatePaperDraft(paper([expression(), numeric(), choice()]), seed);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.questions.length, 3);
  const [expr, num, ch] = result.questions;
  assert.equal(expr.type, "math.expression");
  assert.deepEqual(expr.mathSpec.variables, [{ name: "x", min: -5, max: 5 }]);
  assert.equal(expr.mathSpec.seed, 7);
  assert.equal(num.type, "math.numeric");
  assert.deepEqual(num.mathSpec, { expected: 0.3333, tolerance: { abs: 0.001, rel: 0 } });
  assert.equal(ch.type, "single_choice");
  assert.equal(ch.correctAnswer, "4");
  assert.equal(ch.mathSpec, undefined);
  assert.equal(result.durationMinutes, 30);
  assert.equal(result.passingScore, 60);
});

test("种子由调用方按题号提供", () => {
  const result = validatePaperDraft(paper([expression(), expression({ prompt: "另一题", expected: "x+x+2" })]), (i) => 100 + i);
  assert.equal(result.questions[0].mathSpec.seed, 100);
  assert.equal(result.questions[1].mathSpec.seed, 101);
  const bad = validatePaperDraft(paper([expression()]), () => 1.5);
  assert.equal(bad.ok, false);
});

test("试卷级校验：名称、说明、用时、及格线、题数、重复题干", () => {
  const cases = [
    [paper([expression()], { title: "a" }), /试卷名称/],
    [paper([expression()], { description: "x".repeat(5001) }), /试卷说明/],
    [paper([expression()], { durationMinutes: "0" }), /建议用时/],
    [paper([expression()], { durationMinutes: "1.5" }), /建议用时/],
    [paper([expression()], { passingScore: "101" }), /及格线/],
    [paper([]), /1 至 100 道/],
    [paper(Array.from({ length: 101 }, (_, i) => expression({ prompt: `题 ${i}` }))), /1 至 100 道/],
    [paper([expression(), expression({ expected: "x+x+2" })]), /题干与前面的题重复/],
  ];
  for (const [draft, pattern] of cases) {
    const result = validatePaperDraft(draft, seed);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => pattern.test(e)), `${pattern} in ${result.errors}`);
  }
  assert.equal(validatePaperDraft(paper([expression()], { durationMinutes: "", passingScore: "" }), seed).ok, true);
});

test("表达式题的各类错误都带题号被拒", () => {
  const bad = [
    [expression({ prompt: "" }), /题干/],
    [expression({ explanation: "" }), /解析/],
    [expression({ points: "0" }), /分值/],
    [expression({ points: "1001" }), /分值/],
    [expression({ points: "abc" }), /分值/],
    [expression({ difficulty: "easy" }), /难度/],
    [expression({ expected: "" }), /标准表达式/],
    [expression({ expected: "x".repeat(201) }), /不能超过 200/],
    [expression({ expected: "2x+" }), /自检/],
    [expression({ expected: "y+1" }), /自检/],
    [expression({ expected: "alert(1)" }), /自检/],
    [expression({ expected: "constructor" }), /自检/],
    [expression({ variables: [] }), /变量/],
    [expression({ variables: Array.from({ length: 5 }, (_, i) => ({ name: `v${i}`, min: "0", max: "1" })) }), /变量/],
    [expression({ variables: [{ name: "constructor", min: "0", max: "1" }] }), /不合法/],
    [expression({ variables: [{ name: "x", min: "0", max: "1" }, { name: "x", min: "0", max: "1" }] }), /重复/],
    [expression({ variables: [{ name: "x", min: "5", max: "-5" }] }), /取值范围/],
    [expression({ variables: [{ name: "x", min: "a", max: "1" }] }), /取值范围/],
    [expression({ toleranceAbs: "-1" }), /容差/],
    [expression({ toleranceRel: "x" }), /容差/],
    [expression({ expected: "sqrt(x)", variables: [{ name: "x", min: "-100", max: "-50" }] }), /取值范围内两边都有定义的点太少/],
  ];
  for (const [question, pattern] of bad) {
    const result = validatePaperDraft(paper([question]), seed);
    assert.equal(result.ok, false, pattern.toString());
    assert.ok(result.errors.every((e) => e.startsWith("第 1 题：")), result.errors.join("|"));
    assert.ok(result.errors.some((e) => pattern.test(e)), `${pattern} in ${result.errors}`);
  }
});

test("数值题与选择题的校验", () => {
  const bad = [
    [numeric({ expected: "" }), /标准数值/],
    [numeric({ expected: "1/3" }), /标准数值/],
    [numeric({ toleranceAbs: "-0.1" }), /容差/],
    [choice({ options: ["3"] }), /选项至少两个/],
    [choice({ options: ["3", ""] }), /选项至少两个/],
    [choice({ options: ["a", " A "] }), /选项不能重复/],
    [choice({ correctIndex: null }), /正确答案/],
    [choice({ correctIndex: 3 }), /正确答案/],
  ];
  for (const [question, pattern] of bad) {
    const result = validatePaperDraft(paper([question]), seed);
    assert.equal(result.ok, false, pattern.toString());
    assert.ok(result.errors.some((e) => pattern.test(e)), `${pattern} in ${result.errors}`);
  }
});

test("多道题的错误都带各自题号，且最多返回 20 条", () => {
  const result = validatePaperDraft(paper([expression(), expression({ prompt: "第二题", expected: "" }), choice({ options: ["a"] })]), seed);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.startsWith("第 2 题：")));
  assert.ok(result.errors.some((e) => e.startsWith("第 3 题：")));
  assert.ok(!result.errors.some((e) => e.startsWith("第 1 题：")));
  const many = validatePaperDraft(paper(Array.from({ length: 50 }, () => expression({ prompt: "", explanation: "" }))), seed);
  assert.equal(many.errors.length, 20);
});

test("自检：标准答案对自身为判对；无法判定的规格被报出", () => {
  assert.equal(selfCheck(expression()).verdict, "correct");
  assert.equal(selfCheck(numeric()).verdict, "correct");
  assert.equal(selfCheck(numeric({ expected: "0.3333", toleranceAbs: "0", toleranceRel: "0" })).verdict, "correct");
  assert.equal(selfCheck(expression({ expected: "2x+" })).verdict, "error");
});

test("试判：判对、判错（带取点）、无法判定（带原因）", () => {
  const ok = trialGrade(expression(), "2(x+1)");
  assert.equal(ok.verdict, "correct");
  assert.match(ok.message, /判对：在 \d+ 个取点上/);
  const wrong = trialGrade(expression(), "2x+1");
  assert.equal(wrong.verdict, "incorrect");
  assert.match(wrong.message, /x = .+时作答为 .+，标准答案为 /);
  const syntax = trialGrade(expression(), "2x+");
  assert.equal(syntax.verdict, "error");
  assert.match(syntax.message, /作答无法解析/);
  const evil = trialGrade(expression(), "process.exit(1)");
  assert.equal(evil.verdict, "error");
  assert.equal(trialGrade(numeric(), "1/3").verdict, "correct");
  assert.equal(trialGrade(numeric(), "0.3").verdict, "incorrect");
  assert.match(trialGrade(numeric(), "0.3").message, /超出误差范围/);
  assert.equal(trialGrade(numeric(), "x").verdict, "error");
  assert.equal(trialGrade(numeric(), "").verdict, "error");
  assert.equal(trialGrade(expression({ expected: "" }), "x").verdict, "error");
});

test("LaTeX 预览：能解析返回字符串，否则 null", () => {
  assert.equal(typeof expressionToTex("2x+2", [{ name: "x", min: "0", max: "1" }]), "string");
  assert.match(expressionToTex("x^2", [{ name: "x", min: "0", max: "1" }]), /x\^\{2\}|x\^2/);
  assert.equal(expressionToTex("2x+", [{ name: "x", min: "0", max: "1" }]), null);
  assert.equal(expressionToTex("", []), null);
  assert.equal(expressionToTex("y", [{ name: "x", min: "0", max: "1" }]), null);
  assert.equal(expressionToTex("x", [{ name: "constructor", min: "0", max: "1" }]), null);
});

test("数学出题界面的安全约束：KaTeX 禁用 trust，唯一的 dangerouslySetInnerHTML 在公式组件内，且不引用其他学科", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const dir = new URL("../src/features/subjects/math/admin/", import.meta.url);
  const files = readdirSync(dir).filter((name) => /\.(ts|tsx)$/.test(name));
  assert.ok(files.includes("MathFormula.tsx"));
  for (const name of files) {
    const text = readFileSync(new URL(name, dir), "utf8");
    assert.doesNotMatch(text, /from "[^"]*(korean|english)\//, name);
    assert.doesNotMatch(text, /\beval\(|new Function\(/, name);
    if (name === "MathFormula.tsx") {
      assert.match(text, /trust: false/);
      assert.equal((text.match(/dangerouslySetInnerHTML/g) ?? []).length, 1);
    } else {
      assert.doesNotMatch(text, /dangerouslySetInnerHTML/, name);
    }
  }
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(pkg.dependencies.katex, /^\d+\.\d+\.\d+$/, "katex 需要固定版本");
});

test("数学出题界面不引用 app 层（依赖方向 app → features）", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const dir = new URL("../src/features/subjects/math/admin/", import.meta.url);
  for (const name of readdirSync(dir)) {
    assert.doesNotMatch(readFileSync(new URL(name, dir), "utf8"), /from ["']@\/app\//, name);
  }
});

test("草稿还原：保存的行 → 表单状态 → 校验 → 与原题目等价（往返一致）", async () => {
  const { draftFromRows } = await import("../src/features/subjects/math/admin/paper-model.ts");
  const original = paper([
    expression({ toleranceAbs: "1e-6", toleranceRel: "0", variables: [{ name: "x", min: "-5", max: "5" }, { name: "y", min: "0.5", max: "3" }], expected: "x*y" }),
    numeric(),
    choice(),
  ]);
  const saved = validatePaperDraft(original, () => 11);
  assert.equal(saved.ok, true);
  // 把校验结果当作数据库里的行（点名数字以字符串 / 数字混合出现，模拟 numeric 列）
  const rows = saved.questions.map((q, i) => ({
    id: `q${i}`,
    question_type: q.type,
    prompt: q.prompt,
    options: q.options ?? [],
    points: String(q.points) + ".00",
    difficulty: q.difficulty,
    sort_order: i,
    correct_answer: q.correctAnswer ?? null,
    explanation: q.explanation,
    spec: q.mathSpec ?? null,
  })).reverse(); // 顺序打乱，按 sort_order 还原
  const restored = draftFromRows({ title: saved.title, description: saved.description, duration_minutes: saved.durationMinutes, passing_score: "60.00" }, rows);
  assert.ok(restored);
  assert.equal(restored.questions.length, 3);
  const again = validatePaperDraft(restored, () => 11);
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.deepEqual(again.questions, saved.questions);
  assert.equal(restored.passingScore, "60");
  assert.equal(restored.durationMinutes, "30");
});

test("草稿还原：无法识别的行返回 null，不做猜测", async () => {
  const { draftFromRows } = await import("../src/features/subjects/math/admin/paper-model.ts");
  const meta = { title: "t", description: "", duration_minutes: null, passing_score: null };
  const row = { id: "q", question_type: "math.numeric", prompt: "p", options: [], points: "5.00", difficulty: "foundation", sort_order: 0, correct_answer: null, explanation: "e", spec: { expected: 1, tolerance: { abs: 0, rel: 0 } } };
  assert.ok(draftFromRows(meta, [row]));
  assert.equal(draftFromRows(meta, [{ ...row, question_type: "short_text" }]), null);
  assert.equal(draftFromRows(meta, [{ ...row, spec: null }]), null);
  assert.equal(draftFromRows(meta, [{ ...row, spec: { expected: "1", tolerance: { abs: "x", rel: 0 } } }]), null);
  assert.equal(draftFromRows(meta, [{ ...row, points: "abc" }]), null);
  assert.equal(draftFromRows(meta, [{ ...row, difficulty: "easy" }]), null);
  const choiceRow = { ...row, question_type: "single_choice", options: ["a", "b"], correct_answer: "b", spec: null };
  assert.equal(draftFromRows(meta, [choiceRow]).questions[0].correctIndex, 1);
  assert.equal(draftFromRows(meta, [{ ...choiceRow, options: [1, 2] }]), null);
  assert.equal(draftFromRows(meta, [{ ...choiceRow, correct_answer: "zzz" }]).questions[0].correctIndex, null);
  const exprRow = { ...row, question_type: "math.expression", spec: { expected: "x", variables: [{ name: "x", min: 0, max: 1 }], seed: 1 } };
  assert.equal(draftFromRows(meta, [exprRow]).questions[0].toleranceAbs, "1e-9");
  assert.equal(draftFromRows(meta, [{ ...exprRow, spec: { expected: "x", variables: [{ name: "x", min: "a", max: 1 }] } }]), null);
  assert.deepEqual(draftFromRows(meta, []).questions, []);
});

test("窄屏：变量行的网格列必须可收缩（minmax(0,1fr)），输入框带 min-w-0，否则 390px 宽度下对话框横向溢出", async () => {
  const { readFileSync } = await import("node:fs");
  const text = readFileSync(new URL("../src/features/subjects/math/admin/MathQuestionEditor.tsx", import.meta.url), "utf8");
  assert.match(text, /grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)_minmax\(0,1fr\)_auto\]/);
  assert.doesNotMatch(text, /grid-cols-\[1fr_1fr_1fr_auto\]/);
  assert.equal((text.match(/w-full min-w-0 rounded-xl border px-3 py-2/g) ?? []).length, 3);
});
