import { LocalDateTime } from "@/components/LocalDateTime";
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
  return (
    <div className="space-y-3">
      {hasError && (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          机构资料审核汇总暂时无法完整读取，请稍后刷新。
        </p>
      )}
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
