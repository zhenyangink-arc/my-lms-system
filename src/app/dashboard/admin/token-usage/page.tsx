import { BarChart3, MessageSquareText, Zap } from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { requireExecutive } from "@/lib/admin";


type TokenUsage = { input_tokens: number; output_tokens: number; total_tokens: number; created_at: string };

export default async function TokenUsagePage() {
  const { supabase } = await requireExecutive();
  const { data, error } = await supabase.from("ai_token_usage").select("input_tokens,output_tokens,total_tokens,created_at").order("created_at", { ascending: false }).limit(5000);
  const rows = (data ?? []) as TokenUsage[];
  // This is a dynamic Server Component; the request time defines the rolling 24-hour window.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const dayRows = rows.filter((row) => now - new Date(row.created_at).getTime() < 86_400_000);
  const total = (items: TokenUsage[], field: keyof Pick<TokenUsage, "input_tokens" | "output_tokens" | "total_tokens">) => items.reduce((sum, item) => sum + item[field], 0);
  return <div className="pb-12"><DashboardPageHeader title="Token 用量" description="从该功能上线后开始累计文字版 AI 对话的用量。" /><div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">{error && <p className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}>暂时无法读取 Token 数据，请先执行最新数据库迁移。</p>}<section className="grid gap-4 sm:grid-cols-3">{[["总 Token", total(rows,"total_tokens"), Zap], ["输入 Token", total(rows,"input_tokens"), MessageSquareText], ["今日 Token", total(dayRows,"total_tokens"), BarChart3]].map(([label, value, Icon]) => { const MetricIcon = Icon as typeof Zap; return <article key={String(label)} className="app-card rounded-3xl border p-5"><MetricIcon size={20} style={{ color: "var(--app-accent)" }} /><p className="mt-4 text-3xl font-black">{Number(value).toLocaleString()}</p><p className="app-muted-text mt-1 text-sm font-black">{String(label)}</p></article>; })}</section><section className="app-card rounded-3xl border p-5"><h2 className="text-lg font-black">最近调用</h2><p className="app-muted-text mt-1 text-xs">共 {rows.length} 条记录</p><div className="mt-4 space-y-2">{rows.slice(0,20).map((row, index) => <div key={`${row.created_at}-${index}`} className="app-soft-card flex items-center justify-between rounded-xl border p-3 text-sm"><span>{new Date(row.created_at).toLocaleString("zh-CN")}</span><span className="font-black">输入 {row.input_tokens} · 输出 {row.output_tokens} · 共 {row.total_tokens}</span></div>)}{rows.length===0 && <p className="app-muted-text py-8 text-center text-sm">暂无记录；新的文字版 AI 对话会从部署后开始统计。</p>}</div></section></div></div>;
}
