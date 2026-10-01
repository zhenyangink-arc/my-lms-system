/**
 * 数学作答的机器判题流程（不依赖框架，便于单元测试）：
 * 读取尚未判过的数学作答 → 调用确定性判题器 → 把建议得分写入机器判题结果。
 * 机器判题只是**建议**：正式得分仍由教师批改函数写入，状态机不变。
 */
import { MATH_QUESTION_TYPES, type MathGradeOutcome, type MathQuestionTypeKey } from "../question-types.ts";
import { EXPRESSION_GRADER, NUMERIC_GRADER } from "./equivalence.ts";

export type AnswerToGrade = {
  answerId: string;
  questionType: string;
  /** 题目满分 */
  points: number;
  answerText: string;
  /** 判题规格（来自数据库，不可信）；缺失时记为无法判定 */
  spec: unknown;
};

export type MachineGradeRecord = {
  answerId: string;
  graderKey: string;
  graderVersion: string;
  verdict: "correct" | "incorrect" | "error";
  suggestedPoints: number | null;
  reason: string;
  evidence: Readonly<Record<string, unknown>>;
};

export type MachineGradingStore = {
  /** 只返回属于给定提交、题型为数学题、且还没有机器判题结果的作答。 */
  listUngraded(submissionIds: string[]): Promise<AnswerToGrade[]>;
  record(record: MachineGradeRecord): Promise<{ error: string | undefined }>;
};

export const MAX_SUBMISSIONS_PER_RUN = 200;
export const MAX_ANSWERS_PER_RUN = 2000;

export function isMathQuestionType(type: string): type is MathQuestionTypeKey {
  return Object.prototype.hasOwnProperty.call(MATH_QUESTION_TYPES, type);
}

function graderFor(type: MathQuestionTypeKey) {
  return type === "math.expression" ? EXPRESSION_GRADER : NUMERIC_GRADER;
}

/** 对一条作答给出判题结果；空白作答建议 0 分，缺少规格记为无法判定。 */
export function gradeAnswer(answer: AnswerToGrade): MachineGradeRecord | null {
  if (!isMathQuestionType(answer.questionType)) return null;
  const grader = graderFor(answer.questionType);
  const base = { answerId: answer.answerId, graderKey: grader.key, graderVersion: grader.version };
  if (answer.answerText.trim() === "") {
    return { ...base, verdict: "incorrect", suggestedPoints: 0, reason: "blank_answer", evidence: {} };
  }
  if (answer.spec === null || answer.spec === undefined) {
    return { ...base, verdict: "error", suggestedPoints: null, reason: "invalid_spec", evidence: { message: "缺少判题规格" } };
  }
  const outcome: MathGradeOutcome = MATH_QUESTION_TYPES[answer.questionType].grade({
    answer: answer.answerText,
    spec: answer.spec,
    maxPoints: answer.points,
  });
  return {
    ...base,
    graderKey: outcome.grader.key,
    graderVersion: outcome.grader.version,
    verdict: outcome.verdict,
    suggestedPoints: outcome.suggestedPoints,
    reason: outcome.reason,
    evidence: outcome.evidence,
  };
}

export async function gradePendingMathAnswers(
  store: MachineGradingStore,
  submissionIds: string[],
): Promise<{ recorded: number; failed: number }> {
  const ids = [...new Set(submissionIds)].slice(0, MAX_SUBMISSIONS_PER_RUN);
  if (ids.length === 0) return { recorded: 0, failed: 0 };
  const answers = (await store.listUngraded(ids)).slice(0, MAX_ANSWERS_PER_RUN);
  let recorded = 0;
  let failed = 0;
  for (const answer of answers) {
    const record = gradeAnswer(answer);
    if (!record) continue;
    const result = await store.record(record);
    if (result.error) failed += 1;
    else recorded += 1;
  }
  return { recorded, failed };
}
