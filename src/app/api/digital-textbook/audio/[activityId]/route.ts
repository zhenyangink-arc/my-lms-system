import { NextResponse } from "next/server";

import { requireActiveUser } from "@/lib/auth";
import {
  canUseStudentFeature,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ activityId: string }> }
) {
  const { supabase, profile } = await requireActiveUser();
  const role = profile?.role ?? "student";
  // 之前只校验内容本身是否 published，没校验请求者是否真的有权限看这门课；
  // 任何登录用户直接访问这个路由都能拿到私有音频的签名地址。
  if (
    !canUseStudentFeature(role, normalizeMembershipTier(profile?.membership_tier), "korean_course")
  ) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  // A copied media endpoint must not become a directly navigable download page.
  // Native media requests use `audio`; address-bar navigation uses `document`.
  if (request.headers.get("sec-fetch-dest") === "document") {
    return NextResponse.json({ message: "Audio is available in the lesson player only." }, { status: 403 });
  }

  const { activityId } = await params;
  const pageIndex = Math.max(0, Number.parseInt(new URL(request.url).searchParams.get("page") ?? "0", 10) || 0);

  if (!/^[0-9a-f-]{36}$/i.test(activityId)) {
    return NextResponse.json({ message: "Invalid activity." }, { status: 400 });
  }

  // 教材目录链使用当前用户客户端读取，让已发布状态与 RLS 先完成内容授权；
  // 只有最终的私密对象键和签名 URL 使用 service_role。
  const { data: activity } = await supabase
    .from("digital_textbook_activities")
    .select("id,node_id")
    .eq("id", activityId)
    .maybeSingle();

  if (!activity) {
    return NextResponse.json({ message: "Audio was not found." }, { status: 404 });
  }

  const { data: node } = await supabase
    .from("digital_textbook_nodes")
    .select("module_id")
    .eq("id", activity.node_id)
    .maybeSingle();

  if (!node) {
    return NextResponse.json({ message: "Audio was not found." }, { status: 404 });
  }

  const { data: module_ } = await supabase
    .from("digital_textbook_modules")
    .select("chapter_id")
    .eq("id", node.module_id)
    .maybeSingle();

  if (!module_) {
    return NextResponse.json({ message: "Audio was not found." }, { status: 404 });
  }

  const { data: chapter } = await supabase
    .from("digital_textbook_chapters")
    .select("status,version_id")
    .eq("id", module_.chapter_id)
    .maybeSingle();

  if (!chapter || chapter.status !== "published") {
    return NextResponse.json({ message: "Audio is not ready." }, { status: 404 });
  }

  const { data: version } = await supabase
    .from("digital_textbook_versions")
    .select("status,textbook_id")
    .eq("id", chapter.version_id)
    .maybeSingle();

  if (!version || version.status !== "published") {
    return NextResponse.json({ message: "Audio is not ready." }, { status: 404 });
  }

  const { data: textbook } = await supabase
    .from("digital_textbooks")
    .select("status")
    .eq("id", version.textbook_id)
    .maybeSingle();

  if (!textbook || textbook.status !== "published") {
    return NextResponse.json({ message: "Audio is not ready." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: track } = await admin
    .from("digital_textbook_listening_tracks")
    .select("audio_object_key,audio_status")
    .eq("activity_id", activity.id)
    .eq("page_index", pageIndex)
    .maybeSingle();
  const { data: secret } = await admin
    .from("digital_textbook_activity_secrets")
    .select("audio_object_key,audio_status")
    .eq("activity_id", activity.id)
    .maybeSingle();

  const audioObjectKey = track?.audio_object_key ?? secret?.audio_object_key;
  const audioStatus = track?.audio_status ?? secret?.audio_status;
  if (!audioObjectKey || audioStatus !== "ready") {
    return NextResponse.json({ message: "Audio is not ready." }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from("digital-textbook-audio")
    .createSignedUrl(audioObjectKey, 60 * 10);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ message: "Audio is temporarily unavailable." }, { status: 503 });
  }

  // Do not redirect the browser to the private storage URL. Proxy the bytes so
  // authorized learners can stream the lesson while the signed origin remains
  // server-side. Range requests are forwarded for seeking and playback speed.
  const range = request.headers.get("range");
  const upstream = await fetch(data.signedUrl, {
    headers: range ? { Range: range } : undefined,
    cache: "no-store",
    signal: request.signal,
  });

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { message: "Audio is temporarily unavailable." },
      { status: 503 },
    );
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": 'inline; filename="lesson-audio"',
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
  });

  for (const name of ["accept-ranges", "content-length", "content-range", "content-type"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
