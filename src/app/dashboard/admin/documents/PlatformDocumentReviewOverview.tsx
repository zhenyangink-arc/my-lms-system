"use client";

import {
  Building2,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { Fragment, useState } from "react";

import { LocalDateTime } from "@/components/LocalDateTime";

export type PlatformDocumentReviewOverviewRow = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  tenant_status: string;
  active_student_count: number | string;
  application_count: number | string;
  preparing_count: number | string;
  pending_review_count: number | string;
  revision_required_count: number | string;
  approved_count: number | string;
  oldest_pending_at: string | null;
  last_activity_at: string | null;
};

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function FormattedDate({ value }: { value: string | null }) {
  return <LocalDateTime value={value} options={DATE_OPTIONS} />;
}

function waitingTime(value: string | null) {
  if (!value) return "—";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "—";
  const hours = Math.max(0, Math.floor((Date.now() - time) / 3_600_000));
  if (hours < 24) return `${hours} 小时`;
  return `${Math.floor(hours / 24)} 天`;
}

export function PlatformDocumentReviewOverview({
  rows,
  hasError,
}: {
  rows: PlatformDocumentReviewOverviewRow[];
  hasError: boolean;
}) {
  const [expandedTenantIds, setExpandedTenantIds] = useState<Set<string>>(
    new Set()
  );
  const institutionCount = rows.length;
  const applicationCount = rows.reduce(
    (sum, row) => sum + numberValue(row.application_count),
    0
  );
  const pendingCount = rows.reduce(
    (sum, row) => sum + numberValue(row.pending_review_count),
    0
  );
  const revisionCount = rows.reduce(
    (sum, row) => sum + numberValue(row.revision_required_count),
    0
  );

  function toggleTenant(tenantId: string) {
    setExpandedTenantIds((current) => {
      const next = new Set(current);
      if (next.has(tenantId)) next.delete(tenantId);
      else next.add(tenantId);
      return next;
    });
  }

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1680px] px-4 sm:px-6 lg:px-8">
        <section className="border-y border-black/[0.08] bg-white">
          <header className="flex flex-col gap-4 border-b border-black/[0.08] px-4 py-5 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.035em] text-zinc-950">
                资料审核管理
              </h2>
            </div>
            <dl className="flex flex-wrap items-center gap-y-2 text-[10px]">
              {[
                ["机构", institutionCount, "text-zinc-950"],
                ["申请单", applicationCount, "text-zinc-950"],
                ["待确认", pendingCount, "text-amber-700"],
                ["需补充", revisionCount, "text-rose-700"],
              ].map(([label, value, color], index) => (
                <div key={String(label)} className={`min-w-[86px] px-4 ${index > 0 ? "border-l border-black/[0.08]" : ""}`}>
                  <dt className="text-zinc-400">{label}</dt>
                  <dd className={`mt-0.5 font-mono text-base font-medium tabular-nums ${color}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </header>

          {hasError && (
            <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-[11px] text-rose-700">
              机构资料审核汇总暂时无法读取，请稍后重试。
            </div>
          )}

          <div className="flex items-center gap-2 border-b border-black/[0.08] px-5 py-3 text-[10px] text-zinc-500">
            <ShieldCheck size={13} className="text-emerald-600" />
            机构运行情况完整可见；学生个人资料仍由所属机构负责处理
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead>
                <tr className="h-10 border-b border-black/[0.08] bg-zinc-50/40 text-[9px] uppercase tracking-[0.07em] text-zinc-500">
                  <th className="w-10 px-3 font-medium"><span className="sr-only">展开</span></th>
                  <th className="w-[250px] border-r border-black/[0.06] px-3 font-medium">机构</th>
                  <th className="w-[100px] px-3 text-right font-medium">活跃学生</th>
                  <th className="w-[100px] px-3 text-right font-medium">申请单</th>
                  <th className="w-[100px] px-3 text-right font-medium">准备中</th>
                  <th className="w-[100px] px-3 text-right font-medium">待确认</th>
                  <th className="w-[100px] px-3 text-right font-medium">需补充</th>
                  <th className="w-[100px] px-3 text-right font-medium">已确认</th>
                  <th className="w-[120px] px-3 font-medium">最久等待</th>
                  <th className="w-[125px] px-5 font-medium">最近更新</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const expanded = expandedTenantIds.has(row.tenant_id);
                  const applicationTotal = numberValue(row.application_count);
                  const flowRows = [
                    ["准备中", numberValue(row.preparing_count), "学生正在整理资料", "text-slate-600", "bg-slate-400"],
                    ["待确认", numberValue(row.pending_review_count), "机构需要及时审核", "text-amber-700", "bg-amber-500"],
                    ["需补充", numberValue(row.revision_required_count), "已退回，等待学生补充", "text-rose-700", "bg-rose-500"],
                    ["已确认", numberValue(row.approved_count), "机构已完成资料确认", "text-emerald-700", "bg-emerald-500"],
                  ] as const;
                  return (
                  <Fragment key={row.tenant_id}>
                  <tr className="h-[50px] border-b border-black/[0.07] text-[11px] hover:bg-zinc-50/60">
                    <td className="px-3"><button type="button" onClick={() => toggleTenant(row.tenant_id)} className="flex size-6 items-center justify-center text-zinc-400 hover:text-zinc-950" aria-label={expanded ? `收起 ${row.tenant_name}` : `展开 ${row.tenant_name}`}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button></td>
                    <td className="border-r border-black/[0.06] px-3">
                      <div className="flex items-center gap-2.5">
                        <Building2 size={13} className="text-zinc-400" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-950">{row.tenant_name}</p>
                          <p className="mt-0.5 font-mono text-[9px] text-zinc-400">{row.tenant_slug}</p>
                        </div>
                        <span className={`ml-auto size-1.5 rounded-full ${row.tenant_status === "active" ? "bg-emerald-500" : "bg-zinc-300"}`} />
                      </div>
                    </td>
                    <td className="px-3 text-right font-mono tabular-nums text-zinc-500">{numberValue(row.active_student_count)}</td>
                    <td className="px-3 text-right font-mono tabular-nums text-zinc-700">{numberValue(row.application_count)}</td>
                    <td className="px-3 text-right font-mono tabular-nums text-zinc-500">{numberValue(row.preparing_count)}</td>
                    <td className="px-3 text-right font-mono tabular-nums text-amber-700">{numberValue(row.pending_review_count)}</td>
                    <td className="px-3 text-right font-mono tabular-nums text-rose-700">{numberValue(row.revision_required_count)}</td>
                    <td className="px-3 text-right font-mono tabular-nums text-emerald-700">{numberValue(row.approved_count)}</td>
                    <td className="px-3 font-mono text-[10px] text-zinc-500">{waitingTime(row.oldest_pending_at)}</td>
                    <td className="px-5 font-mono text-[10px] text-zinc-400"><FormattedDate value={row.last_activity_at} /></td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-black/[0.08] bg-zinc-50/45">
                      <td colSpan={10} className="px-12 py-3">
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                          <table className="w-full border-collapse text-left text-[10px]">
                            <thead><tr className="h-8 border-b border-black/[0.06] text-[8px] uppercase tracking-[0.06em] text-zinc-400"><th className="w-[125px] px-2 font-medium">流程环节</th><th className="w-[90px] px-2 text-right font-medium">申请单</th><th className="w-[90px] px-2 text-right font-medium">占比</th><th className="px-2 font-medium">当前情况</th></tr></thead>
                            <tbody>{flowRows.map(([label, count, explanation, textColor, dotColor]) => <tr key={label} className="h-9 border-b border-black/[0.05] last:border-b-0"><td className={`px-2 font-medium ${textColor}`}><span className={`mr-2 inline-block size-1.5 rounded-full ${dotColor}`} />{label}</td><td className="px-2 text-right font-mono tabular-nums text-zinc-700">{count}</td><td className="px-2 text-right font-mono tabular-nums text-zinc-400">{applicationTotal > 0 ? `${Math.round((count / applicationTotal) * 100)}%` : "—"}</td><td className="px-2 text-zinc-500">{explanation}</td></tr>)}</tbody>
                          </table>
                          <div className="border-l border-black/[0.07] pl-5 text-[10px]">
                            <p className="text-[8px] font-medium uppercase tracking-[0.07em] text-zinc-400">平台巡检判断</p>
                            <p className={`mt-2 text-xs font-medium ${numberValue(row.pending_review_count) > 0 ? "text-amber-700" : numberValue(row.revision_required_count) > 0 ? "text-rose-700" : "text-emerald-700"}`}>{numberValue(row.pending_review_count) > 0 ? `有 ${numberValue(row.pending_review_count)} 份申请单等待机构确认` : numberValue(row.revision_required_count) > 0 ? `有 ${numberValue(row.revision_required_count)} 份申请单等待学生补充` : applicationTotal > 0 ? "当前没有待确认积压" : "该机构尚未产生申请单"}</p>
                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-zinc-500"><div><dt className="text-[8px] text-zinc-400">最久等待</dt><dd className="mt-0.5 font-mono">{waitingTime(row.oldest_pending_at)}</dd></div><div><dt className="text-[8px] text-zinc-400">最近更新</dt><dd className="mt-0.5 font-mono"><FormattedDate value={row.last_activity_at} /></dd></div></dl>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )})}
                {rows.length === 0 && !hasError && (
                  <tr>
                    <td colSpan={10} className="px-5 py-16 text-center">
                      <FileCheck2 className="mx-auto text-zinc-300" size={24} />
                      <p className="mt-3 text-xs font-medium text-zinc-700">暂无机构资料审核数据</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
