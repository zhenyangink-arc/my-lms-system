"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo, useState } from "react";

import type { QuestionInputProps } from "../../question-input-contract.ts";
import { compileExpression } from "../vendor/math-core/compile.ts";
import { MAX_EXPRESSION_LENGTH } from "../vendor/math-core/limits.ts";

/** 预览时假定可能出现的变量名；学生答案里的其他符号只是不显示预览，不影响判题。 */
const PREVIEW_VARIABLES = ["x", "y", "z", "t", "u", "v", "w", "a", "b", "c", "m", "n", "k"] as const;

type Preview =
  | { kind: "none" }
  | { kind: "tex"; tex: string }
  | { kind: "value"; text: string }
  | { kind: "hint"; text: string };

function buildPreview(text: string, numeric: boolean): Preview {
  const source = text.trim();
  if (source === "") return { kind: "none" };
  const compiled = compileExpression(source, { variables: numeric ? [] : [...PREVIEW_VARIABLES] });
  if (!compiled.ok) {
    // 未声明的符号可能是题目允许的变量，不提示；其余是写法问题
    const onlyUnknown = compiled.errors.every((error) => error.code === "UNKNOWN_SYMBOL");
    return onlyUnknown ? { kind: "none" } : { kind: "hint", text: "写法暂时无法识别，请检查括号、运算符和函数名" };
  }
  if (numeric) {
    let value: number;
    try {
      value = compiled.evaluate({});
    } catch {
      return { kind: "hint", text: "这个式子没有定义（例如除以 0），请检查" };
    }
    if (!Number.isFinite(value)) return { kind: "hint", text: "这个式子没有定义（例如除以 0），请检查" };
    return { kind: "value", text: `${source} ≈ ${Number(value.toPrecision(10))}` };
  }
  return { kind: "tex", tex: compiled.toTex() };
}

/** 数学题（表达式 / 数值）的学生作答输入：文本输入 + 语法提示 + 实时预览。预览只是辅助，判题仍在服务端。 */
export function MathAnswerInput({ name, previousAnswer, kind }: QuestionInputProps) {
  const numeric = kind === "math.numeric";
  const [text, setText] = useState(previousAnswer ?? "");
  const preview = useMemo(() => buildPreview(text, numeric), [text, numeric]);
  const html = useMemo(
    () =>
      preview.kind === "tex"
        ? katex.renderToString(preview.tex, { throwOnError: false, trust: false, strict: "ignore", output: "htmlAndMathml" })
        : null,
    [preview],
  );

  return (
    <div className="space-y-2">
      <input
        name={name}
        maxLength={MAX_EXPRESSION_LENGTH}
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        defaultValue={previousAnswer ?? ""}
        onInput={(event) => setText(event.currentTarget.value)}
        placeholder={numeric ? "填写数值，例如 0.333 或 1/3" : "填写表达式，例如 2x+2"}
        className="app-input min-h-12 w-full rounded-xl border px-4 py-3 font-mono text-base sm:text-sm"
      />
      <p className="app-muted-text text-xs leading-5">
        用 ^ 表示乘方，sqrt(x) 表示根号，pi 表示圆周率；可以省略乘号（2x）。
      </p>
      <div className="min-h-6 text-sm" role="status" aria-live="polite">
        {preview.kind === "tex" && html && (
          <span>
            你输入的是：
            <span
              role="img"
              aria-label="你输入的表达式预览"
              // KaTeX 输出的是它自己生成的受控 HTML（trust: false），LaTeX 来自白名单解析后的语法树
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </span>
        )}
        {preview.kind === "value" && <span className="app-muted-text">{preview.text}</span>}
        {preview.kind === "hint" && <span className="app-muted-text">{preview.text}</span>}
      </div>
    </div>
  );
}
