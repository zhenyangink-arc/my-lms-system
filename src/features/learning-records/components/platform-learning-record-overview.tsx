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
import type { PlatformLearningRecordOverviewRow } from "../api/types";

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
      {Number(value).toLocaleString("zh-CN")}
    </TableCell>
  );
}

export function PlatformLearningRecordOverview({
  rows,
  hasError,
}: {
  rows: PlatformLearningRecordOverviewRow[];
  hasError: boolean;
}) {
  return (
    <div className="space-y-3">
      {hasError && (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          机构学习记录汇总暂时无法完整读取，请稍后刷新。
        </p>
      )}
      <DataTable
        isEmpty={!hasError && rows.length === 0}
        emptyContent="当前没有可巡检机构"
        footer={
          <p className="text-xs text-[var(--app-muted)]">
            平台负责人视图仅展示机构级匿名汇总，不包含学生姓名、账号编号、人工辅导备注标题或正文。
          </p>
        }
      >
        <Table className="min-w-[1180px]">
          <TableHeader className="bg-[var(--app-soft-bg)]">
            <TableRow>
              <TableHead>机构</TableHead>
              <TableHead>活跃学生</TableHead>
              <TableHead>全部人工备注</TableHead>
              <TableHead>有效备注</TableHead>
              <TableHead>学生可见</TableHead>
              <TableHead>仅后台可见</TableHead>
              <TableHead>关注事项</TableHead>
              <TableHead>学习计划</TableHead>
              <TableHead>最近记录</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.tenant_id}>
                <TableCell>
                  <p className="font-semibold text-[var(--app-text)]">{row.tenant_name}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">
                    {row.tenant_status === "active" ? "运行中" : "已停用"}
                  </p>
                </TableCell>
                <NumberCell value={row.active_student_count} />
                <NumberCell value={row.total_record_count} />
                <NumberCell value={row.active_record_count} />
                <NumberCell value={row.student_visible_count} />
                <NumberCell value={row.internal_record_count} />
                <NumberCell value={row.attention_record_count} />
                <NumberCell value={row.plan_record_count} />
                <TableCell className="text-xs text-[var(--app-muted)]">
                  <LocalDateTime value={row.last_record_at} options={DATE_TIME_OPTIONS} fallback="暂无记录" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  );
}
