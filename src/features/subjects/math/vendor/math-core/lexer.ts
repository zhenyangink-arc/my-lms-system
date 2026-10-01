/**
 * Lexical gate: runs on the raw source BEFORE it reaches the math.js parser.
 *
 * 1. Character allowlist: ASCII letters, digits, `_`, space, tab, `+ - * / ^ ( ) , .` and `π`.
 *    Everything else (quotes, brackets, `=`, `;`, `:`, `?`, `!`, `'`, `|`, `&`, `<`, `>`, `%`,
 *    `#`, `$`, newlines, full-width / zero-width / confusable Unicode, ...) is rejected. This
 *    removes whole classes of math.js syntax (strings, matrices, objects, assignments,
 *    ranges, conditionals, blocks, comments, factorial, transpose, relational and bitwise
 *    operators) before parsing. The AST whitelist still re-checks everything independently.
 * 2. Number literals that math.js would read in a surprising way:
 *    - `0b…`, `0o…`, `0x…` radix literals (math.js reads `0x` as hex, never as 0·x);
 *    - scientific notation with a signed exponent (`2e-1` is 0.2 for math.js, but reads as
 *      2·e − 1 to a human).
 * 3. Collects identifier tokens with their positions, used to attach positions to AST errors.
 */
import { EXPRESSION_ERROR_CODES, makeError, type ExpressionError } from "./errors.ts";
import { MAX_REPORTED_ERRORS } from "./limits.ts";

export interface IdentifierToken {
  readonly name: string;
  /** 0-based UTF-16 offset. */
  readonly start: number;
  /** Whether the identifier is directly followed by `(` (ignoring spaces), i.e. a call. */
  readonly callee: boolean;
}

export type ScanResult =
  | { readonly ok: true; readonly identifiers: readonly IdentifierToken[] }
  | { readonly ok: false; readonly errors: readonly ExpressionError[] };

const PI_CHAR = "π";

function isAsciiLetter(c: string | undefined): boolean {
  return c !== undefined && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z"));
}

function isDigit(c: string | undefined): boolean {
  return c !== undefined && c >= "0" && c <= "9";
}

function isIdentifierStart(c: string | undefined): boolean {
  return isAsciiLetter(c) || c === "_" || c === PI_CHAR;
}

function isIdentifierPart(c: string | undefined): boolean {
  return isIdentifierStart(c) || isDigit(c);
}

function isAllowedCodePoint(cp: number): boolean {
  if (cp >= 0x30 && cp <= 0x39) return true; // 0-9
  if (cp >= 0x41 && cp <= 0x5a) return true; // A-Z
  if (cp >= 0x61 && cp <= 0x7a) return true; // a-z
  switch (cp) {
    case 0x20: // space
    case 0x09: // tab
    case 0x5f: // _
    case 0x2b: // +
    case 0x2d: // -
    case 0x2a: // *
    case 0x2f: // /
    case 0x5e: // ^
    case 0x28: // (
    case 0x29: // )
    case 0x2c: // ,
    case 0x2e: // .
    case 0x03c0: // π
      return true;
    default:
      return false;
  }
}

function isInvisible(cp: number): boolean {
  return (
    cp < 0x20 ||
    cp === 0x7f ||
    (cp >= 0x80 && cp <= 0xa0) ||
    cp === 0xad ||
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x2028 && cp <= 0x202e) ||
    (cp >= 0x2060 && cp <= 0x206f) ||
    cp === 0x3000 ||
    cp === 0xfeff ||
    (cp >= 0xd800 && cp <= 0xdfff)
  );
}

function characterHint(cp: number): string {
  switch (cp) {
    case 0x3d: // =
      return "不支持赋值、函数定义或方程，请只写表达式本身（例如写 x^2，而不是 f(x)=x^2）";
    case 0x7c: // |
      return "绝对值请使用 abs(x)";
    case 0x5b:
    case 0x5d:
    case 0x7b:
    case 0x7d:
      return "只允许圆括号 ( )";
    case 0x22:
    case 0x27:
    case 0x60:
      return "不支持字符串、引号或转置";
    case 0x3b:
    case 0x0a:
    case 0x0d:
      return "只允许单行、单个表达式";
    case 0x21:
      return "不支持阶乘或逻辑运算";
    case 0x25:
      return "不支持百分号或取模运算";
    case 0x3a:
    case 0x3f:
      return "不支持区间或条件表达式";
    case 0x3c:
    case 0x3e:
    case 0x26:
    case 0x7e:
      return "不支持比较、逻辑或位运算";
    case 0x23:
      return "不支持注释";
    case 0xd7:
    case 0xb7:
    case 0x22c5:
    case 0x2217:
      return "乘号请使用 *";
    case 0xf7:
      return "除号请使用 /";
    case 0x2212:
    case 0x2013:
    case 0x2014:
      return "减号请使用半角 -";
    case 0xb2:
    case 0xb3:
    case 0xb9:
      return "乘方请使用 ^，例如 x^2";
    case 0x221a:
      return "开方请使用 sqrt(x) 或 cbrt(x)";
    case 0xa0:
    case 0x3000:
      return "请使用普通半角空格";
    default:
      break;
  }
  if (cp >= 0xff01 && cp <= 0xff5e) return "检测到全角字符，请使用半角字符";
  if (isInvisible(cp)) return "检测到不可见字符（控制字符、零宽字符或方向控制字符），请删除";
  return "只允许英文字母、数字、下划线、空格、+ - * / ^ ( ) , . 以及 π";
}

function hex(cp: number): string {
  return cp.toString(16).toUpperCase().padStart(4, "0");
}

function invalidCharacterError(cp: number, position: number): ExpressionError {
  const shown = isInvisible(cp) ? "" : `“${String.fromCodePoint(cp)}”`;
  return makeError(
    EXPRESSION_ERROR_CODES.INVALID_CHARACTER,
    `不允许的字符 ${shown}（U+${hex(cp)}，第 ${position + 1} 个字符）：${characterHint(cp)}`,
    { position, symbol: `U+${hex(cp)}` },
  );
}

function nextNonBlank(source: string, from: number): string | undefined {
  let i = from;
  while (source[i] === " " || source[i] === "\t") i++;
  return source[i];
}

export function scanExpression(source: string): ScanResult {
  const errors: ExpressionError[] = [];

  // Pass 1: character allowlist (by code point; lone surrogates are rejected too).
  const reported = new Set<number>();
  for (let i = 0; i < source.length;) {
    const cp = source.codePointAt(i) ?? 0;
    if (!isAllowedCodePoint(cp) && !reported.has(cp)) {
      reported.add(cp);
      if (errors.length < MAX_REPORTED_ERRORS) errors.push(invalidCharacterError(cp, i));
    }
    i += cp > 0xffff ? 2 : 1;
  }
  if (errors.length > 0) return { ok: false, errors };

  // Pass 2: tokens. Mirrors the math.js tokenizer for the allowed character set.
  const identifiers: IdentifierToken[] = [];
  const n = source.length;
  let i = 0;
  while (i < n) {
    const c = source[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (isIdentifierStart(c)) {
      const start = i;
      i++;
      while (i < n && isIdentifierPart(source[i])) i++;
      identifiers.push(
        Object.freeze({
          name: source.slice(start, i),
          start,
          callee: nextNonBlank(source, i) === "(",
        }),
      );
      continue;
    }
    if (isDigit(c) || (c === "." && isDigit(source[i + 1]))) {
      const start = i;
      const second = source[i + 1];
      if (c === "0" && (second === "b" || second === "o" || second === "x")) {
        i += 2;
        while (i < n && isIdentifierPart(source[i])) i++;
        if (errors.length < MAX_REPORTED_ERRORS) {
          const literal = source.slice(start, i);
          errors.push(
            makeError(
              EXPRESSION_ERROR_CODES.INVALID_NUMBER,
              `不支持二进制/八进制/十六进制数字 “${literal}”（第 ${start + 1} 个字符）；` +
                `如表示 0 乘以某个量，请写成 0*${second}`,
              { position: start, symbol: literal },
            ),
          );
        }
        continue;
      }
      if (c === ".") {
        i++;
      } else {
        while (isDigit(source[i])) i++;
        const afterDot = source[i + 1];
        if (source[i] === "." && afterDot !== "*" && afterDot !== "/" && afterDot !== "^") i++;
      }
      while (isDigit(source[i])) i++;
      if (source[i] === "e" || source[i] === "E") {
        const next = source[i + 1];
        if (next === "+" || next === "-") {
          let end = i + 2;
          while (end < n && isIdentifierPart(source[end])) end++;
          const literal = source.slice(start, end);
          const mantissa = source.slice(start, i);
          if (errors.length < MAX_REPORTED_ERRORS) {
            errors.push(
              makeError(
                EXPRESSION_ERROR_CODES.AMBIGUOUS_NUMBER,
                `“${literal}”（第 ${start + 1} 个字符）有歧义：数字后紧跟 ${source[i]}${next} 会被当作科学计数法` +
                  `（如 2e-1 = 0.2），但也可能表示 ${mantissa}·e ${next} …（e 为自然常数）。` +
                  `请改写为无歧义形式，例如 2*10^(-1)、0.2 或 ${mantissa}*e ${next} 1`,
                { position: start, symbol: literal },
              ),
            );
          }
          i = end;
          continue;
        }
        if (isDigit(next)) {
          i++;
          while (isDigit(source[i])) i++;
        }
      }
      continue;
    }
    // Operators and delimiters: + - * / ^ ( ) , . (incl. `.*`, `./`, `.^`, handled by the AST check).
    i++;
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, identifiers: Object.freeze(identifiers) };
}
