import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Ear,
  Languages,
  Mic2,
  PenLine,
  Shapes,
  Sparkles,
} from "lucide-react";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";

export type LanguageSkill =
  | "listening"
  | "speaking"
  | "reading"
  | "writing"
  | "grammar"
  | "vocabulary";

export type SixDimensionDatum = {
  skill: LanguageSkill;
  value: number | null;
  evidenceCount?: number;
  activityCount?: number;
};

export const languageSkillOrder: LanguageSkill[] = [
  "listening",
  "speaking",
  "reading",
  "writing",
  "grammar",
  "vocabulary",
];

export const languageSkillPresentation = {
  listening: {
    label: "听",
    fullLabel: "听力理解",
    icon: Ear,
    color: "var(--status-success)",
    soft: "var(--status-success-surface)",
  },
  speaking: {
    label: "说",
    fullLabel: "口语表达",
    icon: Mic2,
    color: "var(--primary)",
    soft: "var(--accent)",
  },
  reading: {
    label: "读",
    fullLabel: "阅读理解",
    icon: BookOpen,
    color: "var(--support)",
    soft: "var(--support-surface)",
  },
  writing: {
    label: "写",
    fullLabel: "书面表达",
    icon: PenLine,
    color: "var(--primary)",
    soft: "var(--accent)",
  },
  grammar: {
    label: "语",
    fullLabel: "语法运用",
    icon: Shapes,
    color: "var(--support)",
    soft: "var(--support-surface)",
  },
  vocabulary: {
    label: "词",
    fullLabel: "词汇运用",
    icon: Languages,
    color: "var(--status-success)",
    soft: "var(--status-success-surface)",
  },
} satisfies Record<
  LanguageSkill,
  {
    label: string;
    fullLabel: string;
    icon: LucideIcon;
    color: string;
    soft: string;
  }
>;

const RADAR_CENTER = 160;
const RADAR_RADIUS = 94;

function polarPoint(index: number, total: number, radius: number, scale = 1) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / total;
  return [
    RADAR_CENTER + Math.cos(angle) * radius * scale,
    RADAR_CENTER + Math.sin(angle) * radius * scale,
  ] as const;
}

function polygonPoints(values: Array<number | null>, radius = RADAR_RADIUS) {
  return values
    .map((value, index) =>
      polarPoint(
        index,
        values.length,
        radius,
        value == null ? 0 : Math.max(0, Math.min(100, value)) / 100,
      ),
    )
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

function gridPoints(level: number) {
  return languageSkillOrder
    .map((_, index) =>
      polarPoint(
        index,
        languageSkillOrder.length,
        RADAR_RADIUS,
        level / 100,
      ),
    )
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

export function SixDimensionRadar({
  title,
  description,
  icon: HeaderIcon,
  color,
  soft,
  data,
  evidenceText,
  emptyMessage,
  insightLabel = "能力解读",
  insight,
  evidenceOnly = false,
  deemphasizeSparseInsight = false,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  soft: string;
  data: SixDimensionDatum[];
  evidenceText?: (item: SixDimensionDatum) => string;
  emptyMessage: string;
  insightLabel?: string;
  insight?: string;
  evidenceOnly?: boolean;
  deemphasizeSparseInsight?: boolean;
}) {
  const datumBySkill = new Map(data.map((item) => [item.skill, item]));
  const orderedData = languageSkillOrder.map(
    (skill) => datumBySkill.get(skill) ?? { skill, value: null },
  );
  const values = orderedData.map((item) => item.value);
  const available = orderedData.filter((item) => item.value != null);
  const strongest = [...available].sort(
    (a, b) => (b.value ?? 0) - (a.value ?? 0),
  )[0];
  const weakest = [...available].sort(
    (a, b) => (a.value ?? 0) - (b.value ?? 0),
  )[0];
  const average = available.length
    ? available.reduce((sum, item) => sum + (item.value ?? 0), 0) /
      available.length
    : null;
  const chartSummary = orderedData
    .map((item) => {
      const label = languageSkillPresentation[item.skill].fullLabel;
      return `${label}${item.value == null ? "暂无数据" : `${item.value.toFixed(0)}分`}`;
    })
    .join("，");
  const resolvedInsight =
    insight ??
    (available.length === 0
      ? emptyMessage
      : available.length === 1
        ? `当前只有${languageSkillPresentation[available[0].skill].fullLabel}形成有效数据，继续完成其他维度练习后才能比较强弱项。`
        : `目前${languageSkillPresentation[strongest.skill].fullLabel}表现相对突出；建议下一阶段优先巩固${languageSkillPresentation[weakest.skill].fullLabel}，逐步缩小六维差距。`);
  const sparseInsight = deemphasizeSparseInsight && available.length <= 2;

  return (
    <section className="app-card overflow-hidden rounded-2xl border">
      <header className="flex flex-col gap-4 border-b border-[var(--border-subtle)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
            style={{ color, backgroundColor: soft }}
          >
            <HeaderIcon size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <CardTitleWithHint
              title={title}
              description={description}
              headingLevel={2}
              titleClassName="text-lg font-bold tracking-tight"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold tabular-nums">
            综合 {average == null ? "—" : `${average.toFixed(1)}%`}
          </span>
          <span
            className="rounded-full px-3 py-2 text-xs font-semibold tabular-nums"
            style={{ color, backgroundColor: soft }}
          >
            覆盖 {available.length} / 6
          </span>
        </div>
      </header>

      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(360px,0.88fr)_minmax(0,1.12fr)] xl:items-stretch">
        <div
          className="rounded-lg border border-[var(--border-subtle)] p-3 sm:p-5"
          style={{
            background: `linear-gradient(145deg, var(--surface-soft), color-mix(in srgb, ${soft} 55%, var(--card)))`,
          }}
        >
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-sm font-semibold">六边形能力轮廓</p>
              <p className="app-muted-text mt-1 text-xs font-medium">
                越接近外圈，当前掌握越稳定
              </p>
            </div>
            <span className="rounded-full bg-[var(--card)] px-2.5 py-1.5 text-[11px] font-semibold">
              每圈 25 分
            </span>
          </div>

          <svg
            viewBox="0 0 320 320"
            role="img"
            aria-label={`${title}雷达图。${chartSummary}`}
            className="mx-auto aspect-square w-full max-w-[390px]"
          >
            {[25, 50, 75, 100].map((level) => (
              <polygon
                key={level}
                points={gridPoints(level)}
                fill={
                  level === 100
                    ? "color-mix(in srgb, var(--card) 62%, transparent)"
                    : "none"
                }
                stroke="var(--border)"
                strokeWidth={level === 100 ? 1.5 : 1}
              />
            ))}
            {languageSkillOrder.map((skill, index) => {
              const [x, y] = polarPoint(
                index,
                languageSkillOrder.length,
                RADAR_RADIUS,
              );
              return (
                <line
                  key={skill}
                  x1={RADAR_CENTER}
                  y1={RADAR_CENTER}
                  x2={x}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
              );
            })}
            {available.length > 0 && (
              <polygon
                points={polygonPoints(values)}
                fill={`color-mix(in srgb, ${color} 26%, transparent)`}
                stroke={color}
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
            )}
            {values.map((value, index) => {
              if (value == null) return null;
              const [x, y] = polarPoint(
                index,
                values.length,
                RADAR_RADIUS,
                Math.max(0, Math.min(100, value)) / 100,
              );
              return (
                <circle
                  key={languageSkillOrder[index]}
                  cx={x}
                  cy={y}
                  r="5"
                  fill="var(--card)"
                  stroke={color}
                  strokeWidth="3"
                />
              );
            })}
            {languageSkillOrder.map((skill, index) => {
              const [x, y] = polarPoint(index, languageSkillOrder.length, 128);
              const textAnchor =
                x < RADAR_CENTER - 18
                  ? "end"
                  : x > RADAR_CENTER + 18
                    ? "start"
                    : "middle";
              return (
                <text
                  key={skill}
                  x={x}
                  y={y}
                  textAnchor={textAnchor}
                  dominantBaseline="middle"
                  className="fill-[var(--foreground)] text-[12px] font-semibold"
                >
                  <tspan x={x} dy="-0.35em">
                    {languageSkillPresentation[skill].label}
                  </tspan>
                  <tspan
                    x={x}
                    dy="1.3em"
                    className="fill-[var(--foreground-muted)] text-[10px] font-medium"
                  >
                    {values[index] == null
                      ? "待积累"
                      : `${values[index].toFixed(0)}%`}
                  </tspan>
                </text>
              );
            })}
            {available.length === 0 && (
              <text
                x="160"
                y="164"
                textAnchor="middle"
                className="fill-[var(--foreground-muted)] text-[12px] font-medium"
              >
                暂无有效能力数据
              </text>
            )}
          </svg>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div
            className={
              evidenceOnly
                ? "divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]"
                : "grid gap-2 sm:grid-cols-2"
            }
          >
            {orderedData.map((item) => {
              const presentation = languageSkillPresentation[item.skill];
              const Icon = presentation.icon;
              return (
                <article
                  key={item.skill}
                  className={
                    evidenceOnly
                      ? "flex items-center gap-3 py-3"
                      : "rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-3.5"
                  }
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      color: presentation.color,
                      backgroundColor: presentation.soft,
                    }}
                  >
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold">
                        {presentation.fullLabel}
                      </p>
                      {!evidenceOnly && (
                        <p className="text-base font-black tabular-nums">
                          {item.value == null
                            ? "—"
                            : `${item.value.toFixed(1)}%`}
                        </p>
                      )}
                    </div>
                    <p className="app-muted-text mt-1 text-xs font-medium leading-5">
                      {evidenceText?.(item) ??
                        (item.value == null ? "暂无有效数据" : "已有有效能力数据")}
                    </p>
                    {!evidenceOnly && (
                      <div
                        className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]"
                        role="progressbar"
                        aria-label={`${presentation.fullLabel}能力`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={item.value ?? undefined}
                        aria-valuetext={
                          item.value == null
                            ? "暂无数据"
                            : `${item.value.toFixed(1)}%`
                        }
                      >
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${item.value ?? 0}%`,
                            backgroundColor: presentation.color,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div
            className={
              sparseInsight
                ? "mt-auto border-t border-[var(--border-subtle)] px-1 py-3"
                : "mt-auto rounded-lg border px-4 py-4"
            }
            style={
              sparseInsight
                ? undefined
                : { borderColor: color, backgroundColor: soft }
            }
          >
            <p
              className="flex items-center gap-2 text-xs font-semibold"
              style={{ color: sparseInsight ? "var(--foreground-muted)" : color }}
            >
              <Sparkles size={13} aria-hidden="true" />
              {insightLabel}
            </p>
            <p className="mt-2 text-sm font-medium leading-6">
              {resolvedInsight}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
