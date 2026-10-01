import assert from "node:assert/strict";
import { test } from "node:test";

import { MATH_QUESTION_TYPES, parseMathAnswer } from "../src/features/subjects/math/question-types.ts";

const exprSpec = { expected: "2x+2", variables: [{ name: "x", min: -5, max: 5 }], seed: 7 };
const expr = MATH_QUESTION_TYPES["math.expression"];
const num = MATH_QUESTION_TYPES["math.numeric"];

test("表达式题：对给满分，错给 0，附判题器版本", () => {
  const ok = expr.grade({ answer: " 2(x+1) ", spec: exprSpec, maxPoints: 5 });
  assert.equal(ok.verdict, "correct");
  assert.equal(ok.suggestedPoints, 5);
  assert.equal(ok.grader.key, "math.expression-equivalence");
  const bad = expr.grade({ answer: "2x+1", spec: exprSpec, maxPoints: 5 });
  assert.equal(bad.verdict, "incorrect");
  assert.equal(bad.suggestedPoints, 0);
});

test("数值题：按容差判分", () => {
  const spec = { expected: 1 / 3, tolerance: { abs: 1e-3, rel: 0 } };
  assert.equal(num.grade({ answer: "0.333", spec, maxPoints: 2 }).suggestedPoints, 2);
  assert.equal(num.grade({ answer: "0.3", spec, maxPoints: 2 }).suggestedPoints, 0);
});

test("作答不合规：不给分、不抛异常（转人工）", () => {
  for (const answer of ["", "   ", null, undefined, 5, {}, "x".repeat(201), "x=1", "alert(1)"]) {
    const r = expr.grade({ answer, spec: exprSpec, maxPoints: 5 });
    assert.equal(r.verdict, "error");
    assert.equal(r.suggestedPoints, null);
  }
  assert.equal(parseMathAnswer("x".repeat(200)).ok, true);
  assert.equal(parseMathAnswer("x".repeat(201)).ok, false);
});

test("规格来自数据库，畸形规格一律 invalid_spec", () => {
  const badSpecs = [
    null,
    "x",
    [],
    {},
    { ...exprSpec, expected: 5 },
    { ...exprSpec, expected: "y" },
    { ...exprSpec, variables: [] },
    { ...exprSpec, variables: [{ name: "x", min: 5, max: -5 }] },
    { ...exprSpec, variables: [{ name: "constructor", min: 0, max: 1 }] },
    { ...exprSpec, seed: 1.5 },
    { ...exprSpec, tolerance: { abs: -1, rel: 0 } },
    { ...exprSpec, sampleCount: "9" },
    { ...exprSpec, expected: "(".repeat(5000) },
  ];
  for (const spec of badSpecs) {
    const r = expr.grade({ answer: "x", spec, maxPoints: 5 });
    assert.equal(r.verdict, "error", JSON.stringify(spec)?.slice(0, 50));
    assert.equal(r.reason, "invalid_spec");
  }
  assert.equal(num.grade({ answer: "1", spec: { expected: NaN, tolerance: { abs: 0, rel: 0 } }, maxPoints: 1 }).reason, "invalid_spec");
  assert.equal(num.grade({ answer: "1", spec: { expected: 1 }, maxPoints: 1 }).reason, "invalid_spec");
  assert.equal(expr.grade({ answer: "x", spec: exprSpec, maxPoints: -1 }).reason, "invalid_spec");
  assert.equal(expr.grade({ answer: "x", spec: exprSpec, maxPoints: NaN }).reason, "invalid_spec");
});

test("规格里的原型污染字段不影响判定", () => {
  const spec = JSON.parse('{"expected":"2x+2","variables":[{"name":"x","min":-5,"max":5}],"seed":7,"__proto__":{"seed":1}}');
  assert.equal(expr.grade({ answer: "2x+2", spec, maxPoints: 1 }).verdict, "correct");
});
