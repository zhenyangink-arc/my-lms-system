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
import type { PlatformVisaOverviewRow } from "../api/types";

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

export function PlatformVisaOverview({
  rows,
  hasError,
}: {
  rows: PlatformVisaOverviewRow[];
  hasError: boolean;
}) {
  const totals = rows.reduce(
    (summary, row) => ({
      cases: summary.cases + row.caseCount,
      submitted: summary.submitted + row.submittedCount,
      issued: summary.issued + row.issuedCount,
      pendingTasks: summary.pendingTasks + row.pendingTaskCount,
      supportTasks: summary.supportTasks + row.supportTaskCount,
    }),
    { cases: 0, submitted: 0, issued: 0, pendingTasks: 0, supportTasks: 0 },
  );

  return (
    <div className="space-y-3">
      {hasError && (
        <ManagementNotice tone="warning">
          机构签证汇总暂时无法完整读取，请稍后刷新。
        </ManagementNotice>
      )}
      <ManagementMetricStrip
        label="平台签证巡检概况"
        items={[
          { label: "覆盖机构", value: rows.length },
          { label: "签证档案", value: totals.cases },
          { label: "已经递签", value: totals.submitted },
          { label: "已经获签", value: totals.issued },
          {
            label: "待处理任务",
            value: totals.pendingTasks + totals.supportTasks,
          },
        ]}
      />
      <DataTable
        isEmpty={!hasError && rows.length === 0}
        emptyContent="当前没有可巡检机构"
        footer={
          <p className="text-xs text-[var(--foreground-muted)]">
            平台负责人视图仅展示机构级匿名统计，不包含学生姓名、学生账号、学生 ID、签证任务正文或案件详情。
          </p>
        }
      >
        <Table className="min-w-[1380px]">
          <TableHeader className="bg-[var(--surface-soft)]">
            <TableRow>
              <TableHead>机构</TableHead>
              <TableHead>活跃学生</TableHead>
              <TableHead>签证档案</TableHead>
              <TableHead>机构准备</TableHead>
              <TableHead>材料准备</TableHead>
              <TableHead>已经递签</TableHead>
              <TableHead>等待补件</TableHead>
              <TableHead>签证批准</TableHead>
              <TableHead>已经获签</TableHead>
              <TableHead>等待审核任务</TableHead>
              <TableHead>补充／协助任务</TableHead>
              <TableHead>临近入境</TableHead>
              <TableHead>最早等待</TableHead>
              <TableHead>最近活动</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.tenantId}>
                <TableCell>
                  <p className="font-semibold text-[var(--foreground)]">
                    {row.tenantName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--foreground-muted)]">
                    {row.tenantStatus === "active" ? "运行中" : "已停用"}
                  </p>
                </TableCell>
                <NumberCell value={row.activeStudentCount} />
                <NumberCell value={row.caseCount} />
                <NumberCell value={row.adminPreparingCount} />
                <NumberCell value={row.preparingCount} />
                <NumberCell value={row.submittedCount} />
                <NumberCell value={row.additionalDocumentsCount} />
                <NumberCell value={row.approvedCount} />
                <NumberCell value={row.issuedCount} />
                <NumberCell value={row.pendingTaskCount} />
                <NumberCell value={row.supportTaskCount} />
                <NumberCell value={row.upcomingEntryCount} />
                <TableCell className="text-xs text-[var(--foreground-muted)]">
                  <LocalDateTime
                    value={row.oldestPendingAt}
                    options={DATE_TIME_OPTIONS}
                    fallback="暂无等待"
                  />
                </TableCell>
                <TableCell className="text-xs text-[var(--foreground-muted)]">
                  <LocalDateTime
                    value={row.lastActivityAt}
                    options={DATE_TIME_OPTIONS}
                    fallback="暂无活动"
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
