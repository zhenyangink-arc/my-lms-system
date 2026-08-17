import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
} from "lucide-react";

import { LEARNING_RECORD_DATE_TIME_OPTIONS } from "@/app/dashboard/records/config";
import { LocalDateTime } from "@/components/LocalDateTime";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";

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
        <section className="management-table-panel overflow-hidden border">
          <div className="management-table-toolbar border-b px-5 py-4">
            <p className="app-muted-text text-xs">平台负责人视图仅展示机构级数量和运行状态，不展示学生个人记录。</p>
          </div>
          <div className="overflow-x-auto">
            <table className="management-summary-table w-full min-w-[680px] border-collapse text-left">
              <thead><tr><th>统计项目</th><th>机构</th><th>活跃学生</th><th>有效记录</th><th>学生可见</th><th>关注事项</th></tr></thead>
              <tbody><tr><th>当前数量</th><td>{rows.length}</td><td>{totals.students}</td><td>{totals.records}</td><td>{totals.visible}</td><td>{totals.attention}</td></tr></tbody>
            </table>
          </div>
        </section>

        <section
          className="rounded-2xl border px-4 py-3 text-[11px] font-bold leading-5"
          style={{
            color: "var(--support)",
            borderColor: "var(--support)",
            backgroundColor: "var(--support-surface)",
          }}
        >
          平台只用于确认各机构是否持续维护学习记录；具体内容和学生信息由对应机构自行管理。
        </section>

        {hasError && (
          <section
            className="rounded-2xl border px-4 py-3 text-sm font-bold"
            style={{
              color: "var(--status-warning)",
              backgroundColor: "var(--status-warning-surface)",
            }}
          >
            机构学习记录汇总暂时无法读取，请确认数据库迁移已经执行。
          </section>
        )}

        <section className="management-table-panel overflow-hidden border">
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <h2 className="text-base font-semibold">机构学习记录运行表</h2>
            </div>
            <span className="app-muted-text text-xs font-semibold">
              共 {rows.length} 个机构
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-left">
              <thead>
                <tr
                  className="app-muted-text border-b bg-[var(--surface-soft)] text-[10px]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <th className="w-[21%] px-5 py-3 font-semibold">机构</th>
                  <th className="w-[10%] px-3 py-3 text-center font-semibold">活跃学生</th>
                  <th className="w-[10%] px-3 py-3 text-center font-semibold">有效记录</th>
                  <th className="w-[10%] px-3 py-3 text-center font-semibold">学生可见</th>
                  <th className="w-[10%] px-3 py-3 text-center font-semibold">内部记录</th>
                  <th className="w-[10%] px-3 py-3 text-center font-semibold">关注事项</th>
                  <th className="w-[9%] px-3 py-3 text-center font-semibold">学习计划</th>
                  <th className="w-[12%] px-3 py-3 font-semibold">最近记录</th>
                  <th className="w-[8%] px-5 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.tenant_id}
                    className="border-b text-[11px] last:border-b-0"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            color: "var(--support)",
                            backgroundColor: "var(--support-surface)",
                          }}
                        >
                          <Building2 size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{row.tenant_name}</p>
                          <p className="app-muted-text mt-1 text-[9px]">
                            {row.tenant_slug} · {row.tenant_status === "active" ? "正常" : "已停用"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-center font-mono font-semibold">
                      {numberValue(row.active_student_count)}
                    </td>
                    <td className="px-3 py-4 text-center font-mono font-semibold">
                      {numberValue(row.active_record_count)}
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="inline-flex items-center gap-1 font-mono font-semibold" style={{ color: "var(--status-success)" }}>
                        <Eye size={11} />
                        {numberValue(row.student_visible_count)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="app-muted-text inline-flex items-center gap-1 font-mono font-semibold">
                        <EyeOff size={11} />
                        {numberValue(row.internal_record_count)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center font-mono font-semibold" style={{ color: "var(--status-warning)" }}>
                      {numberValue(row.attention_record_count)}
                    </td>
                    <td className="px-3 py-4 text-center font-mono font-semibold">
                      {numberValue(row.plan_record_count)}
                    </td>
                    <td className="app-muted-text px-3 py-4 text-[10px]">
                      {row.last_record_at
                        ? <LocalDateTime value={row.last_record_at} options={LEARNING_RECORD_DATE_TIME_OPTIONS} />
                        : "暂无记录"}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={scopeDashboardPath(
                          `/dashboard/admin/tenants/${row.tenant_id}`,
                          getDashboardBasePath(null),
                        )}
                        className="inline-flex items-center gap-1 font-semibold"
                        style={{ color: "var(--support)" }}
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
