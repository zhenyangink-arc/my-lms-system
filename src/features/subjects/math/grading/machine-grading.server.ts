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

function chunks<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) result.push(items.slice(i, i + CHUNK));
  return result;
}

/** 用服务端权限读写判题数据；调用方必须已经确认这些提交属于当前教职人员有权批改的作业。 */
function createStore(admin: SupabaseClient): MachineGradingStore {
  return {
    async listUngraded(submissionIds) {
      const result: AnswerToGrade[] = [];
      for (const ids of chunks(submissionIds)) {
        const { data: answers } = await admin
          .from("learning_submission_answers")
          .select("id,question_id,answer_text")
          .in("submission_id", ids);
        if (!answers || answers.length === 0) continue;
        const questionIds = [...new Set(answers.map((a) => a.question_id as string))];
        const { data: questions } = await admin
          .from("learning_assignment_questions")
          .select("id,question_type,points")
          .in("id", questionIds);
        const mathQuestions = new Map(
          (questions ?? [])
            .filter((q) => isMathQuestionType(q.question_type as string))
            .map((q) => [q.id as string, q]),
        );
        if (mathQuestions.size === 0) continue;
        const mathAnswers = answers.filter((a) => mathQuestions.has(a.question_id as string));
        const { data: specs } = await admin
          .from("math_question_specs")
          .select("question_id,spec")
          .in("question_id", [...mathQuestions.keys()]);
        const specByQuestion = new Map((specs ?? []).map((s) => [s.question_id as string, s.spec as unknown]));
        const { data: existing } = await admin
          .from("learning_submission_machine_grades")
          .select("answer_id")
          .in("answer_id", mathAnswers.map((a) => a.id as string));
        const done = new Set((existing ?? []).map((g) => g.answer_id as string));
        for (const answer of mathAnswers) {
          if (done.has(answer.id as string)) continue;
          const question = mathQuestions.get(answer.question_id as string)!;
          result.push({
            answerId: answer.id as string,
            questionType: question.question_type as string,
            points: Number(question.points),
            answerText: String(answer.answer_text ?? ""),
            spec: specByQuestion.get(answer.question_id as string) ?? null,
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
