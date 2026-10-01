/**
 * 数学答案的确定性判题器（纯函数，不碰数据库）。
 *
 * - 表达式题：在变量取值范围内用固定种子取点，代入后按误差比较，判断两式是否等价。
 * - 数值题：把作答当作无变量表达式求值（`1/3`、`0.333` 都可以），按误差比较。
 * 每次判定都返回依据（取点与两边的值），供教师复核。判题器本身不依赖 LLM。
 */
import { compileExpression, type CompiledExpression } from "../vendor/math-core/compile.ts";

export const EXPRESSION_GRADER = { key: "math.expression-equivalence", version: "1.0.0" } as const;
export const NUMERIC_GRADER = { key: "math.numeric", version: "1.0.0" } as const;

export type VariableRange = { readonly name: string; readonly min: number; readonly max: number };

export type Tolerance = { readonly abs: number; readonly rel: number };

export const DEFAULT_TOLERANCE: Tolerance = { abs: 1e-9, rel: 1e-9 };
const DEFAULT_SAMPLE_COUNT = 16;
const DEFAULT_MIN_VALID_POINTS = 8;
const MAX_SAMPLE_COUNT = 64;

export type SamplePoint = {
  readonly scope: Readonly<Record<string, number>>;
  readonly answer: number | null;
  readonly expected: number | null;
};

export type GradeResult =
  | { readonly verdict: "correct" | "incorrect"; readonly reason: string; readonly evidence: Evidence }
  /** 作答无法判定（语法、符号、采样点不足）；不等于答错，由调用方决定提示或转人工。 */
  | { readonly verdict: "error"; readonly reason: string; readonly evidence: Evidence };

export type Evidence = Readonly<Record<string, unknown>>;

/** mulberry32：小而确定的伪随机数发生器。 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function close(a: number, b: number, tol: Tolerance): boolean {
  return Math.abs(a - b) <= tol.abs + tol.rel * Math.max(Math.abs(a), Math.abs(b));
}

function safeEvaluate(fn: CompiledExpression, scope: Readonly<Record<string, number>>): number | null {
  try {
    const value = fn.evaluate(scope);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function validateTolerance(tol: Tolerance): boolean {
  return Number.isFinite(tol.abs) && Number.isFinite(tol.rel) && tol.abs >= 0 && tol.rel >= 0;
}

export type ExpressionSpec = {
  /** 标准答案表达式。 */
  readonly expected: string;
  readonly variables: readonly VariableRange[];
  readonly tolerance?: Tolerance;
  readonly seed: number;
  readonly sampleCount?: number;
  /** 两边都有定义的点至少要有这么多，否则无法判定。 */
  readonly minValidPoints?: number;
};

export function gradeExpression(answerSource: string, spec: ExpressionSpec): GradeResult {
  const tolerance = spec.tolerance ?? DEFAULT_TOLERANCE;
  const sampleCount = Math.min(spec.sampleCount ?? DEFAULT_SAMPLE_COUNT, MAX_SAMPLE_COUNT);
  const minValid = spec.minValidPoints ?? DEFAULT_MIN_VALID_POINTS;
  const base = { grader: EXPRESSION_GRADER, seed: spec.seed, tolerance };

  if (
    !validateTolerance(tolerance) ||
    !Number.isInteger(spec.seed) ||
    !Number.isInteger(sampleCount) ||
    sampleCount < 1 ||
    !Number.isInteger(minValid) ||
    minValid < 1 ||
    minValid > sampleCount ||
    spec.variables.some((v) => !(Number.isFinite(v.min) && Number.isFinite(v.max) && v.min < v.max))
  ) {
    return { verdict: "error", reason: "invalid_spec", evidence: base };
  }

  const options = { variables: spec.variables.map((v) => v.name) };
  const expected = compileExpression(spec.expected, options);
  if (!expected.ok) {
    return { verdict: "error", reason: "invalid_spec", evidence: { ...base, errors: expected.errors } };
  }
  const answer = compileExpression(answerSource, options);
  if (!answer.ok) {
    return { verdict: "error", reason: "invalid_answer", evidence: { ...base, errors: answer.errors } };
  }

  const rng = makeRng(spec.seed);
  const points: SamplePoint[] = [];
  let validPoints = 0;
  let firstMismatch: SamplePoint | null = null;
  for (let i = 0; i < sampleCount; i += 1) {
    const scope: Record<string, number> = {};
    for (const v of spec.variables) scope[v.name] = v.min + (v.max - v.min) * rng();
    const a = safeEvaluate(answer, scope);
    const e = safeEvaluate(expected, scope);
    const point: SamplePoint = { scope, answer: a, expected: e };
    points.push(point);
    if (a === null && e === null) continue; // 两边都无定义：跳过
    if (a === null || e === null || !close(a, e, tolerance)) {
      firstMismatch ??= point;
      continue;
    }
    validPoints += 1;
  }
  const evidence = { ...base, points, validPoints, firstMismatch };
  if (firstMismatch) return { verdict: "incorrect", reason: "value_mismatch", evidence };
  if (validPoints < minValid) return { verdict: "error", reason: "insufficient_valid_points", evidence };
  return { verdict: "correct", reason: "equivalent_on_samples", evidence };
}

export type NumericSpec = {
  readonly expected: number;
  readonly tolerance: Tolerance;
};

export function gradeNumeric(answerSource: string, spec: NumericSpec): GradeResult {
  const base = { grader: NUMERIC_GRADER, tolerance: spec.tolerance, expected: spec.expected };
  if (!Number.isFinite(spec.expected) || !validateTolerance(spec.tolerance)) {
    return { verdict: "error", reason: "invalid_spec", evidence: base };
  }
  const answer = compileExpression(answerSource, {});
  if (!answer.ok) {
    return { verdict: "error", reason: "invalid_answer", evidence: { ...base, errors: answer.errors } };
  }
  const value = safeEvaluate(answer, {});
  if (value === null) return { verdict: "error", reason: "invalid_answer", evidence: { ...base, value } };
  const evidence = { ...base, value };
  return close(value, spec.expected, spec.tolerance)
    ? { verdict: "correct", reason: "within_tolerance", evidence }
    : { verdict: "incorrect", reason: "out_of_tolerance", evidence };
}
