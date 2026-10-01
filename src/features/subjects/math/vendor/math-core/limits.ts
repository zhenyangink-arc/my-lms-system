/**
 * Hard resource limits for expression handling (计划书 附录C).
 *
 * All limits are enforced by `validateExpression` / `compileExpression`.
 * `MAX_EXPRESSION_LENGTH` is checked before the source reaches the math.js parser,
 * which bounds the parser's recursion depth and running time.
 */

/** Maximum source length, in UTF-16 code units (`string.length`). Checked before parsing. */
export const MAX_EXPRESSION_LENGTH = 200;

/**
 * Maximum AST depth. The root node has depth 1; every child (operator operand,
 * parenthesised content, function argument) adds one level. Parentheses count as a level.
 */
export const MAX_AST_DEPTH = 20;

/**
 * Maximum number of AST nodes. Counted node kinds: number literals, symbols/constants,
 * operators (unary, binary, implicit multiplication), parentheses and function calls
 * (the function name itself is not counted separately).
 */
export const MAX_AST_NODES = 100;

/** Maximum length of a declared variable / parameter name. */
export const MAX_SYMBOL_NAME_LENGTH = 32;

/** Maximum number of declared names (variables + parameters) per expression. */
export const MAX_DECLARED_SYMBOLS = 32;

/** `min` / `max` accept between 2 and 4 arguments. */
export const MIN_MINMAX_ARGS = 2;
export const MAX_MINMAX_ARGS = 4;

/** At most this many errors are reported for a single expression. */
export const MAX_REPORTED_ERRORS = 20;
