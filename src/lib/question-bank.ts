import "server-only";

import { redirect } from "next/navigation";

import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { hasExplicitPermission } from "@/lib/permissions/access";

export type StandardQuestionGroup = {
  id: string;
  lesson_id: string;
  curriculum_label?: string;
  slug: string;
  course_key: string;
  chapter_number: number;
  title: string;
  korean_title: string;
  status: "draft" | "published" | "archived";
};

export type StandardQuestion = {
  id: string;
  test_id: string;
  question_key: string;
  question_type: "short_text" | "long_text" | "single_choice" | "file_link";
  prompt: string;
  options: unknown;
  correct_option: number | null;
  correct_answer: string | null;
  explanation: string;
  skill: string;
  ebook_section_step: string;
  ebook_page_reference: string;
  default_points: number;
  difficulty: "foundation" | "medium" | "hard" | "expert";
  tags: unknown;
  status: "draft" | "published" | "archived";
  version: number;
  sort_order: number;
  updated_at: string;
};

export type StandardQuestionBankAccess = {
  canView: boolean;
  canUse: boolean;
  canManage: boolean;
  role: UserRole;
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
};

export async function getStandardQuestionBankAccess(): Promise<StandardQuestionBankAccess> {
  const { supabase, user, profile, platformProfile } =
    await requireActiveUser();
  const roleValue =
    platformProfile?.role === "platform_super_admin"
      ? "platform_super_admin"
      : profile?.role;
  const role = isValidRole(roleValue) ? roleValue : "student";
  const canManage =
    role === "platform_super_admin" ||
    await hasExplicitPermission(
      supabase,
      user.id,
      "standard_question_bank.manage",
      null
    );
  // 标准题库不再直接开放给机构。平台先把题目组成完整试卷，
  // 机构只能预览和发布平台已经发布的整套试卷。
  const canUse = canManage;

  return {
    canView: canUse,
    canUse,
    canManage,
    role,
    supabase,
    user,
  };
}

export async function requireStandardQuestionBankViewer() {
  const access = await getStandardQuestionBankAccess();
  if (!access.canView) redirect("/dashboard");
  return access;
}

export async function requireStandardQuestionBankManager() {
  const access = await getStandardQuestionBankAccess();
  if (!access.canManage) redirect("/dashboard/admin/assignments");
  return access;
}

export function questionOptions(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

export function questionTags(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function standardQuestionAnswer(question: StandardQuestion) {
  if (question.question_type === "single_choice") {
    const options = questionOptions(question.options);
    return question.correct_option === null
      ? ""
      : options[question.correct_option] ?? "";
  }

  return question.correct_answer ?? "";
}
