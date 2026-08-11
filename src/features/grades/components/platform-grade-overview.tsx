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
import type { PlatformGradeOverviewRow } from "../api/types";

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentValue(value: number | string | null) {
  return value == null ? "—" : `${numberValue(value).toFixed(1)}%`;
}

function NumberCell({ value }: { value: number | string }) {
  return (
    <TableCell className="font-mono tabular-nums">
      {numberValue(value).toLocaleString("zh-CN")}
    </TableCell>
  );
}

export function PlatformGradeOverview({
  rows,
  hasError,
}: {
  rows: PlatformGradeOverviewRow[];
  hasError: boolean;
}) {
  return (
    <div className="space-y-3">
      {hasError && (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          机构成绩汇总暂时无法完整读取，请稍后刷新。
        </p>
      )}
      <DataTable
        isEmpty={!hasError && rows.length === 0}
        emptyContent="当前没有可巡检机构"
        footer={
          <p className="text-xs text-[var(--app-muted)]">
            平台负责人视图仅展示机构级匿名汇总，不包含学生姓名、学生账号、个案成绩或复核内容。
          </p>
        }
      >
        <Table className="min-w-[1120px]">
          <TableHeader className="bg-[var(--app-soft-bg)]">
            <TableRow>
              <TableHead>机构</TableHead>
              <TableHead>活跃学生</TableHead>
              <TableHead>已发布任务</TableHead>
              <TableHead>实时成绩</TableHead>
              <TableHead>平均得分率</TableHead>
              <TableHead>通过率</TableHead>
              <TableHead>待复核</TableHead>
              <TableHead>最近成绩</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.tenant_id}>
                <TableCell>
                  <p className="font-semibold text-[var(--app-text)]">
                    {row.tenant_name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">
                    {row.tenant_status === "active" ? "运行中" : "已停用"}
                  </p>
                </TableCell>
                <NumberCell value={row.active_student_count} />
                <NumberCell value={row.published_assignment_count} />
                <NumberCell value={row.grade_record_count} />
                <TableCell className="font-mono tabular-nums">
                  {percentValue(row.average_score_percent)}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {percentValue(row.pass_rate_percent)}
                </TableCell>
                <NumberCell value={row.pending_review_count} />
                <TableCell className="text-xs text-[var(--app-muted)]">
                  <LocalDateTime
                    value={row.last_grade_at}
                    options={DATE_TIME_OPTIONS}
                    fallback="暂无成绩"
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
