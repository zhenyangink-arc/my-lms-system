"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireDocumentReviewManager } from "@/lib/document-reviews";
import type { ModuleCardDeleteState } from "../StudentModuleCardDeleteDialog";

// randomUUID() 用 Web Crypto API 全局对象获取，node:crypto 在 Edge Runtime 下不可用
const randomUUID = () => crypto.randomUUID();

const DOCUMENT_CATEGORIES = ["identity", "academic", "application", "financial", "language", "other"];
const VISA_APPLICATION_CHANNELS = ["china_consulate", "korea_immigration"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function revalidateDocumentPages(studentId: string) {
  revalidatePath("/dashboard/admin/documents");
  revalidatePath(`/dashboard/admin/documents/${studentId}`);
  revalidatePath("/dashboard/documents");
}

export async function deleteStudentDocumentCardAction(
  studentId: string,
  _previousState: ModuleCardDeleteState,
  _formData: FormData
): Promise<ModuleCardDeleteState> {
  void _previousState;
  void _formData;
  const { supabase } = await requireDocumentReviewManager();

  const { error } = await supabase.rpc("delete_student_application_document_card", {
    requested_user_id: studentId,
  });

  if (error) {
    return { status: "error", message: "申请资料卡删除失败，请刷新后重试。" };
  }

  revalidateDocumentPages(studentId);
  redirect("/dashboard/admin/documents?deleted=1");
}

export async function createApplicationChecklistItemAction(
  studentId: string,
  formData: FormData
) {
  const { supabase } = await requireDocumentReviewManager();
  const targetId = String(formData.get("targetId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "other").trim();

  if (title.length < 1 || title.length > 100) {
    throw new Error("资料名称需要填写 1—100 个字符。");
  }
  if (!DOCUMENT_CATEGORIES.includes(category)) {
    throw new Error("请选择有效的资料分类。");
  }

  const { data: target } = await supabase
    .from("student_university_targets")
    .select("id, user_id")
    .eq("id", targetId)
    .eq("user_id", studentId)
    .neq("status", "researching")
    .maybeSingle();
  if (!target) throw new Error("找不到这名学生对应的目标大学申请表。");

  const { data: lastItem } = await supabase
    .from("student_application_documents")
    .select("sort_order")
    .eq("target_id", targetId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("student_application_documents").insert({
    user_id: studentId,
    target_id: targetId,
    document_key: `managed-${randomUUID()}`,
    title,
    category,
    status: "preparing",
    sort_order: (lastItem?.sort_order ?? 0) + 10,
  });
  if (error) throw new Error(`新增申请资料失败：${error.message}`);
  revalidateDocumentPages(studentId);
}

export async function deleteApplicationChecklistItemAction(
  studentId: string,
  documentId: string
) {
  const { supabase } = await requireDocumentReviewManager();

  const { data: existing } = await supabase
    .from("student_application_documents")
    .select("id, admin_locked_at")
    .eq("id", documentId)
    .eq("user_id", studentId)
    .maybeSingle();

  if (!existing) {
    throw new Error("找不到这项申请资料，可能已经被删除。");
  }
  if (existing.admin_locked_at !== null) {
    throw new Error("这项资料已锁定，请先解锁再删除。");
  }

  const { data, error } = await supabase
    .from("student_application_documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", studentId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error("申请资料项目删除失败，请刷新后重试。");
  }
  revalidateDocumentPages(studentId);
}

export async function updateApplicationChecklistItemNoteAction(
  studentId: string,
  documentId: string,
  formData: FormData
) {
  const { supabase } = await requireDocumentReviewManager();
  const adminNote = String(formData.get("adminNote") ?? "").trim();

  if (adminNote.length > 300) {
    throw new Error("管理员备注最多 300 个字符。");
  }

  const { data: existing } = await supabase
    .from("student_application_documents")
    .select("id, admin_locked_at")
    .eq("id", documentId)
    .eq("user_id", studentId)
    .maybeSingle();

  if (!existing) {
    throw new Error("找不到这项申请资料，可能已经被删除。");
  }
  if (existing.admin_locked_at !== null) {
    throw new Error("这项资料已锁定，请先解锁再修改。");
  }

  const { data, error } = await supabase
    .from("student_application_documents")
    .update({ admin_note: adminNote || null })
    .eq("id", documentId)
    .eq("user_id", studentId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error("管理员备注保存失败，请刷新后重试。");
  }
  revalidateDocumentPages(studentId);
}

export async function toggleApplicationChecklistItemLockAction(
  studentId: string,
  documentId: string,
  locked: boolean
) {
  const { supabase } = await requireDocumentReviewManager();
  const { data, error } = await supabase
    .from("student_application_documents")
    .update({ admin_locked_at: locked ? new Date().toISOString() : null })
    .eq("id", documentId)
    .eq("user_id", studentId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error(locked ? "锁定失败，请刷新后重试。" : "解锁失败，请刷新后重试。");
  }
  revalidateDocumentPages(studentId);
}

export async function toggleTargetDocumentsLockAction(
  studentId: string,
  targetId: string,
  locked: boolean
) {
  const { supabase } = await requireDocumentReviewManager();
  const { data, error } = await supabase
    .from("student_university_targets")
    .update({ documents_locked_at: locked ? new Date().toISOString() : null })
    .eq("id", targetId)
    .eq("user_id", studentId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error(locked ? "锁定失败，请刷新后重试。" : "解锁失败，请刷新后重试。");
  }
  revalidateDocumentPages(studentId);
  redirect(`/dashboard/admin/documents/${studentId}`);
}

export async function updateApplicationStageAction(
  studentId: string,
  targetId: string,
  formData: FormData
) {
  const { supabase } = await requireDocumentReviewManager();
  const stage = Number(formData.get("stage"));

  if (!Number.isInteger(stage) || stage < 0 || stage > 9) {
    throw new Error("无效的申请阶段。");
  }

  if (stage === 9) {
    const { data: target, error: targetError } = await supabase
      .from("student_university_targets")
      .select("visa_application_channel")
      .eq("id", targetId)
      .eq("user_id", studentId)
      .maybeSingle();

    if (targetError || !target) {
      throw new Error("找不到这名学生对应的目标大学申请表。");
    }
    if (!VISA_APPLICATION_CHANNELS.includes(target.visa_application_channel ?? "")) {
      throw new Error("请先选择并确认签证办理方式，再点亮第九步。");
    }
  }

  const updatePayload: Record<string, unknown> = { application_stage: stage };
  if (stage < 3) {
    updatePayload.courier_mailed_at = null;
    updatePayload.courier_estimated_arrival_at = null;
  }

  const { data, error } = await supabase
    .from("student_university_targets")
    .update(updatePayload)
    .eq("id", targetId)
    .eq("user_id", studentId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error("阶段更新失败，请刷新后重试。");
  }
  revalidateDocumentPages(studentId);
  revalidatePath("/dashboard/visa");
  revalidatePath("/dashboard/admin/visa");
  revalidatePath(`/dashboard/admin/visa/${studentId}`);
  redirect(`/dashboard/admin/documents/${studentId}`);
}

export async function updateCourierInfoAction(
  studentId: string,
  targetId: string,
  formData: FormData
) {
  const { supabase } = await requireDocumentReviewManager();

  const mailedAt = String(formData.get("courierMailedAt") ?? "").trim();
  const estimatedArrivalAt = String(formData.get("courierEstimatedArrivalAt") ?? "").trim();

  if (!mailedAt || !estimatedArrivalAt) {
    throw new Error("请同时填写快递邮寄时间和预计到达时间。");
  }
  if (!DATE_PATTERN.test(mailedAt) || !DATE_PATTERN.test(estimatedArrivalAt)) {
    throw new Error("日期格式不正确。");
  }
  if (estimatedArrivalAt < mailedAt) {
    throw new Error("预计到达时间不能早于快递邮寄时间。");
  }

  const { data, error } = await supabase
    .from("student_university_targets")
    .update({
      courier_mailed_at: mailedAt,
      courier_estimated_arrival_at: estimatedArrivalAt,
    })
    .eq("id", targetId)
    .eq("user_id", studentId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error("快递信息保存失败，请刷新后重试。");
  }

  revalidateDocumentPages(studentId);
}

export async function confirmVisaApplicationChannelAction(
  studentId: string,
  targetId: string,
  formData: FormData
) {
  const { supabase } = await requireDocumentReviewManager();
  const applicationChannel = String(formData.get("applicationChannel") ?? "").trim();

  if (!VISA_APPLICATION_CHANNELS.includes(applicationChannel)) {
    throw new Error("请选择有效的签证办理方式。");
  }

  const { data, error } = await supabase
    .from("student_university_targets")
    .update({ visa_application_channel: applicationChannel })
    .eq("id", targetId)
    .eq("user_id", studentId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error("签证办理方式确认失败，请刷新后重试。");
  }

  revalidateDocumentPages(studentId);
  revalidatePath("/dashboard/visa");
  revalidatePath("/dashboard/admin/visa");
  revalidatePath(`/dashboard/admin/visa/${studentId}`);
  redirect(`/dashboard/admin/documents/${studentId}`);
}

export type DocumentReviewActionState = {
  status: "idle" | "success" | "error";
  message: string;
  completedAt?: string;
};

export async function reviewApplicationAction(
  targetId: string,
  decision: "revision_required" | "approved",
  _previousState: DocumentReviewActionState,
  formData: FormData
): Promise<DocumentReviewActionState> {
  void _previousState;
  const { supabase, user, tenantId } = await requireDocumentReviewManager();
  const note = String(formData.get("reviewNote") ?? "").trim();

  if (decision === "revision_required" && note.length < 2) {
    return {
      status: "error",
      message: "退回补充时请填写至少 2 个字符的原因。",
    };
  }
  if (note.length > 2000) {
    return { status: "error", message: "审核意见不能超过 2000 个字符。" };
  }

  const { data: target, error: targetError } = await supabase
    .from("student_university_targets")
    .select("id,user_id,application_stage,document_review_status")
    .eq("tenant_id", tenantId)
    .eq("id", targetId)
    .maybeSingle();

  if (targetError || !target) {
    return { status: "error", message: "找不到这份申请单，请刷新后重试。" };
  }
  if (target.document_review_status !== "pending_review") {
    return {
      status: "error",
      message: "这份申请单当前不在待确认状态，请刷新页面查看最新结果。",
    };
  }

  if (decision === "approved") {
    const { count, error: countError } = await supabase
      .from("student_application_documents")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("target_id", targetId)
      .eq("status", "preparing")
      .is("admin_locked_at", null);

    if (countError) {
      return { status: "error", message: "资料完整性检查失败，请稍后重试。" };
    }
    if ((count ?? 0) > 0) {
      return {
        status: "error",
        message: `还有 ${count} 项资料处于准备中，不能确认通过。`,
      };
    }
  }

  const reviewedAt = new Date().toISOString();
  const updatePayload =
    decision === "approved"
      ? {
          document_review_status: "approved",
          document_review_note: note,
          document_reviewed_at: reviewedAt,
          document_reviewed_by: user.id,
          documents_locked_at: reviewedAt,
          application_stage: Math.max(Number(target.application_stage ?? 0), 2),
        }
      : {
          document_review_status: "revision_required",
          document_review_note: note,
          document_reviewed_at: reviewedAt,
          document_reviewed_by: user.id,
          documents_locked_at: null,
        };

  const { data: updated, error } = await supabase
    .from("student_university_targets")
    .update(updatePayload)
    .eq("tenant_id", tenantId)
    .eq("id", targetId)
    .eq("document_review_status", "pending_review")
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return {
      status: "error",
      message: "审核结果未保存，申请单可能已被其他管理员处理。",
    };
  }

  revalidateDocumentPages(target.user_id);
  revalidatePath("/dashboard/admin/visa");

  return {
    status: "success",
    message: decision === "approved" ? "申请资料已确认通过。" : "已退回学生补充资料。",
    completedAt: reviewedAt,
  };
}
