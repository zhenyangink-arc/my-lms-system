/**
 * 数学试卷草稿的纯逻辑：界面状态 → 校验 → create_math_paper 所需的题目数组。
 * 客户端用它做即时校验与“试判”，服务端动作用同一份代码再校验一次；
 * 数据库还有结构校验兜底。判题随机种子不在界面里出现，由调用方在构造时提供。
 */
import { compileExpression } from "../vendor/math-core/compile.ts";
import { MAX_EXPRESSION_LENGTH } from "../vendor/math-core/limits.ts";
import { isValidSymbolName } from "../vendor/math-core/validate.ts";
import { MATH_QUESTION_TYPES } from "../question-types.ts";

export const DIFFICULTIES = ["foundation", "medium", "hard", "expert"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  foundation: "基础",
  medium: "中等",
  hard: "困难",
  expert: "极难",
};

export const MAX_QUESTIONS = 100;
export const MAX_VARIABLES = 4;

type QuestionBase = {
  prompt: string;
  /** 输入框里的原始文本；校验时转成数字。 */
  points: string;
  difficulty: Difficulty;
  explanation: string;
};

export type DraftVariable = { name: string; min: string; max: string };

export type DraftExpressionQuestion = QuestionBase & {
  kind: "expression";
  expected: string;
  variables: DraftVariable[];
  toleranceAbs: string;
  toleranceRel: string;
};

export type DraftNumericQuestion = QuestionBase & {
  kind: "numeric";
  expected: string;
  toleranceAbs: string;
  toleranceRel: string;
};

export type DraftChoiceQuestion = QuestionBase & {
  kind: "choice";
  options: string[];
  correctIndex: number | null;
};

export type DraftQuestion =
  | DraftExpressionQuestion
  | DraftNumericQuestion
  | DraftChoiceQuestion;

export type DraftPaper = {
  title: string;
  description: string;
  /** 空字符串表示不设置。 */
  durationMinutes: string;
  passingScore: string;
  questions: DraftQuestion[];
};

export type QuestionKind = DraftQuestion["kind"];
export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  expression: "表达式作答",
  numeric: "数值作答",
  choice: "选择题",
};

const BASE_DEFAULTS = {
  prompt: "",
  points: "5",
  difficulty: "foundation" as Difficulty,
  explanation: "",
};

export function newQuestion(kind: QuestionKind): DraftQuestion {
  switch (kind) {
    case "expression":
      return {
        ...BASE_DEFAULTS,
        kind,
        expected: "",
        variables: [{ name: "x", min: "-5", max: "5" }],
        toleranceAbs: "0.000000001",
        toleranceRel: "0.000000001",
      };
    case "numeric":
      return { ...BASE_DEFAULTS, kind, expected: "", toleranceAbs: "0.001", toleranceRel: "0" };
    case "choice":
      return { ...BASE_DEFAULTS, kind, options: ["", ""], correctIndex: null };
  }
}

export function newPaper(): DraftPaper {
  return { title: "", description: "", durationMinutes: "30", passingScore: "60", questions: [] };
}

// ---------- 数字解析 ----------

/** 严格解析十进制数（允许小数与科学计数法），拒绝空串、空白、NaN、Infinity、十六进制等。 */
export function parseDecimal(raw: string): number | null {
  const text = raw.trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

// ---------- 构造判题规格 ----------

export type RpcMathSpec =
  | {
      expected: string;
      variables: { name: string; min: number; max: number }[];
      seed: number;
      tolerance: { abs: number; rel: number };
    }
  | { expected: number; tolerance: { abs: number; rel: number } };

type SpecResult<T> = { ok: true; value: T } | { ok: false; message: string };

function buildTolerance(abs: string, rel: string): SpecResult<{ abs: number; rel: number }> {
  const a = parseDecimal(abs);
  const r = parseDecimal(rel);
  if (a === null || r === null || a < 0 || r < 0) return { ok: false, message: "容差需要填写非负数字" };
  return { ok: true, value: { abs: a, rel: r } };
}

export function buildExpressionSpec(
  question: DraftExpressionQuestion,
  seed: number,
): SpecResult<Extract<RpcMathSpec, { seed: number }>> {
  const expected = question.expected.trim();
  if (expected.length === 0) return { ok: false, message: "请填写标准表达式" };
  if (expected.length > MAX_EXPRESSION_LENGTH) {
    return { ok: false, message: `标准表达式不能超过 ${MAX_EXPRESSION_LENGTH} 个字符` };
  }
  if (question.variables.length < 1 || question.variables.length > MAX_VARIABLES) {
    return { ok: false, message: `需要 1 至 ${MAX_VARIABLES} 个变量` };
  }
  const names = new Set<string>();
  const variables: { name: string; min: number; max: number }[] = [];
  for (const variable of question.variables) {
    const name = variable.name.trim();
    if (!isValidSymbolName(name)) return { ok: false, message: `变量名“${name}”不合法` };
    if (names.has(name)) return { ok: false, message: `变量名“${name}”重复` };
    names.add(name);
    const min = parseDecimal(variable.min);
    const max = parseDecimal(variable.max);
    if (min === null || max === null || min >= max) {
      return { ok: false, message: `变量 ${name} 的取值范围需要是最小值小于最大值的两个数字` };
    }
    variables.push({ name, min, max });
  }
  const tolerance = buildTolerance(question.toleranceAbs, question.toleranceRel);
  if (!tolerance.ok) return tolerance;
  if (!Number.isInteger(seed)) return { ok: false, message: "判题种子必须是整数" };
  return { ok: true, value: { expected, variables, seed, tolerance: tolerance.value } };
}

export function buildNumericSpec(
  question: DraftNumericQuestion,
): SpecResult<Extract<RpcMathSpec, { expected: number }>> {
  const expected = parseDecimal(question.expected);
  if (expected === null) return { ok: false, message: "标准数值需要填写有限的数字" };
  const tolerance = buildTolerance(question.toleranceAbs, question.toleranceRel);
  if (!tolerance.ok) return tolerance;
  return { ok: true, value: { expected, tolerance: tolerance.value } };
}

// ---------- 自检与试判 ----------

export type TrialResult = {
  verdict: "correct" | "incorrect" | "error";
  /** 面向老师的中文说明。 */
  message: string;
};

const ERROR_REASON_TEXT: Record<string, string> = {
  invalid_spec: "题目的判题规格不合法",
  invalid_answer: "作答无法解析",
  insufficient_valid_points: "取值范围内两边都有定义的点太少，无法判定（请调整变量取值范围）",
};

function firstErrorMessage(evidence: Readonly<Record<string, unknown>>): string | null {
  const errors = evidence.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first: unknown = errors[0];
    if (typeof first === "object" && first !== null && "message" in first) {
      const message = (first as { message: unknown }).message;
      if (typeof message === "string") return message;
    }
  }
  return null;
}

function formatNumber(value: number | null): string {
  return value === null ? "无定义" : String(Number(value.toPrecision(10)));
}

function describeOutcome(
  outcome: ReturnType<(typeof MATH_QUESTION_TYPES)["math.expression"]["grade"]>,
): TrialResult {
  if (outcome.verdict === "correct") {
    const points = outcome.evidence.validPoints;
    return {
      verdict: "correct",
      message:
        typeof points === "number"
          ? `判对：在 ${points} 个取点上与标准答案一致`
          : "判对：在误差范围内与标准答案一致",
    };
  }
  if (outcome.verdict === "incorrect") {
    const mismatch = outcome.evidence.firstMismatch as
      | { scope: Record<string, number>; answer: number | null; expected: number | null }
      | null
      | undefined;
    if (mismatch) {
      const scope = Object.entries(mismatch.scope)
        .map(([name, value]) => `${name} = ${formatNumber(value)}`)
        .join("，");
      return {
        verdict: "incorrect",
        message: `判错：${scope} 时作答为 ${formatNumber(mismatch.answer)}，标准答案为 ${formatNumber(mismatch.expected)}`,
      };
    }
    const value = outcome.evidence.value;
    return {
      verdict: "incorrect",
      message: typeof value === "number" ? `判错：作答的值为 ${formatNumber(value)}，超出误差范围` : "判错",
    };
  }
  const reason = ERROR_REASON_TEXT[outcome.reason] ?? "无法判定";
  const detail = firstErrorMessage(outcome.evidence);
  return { verdict: "error", message: detail ? `无法判定：${reason}（${detail}）` : `无法判定：${reason}` };
}

/** 对一道数学题试判一个学生答案；选择题不适用。种子仅用于试判，不影响保存。 */
export function trialGrade(
  question: DraftExpressionQuestion | DraftNumericQuestion,
  answer: string,
  seed = 1,
): TrialResult {
  if (question.kind === "expression") {
    const spec = buildExpressionSpec(question, seed);
    if (!spec.ok) return { verdict: "error", message: spec.message };
    return describeOutcome(
      MATH_QUESTION_TYPES["math.expression"].grade({ answer, spec: spec.value, maxPoints: 1 }),
    );
  }
  const spec = buildNumericSpec(question);
  if (!spec.ok) return { verdict: "error", message: spec.message };
  return describeOutcome(
    MATH_QUESTION_TYPES["math.numeric"].grade({ answer, spec: spec.value, maxPoints: 1 }),
  );
}

/** 保存前自检：标准答案对自身判题必须为“正确”。 */
export function selfCheck(question: DraftExpressionQuestion | DraftNumericQuestion): TrialResult {
  const answer = question.expected.trim();
  return trialGrade(question, answer);
}

/** 标准表达式的 LaTeX（用于 KaTeX 预览）；无法解析时返回 null。 */
export function expressionToTex(expected: string, variables: readonly DraftVariable[]): string | null {
  const text = expected.trim();
  if (text.length === 0) return null;
  const names = variables.map((v) => v.name.trim()).filter((name) => isValidSymbolName(name));
  const compiled = compileExpression(text, { variables: names });
  return compiled.ok ? compiled.toTex() : null;
}

// ---------- 校验整份草稿并生成 RPC 题目 ----------

export type RpcQuestion = {
  type: "math.expression" | "math.numeric" | "single_choice";
  prompt: string;
  points: number;
  explanation: string;
  difficulty: Difficulty;
  options?: string[];
  correctAnswer?: string;
  mathSpec?: RpcMathSpec;
};

export type PaperValidation =
  | {
      ok: true;
      title: string;
      description: string;
      durationMinutes: number | null;
      passingScore: number | null;
      questions: RpcQuestion[];
    }
  | { ok: false; errors: string[] };

function normalized(text: string) {
  return text.trim().toLowerCase();
}

/**
 * 校验整份草稿。`seedFor(index)` 为第 index 题（从 0 起）提供判题种子；
 * 客户端传固定值，服务端传随机值。最多返回前 20 条错误，每条带题号。
 */
export function validatePaperDraft(draft: DraftPaper, seedFor: (index: number) => number): PaperValidation {
  const errors: string[] = [];
  const title = draft.title.trim();
  const description = draft.description.trim();
  if (title.length < 2 || title.length > 120) errors.push("试卷名称需要填写 2 至 120 个字");
  if (description.length > 5000) errors.push("试卷说明不能超过 5000 个字");

  let durationMinutes: number | null = null;
  if (draft.durationMinutes.trim() !== "") {
    const value = parseDecimal(draft.durationMinutes);
    if (value === null || !Number.isInteger(value) || value < 1 || value > 600) {
      errors.push("建议用时需要是 1 至 600 的整数分钟");
    } else durationMinutes = value;
  }
  let passingScore: number | null = null;
  if (draft.passingScore.trim() !== "") {
    const value = parseDecimal(draft.passingScore);
    if (value === null || value < 0 || value > 100) errors.push("及格线需要是 0 至 100 的数字");
    else passingScore = value;
  }

  if (draft.questions.length < 1 || draft.questions.length > MAX_QUESTIONS) {
    errors.push(`每套试卷需要 1 至 ${MAX_QUESTIONS} 道题目`);
  }

  const questions: RpcQuestion[] = [];
  const seenPrompts = new Set<string>();
  draft.questions.slice(0, MAX_QUESTIONS).forEach((question, index) => {
    const label = `第 ${index + 1} 题`;
    const problems: string[] = [];
    const prompt = question.prompt.trim();
    const explanation = question.explanation.trim();
    const points = parseDecimal(question.points);
    if (prompt.length < 1 || prompt.length > 3000) problems.push("题干不能为空且不能超过 3000 个字");
    else if (seenPrompts.has(normalized(prompt))) problems.push("题干与前面的题重复");
    else seenPrompts.add(normalized(prompt));
    if (explanation.length < 1 || explanation.length > 3000) problems.push("解析不能为空且不能超过 3000 个字");
    if (points === null || points <= 0 || points > 1000) problems.push("分值需要大于 0 且不超过 1000");
    if (!(DIFFICULTIES as readonly string[]).includes(question.difficulty)) problems.push("难度不正确");

    let rpc: RpcQuestion | null = null;
    if (question.kind === "choice") {
      const options = question.options.map((option) => option.trim());
      if (options.length < 2 || options.some((option) => option.length === 0)) {
        problems.push("选项至少两个且不能为空");
      } else if (new Set(options.map(normalized)).size !== options.length) {
        problems.push("选项不能重复");
      }
      if (question.correctIndex === null || question.correctIndex < 0 || question.correctIndex >= options.length) {
        problems.push("请选择正确答案");
      }
      if (problems.length === 0 && points !== null && question.correctIndex !== null) {
        rpc = {
          type: "single_choice",
          prompt,
          points,
          explanation,
          difficulty: question.difficulty,
          options,
          correctAnswer: options[question.correctIndex],
        };
      }
    } else {
      const spec =
        question.kind === "expression"
          ? buildExpressionSpec(question, seedFor(index))
          : buildNumericSpec(question);
      if (!spec.ok) problems.push(spec.message);
      else {
        const check = selfCheck(question);
        if (check.verdict !== "correct") problems.push(`标准答案无法通过自检：${check.message}`);
        else if (problems.length === 0 && points !== null) {
          rpc = {
            type: question.kind === "expression" ? "math.expression" : "math.numeric",
            prompt,
            points,
            explanation,
            difficulty: question.difficulty,
            mathSpec: spec.value,
          };
        }
      }
    }
    if (problems.length > 0) errors.push(...problems.map((problem) => `${label}：${problem}`));
    else if (rpc) questions.push(rpc);
  });

  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 20) };
  return { ok: true, title, description, durationMinutes, passingScore, questions };
}
