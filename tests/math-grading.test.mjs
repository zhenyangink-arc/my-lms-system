import assert from "node:assert/strict";
import { test } from "node:test";

import {
  gradeExpression,
  gradeNumeric,
} from "../src/features/subjects/math/grading/equivalence.ts";

const x = [{ name: "x", min: -5, max: 5 }];
const spec = (expected, extra = {}) => ({ expected, variables: x, seed: 20261001, ...extra });

test("等价的表达式判对，并带取点依据", () => {
  for (const answer of ["2x+2", "2(x+1)", "x+x+2", "2*x + 2"]) {
    const r = gradeExpression(answer, spec("2x+2"));
    assert.equal(r.verdict, "correct", answer);
  }
  const r = gradeExpression("2(x+1)", spec("2x+2"));
  assert.equal(r.evidence.points.length, 16);
  assert.equal(r.evidence.grader.key, "math.expression-equivalence");
});

test("不等价的表达式判错", () => {
  for (const answer of ["2x+1", "x^2", "2x+2.001", "-2x-2"]) {
    assert.equal(gradeExpression(answer, spec("2x+2")).verdict, "incorrect", answer);
  }
});

test("同一种子结果可重复，不同种子取点不同", () => {
  const a = gradeExpression("2x+2", spec("2(x+1)"));
  const b = gradeExpression("2x+2", spec("2(x+1)"));
  assert.deepEqual(a.evidence.points, b.evidence.points);
  const c = gradeExpression("2x+2", spec("2(x+1)", { seed: 1 }));
  assert.notDeepEqual(a.evidence.points, c.evidence.points);
});

test("一边有定义一边无定义判错；两边都无定义的点跳过", () => {
  // sqrt(x) 在 x<0 无定义，x^2 处处有定义
  assert.equal(gradeExpression("sqrt(x)", spec("x^2")).verdict, "incorrect");
  // 两边同样无定义：只在 x>0 的点比较
  const r = gradeExpression("sqrt(x)^2", spec("sqrt(x)^2", { minValidPoints: 4 }));
  assert.equal(r.verdict, "correct");
});

test("取值范围内有效点不足时无法判定", () => {
  const r = gradeExpression("sqrt(x)", {
    expected: "sqrt(x)",
    variables: [{ name: "x", min: -100, max: -50 }],
    seed: 3,
  });
  assert.equal(r.verdict, "error");
  assert.equal(r.reason, "insufficient_valid_points");
});

test("语法错误、未知符号、超长、恶意输入：无法判定而不是抛异常", () => {
  const bad = [
    "2x+",
    "y+1",
    "x".repeat(500),
    "constructor",
    "__proto__",
    "process.exit(1)",
    "this.constructor.constructor('return 1')()",
    "x; 1",
    "x = 2",
    "[1,2]",
    "２x",
    "(".repeat(5000),
    "",
    "   ",
    "1e309",
  ];
  for (const answer of bad) {
    const r = gradeExpression(answer, spec("2x+2"));
    assert.equal(r.verdict, "error", JSON.stringify(answer).slice(0, 40));
    assert.equal(r.reason, "invalid_answer");
  }
  for (const nonString of [null, undefined, 3, {}, []]) {
    assert.equal(gradeExpression(nonString, spec("2x+2")).verdict, "error");
  }
});

test("题目规格不合法时报 invalid_spec", () => {
  assert.equal(gradeExpression("x", spec("y")).reason, "invalid_spec");
  assert.equal(gradeExpression("x", spec("x", { tolerance: { abs: -1, rel: 0 } })).reason, "invalid_spec");
  assert.equal(gradeExpression("x", spec("x", { sampleCount: 4, minValidPoints: 9 })).reason, "invalid_spec");
  assert.equal(
    gradeExpression("x", { expected: "x", variables: [{ name: "x", min: 2, max: 1 }], seed: 1 }).reason,
    "invalid_spec",
  );
  assert.equal(gradeExpression("x", spec("x", { seed: 1.5 })).reason, "invalid_spec");
});

test("采样点数有上限", () => {
  const r = gradeExpression("x", spec("x", { sampleCount: 100000, minValidPoints: 8 }));
  assert.equal(r.evidence.points.length, 64);
});

test("数值题：1/3 与 0.333 按误差判断", () => {
  const tol = { abs: 1e-3, rel: 0 };
  assert.equal(gradeNumeric("0.333", { expected: 1 / 3, tolerance: tol }).verdict, "correct");
  assert.equal(gradeNumeric("1/3", { expected: 0.333, tolerance: tol }).verdict, "correct");
  assert.equal(gradeNumeric("0.33", { expected: 1 / 3, tolerance: tol }).verdict, "incorrect");
  assert.equal(gradeNumeric("2^10", { expected: 1024, tolerance: { abs: 0, rel: 0 } }).verdict, "correct");
});

test("数值题：不允许变量、非有限值与恶意输入", () => {
  const spec = { expected: 1, tolerance: { abs: 0.1, rel: 0 } };
  for (const answer of ["x", "1/0", "ln(0)", "sqrt(-1)", "alert(1)", "1;2", ""]) {
    assert.equal(gradeNumeric(answer, spec).verdict, "error", answer);
  }
  assert.equal(gradeNumeric("1", { expected: NaN, tolerance: spec.tolerance }).reason, "invalid_spec");
  assert.equal(gradeNumeric("1", { expected: 1, tolerance: { abs: -1, rel: 0 } }).reason, "invalid_spec");
});
