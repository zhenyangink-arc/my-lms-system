/**
 * Validated expression tree ("IR").
 *
 * The whitelist checker converts the untrusted math.js AST into this small, closed,
 * immutable tree. The compiler and the TeX printer only ever see this IR — never a
 * math.js node — so their behaviour is fully determined by this package.
 */
import type { ConstantName, FunctionName } from "./functions.ts";

export type SymbolRole = "variable" | "parameter";

export type BinaryOperator = "+" | "-" | "*" | "/" | "^";

export type UnaryOperator = "-" | "+";

export type ExprNode =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "constant"; readonly name: ConstantName }
  | { readonly kind: "symbol"; readonly name: string; readonly role: SymbolRole }
  | { readonly kind: "unary"; readonly op: UnaryOperator; readonly arg: ExprNode }
  | {
      readonly kind: "binary";
      readonly op: BinaryOperator;
      readonly left: ExprNode;
      readonly right: ExprNode;
      /** True only for implicit multiplication such as `2x` or `3(x+1)`. */
      readonly implicit: boolean;
    }
  /** Parentheses written in the source; kept for faithful TeX output and ambiguity checks. */
  | { readonly kind: "group"; readonly body: ExprNode }
  | { readonly kind: "call"; readonly fn: FunctionName; readonly args: readonly ExprNode[] };
