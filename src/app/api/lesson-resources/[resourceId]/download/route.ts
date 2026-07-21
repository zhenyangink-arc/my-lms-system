import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';

import { getAuthContext } from "@/lib/auth";
import { createR2SignedResourceDownloadUrl } from "@/lib/r2";

/*
  资料文件下载路由

  作用：
  学生或管理员点击“下载文件”时，浏览器直接访问这个地址，
  服务器现场生成一个有时效的签名下载 URL，然后 302 跳转过去。

  为什么不在页面渲染时就直接生成签名 URL？
  因为签名 URL 有过期时间（跟视频那边一样），
  如果提前生成好写进页面 HTML，过一段时间用户点击时可能已经过期。
  现场生成，用多少生成多少，更安全也更简单。

  权限控制：
  这里用的是当前登录用户的 Supabase client（走 cookie），
  不是 service role，所以查询 lesson_resources 会自动受 RLS 约束：
  1. 管理员（is_admin()）能查到所有资料
  2. 普通登录用户只能查到 is_published = true 的资料
  如果查不到，说明这条资料对当前用户不可见，直接返回 404。
*/
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  const { resourceId } = await params;

  const auth = await getAuthContext();

  if (auth.status === "unauthenticated") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (auth.status === "inactive") {
    return NextResponse.redirect(new URL("/account-disabled", request.url));
  }

  const { supabase } = auth;

  const { data: resource } = await supabase
    .from("lesson_resources")
    .select("resource_object_key, original_file_name, is_deleted")
    .eq("id", resourceId)
    .maybeSingle();

  if (!resource || !resource.resource_object_key || resource.is_deleted) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const downloadUrl = await createR2SignedResourceDownloadUrl(
    resource.resource_object_key,
    resource.original_file_name || "download"
  );

  return NextResponse.redirect(downloadUrl);
}
