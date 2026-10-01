/**
 * Function and constant whitelist, with the real-number implementations used by the
 * compiler. Every implementation is a plain `Math.*` call (captured once at module load)
 * or a small wrapper documented below. Nothing here can produce a non-number value.
 */
import { MAX_MINMAX_ARGS, MIN_MINMAX_ARGS } from "./limits.ts";

// Capture the intrinsics once, so later monkey-patching of `Math` cannot change results.
const {
  sin: mathSin,
  cos: mathCos,
  tan: mathTan,
  asin: mathAsin,
  acos: mathAcos,
  atan: mathAtan,
  sinh: mathSinh,
  cosh: mathCosh,
  tanh: mathTanh,
  sqrt: mathSqrt,
  cbrt: mathCbrt,
  abs: mathAbs,
  exp: mathExp,
  log: mathLog,
  log10: mathLog10,
  log2: mathLog2,
  floor: mathFloor,
  ceil: mathCeil,
  round: mathRound,
  sign: mathSign,
  min: mathMin,
  max: mathMax,
  pow: mathPow,
  PI: MATH_PI,
  E: MATH_E,
} = Math;

/**
 * Real power `a ^ b`.
 * - Negative base with a non-integer exponent → NaN (never a complex number), e.g. (-8)^(1/3).
 * - Unlike IEEE `pow`, an undefined (NaN) base stays undefined even for exponent 0:
 *   `Math.pow(NaN, 0) === 1` would make e.g. `sqrt(x)^0` "defined" at x = -1.
 * - 0^0 = 1 (IEEE / JavaScript convention).
 */
export function realPow(base: number, exponent: number): number {
  if (base !== base) return NaN;
  return mathPow(base, exponent);
}

/**
 * Rounds half away from zero (四舍五入 on the absolute value): round(2.5) = 3,
 * round(-2.5) = -3. `Math.round` alone rounds half towards +∞ (Math.round(-2.5) = -2).
 */
export function roundHalfAwayFromZero(x: number): number {
  return x < 0 ? -mathRound(-x) : mathRound(x);
}

/**
 * Logarithm of `x` to base `b`. The base must satisfy b > 0, b ≠ 1 and be finite,
 * otherwise NaN. Bases 10 and 2 use `Math.log10` / `Math.log2` for exact results
 * (e.g. log(1000, 10) === 3, whereas ln(1000)/ln(10) = 2.9999999999999996).
 */
export function logBase(x: number, b: number): number {
  if (!(b > 0) || b === 1 || b === Infinity) return NaN;
  if (b === 10) return mathLog10(x);
  if (b === 2) return mathLog2(x);
  return mathLog(x) / mathLog(b);
}

export const FUNCTION_NAMES = Object.freeze([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "sinh",
  "cosh",
  "tanh",
  "sqrt",
  "cbrt",
  "abs",
  "exp",
  "ln",
  "lg",
  "log",
  "log10",
  "log2",
  "floor",
  "ceil",
  "round",
  "sign",
  "min",
  "max",
] as const);

export type FunctionName = (typeof FUNCTION_NAMES)[number];

export type FunctionImplementation =
  | { readonly kind: "unary"; readonly fn: (x: number) => number }
  | { readonly kind: "binary"; readonly fn: (a: number, b: number) => number }
  /** Left fold of a binary function over 2..N arguments (NaN propagates). */
  | { readonly kind: "fold"; readonly fn: (a: number, b: number) => number };

export interface FunctionSpec {
  readonly name: FunctionName;
  readonly minArgs: number;
  readonly maxArgs: number;
  readonly impl: FunctionImplementation;
}

function unary(name: FunctionName, fn: (x: number) => number): FunctionSpec {
  return Object.freeze({
    name,
    minArgs: 1,
    maxArgs: 1,
    impl: Object.freeze({ kind: "unary", fn }),
  });
}

const minFold = (a: number, b: number): number => mathMin(a, b);
const maxFold = (a: number, b: number): number => mathMax(a, b);

const SPECS: ReadonlyMap<string, FunctionSpec> = new Map<string, FunctionSpec>([
  ["sin", unary("sin", mathSin)],
  ["cos", unary("cos", mathCos)],
  ["tan", unary("tan", mathTan)],
  ["asin", unary("asin", mathAsin)],
  ["acos", unary("acos", mathAcos)],
  ["atan", unary("atan", mathAtan)],
  ["sinh", unary("sinh", mathSinh)],
  ["cosh", unary("cosh", mathCosh)],
  ["tanh", unary("tanh", mathTanh)],
  ["sqrt", unary("sqrt", mathSqrt)],
  ["cbrt", unary("cbrt", mathCbrt)],
  ["abs", unary("abs", mathAbs)],
  ["exp", unary("exp", mathExp)],
  ["ln", unary("ln", mathLog)],
  ["lg", unary("lg", mathLog10)],
  ["log10", unary("log10", mathLog10)],
  ["log2", unary("log2", mathLog2)],
  ["floor", unary("floor", mathFloor)],
  ["ceil", unary("ceil", mathCeil)],
  ["round", unary("round", roundHalfAwayFromZero)],
  ["sign", unary("sign", mathSign)],
  [
    "log",
    Object.freeze({
      name: "log",
      minArgs: 2,
      maxArgs: 2,
      impl: Object.freeze({ kind: "binary", fn: logBase }),
    }),
  ],
  [
    "min",
    Object.freeze({
      name: "min",
      minArgs: MIN_MINMAX_ARGS,
      maxArgs: MAX_MINMAX_ARGS,
      impl: Object.freeze({ kind: "fold", fn: minFold }),
    }),
  ],
  [
    "max",
    Object.freeze({
      name: "max",
      minArgs: MIN_MINMAX_ARGS,
      maxArgs: MAX_MINMAX_ARGS,
      impl: Object.freeze({ kind: "fold", fn: maxFold }),
    }),
  ],
]);

/** Own-entry lookup only (a `Map`), so names like `constructor` or `__proto__` never match. */
export function lookupFunctionSpec(name: string): FunctionSpec | undefined {
  return SPECS.get(name);
}

export type ConstantName = "pi" | "e";

export const CONSTANT_VALUES: Readonly<Record<ConstantName, number>> = Object.freeze({
  pi: MATH_PI,
  e: MATH_E,
});

/** Source spellings of constants: `pi`, `π` (alias of `pi`) and `e`. */
const CONSTANT_SPELLINGS: ReadonlyMap<string, ConstantName> = new Map<string, ConstantName>([
  ["pi", "pi"],
  ["π", "pi"],
  ["e", "e"],
]);

export function lookupConstant(name: string): ConstantName | undefined {
  return CONSTANT_SPELLINGS.get(name);
}

export const CONSTANT_NAMES = Object.freeze(["pi", "π", "e"] as const);
