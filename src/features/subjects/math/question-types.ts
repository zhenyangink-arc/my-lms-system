/**
 * 数学题型登记（纯逻辑，不碰数据库）：校验学生作答与判题规格的形状，并调用判题器给出建议得分。
 * 平台的题型登记契约（见 docs/question-type-grader-slot-design.md §4.1）落地前，先在学科内自成一体；
 * 规格来自数据库，一律当不可信数据严格解析。
 */
import { MAX_EXPRESSION_LENGTH } from "./vendor/math-core/limits.ts";
import {
  EXPRESSION_GRADER,
  NUMERIC_GRADER,
  gradeExpression,
  gradeNumeric,
  type Evidence,
  type ExpressionSpec,
  type NumericSpec,
  type Tolerance,
} from "./grading/equivalence.ts";

export type MathQuestionTypeKey = "math.expression" | "math.numeric";

export type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

export type MathGradeOutcome = {
  readonly verdict: "correct" | "incorrect" | "error";
  /** 建议得分；`error`（无法判定）时为 null，由教师人工批改。 */
  readonly suggestedPoints: number | null;
  readonly reason: string;
  readonly grader: { readonly key: string; readonly version: string };
  readonly evidence: Evidence;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail<T>(message: string): Parsed<T> {
  return { ok: false, message };
}

/** 作答只接受一行表达式文本：先限长再交给判题器，避免超长输入进入解析器。 */
export function parseMathAnswer(raw: unknown): Parsed<string> {
  if (typeof raw !== "string") return fail("作答必须是文本");
  const value = raw.trim();
  if (value.length === 0) return fail("作答不能为空");
  if (value.length > MAX_EXPRESSION_LENGTH) return fail(`作答不能超过 ${MAX_EXPRESSION_LENGTH} 个字符`);
  return { ok: true, value };
}

function parseTolerance(raw: unknown): Parsed<Tolerance> {
  if (!isRecord(raw)) return fail("容差必须是对象");
  const { abs, rel } = raw;
  if (typeof abs !== "number" || typeof rel !== "number" || !Number.isFinite(abs) || !Number.isFinite(rel) || abs < 0 || rel < 0) {
    return fail("容差 abs / rel 必须是非负有限数");
  }
  return { ok: true, value: { abs, rel } };
}

export function parseExpressionSpec(raw: unknown): Parsed<ExpressionSpec> {
  if (!isRecord(raw)) return fail("判题规格必须是对象");
  const { expected, variables, seed, tolerance, sampleCount, minValidPoints } = raw;
  if (typeof expected !== "string" || expected.length === 0 || expected.length > MAX_EXPRESSION_LENGTH) {
    return fail("expected 必须是长度合规的表达式");
  }
  if (!Array.isArray(variables) || variables.length === 0 || variables.length > 4) return fail("variables 需要 1 至 4 个变量");
  const parsedVariables: { name: string; min: number; max: number }[] = [];
  for (const v of variables) {
    if (!isRecord(v) || typeof v.name !== "string" || typeof v.min !== "number" || typeof v.max !== "number") {
      return fail("变量需要 name / min / max");
    }
    parsedVariables.push({ name: v.name, min: v.min, max: v.max });
  }
  if (typeof seed !== "number" || !Number.isInteger(seed)) return fail("seed 必须是整数");
  const spec: { -readonly [K in keyof ExpressionSpec]: ExpressionSpec[K] } = {
    expected,
    variables: parsedVariables,
    seed,
  };
  if (tolerance !== undefined) {
    const t = parseTolerance(tolerance);
    if (!t.ok) return t;
    spec.tolerance = t.value;
  }
  for (const [key, value] of [["sampleCount", sampleCount], ["minValidPoints", minValidPoints]] as const) {
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isInteger(value)) return fail(`${key} 必须是整数`);
    spec[key] = value;
  }
  // 变量名、取值范围、点数关系等细节由判题器按 invalid_spec 把关；这里用空作答探测，提前暴露规格错误。
  const probe = gradeExpression("0", spec);
  if (probe.verdict === "error" && probe.reason === "invalid_spec") return fail("判题规格不合法");
  return { ok: true, value: spec };
}

export function parseNumericSpec(raw: unknown): Parsed<NumericSpec> {
  if (!isRecord(raw)) return fail("判题规格必须是对象");
  const { expected, tolerance } = raw;
  if (typeof expected !== "number" || !Number.isFinite(expected)) return fail("expected 必须是有限数");
  const t = parseTolerance(tolerance);
  if (!t.ok) return t;
  return { ok: true, value: { expected, tolerance: t.value } };
}

function toOutcome(
  result: ReturnType<typeof gradeExpression>,
  grader: { readonly key: string; readonly version: string },
  maxPoints: number,
): MathGradeOutcome {
  const suggestedPoints = result.verdict === "correct" ? maxPoints : result.verdict === "incorrect" ? 0 : null;
  return { verdict: result.verdict, suggestedPoints, reason: result.reason, grader, evidence: result.evidence };
}

export type MathQuestionType = {
  readonly key: MathQuestionTypeKey;
  readonly gradingMode: "server";
  readonly parseAnswer: (raw: unknown) => Parsed<string>;
  /** 规格不合法或作答不合规时返回 error 结果（不抛异常、不给分）。 */
  readonly grade: (input: { answer: unknown; spec: unknown; maxPoints: number }) => MathGradeOutcome;
};

function invalid(
  grader: { readonly key: string; readonly version: string },
  reason: "invalid_answer" | "invalid_spec",
  message: string,
): MathGradeOutcome {
  return { verdict: "error", suggestedPoints: null, reason, grader, evidence: { message } };
}

function makeType<S>(
  key: MathQuestionTypeKey,
  grader: { readonly key: string; readonly version: string },
  parseSpec: (raw: unknown) => Parsed<S>,
  run: (answer: string, spec: S) => ReturnType<typeof gradeExpression>,
): MathQuestionType {
  return {
    key,
    gradingMode: "server",
    parseAnswer: parseMathAnswer,
    grade({ answer, spec, maxPoints }) {
      if (!Number.isFinite(maxPoints) || maxPoints < 0) return invalid(grader, "invalid_spec", "满分不合法");
      const parsedSpec = parseSpec(spec);
      if (!parsedSpec.ok) return invalid(grader, "invalid_spec", parsedSpec.message);
      const parsedAnswer = parseMathAnswer(answer);
      if (!parsedAnswer.ok) return invalid(grader, "invalid_answer", parsedAnswer.message);
      return toOutcome(run(parsedAnswer.value, parsedSpec.value), grader, maxPoints);
    },
  };
}

export const MATH_QUESTION_TYPES: Readonly<Record<MathQuestionTypeKey, MathQuestionType>> = {
  "math.expression": makeType("math.expression", EXPRESSION_GRADER, parseExpressionSpec, gradeExpression),
  "math.numeric": makeType("math.numeric", NUMERIC_GRADER, parseNumericSpec, gradeNumeric),
};
