import { NextRequest, NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import { isAdminRole } from "@/lib/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
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

  const { data: document, error } = await auth.supabase
    .from("student_application_documents")
    .select("storage_path, original_file_name")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !document?.storage_path) {
    return NextResponse.json({ error: "申请材料文件不存在" }, { status: 404 });
  }

  // 签名地址只在管理员点击时生成，并使用短时有效期，避免文件地址长期暴露。
  const { data: signedFile, error: signedError } = await auth.supabase.storage
    .from("application-documents")
    .createSignedUrl(document.storage_path, 60 * 5, {
      download: document.original_file_name || "申请材料",
    });

  if (signedError || !signedFile?.signedUrl) {
    return NextResponse.json({ error: "文件下载地址生成失败" }, { status: 500 });
  }

  return NextResponse.redirect(signedFile.signedUrl);
}
