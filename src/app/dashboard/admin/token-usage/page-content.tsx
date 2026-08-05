import { Database } from "lucide-react";

import { requireExecutive } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TokenUsageTable,
  type TokenUsageTableRow,
} from "./TokenUsageTable";

type TokenUsage = {
  tenant_id: string;
  user_id: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  created_at: string;
};

type TenantSummary = {
  id: string;
  name: string;
  slug: string;
};

const total = (
  items: TokenUsage[],
  field: keyof Pick<TokenUsage, "input_tokens" | "output_tokens" | "total_tokens">,
) => items.reduce((sum, item) => sum + item[field], 0);

function createUsageTableRow({
  id,
  name,
  slug,
  kind,
  isCurrent,
  rows,
  now,
}: {
  id: string;
  name: string;
  slug: string;
  kind: TokenUsageTableRow["kind"];
  isCurrent: boolean;
  rows: TokenUsage[];
  now: number;
}): TokenUsageTableRow {
  const trend = Array<number>(6).fill(0);
  const dayRows = rows.filter((row) => {
    const age = now - new Date(row.created_at).getTime();
    if (age < 0 || age >= 86_400_000) return false;
    const bucket = 5 - Math.min(5, Math.floor(age / 14_400_000));
    trend[bucket] += row.total_tokens;
    return true;
  });

  return {
    id,
    name,
    slug,
    kind,
    isCurrent,
    totalTokens: total(rows, "total_tokens"),
    inputTokens: total(rows, "input_tokens"),
    outputTokens: total(rows, "output_tokens"),
    dayTokens: total(dayRows, "total_tokens"),
    logCount: rows.length,
    trend,
    logs: rows.slice(0, 20).map((row) => ({
      createdAt: row.created_at,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
    })),
  };
}

export default async function TokenUsagePage() {
  const { supabase, role, tenant } = await requireExecutive();
  const canViewAllTenants = role === "platform_super_admin";
  const dataClient = canViewAllTenants ? createAdminClient() : supabase;

  const [{ data, error }, tenantsResult] = await Promise.all([
    dataClient
      .from("ai_token_usage")
      .select("tenant_id,user_id,input_tokens,output_tokens,total_tokens,created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    canViewAllTenants
      ? dataClient.from("tenants").select("id,name,slug").order("created_at")
      : Promise.resolve({
          data: tenant ? [{ id: tenant.id, name: tenant.name, slug: tenant.slug }] : [],
          error: null,
        }),
  ]);

  const rows = (data ?? []) as TokenUsage[];
  const tenants = (tenantsResult.data ?? []) as TenantSummary[];
  const usageUserIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id))),
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
  const rowsByTenant = new Map<string, TokenUsage[]>();

  for (const row of tenantRowsOnly) {
    const current = rowsByTenant.get(row.tenant_id) ?? [];
    current.push(row);
    rowsByTenant.set(row.tenant_id, current);
  }

  const visibleTenantIds = canViewAllTenants
    ? Array.from(new Set([...tenants.map((item) => item.id), ...rowsByTenant.keys()]))
    : tenant
      ? [tenant.id]
      : Array.from(rowsByTenant.keys());

  // This is a dynamic Server Component; the request time defines the rolling 24-hour window.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const dayRows = rows.filter(
    (row) => now - new Date(row.created_at).getTime() < 86_400_000,
  );
  const platformTableRows: TokenUsageTableRow[] = canViewAllTenants
    ? [
        createUsageTableRow({
          id: "platform",
          name: "平台负责人",
          slug: "platform",
          kind: "platform",
          isCurrent: false,
          rows: platformRows,
          now,
        }),
      ]
    : [];
  const organizationTableRows: TokenUsageTableRow[] = visibleTenantIds.map(
    (tenantId) => {
      const item = tenantById.get(tenantId);
      return createUsageTableRow({
        id: `tenant-${tenantId}`,
        name: item?.name ?? "未识别机构",
        slug: item?.slug ?? tenantId,
        kind: "organization",
        isCurrent: tenantId === tenant?.id,
        rows: rowsByTenant.get(tenantId) ?? [],
        now,
      });
    },
  );
  const metrics = [
    {
      label: "总 Token (Total)",
      value: total(rows, "total_tokens"),
      color: "var(--app-accent)",
    },
    {
      label: "输入 Token (Input)",
      value: total(rows, "input_tokens"),
      color: "var(--app-secondary)",
    },
    {
      label: "输出 Token (Output)",
      value: total(rows, "output_tokens"),
      color: "var(--app-success)",
    },
    {
      label: "24 小时增量",
      value: total(dayRows, "total_tokens"),
      color: "var(--app-warm)",
    },
  ];

  return (
    <div className="token-usage-page min-h-full pb-12">
      <div className="mx-auto w-full max-w-[1600px] space-y-9 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">
              Token 用量
            </h1>
          </div>
          <div className="app-muted-text flex items-center gap-2 text-[12px]">
            <Database size={12} strokeWidth={1.7} />
            最近 5,000 条记录
          </div>
        </header>

        {(error || tenantsResult.error || platformProfilesResult.error) && (
          <p
            className="border-y px-1 py-3 text-[13px] font-medium"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
              borderColor: "color-mix(in srgb, var(--app-warm) 28%, var(--app-border))",
            }}
          >
            暂时无法读取完整的 Token 或机构数据，请稍后刷新重试。
          </p>
        )}

        <section>
          <div
            className="token-usage-metrics-strip grid gap-x-8 gap-y-6 pb-7 sm:grid-cols-2 xl:grid-cols-4"
          >
            {metrics.map((metric) => (
              <div key={metric.label} className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <span
                    className="h-0.5 w-3"
                    style={{ backgroundColor: metric.color }}
                    aria-hidden="true"
                  />
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.07em]"
                    style={{ color: metric.color }}
                  >
                    {metric.label}
                  </p>
                </div>
                <p
                  className="mt-2 font-mono text-[34px] font-semibold tabular-nums tracking-[-0.04em]"
                  style={{ color: metric.color }}
                >
                  {metric.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        {canViewAllTenants && (
          <section>
            <div
              className="mb-4 flex flex-wrap items-end justify-between gap-3 border-l-2 pl-3"
              style={{ borderColor: "var(--app-accent)" }}
            >
              <div>
                <h2 className="text-[16px] font-semibold">平台用量明细</h2>
              </div>
              <p className="text-[12px]" style={{ color: "var(--app-accent)" }}>
                平台负责人及平台运营账号
              </p>
            </div>
            <TokenUsageTable rows={platformTableRows} />
          </section>
        )}

        <section>
          <div
            className="mb-4 flex flex-wrap items-end justify-between gap-3 border-l-2 pl-3"
            style={{ borderColor: "var(--app-secondary)" }}
          >
            <div>
              <h2 className="text-[16px] font-semibold">机构用量明细</h2>
            </div>
            <p className="text-[12px]" style={{ color: "var(--app-secondary)" }}>
              共 {organizationTableRows.length.toLocaleString()} 个机构
            </p>
          </div>
          <TokenUsageTable rows={organizationTableRows} />
        </section>
      </div>
    </div>
  );
}
