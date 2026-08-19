import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseInstitutionPlatformOverviewSnapshot } from "../model.ts";
import type { InstitutionPlatformOverviewSnapshot } from "../types.ts";

export class InstitutionPlatformOverviewAccessError extends Error {
  constructor(message = "无权查看机构与平台学习概览") {
    super(message);
    this.name = "InstitutionPlatformOverviewAccessError";
  }
}

/** Exactly one RPC; authorization, tenant scoping, joins, and rollups stay in SQL. */
export async function loadInstitutionPlatformOverview({
  supabase,
  tenantId,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  tenantId: string | null;
  now?: Date;
}): Promise<InstitutionPlatformOverviewSnapshot> {
  const { data, error } = await supabase.rpc(
    "get_institution_platform_learning_overview",
    {
      p_tenant_id: tenantId,
      p_now: now.toISOString(),
    },
  );

  if (error) {
    if (error.code === "42501") {
      throw new InstitutionPlatformOverviewAccessError();
    }
    throw new Error("机构与平台学习概览读取失败，请稍后重试。", {
      cause: error,
    });
  }

  return parseInstitutionPlatformOverviewSnapshot(data);
}
