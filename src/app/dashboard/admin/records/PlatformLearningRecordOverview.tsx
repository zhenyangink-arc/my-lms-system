import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  FileClock,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
} from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { learningRecordDateFormatter } from "@/app/dashboard/records/config";

export type PlatformLearningRecordOverviewRow = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  tenant_status: string;
  active_student_count: number | string;
  total_record_count: number | string;
  active_record_count: number | string;
  student_visible_count: number | string;
  internal_record_count: number | string;
  attention_record_count: number | string;
  plan_record_count: number | string;
  last_record_at: string | null;
};

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PlatformLearningRecordOverview({
  rows,
  hasError,
}: {
  rows: PlatformLearningRecordOverviewRow[];
  hasError: boolean;
}) {
  const totals = rows.reduce(
    (current, row) => ({
      students: current.students + numberValue(row.active_student_count),
      records: current.records + numberValue(row.active_record_count),
      visible: current.visible + numberValue(row.student_visible_count),
      attention: current.attention + numberValue(row.attention_record_count),
    }),
    { students: 0, records: 0, visible: 0, attention: 0 },
  );

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1600px] space-y-5 px-4 sm:px-6 lg:px-8">
        <section
          className="app-card rounded-3xl border p-5 sm:p-6"
          style={{ backgroundColor: "var(--app-card-bg)" }}
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_620px] xl:items-center">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{
                  color: "var(--app-secondary)",
                  backgroundColor: "var(--app-secondary-soft)",
                }}
              >
                <ShieldCheck size={14} />
                平台负责人视图
              </span>
              <DashboardTitleWithHint
                className="mt-3"
                title="机构学习记录运行概览"
                description="只查看机构级记录数量和运行状态，不展示学生姓名、记录标题、正文或下一步建议。"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["机构", rows.length, Building2, "var(--app-secondary)"],
                ["活跃学生", totals.students, UsersRound, "var(--app-accent)"],
                ["有效记录", totals.records, FileClock, "var(--app-success)"],
                ["关注事项", totals.attention, TriangleAlert, "var(--app-warm)"],
              ].map(([label, value, Icon, color]) => {
                const MetricIcon = Icon as typeof Building2;
                return (
                  <div
                    key={String(label)}
                    className="app-soft-card rounded-2xl border p-4 text-center"
                  >
                    <MetricIcon
                      className="mx-auto"
                      size={17}
                      style={{ color: String(color) }}
                    />
                    <p className="mt-2 text-xl font-black">{String(value)}</p>
                    <p className="app-muted-text text-[10px] font-black">
                      {String(label)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border px-4 py-3 text-[11px] font-bold leading-5"
          style={{
            color: "var(--app-secondary)",
            borderColor: "var(--app-secondary)",
            backgroundColor: "var(--app-secondary-soft)",
          }}
        >
          平台只用于确认各机构是否持续维护学习记录；具体内容和学生信息由对应机构自行管理。
        </section>

        {hasError && (
          <section
            className="rounded-2xl border px-4 py-3 text-sm font-bold"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
            }}
          >
            机构学习记录汇总暂时无法读取，请确认数据库迁移已经执行。
          </section>
        )}

        <section className="app-card overflow-hidden rounded-3xl border">
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"
            style={{ borderColor: "var(--app-border)" }}
          >
            <div>
              <h2 className="text-base font-black">机构学习记录运行表</h2>
              <p className="app-muted-text mt-1 text-[10px]">
                每行对应一个机构，仅展示汇总数据。
              </p>
            </div>
            <span className="app-muted-text text-xs font-black">
              共 {rows.length} 个机构
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-left">
              <thead>
                <tr
                  className="app-muted-text border-b bg-[var(--app-soft-bg)] text-[10px]"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <th className="w-[21%] px-5 py-3 font-black">机构</th>
                  <th className="w-[10%] px-3 py-3 text-center font-black">活跃学生</th>
                  <th className="w-[10%] px-3 py-3 text-center font-black">有效记录</th>
                  <th className="w-[10%] px-3 py-3 text-center font-black">学生可见</th>
                  <th className="w-[10%] px-3 py-3 text-center font-black">内部记录</th>
                  <th className="w-[10%] px-3 py-3 text-center font-black">关注事项</th>
                  <th className="w-[9%] px-3 py-3 text-center font-black">学习计划</th>
                  <th className="w-[12%] px-3 py-3 font-black">最近记录</th>
                  <th className="w-[8%] px-5 py-3 font-black">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.tenant_id}
                    className="border-b text-[11px] last:border-b-0"
                    style={{ borderColor: "var(--app-border-soft)" }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            color: "var(--app-secondary)",
                            backgroundColor: "var(--app-secondary-soft)",
                          }}
                        >
                          <Building2 size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-black">{row.tenant_name}</p>
                          <p className="app-muted-text mt-1 text-[9px]">
                            {row.tenant_slug} · {row.tenant_status === "active" ? "正常" : "已停用"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-center font-mono font-black">
                      {numberValue(row.active_student_count)}
                    </td>
                    <td className="px-3 py-4 text-center font-mono font-black">
                      {numberValue(row.active_record_count)}
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="inline-flex items-center gap-1 font-mono font-black" style={{ color: "var(--app-success)" }}>
                        <Eye size={11} />
                        {numberValue(row.student_visible_count)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="app-muted-text inline-flex items-center gap-1 font-mono font-black">
                        <EyeOff size={11} />
                        {numberValue(row.internal_record_count)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center font-mono font-black" style={{ color: "var(--app-warm)" }}>
                      {numberValue(row.attention_record_count)}
                    </td>
                    <td className="px-3 py-4 text-center font-mono font-black">
                      {numberValue(row.plan_record_count)}
                    </td>
                    <td className="app-muted-text px-3 py-4 text-[10px]">
                      {row.last_record_at
                        ? learningRecordDateFormatter.format(new Date(row.last_record_at))
                        : "暂无记录"}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/admin/tenants/${row.tenant_id}`}
                        className="inline-flex items-center gap-1 font-black"
                        style={{ color: "var(--app-secondary)" }}
                      >
                        查看机构
                        <ArrowRight size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="app-muted-text px-5 py-12 text-center text-xs">
                      当前还没有可显示的机构学习记录汇总。
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
