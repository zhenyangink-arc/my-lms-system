import { BarChart3, Building2, MessageSquareText, Zap } from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { requireExecutive } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

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

function TokenUsageGroup({
  name,
  slug,
  rows,
  now,
  badge,
}: {
  name: string;
  slug: string;
  rows: TokenUsage[];
  now: number;
  badge?: string;
}) {
  const dayRows = rows.filter(
    (row) => now - new Date(row.created_at).getTime() < 86_400_000,
  );

  return (
    <article className="app-card rounded-3xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{
            color: "var(--app-secondary)",
            backgroundColor: "var(--app-secondary-soft)",
          }}
        >
          <Building2 size={19} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black">{name}</h3>
          <p className="app-muted-text text-xs">{slug}</p>
        </div>
        {badge && (
          <span
            className="ml-auto rounded-full px-3 py-1 text-xs font-black"
            style={{
              color: "var(--app-success)",
              backgroundColor: "var(--app-success-soft)",
            }}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ["累计 Token", total(rows, "total_tokens")],
          ["输入 Token", total(rows, "input_tokens")],
          ["今日 Token", total(dayRows, "total_tokens")],
        ].map(([label, value]) => (
          <div key={String(label)} className="app-soft-card rounded-2xl border p-4">
            <p className="text-xl font-black">{Number(value).toLocaleString()}</p>
            <p className="app-muted-text mt-1 text-xs font-black">{String(label)}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--app-border-soft)" }}>
        <DashboardTitleWithHint
          headingLevel={4}
          titleClassName="text-sm font-black"
          title="最近调用"
          description={<>共计 {rows.length} 条用量记录</>}
        />
        <div className="mt-3 space-y-2">
          {rows.slice(0, 20).map((row, index) => (
            <div
              key={`${row.created_at}-${index}`}
              className="app-soft-card flex flex-col gap-1 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{new Date(row.created_at).toLocaleString("zh-CN")}</span>
              <span className="font-black">
                输入 {row.input_tokens} · 输出 {row.output_tokens} · 共 {row.total_tokens}
              </span>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="app-muted-text rounded-xl border border-dashed py-6 text-center text-sm">
              暂时没有 Token 使用记录。
            </p>
          )}
        </div>
      </div>
    </article>
  );
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

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        <section
          className="app-card rounded-3xl border p-5 sm:p-6"
          style={{
            background:
              "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-accent-soft))",
          }}
        >
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
            style={{
              color: "var(--app-accent)",
              backgroundColor: "var(--app-accent-soft)",
            }}
          >
            <Zap size={14} />
            AI 用量监控
          </span>
          <DashboardTitleWithHint
            className="mt-3"
            title="Token 用量"
            description={
              canViewAllTenants
                ? "按机构统计文字版 AI 对话用量，并查看各机构最近调用记录。"
                : "查看我的机构产生的文字版 AI 对话用量。"
            }
          />
        </section>

        {(error || tenantsResult.error || platformProfilesResult.error) && (
          <p
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
            }}
          >
            暂时无法读取完整的 Token 或机构数据，请稍后刷新重试。
          </p>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["总 Token", total(rows, "total_tokens"), Zap],
            ["输入 Token", total(rows, "input_tokens"), MessageSquareText],
            ["今日 Token", total(dayRows, "total_tokens"), BarChart3],
          ].map(([label, value, Icon]) => {
            const MetricIcon = Icon as typeof Zap;
            return (
              <article key={String(label)} className="app-card rounded-3xl border p-5">
                <MetricIcon size={20} style={{ color: "var(--app-accent)" }} />
                <p className="mt-4 text-3xl font-black">{Number(value).toLocaleString()}</p>
                <p className="app-muted-text mt-1 text-sm font-black">{String(label)}</p>
              </article>
            );
          })}
        </section>

        {canViewAllTenants && (
          <section className="space-y-4">
            <DashboardTitleWithHint
              headingLevel={2}
              titleClassName="text-xl font-black"
              title="平台负责人用量"
              description="单独统计平台负责人及平台运营账号产生的 Token 用量。"
            />
            <TokenUsageGroup
              name="平台负责人"
              slug="platform"
              rows={platformRows}
              now={now}
              badge="平台用量"
            />
          </section>
        )}

        <section className="space-y-4">
          <DashboardTitleWithHint
            headingLevel={2}
            titleClassName="text-xl font-black"
            title="机构用量"
            description={
              canViewAllTenants
                ? `共 ${visibleTenantIds.length} 个机构，调用记录分别计入对应机构。`
                : "这里只显示当前登录所属机构的用量。"
            }
          />

          <div className="grid items-start gap-4 lg:grid-cols-2">
          {visibleTenantIds.map((tenantId) => {
            const item = tenantById.get(tenantId);
            const tenantRows = rowsByTenant.get(tenantId) ?? [];
            const isMine = tenantId === tenant?.id;

            return (
              <TokenUsageGroup
                key={tenantId}
                name={item?.name ?? "未识别机构"}
                slug={item?.slug ?? tenantId}
                rows={tenantRows}
                now={now}
                badge={isMine ? "我的机构" : undefined}
              />
            );
          })}
          </div>

          {!canViewAllTenants && visibleTenantIds.length === 0 && (
            <div className="app-card rounded-3xl border border-dashed p-8 text-center">
              <Building2 className="mx-auto opacity-30" size={30} />
              <p className="mt-3 font-black">暂时没有可显示的机构</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
