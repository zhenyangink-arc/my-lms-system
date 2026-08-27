import "server-only";

import { requireExecutive } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ModelUsageLog,
  LearningAgentModelConfig,
  ModelUsageRecord,
  ModelUsageResult,
  ModelUsageTableRow,
  ModelUsageTenant,
} from "./types";

const MODEL_USAGE_QUERY_LIMIT = 5000;
const DAY_IN_MILLISECONDS = 86_400_000;
const TREND_BUCKET_IN_MILLISECONDS = 14_400_000;

function total(
  items: ModelUsageRecord[],
  field: keyof Pick<
    ModelUsageRecord,
    "input_tokens" | "output_tokens" | "total_tokens"
  >,
) {
  return items.reduce((sum, item) => sum + item[field], 0);
}

function toUsageLog(row: ModelUsageRecord): ModelUsageLog {
  return {
    createdAt: row.created_at,
    provider: row.provider,
    model: row.model,
    featureCode: row.feature_code,
    agentCode: row.agent_code,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
  };
}

function createModelUsageTableRow({
  id,
  name,
  slug,
  kind,
  isCurrent,
  provider,
  model,
  rows,
  now,
}: {
  id: string;
  name: string;
  slug: string;
  kind: ModelUsageTableRow["kind"];
  isCurrent: boolean;
  provider: ModelUsageRecord["provider"];
  model: string;
  rows: ModelUsageRecord[];
  now: number;
}): ModelUsageTableRow {
  const trend = Array<number>(6).fill(0);
  const dayRows = rows.filter((row) => {
    const age = now - new Date(row.created_at).getTime();
    if (age < 0 || age >= DAY_IN_MILLISECONDS) return false;
    const bucket =
      5 - Math.min(5, Math.floor(age / TREND_BUCKET_IN_MILLISECONDS));
    trend[bucket] += row.total_tokens;
    return true;
  });
  const activity = rows.map(toUsageLog);

  return {
    id,
    name,
    slug,
    kind,
    isCurrent,
    provider,
    model,
    totalTokens: total(rows, "total_tokens"),
    inputTokens: total(rows, "input_tokens"),
    outputTokens: total(rows, "output_tokens"),
    dayTokens: total(dayRows, "total_tokens"),
    logCount: rows.length,
    trend,
    logs: activity.slice(0, 20),
    activity,
  };
}

function groupByProviderAndModel(rows: ModelUsageRecord[]) {
  const groups = new Map<string, ModelUsageRecord[]>();
  for (const row of rows) {
    const key = `${row.provider}\u0000${row.model}`;
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }
  return Array.from(groups.values());
}

export async function getModelUsageData(): Promise<ModelUsageResult> {
  const { supabase, role, tenant } = await requireExecutive();
  const canViewAllTenants = role === "platform_super_admin";
  const dataClient = canViewAllTenants ? createAdminClient() : supabase;

  const [{ data, error }, tenantsResult] = await Promise.all([
    dataClient
      .from("ai_token_usage")
      .select(
        "tenant_id,user_id,provider,model,feature_code,agent_code,input_tokens,output_tokens,total_tokens,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(MODEL_USAGE_QUERY_LIMIT),
    canViewAllTenants
      ? dataClient.from("tenants").select("id,name,slug").order("created_at")
      : Promise.resolve({
          data: tenant
            ? [{ id: tenant.id, name: tenant.name, slug: tenant.slug }]
            : [],
          error: null,
        }),
  ]);

  const [agentProfilesResult, agentSecretsResult] = canViewAllTenants
    ? await Promise.all([
        dataClient
          .from("learning_agent_profiles")
          .select("id,agent_code,subject_code,display_name")
          .eq("status", "published")
          .order("created_at"),
        dataClient
          .from("learning_agent_profile_secrets")
          .select("agent_profile_id,provider,model"),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  const rows = (data ?? []) as ModelUsageRecord[];
  const tenants = (tenantsResult.data ?? []) as ModelUsageTenant[];
  const secretByProfileId = new Map(
    (agentSecretsResult.data ?? []).map((item) => [String(item.agent_profile_id), item]),
  );
  const agentModelConfigs: LearningAgentModelConfig[] = canViewAllTenants
    ? (agentProfilesResult.data ?? []).flatMap((profile) => {
        const secret = secretByProfileId.get(String(profile.id));
        if (!secret || (secret.provider !== "qwen" && secret.provider !== "deepseek")) {
          return [];
        }
        const displayName = profile.display_name && typeof profile.display_name === "object"
          ? String((profile.display_name as Record<string, unknown>)["zh-CN"] ?? profile.agent_code)
          : String(profile.agent_code);
        return [{
          agentCode: String(profile.agent_code),
          displayName,
          subjectCode: String(profile.subject_code),
          provider: secret.provider,
          model: String(secret.model),
        }];
      })
    : [];
  const usageUserIds = Array.from(
    new Set(
      rows
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const platformProfilesResult =
    canViewAllTenants && usageUserIds.length > 0
      ? await createAdminClient()
          .from("profiles")
          .select("id")
          .in("id", usageUserIds)
          .in("role", ["platform_super_admin", "tenant_operator"])
      : { data: [], error: null };
  const platformUserIds = new Set(
    (platformProfilesResult.data ?? []).map((profile) => profile.id as string),
  );
  const platformRows = canViewAllTenants
    ? rows.filter((row) => row.user_id && platformUserIds.has(row.user_id))
    : [];
  const tenantRowsOnly = canViewAllTenants
    ? rows.filter((row) => !row.user_id || !platformUserIds.has(row.user_id))
    : rows;
  const tenantById = new Map(tenants.map((item) => [item.id, item]));
  const rowsByTenant = new Map<string, ModelUsageRecord[]>();

  for (const row of tenantRowsOnly) {
    const current = rowsByTenant.get(row.tenant_id) ?? [];
    current.push(row);
    rowsByTenant.set(row.tenant_id, current);
  }

  const visibleTenantIds = canViewAllTenants
    ? Array.from(
        new Set([...tenants.map((item) => item.id), ...rowsByTenant.keys()]),
      )
    : tenant
      ? [tenant.id]
      : Array.from(rowsByTenant.keys());

  // 动态服务端组件以请求时间计算滚动 24 小时窗口，与旧页面一致。
  const now = Date.now();
  const dayRows = rows.filter(
    (row) => now - new Date(row.created_at).getTime() < DAY_IN_MILLISECONDS,
  );
  const platformTableRows: ModelUsageTableRow[] = canViewAllTenants
    ? groupByProviderAndModel(platformRows).map((providerRows) => {
        const first = providerRows[0];
        return createModelUsageTableRow({
          id: `platform-${first.provider}-${first.model}`,
          name: "平台负责人",
          slug: "platform",
          kind: "platform",
          isCurrent: false,
          provider: first.provider,
          model: first.model,
          rows: providerRows,
          now,
        });
      })
    : [];
  const organizationRows = visibleTenantIds.flatMap((tenantId) => {
    const item = tenantById.get(tenantId);
    const tenantUsageRows = rowsByTenant.get(tenantId) ?? [];
    const groups = canViewAllTenants
      ? groupByProviderAndModel(tenantUsageRows)
      : [tenantUsageRows];

    return groups.map((providerRows) => {
      const first = providerRows[0];
      return createModelUsageTableRow({
        id: canViewAllTenants
          ? `tenant-${tenantId}-${first.provider}-${first.model}`
          : `tenant-${tenantId}`,
        name: item?.name ?? "未识别机构",
        slug: item?.slug ?? tenantId,
        kind: "organization",
        isCurrent: tenantId === tenant?.id,
        provider: canViewAllTenants ? first.provider : "unknown",
        model: canViewAllTenants ? first.model : "全部模型",
        rows: providerRows,
        now,
      });
    });
  });

  return {
    scope: canViewAllTenants ? "platform" : "tenant",
    viewerRole: role,
    tenantId: tenant?.id ?? null,
    canViewAllTenants,
    queryLimit: MODEL_USAGE_QUERY_LIMIT,
    hasQueryError: Boolean(
      error ||
      tenantsResult.error ||
      platformProfilesResult.error ||
      agentProfilesResult.error ||
      agentSecretsResult.error,
    ),
    agentModelConfigs,
    totals: {
      totalTokens: total(rows, "total_tokens"),
      inputTokens: total(rows, "input_tokens"),
      outputTokens: total(rows, "output_tokens"),
      dayTokens: total(dayRows, "total_tokens"),
    },
    platformRows: platformTableRows,
    organizationRows,
  };
}
