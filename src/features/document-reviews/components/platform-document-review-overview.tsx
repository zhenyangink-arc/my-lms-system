import { LocalDateTime } from "@/components/LocalDateTime";
import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import { DataTable } from "@/components/ui/table/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PlatformDocumentReviewOverviewRow } from "../api/types";

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function NumberCell({ value }: { value: number }) {
  return (
    <TableCell className="font-mono tabular-nums">
      {value.toLocaleString("zh-CN")}
    </TableCell>
  );
}

export function PlatformDocumentReviewOverview({
  rows,
  hasError,
}: {
  rows: PlatformDocumentReviewOverviewRow[];
  hasError: boolean;
}) {
  const totals = rows.reduce(
    (summary, row) => ({
      applications: summary.applications + row.applicationCount,
      pending: summary.pending + row.pendingReviewCount,
      revisions: summary.revisions + row.revisionRequiredCount,
      approved: summary.approved + row.approvedCount,
    }),
    { applications: 0, pending: 0, revisions: 0, approved: 0 },
  );

  return (
    <div className="space-y-3">
      {hasError && (
        <ManagementNotice tone="warning">
          机构资料审核汇总暂时无法完整读取，请稍后刷新。
        </ManagementNotice>
      )}
      <ManagementMetricStrip
        label="平台申请材料巡检概况"
        items={[
          { label: "覆盖机构", value: rows.length },
          { label: "申请单", value: totals.applications },
          { label: "待确认", value: totals.pending },
          { label: "需补充", value: totals.revisions },
          { label: "已确认", value: totals.approved },
        ]}
      />
      <DataTable
        isEmpty={!hasError && rows.length === 0}
        emptyContent="当前没有可巡检机构"
        footer={
          <p className="text-xs text-[var(--app-muted)]">
            平台负责人视图只展示机构级匿名汇总，不包含学生姓名、账号编号、目标大学、资料名称或审核意见。
          </p>
        }
      >
        <Table className="min-w-[1180px]">
          <TableHeader className="bg-[var(--app-soft-bg)]">
            <TableRow>
              <TableHead>机构</TableHead>
              <TableHead>活跃学生</TableHead>
              <TableHead>申请单</TableHead>
              <TableHead>准备中</TableHead>
              <TableHead>待确认</TableHead>
              <TableHead>需补充</TableHead>
              <TableHead>已确认</TableHead>
              <TableHead>最早待确认</TableHead>
              <TableHead>最近更新</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.tenantId}>
                <TableCell>
                  <p className="font-semibold text-[var(--app-text)]">
                    {row.tenantName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">
                    {row.tenantStatus === "active" ? "运行中" : "已停用"}
                  </p>
                </TableCell>
                <NumberCell value={row.activeStudentCount} />
                <NumberCell value={row.applicationCount} />
                <NumberCell value={row.preparingCount} />
                <NumberCell value={row.pendingReviewCount} />
                <NumberCell value={row.revisionRequiredCount} />
                <NumberCell value={row.approvedCount} />
                <TableCell className="text-xs text-[var(--app-muted)]">
                  <LocalDateTime
                    value={row.oldestPendingAt}
                    options={DATE_TIME_OPTIONS}
                    fallback="暂无待确认"
                  />
                </TableCell>
                <TableCell className="text-xs text-[var(--app-muted)]">
                  <LocalDateTime
                    value={row.lastActivityAt}
                    options={DATE_TIME_OPTIONS}
                    fallback="暂无更新"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  );
}
