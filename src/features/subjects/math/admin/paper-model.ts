/**
 * 数学试卷草稿的纯逻辑：界面状态 → 校验 → create_math_paper 所需的题目数组。
 * 客户端用它做即时校验与“试判”，服务端动作用同一份代码再校验一次；
 * 数据库还有结构校验兜底。判题随机种子不在界面里出现，由调用方在构造时提供。
 */
import { compileExpression } from "../vendor/math-core/compile.ts";
import { MAX_EXPRESSION_LENGTH } from "../vendor/math-core/limits.ts";
import { isValidSymbolName } from "../vendor/math-core/validate.ts";
import { MATH_QUESTION_TYPES, type MathGradeOutcome } from "../question-types.ts";

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

/** 把判题结果（含数据库里保存的结果）转成面向老师的中文说明。 */
export function describeOutcome(
  outcome: Pick<MathGradeOutcome, "verdict" | "reason" | "evidence">,
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

// ---------- 解析不可信的草稿 JSON（服务端用） ----------

const MAX_TEXT = 6000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max = MAX_TEXT): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

/**
 * 把客户端提交的 JSON 解析成 DraftPaper：严格检查结构与类型，忽略多余字段，
 * 不信任任何一项（题数、选项数、变量数都有上限）。内容层面的校验仍由 validatePaperDraft 完成。
 */
export function parseDraftPaper(raw: unknown): { ok: true; value: DraftPaper } | { ok: false } {
  if (!isRecord(raw)) return { ok: false };
  const title = text(raw.title);
  const description = text(raw.description);
  const durationMinutes = text(raw.durationMinutes, 20);
  const passingScore = text(raw.passingScore, 20);
  if (title === null || description === null || durationMinutes === null || passingScore === null) return { ok: false };
  if (!Array.isArray(raw.questions) || raw.questions.length > MAX_QUESTIONS) return { ok: false };

  const questions: DraftQuestion[] = [];
  for (const item of raw.questions) {
    if (!isRecord(item)) return { ok: false };
    const prompt = text(item.prompt);
    const points = text(item.points, 20);
    const explanation = text(item.explanation);
    const difficulty = item.difficulty;
    if (prompt === null || points === null || explanation === null) return { ok: false };
    if (typeof difficulty !== "string" || !(DIFFICULTIES as readonly string[]).includes(difficulty)) return { ok: false };
    const base = { prompt, points, explanation, difficulty: difficulty as Difficulty };

    if (item.kind === "choice") {
      if (!Array.isArray(item.options) || item.options.length > 8) return { ok: false };
      const options: string[] = [];
      for (const option of item.options) {
        const value = text(option, 1000);
        if (value === null) return { ok: false };
        options.push(value);
      }
      const index = item.correctIndex;
      if (index !== null && !(typeof index === "number" && Number.isInteger(index))) return { ok: false };
      questions.push({ ...base, kind: "choice", options, correctIndex: index });
    } else if (item.kind === "expression" || item.kind === "numeric") {
      const expected = text(item.expected, 400);
      const toleranceAbs = text(item.toleranceAbs, 40);
      const toleranceRel = text(item.toleranceRel, 40);
      if (expected === null || toleranceAbs === null || toleranceRel === null) return { ok: false };
      if (item.kind === "numeric") {
        questions.push({ ...base, kind: "numeric", expected, toleranceAbs, toleranceRel });
      } else {
        if (!Array.isArray(item.variables) || item.variables.length > MAX_VARIABLES) return { ok: false };
        const variables: DraftVariable[] = [];
        for (const variable of item.variables) {
          if (!isRecord(variable)) return { ok: false };
          const name = text(variable.name, 64);
          const min = text(variable.min, 40);
          const max = text(variable.max, 40);
          if (name === null || min === null || max === null) return { ok: false };
          variables.push({ name, min, max });
        }
        questions.push({ ...base, kind: "expression", expected, variables, toleranceAbs, toleranceRel });
      }
    } else return { ok: false };
  }
  return { ok: true, value: { title, description, durationMinutes, passingScore, questions } };
}

// ---------- 把已保存的草稿还原成可编辑的表单状态 ----------

export type SavedPaperRow = {
  title: string;
  description: string;
  duration_minutes: number | null;
  passing_score: number | string | null;
};

export type SavedQuestionRow = {
  id: string;
  question_type: string;
  prompt: string;
  options: unknown;
  points: number | string;
  difficulty: string;
  sort_order: number;
  /** 答案键：选择题的正确答案文本、解析 */
  correct_answer: string | null;
  explanation: string | null;
  /** 数学题的判题规格；来自数据库，按不可信数据处理 */
  spec: unknown;
};

function numberText(value: unknown): string | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? String(n) : null;
}

/**
 * 把数据库里的草稿试卷还原成 DraftPaper。任何一处无法识别就返回 null（界面会提示“无法编辑，请复制为新草稿”），
 * 不做猜测式还原。判题种子不还原：保存时服务端会重新生成。
 */
export function draftFromRows(paper: SavedPaperRow, rows: readonly SavedQuestionRow[]): DraftPaper | null {
  const questions: DraftQuestion[] = [];
  for (const row of [...rows].sort((a, b) => a.sort_order - b.sort_order)) {
    const points = numberText(row.points);
    if (points === null || !(DIFFICULTIES as readonly string[]).includes(row.difficulty)) return null;
    const base = {
      prompt: row.prompt,
      points,
      difficulty: row.difficulty as Difficulty,
      explanation: row.explanation ?? "",
    };
    if (row.question_type === "single_choice") {
      if (!Array.isArray(row.options) || !row.options.every((o) => typeof o === "string")) return null;
      const options = row.options as string[];
      const index = row.correct_answer === null ? -1 : options.indexOf(row.correct_answer);
      questions.push({ ...base, kind: "choice", options, correctIndex: index >= 0 ? index : null });
    } else if (row.question_type === "math.numeric") {
      const spec = row.spec;
      if (!isRecord(spec) || !isRecord(spec.tolerance)) return null;
      const expected = numberText(spec.expected);
      const abs = numberText(spec.tolerance.abs);
      const rel = numberText(spec.tolerance.rel);
      if (expected === null || abs === null || rel === null) return null;
      questions.push({ ...base, kind: "numeric", expected, toleranceAbs: abs, toleranceRel: rel });
    } else if (row.question_type === "math.expression") {
      const spec = row.spec;
      if (!isRecord(spec) || typeof spec.expected !== "string" || !Array.isArray(spec.variables)) return null;
      const variables: DraftVariable[] = [];
      for (const variable of spec.variables) {
        if (!isRecord(variable) || typeof variable.name !== "string") return null;
        const min = numberText(variable.min);
        const max = numberText(variable.max);
        if (min === null || max === null) return null;
        variables.push({ name: variable.name, min, max });
      }
      const tolerance = isRecord(spec.tolerance) ? spec.tolerance : { abs: 1e-9, rel: 1e-9 };
      const abs = numberText(tolerance.abs);
      const rel = numberText(tolerance.rel);
      if (abs === null || rel === null) return null;
      questions.push({ ...base, kind: "expression", expected: spec.expected, variables, toleranceAbs: abs, toleranceRel: rel });
    } else return null;
  }
  return {
    title: paper.title,
    description: paper.description,
    durationMinutes: paper.duration_minutes === null ? "" : String(paper.duration_minutes),
    passingScore: paper.passing_score === null ? "" : (numberText(paper.passing_score) ?? ""),
    questions,
  };
}
