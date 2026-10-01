"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { CONSTANT_NAMES, FUNCTION_NAMES } from "../vendor/math-core/functions.ts";
import { MathFormula } from "./MathFormula";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  MAX_VARIABLES,
  QUESTION_KIND_LABELS,
  deterministicWorkingSeed,
  expressionToTex,
  selfCheck,
  trialGrade,
  type Difficulty,
  type DraftQuestion,
} from "./paper-model";

const fieldClass = "app-input mt-2 w-full rounded-xl border px-3 py-2.5 text-sm";
const labelClass = "text-xs font-semibold";

export function MathQuestionEditor({
  index,
  total,
  question,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  total: number;
  question: DraftQuestion;
  onChange: (next: DraftQuestion) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [trialAnswer, setTrialAnswer] = useState("");
  const [trialDone, setTrialDone] = useState(false);

  const isMath = question.kind !== "choice";
  const check = useMemo(
    () =>
      question.kind === "choice" || question.expected.trim() === ""
        ? null
        : selfCheck(question, deterministicWorkingSeed(question)),
    [question],
  );
  const tex = useMemo(
    () => (question.kind === "expression" ? expressionToTex(question.expected, question.variables) : null),
    [question],
  );
  const trial = useMemo(
    () =>
      trialDone && question.kind !== "choice"
        ? trialGrade(question, trialAnswer, deterministicWorkingSeed(question))
        : null,
    [question, trialAnswer, trialDone],
  );

  function patch(partial: Partial<DraftQuestion>) {
    onChange({ ...question, ...partial } as DraftQuestion);
    setTrialDone(false);
  }

  return (
    <article className="app-soft-card space-y-4 rounded-2xl border p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">
          第 {index + 1} 题 · {QUESTION_KIND_LABELS[question.kind]}
        </h4>
        <div className="flex gap-1">
          <button type="button" aria-label="上移" disabled={index === 0} onClick={() => onMove(-1)} className="app-soft-card flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-40">
            <ArrowUp size={14} />
          </button>
          <button type="button" aria-label="下移" disabled={index === total - 1} onClick={() => onMove(1)} className="app-soft-card flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-40">
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            aria-label="删除本题"
            onClick={() => {
              if (window.confirm("确认删除这道题？")) onRemove();
            }}
            className="app-soft-card flex h-8 w-8 items-center justify-center rounded-lg border"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      <label className={`${labelClass} block`}>
        题干
        <textarea
          value={question.prompt}
          onChange={(event) => patch({ prompt: event.target.value })}
          rows={2}
          maxLength={3000}
          className={`${fieldClass} leading-6`}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          分值
          <input
            value={question.points}
            onChange={(event) => patch({ points: event.target.value })}
            inputMode="decimal"
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          难度
          <select
            value={question.difficulty}
            onChange={(event) => patch({ difficulty: event.target.value as Difficulty })}
            className={fieldClass}
          >
            {DIFFICULTIES.map((value) => (
              <option key={value} value={value}>
                {DIFFICULTY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {question.kind === "choice" && (
        <fieldset className="space-y-2">
          <legend className={labelClass}>选项（选中左侧圆点表示正确答案）</legend>
          {question.options.map((option, optionIndex) => (
            <div key={optionIndex} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${index}`}
                checked={question.correctIndex === optionIndex}
                onChange={() => patch({ correctIndex: optionIndex })}
                aria-label={`选项 ${optionIndex + 1} 是正确答案`}
              />
              <input
                value={option}
                onChange={(event) =>
                  patch({ options: question.options.map((o, i) => (i === optionIndex ? event.target.value : o)) })
                }
                className="app-input w-full rounded-xl border px-3 py-2 text-sm"
                aria-label={`选项 ${optionIndex + 1}`}
              />
              <button
                type="button"
                aria-label={`删除选项 ${optionIndex + 1}`}
                disabled={question.options.length <= 2}
                onClick={() =>
                  patch({
                    options: question.options.filter((_, i) => i !== optionIndex),
                    correctIndex:
                      question.correctIndex === null
                        ? null
                        : question.correctIndex === optionIndex
                          ? null
                          : question.correctIndex > optionIndex
                            ? question.correctIndex - 1
                            : question.correctIndex,
                  })
                }
                className="app-soft-card flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border disabled:opacity-40"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {question.options.length < 8 && (
            <button
              type="button"
              onClick={() => patch({ options: [...question.options, ""] })}
              className="app-soft-card inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
            >
              <Plus size={12} />
              添加选项
            </button>
          )}
        </fieldset>
      )}

      {question.kind === "expression" && (
        <div className="space-y-3">
          <label className={`${labelClass} block`}>
            标准表达式
            <input
              value={question.expected}
              onChange={(event) => patch({ expected: event.target.value })}
              placeholder="例如：2x+2"
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
              className={`${fieldClass} font-mono`}
            />
          </label>
          {tex && (
            <p className="app-muted-text text-xs">
              预览：<MathFormula tex={tex} label="标准表达式预览" />
            </p>
          )}
          <fieldset className="space-y-2">
            <legend className={labelClass}>变量与取值范围（判题时在范围内取点）</legend>
            {question.variables.map((variable, variableIndex) => (
              <div key={variableIndex} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                <input
                  value={variable.name}
                  onChange={(event) =>
                    patch({ variables: question.variables.map((v, i) => (i === variableIndex ? { ...v, name: event.target.value } : v)) })
                  }
                  aria-label="变量名"
                  placeholder="变量名"
                  className="app-input w-full min-w-0 rounded-xl border px-3 py-2 font-mono text-sm"
                />
                <input
                  value={variable.min}
                  onChange={(event) =>
                    patch({ variables: question.variables.map((v, i) => (i === variableIndex ? { ...v, min: event.target.value } : v)) })
                  }
                  aria-label="最小值"
                  placeholder="最小值"
                  inputMode="decimal"
                  className="app-input w-full min-w-0 rounded-xl border px-3 py-2 text-sm"
                />
                <input
                  value={variable.max}
                  onChange={(event) =>
                    patch({ variables: question.variables.map((v, i) => (i === variableIndex ? { ...v, max: event.target.value } : v)) })
                  }
                  aria-label="最大值"
                  placeholder="最大值"
                  inputMode="decimal"
                  className="app-input w-full min-w-0 rounded-xl border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  aria-label="删除变量"
                  disabled={question.variables.length <= 1}
                  onClick={() => patch({ variables: question.variables.filter((_, i) => i !== variableIndex) })}
                  className="app-soft-card flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-40"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {question.variables.length < MAX_VARIABLES && (
              <button
                type="button"
                onClick={() => patch({ variables: [...question.variables, { name: "", min: "-5", max: "5" }] })}
                className="app-soft-card inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
              >
                <Plus size={12} />
                添加变量
              </button>
            )}
          </fieldset>
        </div>
      )}

      {question.kind === "numeric" && (
        <label className={`${labelClass} block`}>
          标准数值
          <input
            value={question.expected}
            onChange={(event) => patch({ expected: event.target.value })}
            placeholder="例如：0.3333"
            inputMode="decimal"
            className={`${fieldClass} font-mono`}
          />
        </label>
      )}

      {isMath && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            绝对误差
            <input
              value={question.toleranceAbs}
              onChange={(event) => patch({ toleranceAbs: event.target.value } as Partial<DraftQuestion>)}
              inputMode="decimal"
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            相对误差
            <input
              value={question.toleranceRel}
              onChange={(event) => patch({ toleranceRel: event.target.value } as Partial<DraftQuestion>)}
              inputMode="decimal"
              className={fieldClass}
            />
          </label>
        </div>
      )}

      <label className={`${labelClass} block`}>
        解析
        <textarea
          value={question.explanation}
          onChange={(event) => patch({ explanation: event.target.value })}
          rows={2}
          maxLength={3000}
          className={`${fieldClass} leading-6`}
        />
      </label>

      {isMath && (
        <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-xs font-semibold">试判（只用于检查规格，不产生任何得分）</p>
          {check && (
            <p className={`text-xs ${check.verdict === "correct" ? "" : "font-semibold"}`} role="status">
              标准答案自检：{check.verdict === "correct" ? "通过" : check.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              value={trialAnswer}
              onChange={(event) => {
                setTrialAnswer(event.target.value);
                setTrialDone(false);
              }}
              placeholder="输入一个学生答案，例如 2(x+1)"
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
              aria-label="试判的学生答案"
              className="app-input min-w-0 flex-1 rounded-xl border px-3 py-2 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setTrialDone(true)}
              disabled={trialAnswer.trim() === ""}
              className="app-soft-card rounded-xl border px-4 py-2 text-xs font-semibold disabled:opacity-40"
            >
              试判
            </button>
          </div>
          {trial && (
            <p className="text-xs" role="status">
              {trial.message}
            </p>
          )}
          <details className="text-xs">
            <summary className="app-muted-text cursor-pointer">支持的写法</summary>
            <p className="app-muted-text mt-2 leading-5">
              运算符：+ - * / ^ 和括号，可省略乘号（2x）。常量：{CONSTANT_NAMES.join("、")}。函数：{FUNCTION_NAMES.join("、")}。
            </p>
          </details>
        </div>
      )}
    </article>
  );
}
