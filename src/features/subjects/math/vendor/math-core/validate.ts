/**
 * Expression validation pipeline:
 *
 *   type check → length limit (before parsing) → declarations → empty check
 *   → lexical gate → math.js `parse` → AST depth / node limits → AST whitelist → IR
 *
 * The math.js AST is treated as untrusted data. The whitelist checker reads only the
 * fields it needs, re-validates their types, and converts accepted nodes into the closed
 * IR defined in `ir.ts`. Anything it does not recognise is rejected (fail closed).
 *
 * No function in this module throws for any input; unexpected failures are reported as
 * `INTERNAL_ERROR`.
 */
import {
  EXPRESSION_ERROR_CODES,
  makeError,
  type ExpressionError,
  type ExpressionErrorCode,
} from "./errors.ts";
import {
  FUNCTION_NAMES,
  lookupConstant,
  lookupFunctionSpec,
  type ConstantName,
  type FunctionName,
} from "./functions.ts";
import type { BinaryOperator, ExprNode, SymbolRole } from "./ir.ts";
import { scanExpression, type IdentifierToken } from "./lexer.ts";
import {
  MAX_AST_DEPTH,
  MAX_AST_NODES,
  MAX_DECLARED_SYMBOLS,
  MAX_EXPRESSION_LENGTH,
  MAX_REPORTED_ERRORS,
  MAX_SYMBOL_NAME_LENGTH,
} from "./limits.ts";
import { parseWithMathJs } from "./parser.ts";

/** Names that may be used in an expression besides the whitelisted constants. */
export interface ExpressionOptions {
  /** Independent variable names, e.g. `["x"]`. */
  readonly variables?: readonly string[];
  /** Parameter names (slider ids), e.g. `["a", "b", "c"]`. */
  readonly parameters?: readonly string[];
}

export interface ExpressionInfo {
  /** Number of AST nodes (see `MAX_AST_NODES` for what is counted). */
  readonly nodeCount: number;
  /** AST depth; the root has depth 1 (see `MAX_AST_DEPTH`). */
  readonly depth: number;
  /** Declared variables that occur in the expression, in declaration order. */
  readonly usedVariables: readonly string[];
  /** Declared parameters that occur in the expression, in declaration order. */
  readonly usedParameters: readonly string[];
  /** Whitelisted functions that occur in the expression, sorted. */
  readonly usedFunctions: readonly FunctionName[];
  /** Constants that occur in the expression (`π` is reported as `pi`), sorted. */
  readonly usedConstants: readonly ConstantName[];
}

export type ValidationResult =
  | { readonly ok: true; readonly info: ExpressionInfo }
  | { readonly ok: false; readonly errors: readonly ExpressionError[] };

/** Internal result that also carries the validated IR for the compiler. */
export type AnalysisResult =
  | {
      readonly ok: true;
      readonly info: ExpressionInfo;
      readonly ir: ExprNode;
    }
  | { readonly ok: false; readonly errors: readonly ExpressionError[] };

// ---------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------

/** Pattern for declared variable / parameter names: ASCII letter, then letters, digits, `_`. */
export const SYMBOL_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Names that cannot be declared: whitelisted functions and constants, math.js keywords
 * and literal names, and JavaScript object-prototype property names.
 */
const RESERVED_NAMES: ReadonlySet<string> = new Set<string>([
  ...FUNCTION_NAMES,
  "pi",
  "e",
  "mod",
  "to",
  "in",
  "and",
  "or",
  "xor",
  "not",
  "true",
  "false",
  "null",
  "undefined",
  "NaN",
  "Infinity",
  "end",
  "constructor",
  "prototype",
  "__proto__",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toString",
  "toLocaleString",
  "valueOf",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);

/** `e1`, `E2x`, ... would collide with scientific notation (`2e1` is 20, not 2·e1). */
const SCIENTIFIC_LIKE_NAME = /^[eE][0-9]/;

function symbolNameProblem(name: unknown): string | null {
  if (typeof name !== "string") return "名称必须是字符串";
  if (name.length === 0) return "名称不能为空";
  if (name.length > MAX_SYMBOL_NAME_LENGTH) return `名称长度不能超过 ${MAX_SYMBOL_NAME_LENGTH}`;
  if (!SYMBOL_NAME_PATTERN.test(name)) {
    return "名称只能由英文字母开头，后接英文字母、数字或下划线";
  }
  if (RESERVED_NAMES.has(name)) return "该名称是保留字（函数名、常数名、关键字或对象原型属性）";
  if (SCIENTIFIC_LIKE_NAME.test(name)) {
    return "以 e/E 加数字开头的名称会与科学计数法冲突（例如 2e1 表示 20）";
  }
  return null;
}

/** Whether `name` can be declared as a variable or parameter. */
export function isValidSymbolName(name: string): boolean {
  return symbolNameProblem(name) === null;
}

interface DeclaredSymbols {
  readonly variables: readonly string[];
  readonly parameters: readonly string[];
  readonly roles: ReadonlyMap<string, SymbolRole>;
}

type DeclarationResult =
  | { readonly ok: true; readonly symbols: DeclaredSymbols }
  | { readonly ok: false; readonly errors: readonly ExpressionError[] };

const hasOwn = Object.prototype.hasOwnProperty;

/** Reads an own data property only, so a polluted `Object.prototype` cannot inject names. */
function readOwn(object: object, key: string): unknown {
  if (!hasOwn.call(object, key)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && hasOwn.call(descriptor, "value")
    ? descriptor.value
    : undefined;
}

function checkDeclarations(options: unknown): DeclarationResult {
  if (options === undefined) {
    return { ok: true, symbols: { variables: [], parameters: [], roles: new Map() } };
  }
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    return fail(
      EXPRESSION_ERROR_CODES.INVALID_ARGUMENT,
      "options 必须是 { variables?: string[], parameters?: string[] } 形式的对象",
    );
  }
  const errors: ExpressionError[] = [];
  const roles = new Map<string, SymbolRole>();
  const lists: Record<SymbolRole, string[]> = { variable: [], parameter: [] };
  let total = 0;
  for (const [key, role, label] of [
    ["variables", "variable", "自变量"],
    ["parameters", "parameter", "参数"],
  ] as const) {
    const list = readOwn(options, key);
    if (list === undefined) continue;
    if (!Array.isArray(list)) {
      errors.push(makeError(EXPRESSION_ERROR_CODES.INVALID_ARGUMENT, `${key} 必须是字符串数组`));
      continue;
    }
    total += list.length;
    if (total > MAX_DECLARED_SYMBOLS) {
      errors.push(
        makeError(
          EXPRESSION_ERROR_CODES.INVALID_DECLARATION,
          `声明的自变量与参数总数不能超过 ${MAX_DECLARED_SYMBOLS}`,
        ),
      );
      break;
    }
    for (let index = 0; index < list.length; index++) {
      const name: unknown = list[index];
      const problem = symbolNameProblem(name);
      const shown = typeof name === "string" ? name : String(typeof name);
      if (problem !== null) {
        errors.push(
          makeError(
            EXPRESSION_ERROR_CODES.INVALID_DECLARATION,
            `${label}名称 “${shown}” 无效：${problem}`,
            { symbol: shown },
          ),
        );
        continue;
      }
      const valid = name as string;
      if (roles.has(valid)) {
        errors.push(
          makeError(
            EXPRESSION_ERROR_CODES.INVALID_DECLARATION,
            `名称 “${valid}” 被重复声明（自变量与参数不能同名）`,
            { symbol: valid },
          ),
        );
        continue;
      }
      roles.set(valid, role);
      lists[role].push(valid);
    }
  }
  if (errors.length > 0) return { ok: false, errors: freezeErrors(errors) };
  return {
    ok: true,
    symbols: {
      variables: Object.freeze(lists.variable),
      parameters: Object.freeze(lists.parameter),
      roles,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freezeErrors(errors: readonly ExpressionError[]): readonly ExpressionError[] {
  return Object.freeze(errors.slice(0, MAX_REPORTED_ERRORS));
}

function fail(
  code: ExpressionErrorCode,
  message: string,
  extra?: { readonly position?: number | undefined; readonly symbol?: string | undefined },
): { readonly ok: false; readonly errors: readonly ExpressionError[] } {
  return { ok: false, errors: freezeErrors([makeError(code, message, extra)]) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nodeType(node: unknown): string | undefined {
  if (!isRecord(node)) return undefined;
  const type = node["type"];
  return typeof type === "string" ? type : undefined;
}

function nodeArgs(node: Record<string, unknown>): readonly unknown[] | undefined {
  const args = node["args"];
  return Array.isArray(args) ? (args as readonly unknown[]) : undefined;
}

/** Children of the node kinds that can be part of a valid expression. */
function childrenOf(node: unknown): readonly unknown[] {
  if (!isRecord(node)) return [];
  switch (nodeType(node)) {
    case "OperatorNode":
    case "FunctionNode":
      return nodeArgs(node) ?? [];
    case "ParenthesisNode":
      return [node["content"]];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

type MeasureResult =
  | { readonly ok: true; readonly nodeCount: number; readonly depth: number }
  | { readonly ok: false; readonly errors: readonly ExpressionError[] };

/**
 * Counts nodes and depth with early exit, so recursion never goes deeper than
 * `MAX_AST_DEPTH + 1` and never visits more than `MAX_AST_NODES + 1` nodes.
 */
function measure(root: unknown): MeasureResult {
  let count = 0;
  let maxDepth = 0;
  let exceeded: "depth" | "nodes" | null = null;
  const visit = (node: unknown, depth: number): void => {
    if (exceeded !== null) return;
    if (depth > MAX_AST_DEPTH) {
      exceeded = "depth";
      return;
    }
    count++;
    if (count > MAX_AST_NODES) {
      exceeded = "nodes";
      return;
    }
    if (depth > maxDepth) maxDepth = depth;
    for (const child of childrenOf(node)) visit(child, depth + 1);
  };
  visit(root, 1);
  if (exceeded === "depth") {
    return fail(
      EXPRESSION_ERROR_CODES.EXPR_TOO_DEEP,
      `表达式嵌套过深：语法树深度超过上限 ${MAX_AST_DEPTH}`,
    );
  }
  if (exceeded === "nodes") {
    return fail(
      EXPRESSION_ERROR_CODES.EXPR_TOO_MANY_NODES,
      `表达式过于复杂：语法树节点数超过上限 ${MAX_AST_NODES}`,
    );
  }
  return { ok: true, nodeCount: count, depth: maxDepth };
}

// ---------------------------------------------------------------------------
// Whitelist conversion
// ---------------------------------------------------------------------------

const BINARY_OPERATORS: ReadonlyMap<string, BinaryOperator> = new Map<string, BinaryOperator>([
  ["add", "+"],
  ["subtract", "-"],
  ["multiply", "*"],
  ["divide", "/"],
  ["pow", "^"],
]);

const FORBIDDEN_NODE_DESCRIPTIONS: ReadonlyMap<string, string> = new Map([
  ["AssignmentNode", "赋值"],
  ["FunctionAssignmentNode", "函数定义"],
  ["AccessorNode", "属性访问或下标访问"],
  ["IndexNode", "下标"],
  ["ArrayNode", "数组或矩阵"],
  ["ObjectNode", "对象"],
  ["RangeNode", "区间"],
  ["ConditionalNode", "条件表达式"],
  ["BlockNode", "多条语句"],
  ["RelationalNode", "连续比较"],
]);

function describeOperator(op: string): string {
  switch (op) {
    case "mod":
    case "%":
      return "取模运算";
    case "and":
    case "or":
    case "xor":
    case "not":
      return "逻辑运算";
    case "&":
    case "|":
    case "^|":
    case "~":
    case "<<":
    case ">>":
    case ">>>":
      return "位运算";
    case "==":
    case "!=":
    case "<":
    case ">":
    case "<=":
    case ">=":
      return "比较运算";
    case "!":
      return "阶乘";
    case "'":
      return "转置";
    case "to":
    case "in":
      return "单位换算";
    case ".*":
    case "./":
    case ".^":
      return "逐元素（点）运算";
    case "??":
      return "空值合并运算";
    default:
      return "运算符";
  }
}

const NAMED_OPERATORS: ReadonlySet<string> = new Set([
  "mod",
  "and",
  "or",
  "xor",
  "not",
  "to",
  "in",
]);

function rightmostFactor(node: ExprNode): ExprNode {
  let current = node;
  for (;;) {
    if (current.kind === "binary" && current.op === "*" && current.implicit) {
      current = current.right;
    } else if (current.kind === "unary") {
      current = current.arg;
    } else {
      return current;
    }
  }
}

class Converter {
  readonly errors: ExpressionError[] = [];
  private readonly errorKeys = new Set<string>();
  readonly usedSymbols = new Set<string>();
  readonly usedFunctions = new Set<FunctionName>();
  readonly usedConstants = new Set<ConstantName>();

  private readonly symbols: DeclaredSymbols;
  private readonly identifiers: readonly IdentifierToken[];

  constructor(symbols: DeclaredSymbols, identifiers: readonly IdentifierToken[]) {
    this.symbols = symbols;
    this.identifiers = identifiers;
  }

  private report(
    code: ExpressionErrorCode,
    message: string,
    extra?: { readonly position?: number | undefined; readonly symbol?: string | undefined },
  ): null {
    const key = `${code}\u0000${extra?.symbol ?? ""}\u0000${message}`;
    if (!this.errorKeys.has(key) && this.errors.length < MAX_REPORTED_ERRORS) {
      this.errorKeys.add(key);
      this.errors.push(makeError(code, message, extra));
    }
    return null;
  }

  private positionOf(name: string, callee: boolean | null): number | undefined {
    for (const token of this.identifiers) {
      if (token.name === name && (callee === null || token.callee === callee)) return token.start;
    }
    return undefined;
  }

  private availableSymbols(): string {
    return [...this.symbols.variables, ...this.symbols.parameters, "pi", "e"].join(", ");
  }

  convert(node: unknown): ExprNode | null {
    if (!isRecord(node)) {
      return this.report(EXPRESSION_ERROR_CODES.FORBIDDEN_NODE, "表达式包含无法识别的节点");
    }
    const type = nodeType(node);
    switch (type) {
      case "ConstantNode":
        return this.convertConstant(node);
      case "SymbolNode":
        return this.convertSymbol(node);
      case "ParenthesisNode": {
        const body = this.convert(node["content"]);
        return body === null ? null : Object.freeze({ kind: "group", body });
      }
      case "OperatorNode":
        return this.convertOperator(node);
      case "FunctionNode":
        return this.convertCall(node);
      default: {
        const shownType = type ?? "unknown";
        const description = FORBIDDEN_NODE_DESCRIPTIONS.get(shownType) ?? "不支持的语法";
        return this.report(
          EXPRESSION_ERROR_CODES.FORBIDDEN_NODE,
          `不允许的语法：${description}（${shownType}）。只允许数字、已声明的符号、+ - * / ^、括号和白名单函数`,
          { symbol: shownType },
        );
      }
    }
  }

  private convertConstant(node: Record<string, unknown>): ExprNode | null {
    const value = node["value"];
    if (typeof value === "number") {
      if (Number.isFinite(value)) return Object.freeze({ kind: "number", value });
      return this.report(
        EXPRESSION_ERROR_CODES.NON_FINITE_LITERAL,
        `数字常量必须是有限值，实际为 ${String(value)}（例如 1e309 超出了浮点数范围）`,
        { symbol: String(value) },
      );
    }
    const kind =
      typeof value === "string"
        ? "字符串"
        : typeof value === "boolean"
          ? "布尔值"
          : value === null || value === undefined
            ? "空值"
            : "非数字常量";
    return this.report(
      EXPRESSION_ERROR_CODES.FORBIDDEN_NODE,
      `不允许的常量：${kind}。表达式中的常量只能是有限的数字`,
      { symbol: "ConstantNode" },
    );
  }

  private convertSymbol(node: Record<string, unknown>): ExprNode | null {
    const name = node["name"];
    if (typeof name !== "string") {
      return this.report(EXPRESSION_ERROR_CODES.FORBIDDEN_NODE, "符号名称无效", {
        symbol: "SymbolNode",
      });
    }
    const role = this.symbols.roles.get(name);
    if (role !== undefined) {
      this.usedSymbols.add(name);
      return Object.freeze({ kind: "symbol", name, role });
    }
    const constant = lookupConstant(name);
    if (constant !== undefined) {
      this.usedConstants.add(constant);
      return Object.freeze({ kind: "constant", name: constant });
    }
    const position = this.positionOf(name, false) ?? this.positionOf(name, null);
    if (NAMED_OPERATORS.has(name)) {
      return this.report(
        EXPRESSION_ERROR_CODES.UNKNOWN_SYMBOL,
        `“${name}” 是保留的运算符关键字，不能作为符号使用`,
        { position, symbol: name },
      );
    }
    let hint = `可用符号：${this.availableSymbols()}`;
    if (lookupFunctionSpec(name) !== undefined) {
      hint = `“${name}” 是函数，调用时必须带括号，例如 ${name}(x)`;
    } else if (name.length > 1 && name.includes("π")) {
      hint = "π 与相邻的字母之间需要乘号，例如 2*π*x";
    } else if (name.length > 1 && this.looksLikeProduct(name)) {
      hint = `若表示乘积，请用 * 分隔各个因子（例如 ${name.split("").join("*")}）；可用符号：${this.availableSymbols()}`;
    }
    return this.report(
      EXPRESSION_ERROR_CODES.UNKNOWN_SYMBOL,
      `未知符号 “${name}”：既不是已声明的自变量或参数，也不是常数 pi、e。${hint}`,
      { position, symbol: name },
    );
  }

  private looksLikeProduct(name: string): boolean {
    for (const ch of name) {
      if (ch >= "0" && ch <= "9") continue;
      if (!this.symbols.roles.has(ch) && ch !== "e") return false;
    }
    return true;
  }

  private convertOperator(node: Record<string, unknown>): ExprNode | null {
    const op = node["op"];
    const fn = node["fn"];
    const args = nodeArgs(node);
    const shownOp = typeof op === "string" ? op : "?";
    const forbidden = (): null =>
      this.report(
        EXPRESSION_ERROR_CODES.FORBIDDEN_NODE,
        `不允许的运算符 “${shownOp}”（${describeOperator(shownOp)}）。只允许 + - * / ^ 以及一元 + -`,
        {
          position: NAMED_OPERATORS.has(shownOp) ? this.positionOf(shownOp, null) : undefined,
          symbol: shownOp,
        },
      );
    if (typeof op !== "string" || typeof fn !== "string" || args === undefined) return forbidden();
    if (node["isPercentage"] === true) return forbidden();
    const implicit = node["implicit"] === true;

    if (args.length === 1 && !implicit) {
      if ((fn === "unaryMinus" && op === "-") || (fn === "unaryPlus" && op === "+")) {
        const arg = this.convert(args[0]);
        return arg === null ? null : Object.freeze({ kind: "unary", op, arg });
      }
      return forbidden();
    }

    const binary = BINARY_OPERATORS.get(fn);
    if (args.length !== 2 || binary === undefined || binary !== op) return forbidden();
    if (implicit && binary !== "*") return forbidden();

    const left = this.convert(args[0]);
    const right = this.convert(args[1]);
    if (left === null || right === null) return null;
    const result: ExprNode = Object.freeze({ kind: "binary", op: binary, left, right, implicit });
    this.checkAmbiguity(result);
    return result;
  }

  /**
   * Rejects implicit multiplication next to `/` or `^`, where the linear notation has
   * no universally agreed reading:
   *   A. `x/2y`  — math.js: x/(2y);  also read as (x/2)·y
   *   B. `1/2x`  — math.js: (1/2)·x; also read as 1/(2x)
   *   C. `e^2x`  — math.js: (e^2)·x; also read as e^(2x)
   */
  private checkAmbiguity(node: ExprNode): void {
    if (node.kind !== "binary") return;
    const code = EXPRESSION_ERROR_CODES.AMBIGUOUS_IMPLICIT_MULTIPLICATION;
    if (node.op === "/" && node.right.kind === "binary" && node.right.implicit) {
      this.report(
        code,
        "除号右侧紧跟隐式乘法（如 x/2y），无法确定是 x/(2y) 还是 (x/2)·y。请加括号或使用显式乘号 *",
        { symbol: "/" },
      );
      return;
    }
    if (node.op === "*" && node.implicit) {
      const factor = rightmostFactor(node.left);
      if (factor.kind === "binary" && factor.op === "/") {
        this.report(
          code,
          "分数后紧跟隐式乘法（如 1/2x），无法确定是 (1/2)·x 还是 1/(2x)。请写成 (1/2)*x、x/2 或 1/(2*x)",
          { symbol: "/" },
        );
      } else if (factor.kind === "binary" && factor.op === "^") {
        this.report(
          code,
          "乘方后紧跟隐式乘法（如 e^2x 或 x^2y），无法确定指数的范围。请写成 e^(2*x) 或 e^2*x",
          { symbol: "^" },
        );
      }
    }
  }

  private convertCall(node: Record<string, unknown>): ExprNode | null {
    const callee = node["fn"];
    const args = nodeArgs(node);
    if (node["optional"] === true || args === undefined) {
      return this.report(EXPRESSION_ERROR_CODES.FORBIDDEN_NODE, "不允许的函数调用形式", {
        symbol: "FunctionNode",
      });
    }
    if (
      !isRecord(callee) ||
      nodeType(callee) !== "SymbolNode" ||
      typeof callee["name"] !== "string"
    ) {
      // e.g. `obj.fn(x)`: the callee is an accessor, not a plain function name.
      this.convert(callee);
      for (const arg of args) this.convert(arg);
      return this.report(
        EXPRESSION_ERROR_CODES.FORBIDDEN_NODE,
        "只允许直接调用白名单函数（如 sin(x)）",
        { symbol: "FunctionNode" },
      );
    }
    const name = callee["name"];
    const position = this.positionOf(name, true) ?? this.positionOf(name, null);
    const spec = lookupFunctionSpec(name);
    if (spec === undefined) {
      for (const arg of args) this.convert(arg);
      let hint = `可用函数：${FUNCTION_NAMES.join(" ")}`;
      if (this.symbols.roles.has(name) || lookupConstant(name) !== undefined) {
        hint = `“${name}” 不是函数；若表示乘法，请写成 ${name}*(…)`;
      }
      return this.report(EXPRESSION_ERROR_CODES.UNKNOWN_FUNCTION, `未知函数 “${name}”。${hint}`, {
        position,
        symbol: name,
      });
    }
    const converted: ExprNode[] = [];
    let failed = false;
    for (const arg of args) {
      const result = this.convert(arg);
      if (result === null) failed = true;
      else converted.push(result);
    }
    if (spec.name === "log" && args.length === 1) {
      return this.report(
        EXPRESSION_ERROR_CODES.AMBIGUOUS_LOG,
        "log(x) 的底数有歧义（不同教材中可能表示以 10 或以 e 为底）。" +
          "请使用 ln(x)（自然对数）或 lg(x)（常用对数，以 10 为底），或用 log(x, b) 指定底数 b",
        { position, symbol: "log" },
      );
    }
    if (args.length < spec.minArgs || args.length > spec.maxArgs) {
      const expected =
        spec.minArgs === spec.maxArgs ? `${spec.minArgs}` : `${spec.minArgs}–${spec.maxArgs}`;
      return this.report(
        EXPRESSION_ERROR_CODES.WRONG_ARITY,
        `函数 ${name} 需要 ${expected} 个参数，实际为 ${args.length} 个`,
        { position, symbol: name },
      );
    }
    if (failed) return null;
    this.usedFunctions.add(spec.name);
    return Object.freeze({ kind: "call", fn: spec.name, args: Object.freeze(converted) });
  }
}

function checkTree(
  root: unknown,
  symbols: DeclaredSymbols,
  identifiers: readonly IdentifierToken[],
): AnalysisResult {
  const measured = measure(root);
  if (!measured.ok) return measured;
  const converter = new Converter(symbols, identifiers);
  const ir = converter.convert(root);
  if (converter.errors.length > 0 || ir === null) {
    if (converter.errors.length === 0) {
      return fail(EXPRESSION_ERROR_CODES.INTERNAL_ERROR, "表达式校验失败（内部错误）");
    }
    return { ok: false, errors: freezeErrors(converter.errors) };
  }
  const info: ExpressionInfo = Object.freeze({
    nodeCount: measured.nodeCount,
    depth: measured.depth,
    usedVariables: Object.freeze(symbols.variables.filter((n) => converter.usedSymbols.has(n))),
    usedParameters: Object.freeze(symbols.parameters.filter((n) => converter.usedSymbols.has(n))),
    usedFunctions: Object.freeze([...converter.usedFunctions].sort()),
    usedConstants: Object.freeze([...converter.usedConstants].sort()),
  });
  return { ok: true, info, ir };
}

/** Full analysis used by both `validateExpression` and `compileExpression`. Never throws. */
export function analyzeExpression(source: unknown, options?: unknown): AnalysisResult {
  try {
    if (typeof source !== "string") {
      return fail(EXPRESSION_ERROR_CODES.INVALID_ARGUMENT, "表达式必须是字符串");
    }
    if (source.length > MAX_EXPRESSION_LENGTH) {
      return fail(
        EXPRESSION_ERROR_CODES.EXPR_TOO_LONG,
        `表达式过长：${source.length} 个字符，上限为 ${MAX_EXPRESSION_LENGTH}`,
      );
    }
    const declarations = checkDeclarations(options);
    if (!declarations.ok) return declarations;
    if (/^[ \t]*$/.test(source)) {
      return fail(EXPRESSION_ERROR_CODES.EMPTY_EXPRESSION, "表达式不能为空");
    }
    const scanned = scanExpression(source);
    if (!scanned.ok) return { ok: false, errors: freezeErrors(scanned.errors) };
    const parsed = parseWithMathJs(source);
    if (!parsed.ok) {
      const where = parsed.position === undefined ? "" : `（第 ${parsed.position + 1} 个字符附近）`;
      return fail(EXPRESSION_ERROR_CODES.SYNTAX_ERROR, `语法错误${where}：${parsed.message}`, {
        position: parsed.position,
      });
    }
    return checkTree(parsed.node, declarations.symbols, scanned.identifiers);
  } catch {
    return fail(EXPRESSION_ERROR_CODES.INTERNAL_ERROR, "表达式校验失败（内部错误）");
  }
}

/**
 * Validates an expression against the whitelist and resource limits.
 * Never throws; returns structured errors instead.
 */
export function validateExpression(source: string, options?: ExpressionOptions): ValidationResult {
  const result = analyzeExpression(source, options);
  return result.ok ? { ok: true, info: result.info } : result;
}

/**
 * Runs only the AST limit and whitelist stages on an already-parsed math.js node.
 * Internal: exists so tests can prove the AST whitelist rejects forbidden node types
 * independently of the lexical gate. Never throws.
 */
export function validateMathJsNode(node: unknown, options?: ExpressionOptions): ValidationResult {
  try {
    const declarations = checkDeclarations(options);
    if (!declarations.ok) return declarations;
    const result = checkTree(node, declarations.symbols, []);
    return result.ok ? { ok: true, info: result.info } : result;
  } catch {
    return fail(EXPRESSION_ERROR_CODES.INTERNAL_ERROR, "表达式校验失败（内部错误）");
  }
}
