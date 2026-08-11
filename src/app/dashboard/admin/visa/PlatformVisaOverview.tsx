"use client";

import { Building2, ChevronDown, ChevronRight, Plane, ShieldCheck } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { LocalDateTime } from "@/components/LocalDateTime";

export type PlatformVisaOverviewRow = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  tenant_status: string;
  active_student_count: number | string;
  case_count: number | string;
  admin_preparing_count: number | string;
  preparing_count: number | string;
  submitted_count: number | string;
  additional_documents_count: number | string;
  approved_count: number | string;
  issued_count: number | string;
  pending_task_count: number | string;
  support_task_count: number | string;
  upcoming_entry_count: number | string;
  oldest_pending_at: string | null;
  last_activity_at: string | null;
};

export type PlatformVisaCaseAuditRow = {
  tenant_id: string;
  case_reference: string;
  visa_type: string;
  application_channel: string;
  case_status: string;
  task_count: number | string;
  approved_task_count: number | string;
  pending_task_count: number | string;
  support_task_count: number | string;
  target_entry_date: string | null;
  planned_entry_date: string | null;
  oldest_pending_at: string | null;
  updated_at: string;
};

const VISA_TYPE_LABELS: Record<string, string> = {
  d4_language: "语言研修签证",
  d2_bachelor: "本科签证",
  d2_master: "硕士签证",
  d2_doctor: "博士签证",
};

const CHANNEL_LABELS: Record<string, string> = {
  china_consulate: "驻华领馆递签",
  korea_immigration: "韩国出入境返签",
};

const CASE_STATUS_LABELS: Record<string, string> = {
  admin_preparing: "机构准备",
  planning: "材料运输",
  preparing: "学生确认",
  ready_to_submit: "准备递签",
  submitted: "已经递签",
  additional_documents: "等待补件",
  approved: "签证批准",
  issued: "已经获签",
  closed: "已经关闭",
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
  return hours < 24 ? `${hours} 小时` : `${Math.floor(hours / 24)} 天`;
}

export function PlatformVisaOverview({
  rows,
  caseRows,
  hasError,
}: {
  rows: PlatformVisaOverviewRow[];
  caseRows: PlatformVisaCaseAuditRow[];
  hasError: boolean;
}) {
  const [expandedTenantIds, setExpandedTenantIds] = useState<Set<string>>(new Set());
  const totals = useMemo(
    () => ({
      cases: rows.reduce((sum, row) => sum + numberValue(row.case_count), 0),
      pending: rows.reduce((sum, row) => sum + numberValue(row.pending_task_count), 0),
      support: rows.reduce((sum, row) => sum + numberValue(row.support_task_count), 0),
      issued: rows.reduce((sum, row) => sum + numberValue(row.issued_count), 0),
    }),
    [rows]
  );
  const caseRowsByTenant = useMemo(() => {
    const grouped = new Map<string, PlatformVisaCaseAuditRow[]>();
    for (const item of caseRows) {
      const group = grouped.get(item.tenant_id) ?? [];
      group.push(item);
      grouped.set(item.tenant_id, group);
    }
    return grouped;
  }, [caseRows]);

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
      <div className="mx-auto mt-5 w-full max-w-[1720px] px-4 sm:px-6 lg:px-8">
        <section className="border-y border-black/[0.08] bg-white">
          <header className="flex flex-col gap-4 border-b border-black/[0.08] px-4 py-5 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-400">
                平台负责人 / 机构运行巡检
              </p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.035em] text-zinc-950">
                签证管理
              </h2>
            </div>
            <dl className="flex flex-wrap items-center gap-y-2 text-[10px]">
              {[
                ["机构", rows.length, "text-zinc-950"],
                ["签证档案", totals.cases, "text-zinc-950"],
                ["等待审核", totals.pending, "text-amber-700"],
                ["待补件 / 协助", totals.support, "text-rose-700"],
                ["已获签", totals.issued, "text-emerald-700"],
              ].map(([label, value, color], index) => (
                <div
                  key={String(label)}
                  className={`min-w-[88px] px-4 ${index > 0 ? "border-l border-black/[0.08]" : ""}`}
                >
                  <dt className="text-zinc-400">{label}</dt>
                  <dd className={`mt-0.5 font-mono text-base font-medium tabular-nums ${color}`}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </header>

          {hasError && (
            <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-[11px] text-rose-700">
              机构签证汇总暂时无法读取，请确认数据库迁移已经完成。
            </div>
          )}

          <div className="flex items-center gap-2 border-b border-black/[0.08] px-5 py-3 text-[10px] text-zinc-500">
            <ShieldCheck size={13} className="text-emerald-600" />
            平台可巡检每家机构的办理质量与积压；学生身份和敏感签证材料仍由所属机构处理。
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] border-collapse text-left">
              <thead>
                <tr className="h-10 border-b border-black/[0.08] bg-zinc-50/40 text-[9px] uppercase tracking-[0.07em] text-zinc-500">
                  <th className="w-10 px-3 font-medium"><span className="sr-only">展开</span></th>
                  <th className="w-[250px] border-r border-black/[0.06] px-3 font-medium">机构</th>
                  <th className="w-[90px] px-3 text-right font-medium">学生</th>
                  <th className="w-[95px] px-3 text-right font-medium">档案</th>
                  <th className="w-[100px] px-3 text-right font-medium">等待审核</th>
                  <th className="w-[120px] px-3 text-right font-medium">补件 / 受阻</th>
                  <th className="w-[90px] px-3 text-right font-medium">已递签</th>
                  <th className="w-[90px] px-3 text-right font-medium">已获签</th>
                  <th className="w-[100px] px-3 text-right font-medium">临近入境</th>
                  <th className="w-[115px] px-3 font-medium">最长等待</th>
                  <th className="w-[125px] px-5 font-medium">最近更新</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const expanded = expandedTenantIds.has(row.tenant_id);
                  const total = numberValue(row.case_count);
                  const flowRows = [
                    ["机构准备", numberValue(row.admin_preparing_count), "text-violet-700", "bg-violet-500"],
                    ["材料准备", numberValue(row.preparing_count), "text-sky-700", "bg-sky-500"],
                    ["已经递签", numberValue(row.submitted_count), "text-amber-700", "bg-amber-500"],
                    ["等待补件", numberValue(row.additional_documents_count), "text-rose-700", "bg-rose-500"],
                    ["签证批准", numberValue(row.approved_count), "text-teal-700", "bg-teal-500"],
                    ["已经获签", numberValue(row.issued_count), "text-emerald-700", "bg-emerald-500"],
                  ] as const;
                  const pending = numberValue(row.pending_task_count);
                  const support = numberValue(row.support_task_count);
                  const tenantCases = caseRowsByTenant.get(row.tenant_id) ?? [];

                  return (
                    <Fragment key={row.tenant_id}>
                      <tr className="h-[50px] border-b border-black/[0.07] text-[11px] hover:bg-zinc-50/60">
                        <td className="px-3">
                          <button
                            type="button"
                            onClick={() => toggleTenant(row.tenant_id)}
                            className="flex size-6 items-center justify-center text-zinc-400 hover:text-zinc-950"
                            aria-label={expanded ? `收起 ${row.tenant_name}` : `展开 ${row.tenant_name}`}
                          >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
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
                        <td className="px-3 text-right font-mono tabular-nums text-zinc-800">{total}</td>
                        <td className="px-3 text-right font-mono tabular-nums text-amber-700">{pending}</td>
                        <td className="px-3 text-right font-mono tabular-nums text-rose-700">{support}</td>
                        <td className="px-3 text-right font-mono tabular-nums text-sky-700">{numberValue(row.submitted_count)}</td>
                        <td className="px-3 text-right font-mono tabular-nums text-emerald-700">{numberValue(row.issued_count)}</td>
                        <td className="px-3 text-right font-mono tabular-nums text-violet-700">{numberValue(row.upcoming_entry_count)}</td>
                        <td className="px-3 font-mono text-[10px] text-zinc-500">{waitingTime(row.oldest_pending_at)}</td>
                        <td className="px-5 font-mono text-[10px] text-zinc-400"><FormattedDate value={row.last_activity_at} /></td>
                      </tr>

                      {expanded && (
                        <tr className="border-b border-black/[0.08] bg-zinc-50/45">
                          <td colSpan={11} className="px-12 py-3">
                            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                              <table className="w-full border-collapse text-left text-[10px]">
                                <thead>
                                  <tr className="h-8 border-b border-black/[0.06] text-[8px] uppercase tracking-[0.06em] text-zinc-400">
                                    <th className="w-[130px] px-2 font-medium">办理阶段</th>
                                    <th className="w-[90px] px-2 text-right font-medium">档案</th>
                                    <th className="w-[90px] px-2 text-right font-medium">占比</th>
                                    <th className="px-2 font-medium">巡检说明</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {flowRows.map(([label, count, textColor, dotColor]) => (
                                    <tr key={label} className="h-9 border-b border-black/[0.05] last:border-b-0">
                                      <td className={`px-2 font-medium ${textColor}`}>
                                        <span className={`mr-2 inline-block size-1.5 rounded-full ${dotColor}`} />{label}
                                      </td>
                                      <td className="px-2 text-right font-mono tabular-nums text-zinc-700">{count}</td>
                                      <td className="px-2 text-right font-mono tabular-nums text-zinc-400">{total > 0 ? `${Math.round((count / total) * 100)}%` : "—"}</td>
                                      <td className="px-2 text-zinc-500">{count > 0 ? `${count} 份档案处于该阶段` : "当前没有档案"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              <div className="border-l border-black/[0.07] pl-5 text-[10px]">
                                <p className="text-[8px] font-medium uppercase tracking-[0.07em] text-zinc-400">平台巡检判断</p>
                                <p className={`mt-2 text-xs font-medium ${pending > 0 ? "text-amber-700" : support > 0 ? "text-rose-700" : total > 0 ? "text-emerald-700" : "text-zinc-500"}`}>
                                  {pending > 0
                                    ? `有 ${pending} 项任务等待机构审核`
                                    : support > 0
                                      ? `有 ${support} 项任务等待补件或机构协助`
                                      : total > 0
                                        ? "当前没有审核积压"
                                        : "该机构尚未产生签证档案"}
                                </p>
                                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-zinc-500">
                                  <div><dt className="text-[8px] text-zinc-400">最长等待</dt><dd className="mt-0.5 font-mono">{waitingTime(row.oldest_pending_at)}</dd></div>
                                  <div><dt className="text-[8px] text-zinc-400">临近入境</dt><dd className="mt-0.5 font-mono">{numberValue(row.upcoming_entry_count)} 人</dd></div>
                                </dl>
                              </div>
                            </div>
                            <div className="mt-4 border-t border-black/[0.07] pt-3">
                              <div className="mb-2 flex items-center justify-between text-[9px] text-zinc-400">
                                <span className="uppercase tracking-[0.07em]">匿名案件巡检</span>
                                <span>{tenantCases.length} 份档案</span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] border-collapse text-left text-[9px]">
                                  <thead>
                                    <tr className="h-8 border-b border-black/[0.06] text-[8px] uppercase tracking-[0.05em] text-zinc-400">
                                      <th className="w-[110px] px-2 font-medium">案件编号</th>
                                      <th className="w-[120px] px-2 font-medium">签证类型</th>
                                      <th className="w-[140px] px-2 font-medium">办理通道</th>
                                      <th className="w-[100px] px-2 font-medium">当前阶段</th>
                                      <th className="w-[110px] px-2 text-right font-medium">任务进度</th>
                                      <th className="w-[100px] px-2 text-right font-medium">待处理</th>
                                      <th className="w-[110px] px-2 font-medium">最长等待</th>
                                      <th className="w-[110px] px-2 font-medium">计划入境</th>
                                      <th className="w-[120px] px-2 font-medium">最近更新</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tenantCases.map((item) => {
                                      const itemPending = numberValue(item.pending_task_count);
                                      const itemSupport = numberValue(item.support_task_count);
                                      return (
                                        <tr key={`${item.tenant_id}-${item.case_reference}`} className="h-9 border-b border-black/[0.05] last:border-b-0">
                                          <td className="px-2 font-mono text-zinc-600">签证-{item.case_reference}</td>
                                          <td className="px-2 text-zinc-600">{VISA_TYPE_LABELS[item.visa_type] ?? item.visa_type}</td>
                                          <td className="px-2 text-zinc-500">{CHANNEL_LABELS[item.application_channel] ?? item.application_channel}</td>
                                          <td className="px-2 font-medium text-zinc-700">{CASE_STATUS_LABELS[item.case_status] ?? item.case_status}</td>
                                          <td className="px-2 text-right font-mono tabular-nums text-zinc-600">{numberValue(item.approved_task_count)} / {numberValue(item.task_count)}</td>
                                          <td className={`px-2 text-right font-mono tabular-nums ${itemPending + itemSupport > 0 ? "text-rose-700" : "text-zinc-400"}`}>{itemPending + itemSupport}</td>
                                          <td className="px-2 font-mono text-zinc-400">{waitingTime(item.oldest_pending_at)}</td>
                                          <td className="px-2 font-mono text-zinc-500">{item.planned_entry_date ?? item.target_entry_date ?? "—"}</td>
                                          <td className="px-2 font-mono text-zinc-400"><FormattedDate value={item.updated_at} /></td>
                                        </tr>
                                      );
                                    })}
                                    {tenantCases.length === 0 && <tr><td colSpan={9} className="px-2 py-8 text-center text-zinc-400">该机构尚未产生签证案件</td></tr>}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {rows.length === 0 && !hasError && (
                  <tr>
                    <td colSpan={11} className="px-5 py-16 text-center">
                      <Plane className="mx-auto text-zinc-300" size={24} />
                      <p className="mt-3 text-xs font-medium text-zinc-700">暂无机构签证运行数据</p>
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
