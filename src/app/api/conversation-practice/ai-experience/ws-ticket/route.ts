import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import {
  canUseStudentFeature,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

const USAGE_MODEL_LABEL = "conversation_voice_image";
const DAILY_MESSAGE_LIMIT = Number(process.env.CONVERSATION_AI_DAILY_MESSAGE_LIMIT ?? 200);
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;
// 握手 URL 拿到后应立刻用来连接，短期有效即可，缩短 URL 被截获后的可重放窗口。
const TICKET_TTL_MS = 60_000;

// 语音版实时录音走浏览器直连 WebSocket，绕开了 chat/route.ts 那层配额和鉴权检查。
// 这个接口把"要不要给你 WS 地址"这一步收回服务端：先登录、再校验会员档位和每日
// 配额，通过了才把地址发给前端，未登录用户不再能从打包后的 JS 里直接扒出地址。
export async function GET() {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "请先登录后再使用 AI 口语陪练。" }, { status: 401 });
  }

  const role = auth.profile?.role ?? "student";
  if (role === "platform_course_inspector") {
    return NextResponse.json({ error: "课程巡检员为只读模式，不能使用 AI 口语陪练。" }, { status: 403 });
  }
  if (
    auth.status !== "active" ||
    !canUseStudentFeature(
      role,
      normalizeMembershipTier(auth.profile?.membership_tier),
      "ai_conversation_experience"
    )
  ) {
    return NextResponse.json({ error: "当前会员档位没有 AI 交流体验权限。" }, { status: 403 });
  }

  const userId = auth.user.id;
  const tenantId = auth.tenant?.id;
  if (!tenantId) {
    return NextResponse.json({ error: "当前账号没有可用的学习空间。" }, { status: 403 });
  }
  const admin = createAdminClient();
  const windowStartIso = new Date(Date.now() - ROLLING_WINDOW_MS).toISOString();
  const { count: usedInWindow, error: usageCheckError } = await admin
    .from("ai_token_usage")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("model", USAGE_MODEL_LABEL)
    .gte("created_at", windowStartIso);

  if (!usageCheckError && (usedInWindow ?? 0) >= DAILY_MESSAGE_LIMIT) {
    return NextResponse.json(
      { error: "今日 AI 口语陪练使用次数已达上限，请明天再试或联系管理员。" },
      { status: 429 }
    );
  }

  // 特意不设内网/隧道兜底地址：语音服务是浏览器直连的公网地址，配置缺失时
  // 直接报错比悄悄回退到一个用户永远连不通的内网地址更容易被运维发现。
  const wsBaseUrl = process.env.CONVERSATION_AI_WS_URL;
  if (!wsBaseUrl) {
    return NextResponse.json({ error: "语音陪练服务尚未配置，请联系管理员。" }, { status: 500 });
  }

  let url: URL;
  try {
    url = new URL(wsBaseUrl);
  } catch {
    return NextResponse.json({ error: "语音陪练服务地址配置不正确。" }, { status: 500 });
  }

  // 浏览器原生 WebSocket API 不支持自定义 Authorization 头，鉴权信息只能放进握手
  // URL：时间戳 + HMAC 签名。要真正堵住"拿到地址就能连"，还需要上游 WS 服务自己
  // 校验 uid/exp/sig 三个参数（不在本仓库范围内，需要运维在语音服务那侧配合）。
  const serviceToken = process.env.CONVERSATION_AI_SERVICE_TOKEN;
  if (serviceToken) {
    const expires = Date.now() + TICKET_TTL_MS;
    const signature = createHmac("sha256", serviceToken)
      .update(`${userId}.${expires}`)
      .digest("hex");
    url.searchParams.set("uid", userId);
    url.searchParams.set("exp", String(expires));
    url.searchParams.set("sig", signature);
  }

  return NextResponse.json({ url: url.toString() });
}
