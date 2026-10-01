import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

import type { MachineSuggestion } from "../../admin-slot-contract.ts";
import { describeOutcome } from "../admin/paper-model.ts";
import {
  gradePendingMathAnswers,
  isMathQuestionType,
  type AnswerToGrade,
  type MachineGradingStore,
} from "./machine-grading.ts";

const CHUNK = 100;
/** PostgREST 默认单次最多返回 1000 行，需要翻页。 */
const PAGE = 1000;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** 翻页读取全部行；任何一页出错就抛出（不把读取失败当成“没有数据”）。 */
async function selectAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`机器判题读取失败：${error.message}`);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) break;
  }
  return rows;
}

/** 用服务端权限读写判题数据；调用方必须已经确认这些提交属于当前教职人员有权批改的作业。 */
export function createStore(admin: SupabaseClient): MachineGradingStore {
  return {
    async listUngraded(submissionIds, options) {
      const result: AnswerToGrade[] = [];
      for (const ids of chunks(submissionIds, 50)) {
        const answers = await selectAll<{ id: string; question_id: string; answer_text: string | null }>((from, to) =>
          admin
            .from("learning_submission_answers")
            .select("id,question_id,answer_text")
            .in("submission_id", ids)
            .order("id")
            .range(from, to),
        );
        if (answers.length === 0) continue;
        const questionIds = [...new Set(answers.map((a) => a.question_id))];
        const questions: { id: string; question_type: string; points: number | string }[] = [];
        for (const chunk of chunks(questionIds)) {
          questions.push(
            ...(await selectAll<{ id: string; question_type: string; points: number | string }>((from, to) =>
              admin.from("learning_assignment_questions").select("id,question_type,points").in("id", chunk).order("id").range(from, to),
            )),
          );
        }
        const mathQuestions = new Map(questions.filter((q) => isMathQuestionType(q.question_type)).map((q) => [q.id, q]));
        if (mathQuestions.size === 0) continue;
        const mathAnswers = answers.filter((a) => mathQuestions.has(a.question_id));
        const specByQuestion = new Map<string, unknown>();
        for (const chunk of chunks([...mathQuestions.keys()])) {
          const specs = await selectAll<{ question_id: string; spec: unknown }>((from, to) =>
            admin.from("math_question_specs").select("question_id,spec").in("question_id", chunk).order("question_id").range(from, to),
          );
          specs.forEach((row) => specByQuestion.set(row.question_id, row.spec));
        }
        const done = new Set<string>();
        if (!options?.includeGraded) {
          for (const chunk of chunks(mathAnswers.map((a) => a.id))) {
            const graded = await selectAll<{ id: string; answer_id: string }>((from, to) =>
              admin.from("learning_submission_machine_grades").select("id,answer_id").in("answer_id", chunk).order("id").range(from, to),
            );
            graded.forEach((row) => done.add(row.answer_id));
          }
        }
        for (const answer of mathAnswers) {
          if (done.has(answer.id)) continue;
          const question = mathQuestions.get(answer.question_id)!;
          result.push({
            answerId: answer.id,
            questionType: question.question_type,
            points: Number(question.points),
            answerText: String(answer.answer_text ?? ""),
            spec: specByQuestion.get(answer.question_id) ?? null,
          });
        }
      }
      return result;
    },
    async record(record) {
      const { error } = await admin.rpc("record_learning_machine_grade", {
        p_answer_id: record.answerId,
        p_grader_key: record.graderKey,
        p_grader_version: record.graderVersion,
        p_verdict: record.verdict,
        p_suggested_points: record.suggestedPoints,
        p_reason: record.reason,
        p_evidence: record.evidence,
        p_only_if_missing: record.onlyIfMissing === true,
      });
      return { error: error?.message };
    },
  };
}

/**
 * 教师批改页面调用：先给还没判过的数学作答补上机器判题，再用教职人员自己的连接
 * （受 RLS 约束）读取每道作答的最新建议。任何失败都不影响页面：返回已有的建议即可。
 */
export async function prepareMathMachineGrades(input: {
  supabase: SupabaseClient;
  pendingSubmissionIds: string[];
  answerIds: string[];
}): Promise<Map<string, MachineSuggestion>> {
  const suggestions = new Map<string, MachineSuggestion>();
  if (input.answerIds.length === 0) return suggestions;
  try {
    if (input.pendingSubmissionIds.length > 0) {
      await gradePendingMathAnswers(createStore(createAdminClient()), input.pendingSubmissionIds);
    }
    for (const ids of chunks(input.answerIds)) {
      const { data } = await input.supabase
        .from("learning_submission_machine_grades")
        .select("answer_id,revision,verdict,suggested_points,reason,evidence")
        .in("answer_id", ids)
        .order("revision", { ascending: false });
      for (const row of data ?? []) {
        const answerId = row.answer_id as string;
        if (suggestions.has(answerId)) continue; // 已按修订号从新到旧排序，保留最新一条
        const verdict = row.verdict as "correct" | "incorrect" | "error";
        suggestions.set(answerId, {
          verdict,
          suggestedPoints: row.suggested_points === null ? null : Number(row.suggested_points),
          message: describeOutcome({
            verdict,
            reason: String(row.reason ?? ""),
            evidence: (row.evidence ?? {}) as Record<string, unknown>,
          }).message,
        });
      }
    }
  } catch {
    // 机器判题只是辅助；读取或判题失败时教师仍可人工批改
  }
  return suggestions;
}
