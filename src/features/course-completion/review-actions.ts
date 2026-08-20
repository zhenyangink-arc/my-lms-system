"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireManagementAppAccess } from "@/lib/management-apps";
import { createClient } from "@/lib/supabase/server";
import type { CompletionCertificateActionState } from "./review-types";

const uuidSchema = z.string().uuid();
const reasonSchema = z.string().trim().min(2).max(1000);
const retakePolicySchema = z.enum(["highest", "latest", "weighted"]);

async function requireCompletionCertificateManager(space: string, appSlug: string) {
  const access = await requireManagementAppAccess(space, appSlug);
  const allowed =
    access.scope === "tenant" &&
    access.app.slug === "korean" &&
    Boolean(access.tenantId) &&
    (access.role === "tenant_super_admin" || access.role === "ceo");

  if (!allowed) throw new Error("当前账号没有结课证书管理权限。");
  return access;
}

async function requireCompletionRetakeManager(space: string, appSlug: string) {
  const access = await requireManagementAppAccess(space, appSlug);
  const allowed =
    access.scope === "tenant" &&
    access.app.slug === "korean" &&
    Boolean(access.tenantId) &&
    access.capabilities.manageAssessments &&
    ["teacher", "tenant_super_admin", "ceo"].includes(access.role);

  if (!allowed) throw new Error("当前账号没有发起补考的权限。");
  return access;
}

function failure(message: string): CompletionCertificateActionState {
  return { status: "error", message };
}

function databaseMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String(error.message).trim();
    if (message) return message;
  }
  return fallback;
}

function parseKoreanDateTime(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)
    ? `${raw}:00+09:00`
    : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function configureCompletionRetakeAction(
  space: string,
  appSlug: string,
  evaluationId: string,
  _previousState: CompletionCertificateActionState,
  formData: FormData,
): Promise<CompletionCertificateActionState> {
  void _previousState;
  const parsedEvaluationId = uuidSchema.safeParse(evaluationId);
  const parsedAssignmentId = uuidSchema.safeParse(formData.get("assignment_id"));
  const parsedPaperId = uuidSchema.safeParse(formData.get("retake_paper_id"));
  const parsedPolicy = retakePolicySchema.safeParse(formData.get("retake_score_policy"));
  const startsAt = parseKoreanDateTime(formData.get("retake_starts_at"));
  const dueAt = parseKoreanDateTime(formData.get("retake_due_at"));
  const originalWeight = Number(formData.get("retake_original_weight_percent"));

  if (!parsedEvaluationId.success || !parsedAssignmentId.success || !parsedPaperId.success) {
    return failure("资格记录、原考试或补考卷编号无效，请刷新后重试。");
  }
  if (!parsedPolicy.success) return failure("请选择有效的补考成绩采用规则。");
  if (!startsAt || !dueAt || startsAt <= new Date() || dueAt <= startsAt) {
    return failure("补考开始时间必须晚于当前时间，截止时间必须晚于开始时间。");
  }
  if (parsedPolicy.data === "weighted" && (!Number.isInteger(originalWeight) || originalWeight < 1 || originalWeight > 99)) {
    return failure("首次成绩占比需要填写 1 至 99。");
  }

  try {
    const access = await requireCompletionRetakeManager(space, appSlug);
    const supabase = await createClient();
    const { error } = await supabase.rpc("configure_learning_assignment_retake", {
      p_evaluation_id: parsedEvaluationId.data,
      p_assignment_id: parsedAssignmentId.data,
      p_retake_paper_id: parsedPaperId.data,
      p_retake_starts_at: startsAt.toISOString(),
      p_retake_due_at: dueAt.toISOString(),
      p_retake_score_policy: parsedPolicy.data,
      p_retake_original_weight_percent:
        parsedPolicy.data === "weighted" ? originalWeight : null,
    });
    if (error) return failure(databaseMessage(error, "补考发起失败，请稍后重试。"));
    revalidatePath(`${access.appPath}/completion-review`);
    revalidatePath(`/${encodeURIComponent(space)}/apps/${encodeURIComponent(appSlug)}`);
    revalidatePath(`/${encodeURIComponent(space)}/apps/${encodeURIComponent(appSlug)}/assignments`);
    return { status: "success", message: "补考已发起，学生会按设定时间看到任务。" };
  } catch (error) {
    return failure(databaseMessage(error, "补考发起失败，请稍后重试。"));
  }
}

export async function issueCompletionCertificateAction(
  space: string,
  appSlug: string,
  evaluationId: string,
  _previousState: CompletionCertificateActionState,
  _formData: FormData,
): Promise<CompletionCertificateActionState> {
  void _previousState;
  void _formData;
  const parsedId = uuidSchema.safeParse(evaluationId);
  if (!parsedId.success) return failure("结课资格记录编号无效，请刷新后重试。");

  try {
    const access = await requireCompletionCertificateManager(space, appSlug);
    const supabase = await createClient();
    const { error } = await supabase.rpc(
      "issue_course_completion_certificate",
      { p_evaluation_id: parsedId.data },
    );
    if (error) return failure(databaseMessage(error, "证书颁发失败，请稍后重试。"));
    revalidatePath(`${access.appPath}/completion-review`);
    return { status: "success", message: "证书已颁发。" };
  } catch (error) {
    return failure(databaseMessage(error, "证书颁发失败，请稍后重试。"));
  }
}

export async function revokeCompletionCertificateAction(
  space: string,
  appSlug: string,
  certificateId: string,
  _previousState: CompletionCertificateActionState,
  formData: FormData,
): Promise<CompletionCertificateActionState> {
  void _previousState;
  const parsedId = uuidSchema.safeParse(certificateId);
  const parsedReason = reasonSchema.safeParse(formData.get("reason"));
  if (!parsedId.success) return failure("证书编号无效，请刷新后重试。");
  if (!parsedReason.success) return failure("请填写 2 至 1000 字的明确撤销原因。");

  try {
    const access = await requireCompletionCertificateManager(space, appSlug);
    const supabase = await createClient();
    const { error } = await supabase.rpc(
      "revoke_course_completion_certificate",
      { p_certificate_id: parsedId.data, p_reason: parsedReason.data },
    );
    if (error) return failure(databaseMessage(error, "证书撤销失败，请稍后重试。"));
    revalidatePath(`${access.appPath}/completion-review`);
    return { status: "success", message: "证书已撤销。" };
  } catch (error) {
    return failure(databaseMessage(error, "证书撤销失败，请稍后重试。"));
  }
}

export async function reissueCompletionCertificateAction(
  space: string,
  appSlug: string,
  certificateId: string,
  evaluationId: string,
  _previousState: CompletionCertificateActionState,
  formData: FormData,
): Promise<CompletionCertificateActionState> {
  void _previousState;
  const parsedCertificateId = uuidSchema.safeParse(certificateId);
  const parsedEvaluationId = uuidSchema.safeParse(evaluationId);
  const parsedReason = reasonSchema.safeParse(formData.get("reason"));
  if (!parsedCertificateId.success || !parsedEvaluationId.success) {
    return failure("证书或资格记录编号无效，请刷新后重试。");
  }
  if (!parsedReason.success) return failure("请填写 2 至 1000 字的明确重新颁发原因。");

  try {
    const access = await requireCompletionCertificateManager(space, appSlug);
    const supabase = await createClient();
    const { error } = await supabase.rpc(
      "reissue_course_completion_certificate",
      {
        p_certificate_id: parsedCertificateId.data,
        p_reason: parsedReason.data,
        p_evaluation_id: parsedEvaluationId.data,
      },
    );
    if (error) return failure(databaseMessage(error, "证书重新颁发失败，请稍后重试。"));
    revalidatePath(`${access.appPath}/completion-review`);
    return { status: "success", message: "新证书已颁发，原证书已标记为被替代。" };
  } catch (error) {
    return failure(databaseMessage(error, "证书重新颁发失败，请稍后重试。"));
  }
}
