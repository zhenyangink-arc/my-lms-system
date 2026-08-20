import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ManagementAppAccess } from "@/lib/management-apps";
import {
  parseCompletionStatistics,
  type CompletionStatistics,
} from "./statistics-types";

export async function getCompletionStatistics(
  access: ManagementAppAccess,
): Promise<CompletionStatistics> {
  const isInstitutionLeader =
    access.scope === "tenant" &&
    Boolean(access.tenantId) &&
    (access.role === "tenant_super_admin" || access.role === "ceo");
  const isPlatformOwner =
    access.scope === "platform" && access.globalRole === "platform_owner";

  if (!isInstitutionLeader && !isPlatformOwner) {
    throw new Error("当前账号无权查看结课统计。");
  }

  const supabase = await createClient();
  const rpcName = isPlatformOwner
    ? "get_platform_course_completion_trends"
    : "get_institution_course_completion_statistics";
  const { data, error } = await supabase.rpc(rpcName, {
    p_student_app_id: access.appId,
  });

  if (error) {
    throw new Error("无法读取结课统计，请稍后重试。", { cause: error });
  }

  return parseCompletionStatistics(data);
}
