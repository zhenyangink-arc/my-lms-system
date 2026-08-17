"use client";

import { useState } from "react";
import { BarChart3, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Props = {
  monthLabel: string;
  buttonLabel?: string;
  dailyMinutes: number[];
  dayTips?: string[];
  totalMinutes: number;
  maxMinutes: number;
  /** X 轴标签单位后缀，如年度视图传 "月"（显示 1月~12月）；月度视图不传。 */
  xLabelUnit?: string;
};

const CHART_W = 900;
const CHART_H = 280;
const PAD = { left: 34, right: 16, top: 18, bottom: 28 };

function formatStudyMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
}

/**
 * 学习活动右上角的查看按钮：点击弹出学习记录弹框（月度/年度通用），
 * 用柱状图汇聚每个周期的学习时长（上限 = maxMinutes）。
 * monthLabel 用于弹框标题（如"8月"、"2026年"），buttonLabel 是按钮文字。
 */
export function MonthlyStudyDialog({
  monthLabel,
  buttonLabel = "按月查看",
  dailyMinutes,
  dayTips = [],
  totalMinutes,
  maxMinutes,
  xLabelUnit = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const days = dailyMinutes.length;
  const hasData = totalMinutes > 0;
  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const maxY = Math.max(maxMinutes, 1);

  const barStep = plotW / days;
  const barW = Math.max(barStep * 0.45, 2);

  // Y 轴网格：0 / 1h / 2h / 3h / 4h（按 maxMinutes 等比）
  const yGrid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    ratio,
    label: ratio === 0 ? "0" : `${Math.round((maxY * ratio) / 60)}h`,
  }));

  // X 轴标签：每天日期都显示
  const xLabels = dailyMinutes.map((_, i) => i);

  // 悬停柱子的顶部高度（tooltip 跟随进度柱高度走）
  const hoveredIndex = hovered ?? -1;
  const hoveredMinutes = hoveredIndex >= 0 ? dailyMinutes[hoveredIndex] : 0;
  const hoveredBarTopY =
    PAD.top + plotH * (1 - Math.min(hoveredMinutes, maxY) / maxY);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-3 py-2 text-xs font-bold transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        style={{ color: "var(--primary-hover)", backgroundColor: "var(--accent)" }}
      >
        {buttonLabel}
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-black/5"
          className="!max-w-[920px] gap-0 rounded-[20px] p-0 app-glass-panel overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-3">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <BarChart3 size={18} style={{ color: "var(--primary)" }} />
              {monthLabel}学习记录
            </DialogTitle>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-xs font-bold"
              style={{ color: "var(--primary-hover)", backgroundColor: "var(--accent)" }}
            >
              本月累计学习 {formatStudyMinutes(totalMinutes)}
            </span>
          </div>

          <div className="px-4 pb-4">
            {hasData ? (
              <div className="relative">
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full"
                role="img"
                aria-label={`${monthLabel}每日学习时长柱状图`}
              >
                {/* 水平网格线 + Y 轴刻度 */}
                {yGrid.map((g) => {
                  const y = PAD.top + plotH * (1 - g.ratio);
                  return (
                    <g key={g.label}>
                      <line
                        x1={PAD.left}
                        y1={y}
                        x2={CHART_W - PAD.right}
                        y2={y}
                        stroke="var(--border)"
                        strokeOpacity="0.45"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={PAD.left - 8}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="10"
                        fill="var(--foreground-muted)"
                      >
                        {g.label}
                      </text>
                    </g>
                  );
                })}

                {/* 每日柱状图：每天都有空槽，有学习的天叠加橙色柱 */}
                {dailyMinutes.map((minutes, i) => {
                  const barH = (Math.min(minutes, maxY) / maxY) * plotH;
                  const x = PAD.left + i * barStep;
                  return (
                    <g key={i}>
                      <rect
                        x={x + 1}
                        y={PAD.top}
                        width={barW}
                        height={plotH}
                        fill="color-mix(in srgb, var(--border) 40%, transparent)"
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                      />
                      {minutes > 0 && (
                        <rect
                          x={x + 1}
                          y={PAD.top + plotH - barH}
                          width={barW}
                          height={barH}
                          fill="#f97316"
                          onMouseEnter={() => setHovered(i)}
                          onMouseLeave={() => setHovered(null)}
                        />
                      )}
                    </g>
                  );
                })}

                {/* X 轴标签：对齐柱子中心（柱子从每格中心偏左，用柱子中心定位） */}
                {xLabels.map((i) => (
                  <text
                    key={i}
                    x={PAD.left + i * barStep + 1 + barW / 2}
                    y={CHART_H - 6}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--foreground-muted)"
                  >
                    {i + 1}
                    {xLabelUnit}
                  </text>
                ))}
              </svg>
              {hovered !== null && (
                <div
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-pre rounded-xl px-3 py-2 text-xs font-bold shadow-lg"
                  style={{
                    left: `${((PAD.left + hovered * barStep + barStep / 2) / CHART_W) * 100}%`,
                    top: `${(hoveredBarTopY / CHART_H) * 100}%`,
                    marginBottom: "8px",
                    backgroundColor: "var(--card)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {dayTips[hovered] ??
                    `${hovered + 1} 日 · 学习 ${formatStudyMinutes(dailyMinutes[hovered])}`}
                </div>
              )}
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl text-center">
                <BarChart3 size={22} style={{ color: "var(--status-success)" }} aria-hidden="true" />
                <p className="mt-3 text-sm font-bold">本月还没有学习记录</p>
                <p className="mt-1 text-xs app-muted-text">
                  开始学习后，这里会画出你本月的学习曲线
                </p>
              </div>
            )}
          </div>

          <div className="border-t px-6 py-3 app-divider">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 w-full rounded-xl py-2 text-xs font-bold transition hover:bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              style={{ color: "var(--foreground-muted)" }}
            >
              关闭
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
