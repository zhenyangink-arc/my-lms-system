import { NextRequest, NextResponse } from "next/server";

import { isAdminRole } from "@/lib/admin";
import { getAuthContext } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const auth = await getAuthContext();

  if (auth.status === "unauthenticated") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (auth.status === "inactive") {
    return NextResponse.redirect(new URL("/account-disabled", request.url));
  }
  if (!isAdminRole(auth.profile?.role)) {
    return NextResponse.json({ error: "无权查看申请材料文件" }, { status: 403 });
  }

  const { data: file, error } = await auth.supabase
    .from("student_application_document_files")
    .select("storage_path, original_file_name")
    .eq("id", fileId)
    .maybeSingle();

  if (error || !file?.storage_path) {
    return NextResponse.json({ error: "申请材料版本不存在" }, { status: 404 });
  }

  // 每个历史版本都在管理员点击时单独生成五分钟有效的签名地址。
  const { data: signedFile, error: signedError } = await auth.supabase.storage
    .from("application-documents")
    .createSignedUrl(file.storage_path, 60 * 5, {
      download: file.original_file_name || "申请材料",
    });

  if (signedError || !signedFile?.signedUrl) {
    return NextResponse.json({ error: "文件下载地址生成失败" }, { status: 500 });
  }

  return NextResponse.redirect(signedFile.signedUrl);
}
