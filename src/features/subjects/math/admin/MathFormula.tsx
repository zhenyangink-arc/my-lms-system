"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

/**
 * 用 KaTeX 渲染一段由判题层生成的 LaTeX。`trust: false` 禁用 \href 等可触发外部行为的命令；
 * LaTeX 只来自白名单解析后的语法树，不接受老师直接输入的 LaTeX。
 */
export function MathFormula({ tex, label }: { tex: string; label: string }) {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        throwOnError: false,
        trust: false,
        strict: "ignore",
        output: "htmlAndMathml",
      }),
    [tex],
  );
  return (
    <span
      role="img"
      aria-label={label}
      // KaTeX 的输出是它自己生成的受控 HTML（trust: false）
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
