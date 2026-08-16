"use server";

import { requireActiveUser } from "@/lib/auth";
import { STUDENT_APP_IDS } from "@/lib/student-apps";

const TOOLBOX_SKILLS = [
  "vocabulary",
  "speaking",
  "grammar",
  "listening",
  "reading",
  "writing",
];

type PracticeAnswer = {
  questionId: string;
  response: string;
  durationSeconds: number;
};

export type ToolboxPracticeResult = {
  sessionId: string;
  answeredCount: number;
  correctCount: number;
  earnedScore: number;
  maxScore: number;
  percentage: number;
};

export type SubmitToolboxPracticeResponse =
  | { ok: true; result: ToolboxPracticeResult }
  | { ok: false; message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 记录成长工具箱练习时长（增量秒数）到 learning_time_log（source='toolbox'）。
 * 由练习页的计时组件周期上报；单次上限 1 小时，防异常数据。
 */
export async function recordToolboxStudyTime(
  skill: string,
  seconds: number
): Promise<void> {
  const s = Math.floor(Number(seconds) || 0);
  if (!TOOLBOX_SKILLS.includes(skill)) return;
  if (s < 1 || s > 3600) return;

  const { supabase, user, tenant } = await requireActiveUser();
  if (!tenant?.id) return;

  await supabase.from("learning_time_log").insert({
    tenant_id: tenant.id,
    student_id: user.id,
    student_app_id: STUDENT_APP_IDS.korean,
    test_slug: `toolbox-${skill}`,
    source: "toolbox",
    seconds: s,
  });
}

/**
 * 提交成长工具箱专项练习。所有得分都由数据库根据私有答案表重新核验，
 * 客户端提交的内容只包含题号、答案和该题停留时间。
 */
export async function submitToolboxPractice(input: {
  exerciseId: string;
  answers: PracticeAnswer[];
  activeSeconds: number;
  clientEventId: string;
}): Promise<SubmitToolboxPracticeResponse> {
  if (
    !UUID_PATTERN.test(input.exerciseId) ||
    !UUID_PATTERN.test(input.clientEventId) ||
    !Array.isArray(input.answers) ||
    input.answers.length < 1 ||
    input.answers.length > 100
  ) {
    return { ok: false, message: "练习提交内容不完整，请刷新后重试。" };
  }

  const answers = input.answers.map((answer) => ({
    questionId: String(answer.questionId ?? ""),
    response: String(answer.response ?? "").trim().slice(0, 5000),
    durationSeconds: Math.max(
      0,
      Math.min(7200, Math.floor(Number(answer.durationSeconds) || 0)),
    ),
  }));

  if (
    answers.some(
      (answer) =>
        !UUID_PATTERN.test(answer.questionId) || answer.response.length === 0,
    )
  ) {
    return { ok: false, message: "请完成全部题目后再提交。" };
  }

  const { supabase, tenant, profile } = await requireActiveUser();
  if (!tenant?.id || profile?.role !== "student") {
    return { ok: false, message: "只有当前机构的学生账号可以提交练习。" };
  }

  const { data, error } = await supabase.rpc("submit_toolbox_practice", {
    p_exercise_id: input.exerciseId,
    p_answers: answers,
    p_active_seconds: Math.max(
      0,
      Math.min(7200, Math.floor(Number(input.activeSeconds) || 0)),
    ),
    p_client_event_id: input.clientEventId,
  });

  if (error || !data || typeof data !== "object") {
    return { ok: false, message: "练习结果保存失败，请稍后再试。" };
  }

  const result = data as Record<string, unknown>;
  return {
    ok: true,
    result: {
      sessionId: String(result.sessionId ?? ""),
      answeredCount: Number(result.answeredCount ?? 0),
      correctCount: Number(result.correctCount ?? 0),
      earnedScore: Number(result.earnedScore ?? 0),
      maxScore: Number(result.maxScore ?? 0),
      percentage: Number(result.percentage ?? 0),
    },
  };
}
