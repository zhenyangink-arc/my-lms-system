/**
 * Restricted compiler: turns a validated IR tree into a tree of plain JavaScript closures.
 *
 * - No `eval`, no `Function` constructor, no math.js `compile`/`evaluate`.
 * - Every operation is either a JS arithmetic operator on numbers or one of the
 *   implementations in `functions.ts`, so the result is always a JS `number`.
 * - Symbol values are read once per call from OWN DATA properties of the scope object;
 *   inherited properties, getters and non-number values are never used.
 */
import {
  EVALUATION_ERROR_CODES,
  EXPRESSION_ERROR_CODES,
  ExpressionEvaluationError,
  makeError,
  type ExpressionError,
} from "./errors.ts";
import { CONSTANT_VALUES, lookupFunctionSpec, realPow } from "./functions.ts";
import type { ExprNode } from "./ir.ts";
import { exprToTex } from "./tex.ts";
import { analyzeExpression, type ExpressionInfo, type ExpressionOptions } from "./validate.ts";

/** Values for the symbols used by an expression, e.g. `{ x: 1.5, a: 2 }`. */
export type EvaluationScope = Readonly<Record<string, number>>;

export interface CompiledExpression {
  readonly ok: true;
  /** The original source string. */
  readonly source: string;
  readonly info: ExpressionInfo;
  /** Declared names used by the expression (variables first, then parameters; declaration order). */
  readonly usedSymbols: readonly string[];
  /**
   * Evaluates the expression with real-number semantics. Every name in `usedSymbols`
   * must be an own data property of `scope` holding a primitive number; otherwise an
   * `ExpressionEvaluationError` is thrown. Other properties of `scope` are ignored.
   */
  evaluate(scope?: EvaluationScope): number;
  /** KaTeX-ready LaTeX generated from the validated tree (render with `trust: false`). */
  toTex(): string;
}

export type CompileResult =
  CompiledExpression | { readonly ok: false; readonly errors: readonly ExpressionError[] };

type Evaluator = (values: Float64Array) => number;

const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const hasOwn = Object.prototype.hasOwnProperty;
const EMPTY_VALUES = new Float64Array(0);

function compileNode(node: ExprNode, slots: ReadonlyMap<string, number>): Evaluator {
  switch (node.kind) {
    case "number": {
      const value = node.value;
      return () => value;
    }
    case "constant": {
      const value = CONSTANT_VALUES[node.name];
      return () => value;
    }
    case "symbol": {
      const slot = slots.get(node.name);
      if (slot === undefined) throw new Error(`internal: no slot for symbol ${node.name}`);
      return (values) => values[slot]!;
    }
    case "group":
      return compileNode(node.body, slots);
    case "unary": {
      const arg = compileNode(node.arg, slots);
      return node.op === "-" ? (values) => -arg(values) : arg;
    }
    case "binary": {
      const left = compileNode(node.left, slots);
      const right = compileNode(node.right, slots);
      switch (node.op) {
        case "+":
          return (values) => left(values) + right(values);
        case "-":
          return (values) => left(values) - right(values);
        case "*":
          return (values) => left(values) * right(values);
        case "/":
          return (values) => left(values) / right(values);
        case "^":
          return (values) => realPow(left(values), right(values));
      }
      throw new Error("internal: unknown binary operator");
    }
    case "call": {
      const spec = lookupFunctionSpec(node.fn);
      if (spec === undefined) throw new Error(`internal: unknown function ${node.fn}`);
      const args = node.args.map((arg) => compileNode(arg, slots));
      const impl = spec.impl;
      const [a, b, c, d] = args;
      if (impl.kind === "unary" && args.length === 1 && a !== undefined) {
        const fn = impl.fn;
        return (values) => fn(a(values));
      }
      if (impl.kind === "binary" && args.length === 2 && a !== undefined && b !== undefined) {
        const fn = impl.fn;
        return (values) => fn(a(values), b(values));
      }
      if (impl.kind === "fold" && a !== undefined && b !== undefined) {
        const fn = impl.fn;
        if (args.length === 2) return (values) => fn(a(values), b(values));
        if (args.length === 3 && c !== undefined) {
          return (values) => fn(fn(a(values), b(values)), c(values));
        }
        if (args.length === 4 && c !== undefined && d !== undefined) {
          return (values) => fn(fn(fn(a(values), b(values)), c(values)), d(values));
        }
      }
      throw new Error(`internal: bad arity for ${node.fn}`);
    }
  }
}

function readScopeValue(scope: unknown, name: string): number {
  if ((typeof scope !== "object" && typeof scope !== "function") || scope === null) {
    throw new ExpressionEvaluationError(
      EVALUATION_ERROR_CODES.MISSING_VARIABLE,
      name,
      `缺少变量 “${name}” 的取值：scope 必须是包含该属性的对象`,
    );
  }
  const descriptor = getOwnPropertyDescriptor(scope, name);
  if (descriptor === undefined) {
    throw new ExpressionEvaluationError(
      EVALUATION_ERROR_CODES.MISSING_VARIABLE,
      name,
      `缺少变量 “${name}” 的取值（只读取 scope 自身的属性，不读取原型链）`,
    );
  }
  if (!hasOwn.call(descriptor, "value")) {
    throw new ExpressionEvaluationError(
      EVALUATION_ERROR_CODES.INVALID_VARIABLE_VALUE,
      name,
      `变量 “${name}” 不能是访问器属性（getter/setter）`,
    );
  }
  const value: unknown = descriptor.value;
  if (typeof value !== "number") {
    throw new ExpressionEvaluationError(
      EVALUATION_ERROR_CODES.INVALID_VARIABLE_VALUE,
      name,
      `变量 “${name}” 的取值必须是 number 类型，实际为 ${typeof value}`,
    );
  }
  return value;
}

/**
 * Validates and compiles an expression. Never throws; on failure returns the same
 * structured errors as `validateExpression`.
 */
export function compileExpression(source: string, options?: ExpressionOptions): CompileResult {
  const analysis = analyzeExpression(source, options);
  if (!analysis.ok) return analysis;
  try {
    const { info, ir } = analysis;
    const usedSymbols = Object.freeze([...info.usedVariables, ...info.usedParameters]);
    const slots = new Map<string, number>();
    usedSymbols.forEach((name, index) => slots.set(name, index));
    const root = compileNode(ir, slots);
    const tex = exprToTex(ir);
    const count = usedSymbols.length;

    // A fresh buffer per call keeps evaluation re-entrant; constant expressions need none.
    const evaluate =
      count === 0
        ? (): number => root(EMPTY_VALUES)
        : (scope?: EvaluationScope): number => {
            const values = new Float64Array(count);
            for (let i = 0; i < count; i++) values[i] = readScopeValue(scope, usedSymbols[i]!);
            return root(values);
          };
    const toTex = (): string => tex;

    return Object.freeze({
      ok: true as const,
      source: source,
      info,
      usedSymbols,
      evaluate,
      toTex,
    });
  } catch {
    return {
      ok: false,
      errors: Object.freeze([
        makeError(EXPRESSION_ERROR_CODES.INTERNAL_ERROR, "表达式编译失败（内部错误）"),
      ]),
    };
  }
}
