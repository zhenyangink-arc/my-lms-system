import { LocalDateTime } from "@/components/LocalDateTime";
import { ManagementNotice } from "@/components/layout/management-page";
import { DataTable } from "@/components/ui/table/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PlatformHelpOverviewRow } from "../api/types";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export function PlatformHelpOverview({
  rows,
  hasError,
}: {
  rows: PlatformHelpOverviewRow[];
  hasError: boolean;
}) {
  return (
    <div className="space-y-3">
      {hasError && (
        <ManagementNotice tone="warning">
          机构帮助中心汇总暂时无法完整读取，请稍后刷新。
        </ManagementNotice>
      )}
      <DataTable
        isEmpty={!hasError && rows.length === 0}
        emptyContent="当前没有可巡检机构"
        footer={
          <p className="text-xs text-[var(--app-muted)]">
            平台范围仅展示机构级统计，不包含学生姓名、问题正文或消息记录。
          </p>
        }
      >
        <Table className="min-w-[1320px]">
          <TableHeader className="bg-[var(--app-soft-bg)]">
            <TableRow>
              <TableHead>机构</TableHead>
              <TableHead>活跃成员</TableHead>
              <TableHead>全部工单</TableHead>
              <TableHead>待回复</TableHead>
              <TableHead>处理中</TableHead>
              <TableHead>待学生确认</TableHead>
              <TableHead>紧急</TableHead>
              <TableHead>超时</TableHead>
              <TableHead>解决率</TableHead>
              <TableHead>最长等待</TableHead>
              <TableHead>最近更新</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.tenantId}>
                <TableCell>
                  <p className="font-semibold text-[var(--app-text)]">{row.tenantName}</p>
                  <p className="mt-1 text-[10px] text-[var(--app-muted)]">
                    {row.tenantStatus === "active" ? "运行中" : "已停用"}
                  </p>
                </TableCell>
                <NumberCell value={row.activeMembers} />
                <NumberCell value={row.totalTickets} />
                <NumberCell value={row.openTickets} />
                <NumberCell value={row.inProgressTickets} />
                <NumberCell value={row.waitingStudentTickets} />
                <NumberCell value={row.urgentPendingTickets} />
                <NumberCell value={row.overdueTickets} />
                <TableCell className="font-mono tabular-nums">{row.resolutionRate}%</TableCell>
                <TableCell className="text-xs text-[var(--app-muted)]">
                  {elapsedLabel(row.oldestWaitingAt)}
                </TableCell>
                <TableCell className="text-xs text-[var(--app-muted)]">
                  <LocalDateTime
                    value={row.lastUpdatedAt}
                    options={DATE_OPTIONS}
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

function NumberCell({ value }: { value: number }) {
  return <TableCell className="font-mono tabular-nums">{value}</TableCell>;
}

function elapsedLabel(value: string | null) {
  if (!value) return "—";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  return `${Math.floor(hours / 24)} 天`;
}
