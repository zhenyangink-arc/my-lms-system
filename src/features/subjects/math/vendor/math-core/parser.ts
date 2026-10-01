/**
 * The only place that touches math.js.
 *
 * A private math.js instance is assembled from the number-only build with just the
 * factories needed by `parse` (no BigNumber / Fraction / Complex / Unit, no `evaluate`,
 * `compile`, `simplify`, `derivative`, `import`-able function set). The instance is never
 * exported; only the syntax tree produced by `parse` leaves this module, and it is treated
 * as untrusted data (`unknown`) by the whitelist checker.
 *
 * math.js is used strictly as a parser: this package never calls `evaluate`, `compile`,
 * or any method on the returned nodes.
 */
import { create, parseDependencies } from "mathjs/number";

if (parseDependencies === undefined) {
  throw new Error("@edumath/math-core: mathjs/number does not export parseDependencies");
}
const restrictedMath = create({ parseDependencies }, { number: "number" });
const mathParse = restrictedMath.parse;

export type ParseOutcome =
  | { readonly ok: true; readonly node: unknown }
  | { readonly ok: false; readonly message: string; readonly position?: number };

/**
 * Parses `source` into an untrusted math.js AST. Never throws.
 * Callers must enforce `MAX_EXPRESSION_LENGTH` and the lexical gate first.
 */
export function parseWithMathJs(source: string): ParseOutcome {
  try {
    const node: unknown = mathParse(source);
    return { ok: true, node };
  } catch (error: unknown) {
    let message = "无法解析表达式";
    let position: number | undefined;
    if (error instanceof Error) {
      message = error.message.replace(/\s*\(char \d+\)\s*$/, "");
      const char: unknown = (error as { char?: unknown }).char;
      if (typeof char === "number" && Number.isInteger(char)) {
        position = Math.max(0, Math.min(source.length, char - 1));
      }
    }
    return position === undefined ? { ok: false, message } : { ok: false, message, position };
  }
}
