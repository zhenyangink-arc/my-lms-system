/**
 * LaTeX output for KaTeX, generated only from the validated IR.
 *
 * Safety: identifiers are restricted to `[A-Za-z0-9_]`, numbers are finite JS numbers and
 * every macro is emitted by this file, so the output cannot contain user-controlled
 * macros. `assertSafeTex` re-checks the final string against a macro allowlist
 * (defence in depth), which excludes `\href`, `\url`, `\htmlClass`, `\includegraphics`,
 * `\def`, etc. Renderers must still call KaTeX with `trust: false`.
 */
import type { ExprNode } from "./ir.ts";

const ALLOWED_MACROS = new Set<string>([
  "\\sin",
  "\\cos",
  "\\tan",
  "\\arcsin",
  "\\arccos",
  "\\arctan",
  "\\sinh",
  "\\cosh",
  "\\tanh",
  "\\sqrt",
  "\\exp",
  "\\ln",
  "\\lg",
  "\\log",
  "\\min",
  "\\max",
  "\\operatorname",
  "\\frac",
  "\\left",
  "\\right",
  "\\cdot",
  "\\times",
  "\\pi",
  "\\lfloor",
  "\\rfloor",
  "\\lceil",
  "\\rceil",
  "\\mathit",
  "\\mathrm",
]);

/** Characters that may appear in generated TeX. */
const ALLOWED_TEX_CHARS = /^[A-Za-z0-9 +\-.,(){}[\]^_|\\]*$/;

/** Throws if `tex` is not built exclusively from allowlisted macros and characters. */
export function assertSafeTex(tex: string): void {
  if (!ALLOWED_TEX_CHARS.test(tex)) throw new Error("unsafe TeX: unexpected character");
  let depth = 0;
  let left = 0;
  let right = 0;
  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i];
    if (ch === "{") depth++;
    else if (ch === "}" && --depth < 0) throw new Error("unsafe TeX: unbalanced braces");
    else if (ch === "\\") {
      let j = i + 1;
      while (j < tex.length && /[A-Za-z]/.test(tex[j] ?? "")) j++;
      if (j === i + 1) {
        // Only the escaped underscore `\_` is allowed as a non-letter control symbol.
        if (tex[j] !== "_") throw new Error("unsafe TeX: unexpected control symbol");
        i = j;
        continue;
      }
      const macro = tex.slice(i, j);
      if (!ALLOWED_MACROS.has(macro)) throw new Error(`unsafe TeX: macro ${macro} not allowed`);
      if (macro === "\\left") left++;
      if (macro === "\\right") right++;
      i = j - 1;
    }
  }
  if (depth !== 0 || left !== right) throw new Error("unsafe TeX: unbalanced delimiters");
}

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Parameter names spelled as Greek letters render as the letter (e.g. `theta` → θ). */
const GREEK_LETTERS: ReadonlySet<string> = new Set([
  "alpha",
  "beta",
  "gamma",
  "delta",
  "epsilon",
  "zeta",
  "eta",
  "theta",
  "iota",
  "kappa",
  "lambda",
  "mu",
  "nu",
  "xi",
  "rho",
  "sigma",
  "tau",
  "upsilon",
  "phi",
  "chi",
  "psi",
  "omega",
  "Gamma",
  "Delta",
  "Theta",
  "Lambda",
  "Xi",
  "Sigma",
  "Upsilon",
  "Phi",
  "Psi",
  "Omega",
]);

for (const letter of GREEK_LETTERS) ALLOWED_MACROS.add(`\\${letter}`);

/** Renders a base name: a single letter, a Greek letter macro, or `\mathit{…}`. */
function baseTex(base: string): string {
  if (base.length === 1) return base;
  if (GREEK_LETTERS.has(base)) return `\\${base}`;
  return `\\mathit{${base.replace(/_/g, "\\_")}}`;
}

function symbolTex(name: string): string {
  if (!NAME_PATTERN.test(name)) throw new Error("internal: invalid symbol name");
  // `x0`, `x10`, `theta1` → base with a numeric subscript.
  const digitSuffix = /^([A-Za-z]+?)([0-9]+)$/.exec(name);
  if (digitSuffix !== null) return `${baseTex(digitSuffix[1] ?? "")}_{${digitSuffix[2]}}`;
  // `x_1`, `x_max`, `theta_a` → base with a subscript.
  const subscript = /^([A-Za-z]+)_([A-Za-z0-9]+)$/.exec(name);
  if (subscript !== null) {
    const sub = subscript[2] ?? "";
    const subTex = /^[0-9]+$/.test(sub) || sub.length === 1 ? sub : `\\mathrm{${sub}}`;
    return `${baseTex(subscript[1] ?? "")}_{${subTex}}`;
  }
  return baseTex(name);
}

function isMultiLetterSymbol(node: ExprNode): boolean {
  return node.kind === "symbol" && symbolTex(node.name).startsWith("\\mathit");
}

function numberTex(value: number): string {
  if (!Number.isFinite(value)) throw new Error("internal: non-finite literal");
  const text = String(value);
  const exponentAt = text.indexOf("e");
  if (exponentAt < 0) return text;
  const mantissa = text.slice(0, exponentAt);
  const exponent = Number(text.slice(exponentAt + 1));
  return `${mantissa} \\times 10^{${exponent}}`;
}

/** 5 = atom, 4 = power, 3 = unary, 2 = product/quotient, 1 = sum/difference. */
function precedence(node: ExprNode): number {
  switch (node.kind) {
    case "unary":
      return 3;
    case "binary":
      return node.op === "^" ? 4 : node.op === "+" || node.op === "-" ? 1 : 2;
    default:
      return 5;
  }
}

function paren(tex: string): string {
  return `\\left(${tex}\\right)`;
}

/** Contexts that already group visually (fraction parts, exponents, arguments) drop one level of source parentheses. */
function unwrapGroup(node: ExprNode): ExprNode {
  return node.kind === "group" ? node.body : node;
}

function leftmostAtom(node: ExprNode): ExprNode {
  if (node.kind === "binary" && node.op !== "/") return leftmostAtom(node.left);
  return node;
}

function rightmostAtom(node: ExprNode): ExprNode {
  if (node.kind === "binary" && node.op !== "/" && node.op !== "^")
    return rightmostAtom(node.right);
  if (node.kind === "unary") return rightmostAtom(node.arg);
  return node;
}

function callTex(fn: string, args: readonly ExprNode[]): string {
  const inner = args.map((arg) => toTex(unwrapGroup(arg)));
  const first = inner[0] ?? "";
  const call = (macro: string): string => `${macro}${paren(inner.join(", "))}`;
  switch (fn) {
    case "sin":
    case "cos":
    case "tan":
    case "sinh":
    case "cosh":
    case "tanh":
    case "exp":
    case "ln":
    case "lg":
    case "min":
    case "max":
      return call(`\\${fn}`);
    case "asin":
      return call("\\arcsin");
    case "acos":
      return call("\\arccos");
    case "atan":
      return call("\\arctan");
    case "sqrt":
      return `\\sqrt{${first}}`;
    case "cbrt":
      return `\\sqrt[3]{${first}}`;
    case "abs":
      return `\\left|${first}\\right|`;
    case "floor":
      return `\\left\\lfloor ${first}\\right\\rfloor`;
    case "ceil":
      return `\\left\\lceil ${first}\\right\\rceil`;
    case "round":
      return call("\\operatorname{round}");
    case "sign":
      return call("\\operatorname{sgn}");
    case "log10":
      return `\\log_{10}${paren(first)}`;
    case "log2":
      return `\\log_{2}${paren(first)}`;
    case "log":
      return `\\log_{${inner[1] ?? ""}}${paren(first)}`;
    default:
      throw new Error(`internal: no TeX for function ${fn}`);
  }
}

function toTex(node: ExprNode): string {
  switch (node.kind) {
    case "number":
      return numberTex(node.value);
    case "constant":
      return node.name === "pi" ? "\\pi" : "e";
    case "symbol":
      return symbolTex(node.name);
    case "group":
      return paren(toTex(node.body));
    case "call":
      return callTex(node.fn, node.args);
    case "unary": {
      const arg = toTex(node.arg);
      const wrapped = node.arg.kind === "unary" || precedence(node.arg) < 3 ? paren(arg) : arg;
      return `${node.op}${wrapped}`;
    }
    case "binary": {
      const { op, left, right } = node;
      if (op === "/") {
        return `\\frac{${toTex(unwrapGroup(left))}}{${toTex(unwrapGroup(right))}}`;
      }
      if (op === "^") {
        const baseTex = toTex(left);
        const wrapBase =
          left.kind === "unary" || left.kind === "binary" || baseTex.includes("\\times");
        return `${wrapBase ? paren(baseTex) : baseTex}^{${toTex(unwrapGroup(right))}}`;
      }
      const leftTex = toTex(left);
      const rightTex = toTex(right);
      if (op === "+" || op === "-") {
        const wrapRight = right.kind === "unary" || (op === "-" && precedence(right) <= 1);
        return `${leftTex} ${op} ${wrapRight ? paren(rightTex) : rightTex}`;
      }
      // Multiplication (explicit or implicit).
      const l = precedence(left) < 2 ? paren(leftTex) : leftTex;
      const r = precedence(right) < 2 || right.kind === "unary" ? paren(rightTex) : rightTex;
      if (!node.implicit) return `${l} \\cdot ${r}`;
      const needsDot =
        leftmostAtom(right).kind === "number" ||
        isMultiLetterSymbol(rightmostAtom(left)) ||
        isMultiLetterSymbol(leftmostAtom(right));
      // A space always separates the factors so a macro never merges with a following letter (`\pi x`).
      return needsDot ? `${l} \\cdot ${r}` : `${l} ${r}`;
    }
  }
}

/** Renders a validated tree to KaTeX-compatible LaTeX and verifies the result. */
export function exprToTex(node: ExprNode): string {
  const tex = toTex(node);
  assertSafeTex(tex);
  return tex;
}
