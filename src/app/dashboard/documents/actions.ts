"use server";

import { revalidatePath } from "next/cache";

import { requireStudentFeature } from "@/lib/student-permissions-server";
import type { DocumentActionState } from "./document-action-state";

const STUDENT_PREPARATION_STATUSES = ["not_started", "preparing"];
const SUBMITTABLE_STATUSES = ["not_started", "preparing", "pending_review", "revision_required"];
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

function result(status: "success" | "error", message: string): DocumentActionState {
  return { status, message };
}

export async function saveApplicationDocumentAction(
  documentId: string,
  _previousState: DocumentActionState,
  formData: FormData
): Promise<DocumentActionState> {
  const { supabase, user } = await requireStudentFeature("application_documents");
  const requestedStatus = String(formData.get("status") ?? "").trim();

  const { data: currentDocument, error: documentError } = await supabase
    .from("student_application_documents")
    .select("id, status")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (documentError || !currentDocument) return result("error", "找不到要更新的申请材料。");

  if (STUDENT_PREPARATION_STATUSES.includes(requestedStatus)) {
    if (!STUDENT_PREPARATION_STATUSES.includes(currentDocument.status)) {
      return result("error", "材料已提交审核，当前不能退回准备状态。");
    }

    const { data: updatedDocument, error } = await supabase
      .from("student_application_documents")
      .update({ status: requestedStatus })
      .eq("id", documentId)
      .eq("user_id", user.id)
      .in("status", STUDENT_PREPARATION_STATUSES)
      .select("id")
      .maybeSingle();

    if (error || !updatedDocument) return result("error", "材料准备状态保存失败，请稍后重试。");
    revalidatePath("/dashboard/documents");
    return result("success", requestedStatus === "preparing" ? "已标记为准备中。" : "已标记为未开始。");
  }

  if (requestedStatus !== "ready") return result("error", "请选择有效的材料状态。");
  if (!SUBMITTABLE_STATUSES.includes(currentDocument.status)) {
    return result("error", "当前材料已经提交，请等待管理员审核。");
  }

  const file = formData.get("document_file");
  if (!(file instanceof File) || file.size === 0) {
    return result("error", "选择“已准备”时必须上传材料文件。");
  }

  const extension = FILE_TYPES[file.type];
  if (!extension) return result("error", "仅支持 PDF、JPG、PNG、WEBP、DOC 或 DOCX 文件。");
  if (file.size > MAX_FILE_SIZE) return result("error", "单个申请材料不能超过 15MB。");

  const safeFileName = file.name.trim().slice(0, 180);
  if (!safeFileName) return result("error", "文件名称无效，请重新选择文件。");

  // 文件路径不包含学生原始文件名，避免特殊字符影响存储；原始名称单独保存在数据库。
  const storagePath = `${user.id}/${documentId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("application-documents")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return result("error", "文件上传失败，请检查格式和大小后重试。");

  const { error: submitError } = await supabase.rpc("submit_student_application_document", {
    requested_document_id: documentId,
    requested_storage_path: storagePath,
    requested_file_name: safeFileName,
    requested_file_size: file.size,
    requested_mime_type: file.type,
  });

  if (submitError) {
    // 数据库提交失败时只删除尚未登记的孤立文件，不影响任何历史版本。
    await supabase.storage.from("application-documents").remove([storagePath]);
    return result("error", "材料提交失败，请刷新页面后重新上传。");
  }

  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/admin/documents");
  revalidatePath(`/dashboard/admin/documents/${user.id}`);
  return result(
    "success",
    currentDocument.status === "pending_review"
      ? "提交文件已更换，新版本正在等待审核。"
      : currentDocument.status === "revision_required"
        ? "新版本已重新提交，等待管理员审核。"
        : "材料已提交，当前进入待审核状态。"
  );
}
