import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth";
import { isPlatformOwnerRole } from "@/lib/platform-owner-role";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSupportedLearningAgentModel,
  type LearningAgentProvider,
} from "@/features/model-usage/model-options";

const requestSchema = z.object({
  agentCode: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  provider: z.enum(["qwen", "deepseek"]),
  model: z.string().trim().min(2).max(100),
});

export async function PATCH(request: Request) {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }
  if (
    auth.status !== "active" ||
    !isPlatformOwnerRole(auth.platformProfile?.role) ||
    auth.tenant
  ) {
    return NextResponse.json(
      { error: "只有平台负责人可以修改教学引擎模型。" },
      { status: 403 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "模型配置格式不正确。" }, { status: 400 });
  }
  const { agentCode, provider, model } = parsed.data;
  if (!isSupportedLearningAgentModel(provider as LearningAgentProvider, model)) {
    return NextResponse.json(
      { error: "当前供应商不支持所选模型。" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("set_learning_agent_model", {
    p_agent_code: agentCode,
    p_provider: provider,
    p_model: model,
    p_changed_by: auth.user.id,
  });
  if (error) {
    return NextResponse.json(
      { error: "模型配置保存失败，请稍后重试。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ agentCode, provider, model });
}
