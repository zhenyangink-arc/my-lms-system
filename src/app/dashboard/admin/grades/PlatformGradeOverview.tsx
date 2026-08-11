import Link from "next/link";
import {
  ArrowRight,
  Building2,
} from "lucide-react";

import { GRADE_DATE_TIME_OPTIONS } from "@/app/dashboard/grades/config";
import { LocalDateTime } from "@/components/LocalDateTime";

export type PlatformGradeOverviewRow = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  tenant_status: string;
  active_student_count: number | string;
  published_assignment_count: number | string;
  grade_record_count: number | string;
  average_score_percent: number | string | null;
  pass_rate_percent: number | string | null;
  pending_review_count: number | string;
  last_grade_at: string | null;
};

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPercent(value: number | string | null) {
  if (value == null) return "—";
  return `${numberValue(value).toFixed(1)}%`;
}

export function PlatformGradeOverview({
  rows,
  hasError,
}: {
  rows: PlatformGradeOverviewRow[];
  hasError: boolean;
}) {
  const institutionCount = rows.length;
  const activeStudentCount = rows.reduce(
    (sum, row) => sum + numberValue(row.active_student_count),
    0,
  );
  const gradeRecordCount = rows.reduce(
    (sum, row) => sum + numberValue(row.grade_record_count),
    0,
  );
  const pendingReviewCount = rows.reduce(
    (sum, row) => sum + numberValue(row.pending_review_count),
    0,
  );
  const weightedScoreTotal = rows.reduce(
    (sum, row) =>
      sum +
      numberValue(row.average_score_percent) *
        numberValue(row.grade_record_count),
    0,
  );
  const overallAverage = gradeRecordCount
    ? weightedScoreTotal / gradeRecordCount
    : null;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1600px] space-y-5 px-4 sm:px-6 lg:px-8">
        <section className="management-table-panel overflow-hidden border">
          <div className="management-table-toolbar border-b px-5 py-4">
            <div>
              <h2>机构成绩运行概览</h2>
              <p className="app-muted-text mt-1 text-xs">仅显示机构级汇总指标，不展示学生个人成绩和答题内容。</p>
            </div>
            <span className="app-muted-text text-xs font-medium">平台负责人视图</span>
          </div>
          <div className="overflow-x-auto">
            <table className="management-summary-table w-full min-w-[720px] border-collapse text-left">
              <thead><tr><th>统计项目</th><th>机构</th><th>活跃学生</th><th>成绩记录</th><th>待复核</th><th>平均得分率</th></tr></thead>
              <tbody><tr><th>当前数量</th><td>{institutionCount}</td><td>{activeStudentCount}</td><td>{gradeRecordCount}</td><td>{pendingReviewCount}</td><td>{overallAverage == null ? "—" : `${overallAverage.toFixed(1)}%`}</td></tr></tbody>
            </table>
          </div>
        </section>

        <section
          className="flex flex-col gap-4 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center"
          style={{
            color: "var(--app-secondary)",
            borderColor: "var(--app-secondary)",
            backgroundColor: "var(--app-secondary-soft)",
          }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black">平台数据边界</p>
            <p className="mt-1 text-[11px] leading-5">
              平台负责人用于判断各机构成绩业务是否正常运行；学生成绩核对和复核处理仍由对应机构完成。
            </p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="text-xl font-black">
              {overallAverage == null ? "—" : `${overallAverage.toFixed(1)}%`}
            </p>
            <p className="text-[10px] font-black">平台总体平均得分率</p>
          </div>
        </section>

        {hasError && (
          <section
            className="rounded-2xl border px-4 py-3 text-sm font-bold"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
            }}
          >
            机构成绩汇总暂时无法读取，请确认数据库迁移已经执行。
          </section>
        )}

        <section className="app-card overflow-hidden rounded-3xl border">
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"
            style={{ borderColor: "var(--app-border)" }}
          >
            <div>
              <h2 className="text-base font-black">机构成绩运行表</h2>
              <p className="app-muted-text mt-1 text-[10px]">
                每行对应一个机构，仅展示汇总统计。
              </p>
            </div>
            <span className="app-muted-text text-xs font-black">
              共 {institutionCount} 个机构
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-left">
              <thead>
                <tr
                  className="app-muted-text border-b bg-[var(--app-soft-bg)] text-[10px]"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <th className="w-[20%] px-5 py-3 font-black">机构</th>
                  <th className="w-[10%] px-3 py-3 text-center font-black">活跃学生</th>
                  <th className="w-[10%] px-3 py-3 text-center font-black">已发布任务</th>
                  <th className="w-[10%] px-3 py-3 text-center font-black">成绩记录</th>
                  <th className="w-[11%] px-3 py-3 font-black">平均得分率</th>
                  <th className="w-[10%] px-3 py-3 font-black">通过率</th>
                  <th className="w-[10%] px-3 py-3 text-center font-black">待复核</th>
                  <th className="w-[11%] px-3 py-3 font-black">最近成绩</th>
                  <th className="w-[8%] px-5 py-3 font-black">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const pending = numberValue(row.pending_review_count);
                  return (
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
                        {numberValue(row.published_assignment_count)}
                      </td>
                      <td className="px-3 py-4 text-center font-mono font-black">
                        {numberValue(row.grade_record_count)}
                      </td>
                      <td className="px-3 py-4 font-mono font-black">
                        {formatPercent(row.average_score_percent)}
                      </td>
                      <td className="px-3 py-4 font-mono font-black">
                        {formatPercent(row.pass_rate_percent)}
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span
                          className="inline-flex min-w-8 justify-center rounded-full px-2 py-1 font-mono text-[9px] font-black"
                          style={{
                            color: pending > 0 ? "var(--app-warm)" : "var(--app-success)",
                            backgroundColor: pending > 0 ? "var(--app-warm-soft)" : "var(--app-success-soft)",
                          }}
                        >
                          {pending}
                        </span>
                      </td>
                      <td className="app-muted-text px-3 py-4 text-[10px]">
                        {row.last_grade_at
                          ? <LocalDateTime value={row.last_grade_at} options={GRADE_DATE_TIME_OPTIONS} />
                          : "暂无成绩"}
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
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="app-muted-text px-5 py-12 text-center text-xs"
                    >
                      当前还没有可显示的机构成绩汇总。
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
