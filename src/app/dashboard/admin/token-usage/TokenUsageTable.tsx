"use client";

import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";

export type TokenUsageLog = {
  createdAt: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type TokenUsageTableRow = {
  id: string;
  name: string;
  slug: string;
  kind: "platform" | "organization";
  isCurrent: boolean;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  dayTokens: number;
  logCount: number;
  trend: number[];
  logs: TokenUsageLog[];
};

function TokenNumber({
  value,
  emphasized = false,
}: {
  value: number;
  emphasized?: boolean;
}) {
  return (
    <span
      className={`font-mono text-[14px] tabular-nums ${
        emphasized ? "font-semibold" : "font-medium"
      }`}
    >
      {value.toLocaleString()}
    </span>
  );
}

function TrendCell({
  values,
  total,
  kind,
}: {
  values: number[];
  total: number;
  kind: TokenUsageTableRow["kind"];
}) {
  const max = Math.max(...values, 1);
  const trendColor =
    kind === "platform" ? "var(--app-accent)" : "var(--app-secondary)";

  return (
    <div className="flex min-w-[130px] items-center justify-center gap-3">
      <span
        className="min-w-12 font-mono text-[12px] font-semibold tabular-nums"
        style={{ color: total > 0 ? "var(--app-success)" : "var(--app-muted)" }}
      >
        +{total.toLocaleString()}
      </span>
      <span className="flex h-6 flex-1 items-end gap-1" aria-label="最近 24 小时趋势">
        {values.map((value, index) => (
          <span
            key={index}
            className="min-h-px flex-1"
            style={{
              height: `${Math.max(8, Math.round((value / max) * 100))}%`,
              backgroundColor: value > 0 ? trendColor : "var(--app-border)",
            }}
          />
        ))}
      </span>
    </div>
  );
}

export function TokenUsageTable({ rows }: { rows: TokenUsageTableRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const tone = rows[0]?.kind ?? "organization";
  const toneColor =
    tone === "platform" ? "var(--app-accent)" : "var(--app-secondary)";
  const toneSoft =
    tone === "platform" ? "var(--app-accent-soft)" : "var(--app-secondary-soft)";

  return (
    <div
      className="token-usage-table overflow-x-auto border"
      data-tone={tone}
      style={{
        borderColor: `color-mix(in srgb, ${toneColor} 24%, var(--app-border))`,
        borderRadius: "8px",
        backgroundColor: "var(--app-card-bg)",
      }}
    >
      <table className="w-full min-w-[1040px] border-collapse text-center">
        <thead style={{ backgroundColor: toneSoft }}>
          <tr>
            <th className="w-[18%] px-3 py-3 text-center text-[11px]">名称</th>
            <th className="w-[10%] px-4 py-3 text-[11px]">角色</th>
            <th className="px-4 py-3 text-center text-[11px]">累计 Token</th>
            <th className="px-4 py-3 text-center text-[11px]">输入 Token</th>
            <th className="px-4 py-3 text-center text-[11px]">输出 Token</th>
            <th className="w-[18%] px-4 py-3 text-[11px]">24H 趋势</th>
            <th className="w-[16%] px-4 py-3 text-center text-[11px]">最近调用日志</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = expandedId === row.id;

            return (
              <Fragment key={row.id}>
                <tr>
                  <td className="px-3 py-3.5">
                    <p className="text-[14px] font-semibold">{row.name}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className="inline-flex border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                      style={{
                        borderColor: `color-mix(in srgb, ${
                          row.kind === "platform"
                            ? "var(--app-accent)"
                            : "var(--app-secondary)"
                        } 24%, var(--app-border))`,
                        borderRadius: "4px",
                        color:
                          row.kind === "platform"
                            ? "var(--app-accent-strong)"
                            : "var(--app-secondary)",
                        backgroundColor:
                          row.kind === "platform"
                            ? "var(--app-accent-soft)"
                            : "var(--app-secondary-soft)",
                      }}
                    >
                      {row.kind === "platform" ? "Platform" : "Org"}
                    </span>
                    {row.isCurrent && (
                      <span
                        className="ml-1.5 text-[9px] font-semibold uppercase tracking-[0.08em]"
                        style={{ color: "var(--app-success)" }}
                      >
                        Current
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <TokenNumber value={row.totalTokens} emphasized />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <TokenNumber value={row.inputTokens} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <TokenNumber value={row.outputTokens} />
                  </td>
                  <td className="px-4 py-3.5">
                    <TrendCell
                      values={row.trend}
                      total={row.dayTokens}
                      kind={row.kind}
                    />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                      disabled={row.logCount === 0}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold disabled:cursor-default disabled:opacity-45"
                      style={{
                        color:
                          row.logCount > 0
                            ? "var(--app-accent-strong)"
                            : "var(--app-muted)",
                      }}
                      aria-expanded={expanded}
                    >
                      {row.logCount > 0
                        ? `查看最近 ${Math.min(row.logCount, 20)} 条`
                        : "暂无调用"}
                      {row.logCount > 0 && (
                        <ChevronDown
                          className={`transition-transform ${
                            expanded ? "rotate-180" : ""
                          }`}
                          size={12}
                          strokeWidth={1.8}
                        />
                      )}
                    </button>
                  </td>
                </tr>

                {expanded && (
                  <tr>
                    <td
                      colSpan={7}
                      className="border-t p-0"
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-card-bg)",
                      }}
                    >
                      <div className="grid grid-cols-[minmax(220px,1fr)_repeat(3,minmax(120px,0.45fr))] px-5 py-2 text-center text-[10px] font-medium uppercase tracking-[0.08em] app-muted-text">
                        <span>调用时间</span>
                        <span>输入</span>
                        <span>输出</span>
                        <span>合计</span>
                      </div>
                      {row.logs.map((log, index) => (
                        <div
                          key={`${log.createdAt}-${index}`}
                          className="grid grid-cols-[minmax(220px,1fr)_repeat(3,minmax(120px,0.45fr))] border-t px-5 py-2.5 text-center text-[12px]"
                          style={{ borderColor: "var(--app-border-soft)" }}
                        >
                          <span className="app-muted-text">
                            {new Date(log.createdAt).toLocaleString("zh-CN")}
                          </span>
                          <span className="font-mono tabular-nums">
                            {log.inputTokens.toLocaleString()}
                          </span>
                          <span className="font-mono tabular-nums">
                            {log.outputTokens.toLocaleString()}
                          </span>
                          <span className="font-mono font-semibold tabular-nums">
                            {log.totalTokens.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="app-muted-text px-4 py-10 text-center text-[13px]">
                暂时没有可显示的用量主体。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
