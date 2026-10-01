/**
 * Stable, structured error codes for expression validation and evaluation.
 *
 * The codes are part of the public contract: they are fed back to the LLM during
 * automatic repair (计划书 §6.4) and shown to teachers, so existing codes must never be
 * renamed or re-purposed.
 */
export const EXPRESSION_ERROR_CODES = Object.freeze({
  /** `source` is not a string, or the options object is malformed. */
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  /** A declared variable / parameter name is invalid, reserved or duplicated. */
  INVALID_DECLARATION: "INVALID_DECLARATION",
  /** The expression is empty or contains only whitespace. */
  EMPTY_EXPRESSION: "EMPTY_EXPRESSION",
  /** The source is longer than `MAX_EXPRESSION_LENGTH` (checked before parsing). */
  EXPR_TOO_LONG: "EXPR_TOO_LONG",
  /** A character outside the lexical allowlist (e.g. `=`, `[`, `"`, full-width letters, zero-width characters). */
  INVALID_CHARACTER: "INVALID_CHARACTER",
  /** A binary / octal / hexadecimal literal such as `0x1F`, `0b1`, `0o7`. */
  INVALID_NUMBER: "INVALID_NUMBER",
  /** Scientific notation with a signed exponent such as `2e-1` (could mean 2·e − 1). */
  AMBIGUOUS_NUMBER: "AMBIGUOUS_NUMBER",
  /** The math.js parser rejected the expression. */
  SYNTAX_ERROR: "SYNTAX_ERROR",
  /** The AST is deeper than `MAX_AST_DEPTH`. */
  EXPR_TOO_DEEP: "EXPR_TOO_DEEP",
  /** The AST has more than `MAX_AST_NODES` nodes. */
  EXPR_TOO_MANY_NODES: "EXPR_TOO_MANY_NODES",
  /** A node type or operator outside the whitelist (assignment, accessor, matrix, string, relational, ...). */
  FORBIDDEN_NODE: "FORBIDDEN_NODE",
  /** A numeric literal that is not finite (`1e309`, `Infinity`, `NaN`). */
  NON_FINITE_LITERAL: "NON_FINITE_LITERAL",
  /** A symbol that is neither declared nor a whitelisted constant. */
  UNKNOWN_SYMBOL: "UNKNOWN_SYMBOL",
  /** A function call whose name is not in the function whitelist. */
  UNKNOWN_FUNCTION: "UNKNOWN_FUNCTION",
  /** A whitelisted function called with the wrong number of arguments. */
  WRONG_ARITY: "WRONG_ARITY",
  /** Single-argument `log(x)`: the base is ambiguous; use `ln`, `lg` or `log(x, b)`. */
  AMBIGUOUS_LOG: "AMBIGUOUS_LOG",
  /** Implicit multiplication adjacent to `/` or `^` (e.g. `1/2x`, `x/2y`, `e^2x`). */
  AMBIGUOUS_IMPLICIT_MULTIPLICATION: "AMBIGUOUS_IMPLICIT_MULTIPLICATION",
  /** Unexpected internal failure. Should never happen; always a bug. */
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const);

export type ExpressionErrorCode =
  (typeof EXPRESSION_ERROR_CODES)[keyof typeof EXPRESSION_ERROR_CODES];

export interface ExpressionError {
  /** Stable machine-readable code. */
  readonly code: ExpressionErrorCode;
  /** Human-readable explanation (zh-CN), suitable for teachers and for LLM repair prompts. */
  readonly message: string;
  /** 0-based UTF-16 offset into the source, when it can be determined. */
  readonly position?: number;
  /** The offending symbol, function, operator or node type, when applicable. */
  readonly symbol?: string;
}

export function makeError(
  code: ExpressionErrorCode,
  message: string,
  extra?: { readonly position?: number | undefined; readonly symbol?: string | undefined },
): ExpressionError {
  const error: { code: ExpressionErrorCode; message: string; position?: number; symbol?: string } =
    { code, message };
  if (extra?.position !== undefined) error.position = extra.position;
  if (extra?.symbol !== undefined) error.symbol = extra.symbol;
  return Object.freeze(error);
}

/** Error codes thrown by `CompiledExpression.evaluate` when it is called incorrectly. */
export const EVALUATION_ERROR_CODES = Object.freeze({
  /** A symbol used by the expression is not an own data property of the scope. */
  MISSING_VARIABLE: "MISSING_VARIABLE",
  /** A scope value is not a primitive `number` (or is an accessor property). */
  INVALID_VARIABLE_VALUE: "INVALID_VARIABLE_VALUE",
} as const);

export type EvaluationErrorCode =
  (typeof EVALUATION_ERROR_CODES)[keyof typeof EVALUATION_ERROR_CODES];

/**
 * Thrown by `CompiledExpression.evaluate` when the caller supplies an incomplete or
 * malformed scope. This indicates a bug in trusted calling code (renderer / validator),
 * not a mathematical domain problem, so it is loud instead of silently returning NaN.
 */
export class ExpressionEvaluationError extends Error {
  readonly code: EvaluationErrorCode;
  readonly symbol: string;

  constructor(code: EvaluationErrorCode, symbol: string, message: string) {
    super(message);
    this.name = "ExpressionEvaluationError";
    this.code = code;
    this.symbol = symbol;
  }
}
