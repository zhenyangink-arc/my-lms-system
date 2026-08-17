"use client";

import { LocalDateTime } from "@/components/LocalDateTime";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ModelUsageTableRow } from "../../api/types";

const LOG_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

export function ModelUsageActivityDialog({
  row,
}: {
  row: ModelUsageTableRow;
}) {
  if (row.logCount === 0) {
    return <span className="text-xs text-[var(--foreground-muted)]">暂无调用</span>;
  }

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="h-8 rounded-md border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--surface-soft)]"
      >
        查看最近 {Math.min(row.logCount, 20)} 条
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{row.name}调用明细</DialogTitle>
          <DialogDescription>
            当前筛选范围共 {row.logCount.toLocaleString("zh-CN")} 条记录，按时间倒序显示最近 20 条。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto border border-[var(--border)]">
          <table className="w-full min-w-[620px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-[var(--surface-soft)] text-[var(--foreground-muted)]">
              <tr>
                <th className="px-3 py-2.5 font-medium">调用时间</th>
                <th className="px-3 py-2.5 text-right font-medium">输入</th>
                <th className="px-3 py-2.5 text-right font-medium">输出</th>
                <th className="px-3 py-2.5 text-right font-medium">合计</th>
              </tr>
            </thead>
            <tbody>
              {row.logs.map((log, index) => (
                <tr
                  key={`${log.createdAt}-${index}`}
                  className="border-t border-[var(--border-subtle)]"
                >
                  <td className="px-3 py-2.5 text-[var(--foreground-muted)]">
                    <LocalDateTime
                      value={log.createdAt}
                      options={LOG_TIME_OPTIONS}
                      fallback="时间待确认"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {log.inputTokens.toLocaleString("zh-CN")}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {log.outputTokens.toLocaleString("zh-CN")}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                    {log.totalTokens.toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
