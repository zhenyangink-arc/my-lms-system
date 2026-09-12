import { createClient } from "@/lib/supabase/server";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { FollowupEditor } from "./FollowupEditor";
import type { InsightMode } from "./model";
const labels: Record<string, string> = { pending: "待处理", in_progress: "跟进中", resolved: "已复查关闭" };
export async function InstitutionFollowups({ appSlug, appId, tenant, tenantName, topic }: { appSlug: string; appId: string; tenant: string; tenantName: string; topic: InsightMode }) {
  const client = await createClient();
  const { data, error } = await client.from("institution_learning_followups").select("id,status,note,created_at").eq("tenant_id", tenant).eq("app_id", appId).eq("topic", topic).order("sequence", { ascending: false }).limit(20);
  return <section className="app-card space-y-4 border p-4">
    <CardTitleWithHint headingLevel={2} title={`${tenantName} · 机构跟进`} description="记录当前栏目下的机构处理情况，不受统计时间或课程筛选影响。历史完整保留，此处显示最近 20 次处理记录；关闭需填写复查结果，重新发现问题可再次跟进。" />
    {error ? <p role="alert" className="text-sm">跟进记录暂时无法读取，请刷新重试。</p> : <>
      <p className="text-sm">当前状态：{data?.[0] ? labels[data[0].status] : "尚未记录"}</p>
      <FollowupEditor appSlug={appSlug} tenant={tenant} topic={topic} latestId={data?.[0]?.id ?? ""} status={data?.[0]?.status ?? "pending"} />
      {data?.length ? <details><summary className="min-h-11 cursor-pointer py-3 text-sm">处理历史（最近 {data.length} 条）</summary><ol className="space-y-3">{data.map(row => <li key={row.id} className="border-t pt-3 text-sm"><div>{labels[row.status]} · <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Seoul", hour12: false })}（韩国时间）</time></div><p className="mt-2 whitespace-pre-wrap break-words">{row.note}</p></li>)}</ol></details> : null}
    </>}
  </section>;
}
