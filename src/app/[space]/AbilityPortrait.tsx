import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  Compass,
  FlaskConical,
  Mic2,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";

import {
  languageSkillOrder,
  languageSkillPresentation,
} from "@/components/analytics/SixDimensionRadar";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import type {
  AbilityPortraitData,
  AbilitySkillTier,
} from "@/features/student-ability-portrait/api/service";

const RADAR_CENTER = 160;
const RADAR_RADIUS = 105;

const tierPresentation: Record<AbilitySkillTier, { badge: string; border: string }> = {
  优势项: { badge: "bg-emerald-50 text-emerald-700", border: "border-emerald-300" },
  良好: { badge: "bg-sky-50 text-sky-700", border: "border-sky-200" },
  中等: { badge: "bg-amber-50 text-amber-700", border: "border-amber-200" },
  待提升: { badge: "bg-rose-50 text-rose-700", border: "border-rose-300" },
};

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
      polarPoint(index, languageSkillOrder.length, RADAR_RADIUS, level / 100),
    )
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

function GradeRing({ score, grade }: { score: number | null; grade: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * circumference;

  return (
    <svg viewBox="0 0 68 68" className="size-16 shrink-0" role="img" aria-label={`综合评级 ${grade}`}>
      <circle cx="34" cy="34" r={radius} fill="none" stroke="var(--border)" strokeWidth="6" />
      {score != null && pct > 0 ? (
        <circle
          cx="34"
          cy="34"
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform="rotate(-90 34 34)"
        />
      ) : null}
      <text
        x="34"
        y="35"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-950 text-[16px] font-black"
      >
        {grade}
      </text>
    </svg>
  );
}

export function AbilityPortrait({
  data,
  studentName,
  toolboxHref,
  universityTargetHref,
}: {
  data: AbilityPortraitData;
  studentName: string;
  toolboxHref: string;
  universityTargetHref: string;
}) {
  const { skills, insight, trend, confidence, universityTarget } = data;
  const values = skills.map((item) => item.value);
  const hasAnyValue = skills.some((item) => item.value != null);
  const studentInitial = Array.from(studentName.trim())[0]?.toUpperCase() || "U";
  const trendMax = trend
    ? Math.max(
        20,
        ...trend.series.flatMap((series) =>
          series.values.filter((value): value is number => value != null),
        ),
      )
    : 0;
  const trendPlot = { left: 28, right: 294, top: 10, bottom: 92 };
  const trendWidth = trendPlot.right - trendPlot.left;
  const trendHeight = trendPlot.bottom - trendPlot.top;

  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/90 bg-white/82 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-7 lg:p-8">
      <div aria-hidden="true" className="absolute -left-24 top-20 -z-10 size-72 rounded-full bg-emerald-200/20 blur-3xl" />
      <div aria-hidden="true" className="absolute -right-24 -top-24 -z-10 size-72 rounded-full bg-sky-200/20 blur-3xl" />

      <div className="border-b border-slate-200/80 pb-5">
        <CardTitleWithHint
          headingLevel={2}
          title="学生能力画像"
          titleClassName="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl"
          description="综合最近的作业批改、测试成绩、AI 口语评估与日常专项练习，估算听说读写语词六个维度的当前水平。数据不足时相应维度会显示为空，不会用估算值填补。"
          hintLabel="查看能力画像的计算说明"
        />
        <p className="mt-1 text-sm font-semibold text-slate-500">
          六维学习能力分析与成长洞察
        </p>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-5 lg:grid-cols-[28rem_minmax(0,1fr)]">
            <aside className="flex min-h-[25rem] flex-col rounded-3xl border border-slate-200 bg-slate-50/85 p-5">
              <div className="flex flex-col items-center text-center">
                <span className="flex size-24 items-center justify-center rounded-full border-[6px] border-white bg-gradient-to-br from-emerald-200 via-teal-100 to-sky-100 text-3xl font-black text-slate-900 shadow-[0_12px_30px_-16px_rgba(15,23,42,0.45)] ring-1 ring-emerald-200">
                  {studentInitial}
                </span>
                <h3 className="mt-4 max-w-full truncate text-xl font-black text-slate-950">{studentName}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">韩语学习者</p>
                <p className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                  已积累 {confidence.totalEvidence} 条有效数据
                </p>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Building2 size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-500">目标大学</p>
                    <p className="mt-0.5 truncate text-sm font-black text-slate-950">
                      {universityTarget?.universityName ?? "尚未设置"}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                      {universityTarget
                        ? universityTarget.programName ?? "专业待定"
                        : "设置目标后跟踪申请进度"}
                    </p>
                  </div>
                </div>
                {universityTarget ? (
                  <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      {universityTarget.statusLabel}
                    </span>
                    {universityTarget.daysRemaining != null ? (
                      <p className="text-right text-xs font-bold text-slate-500">
                        距截止 <span className="text-xl font-black tabular-nums text-slate-950">{universityTarget.daysRemaining}</span> 天
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <Link
                href={universityTargetHref}
                className="mt-auto inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                {universityTarget ? "查看留学目标" : "设置目标大学"}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </aside>

            <div className="relative flex min-h-[25rem] items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white/70 px-2 py-4 sm:px-5">
              <div aria-hidden="true" className="absolute inset-8 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--primary)_12%,transparent)_0%,transparent_68%)]" />
              <svg
                viewBox="0 0 320 320"
                role="img"
                aria-label={`六维能力雷达图。${skills
                  .map((item) => `${languageSkillPresentation[item.skill].fullLabel}${item.value == null ? "暂无数据" : `${item.value.toFixed(0)}分`}`)
                  .join("，")}`}
                className="relative z-10 mx-auto aspect-square w-full max-w-[31rem]"
              >
                {[20, 40, 60, 80, 100].map((level) => (
                  <polygon
                    key={level}
                    points={gridPoints(level)}
                    fill={level === 100 ? "rgba(255,255,255,0.52)" : "none"}
                    stroke="var(--border)"
                    strokeWidth={level === 100 ? 1.5 : 1}
                  />
                ))}
                {languageSkillOrder.map((skill, index) => {
                  const [x, y] = polarPoint(index, languageSkillOrder.length, RADAR_RADIUS);
                  return <line key={skill} x1={RADAR_CENTER} y1={RADAR_CENTER} x2={x} y2={y} stroke="var(--border)" strokeWidth="1" />;
                })}
                {[20, 40, 60, 80, 100].map((level) => (
                  <text key={level} x={RADAR_CENTER + 4} y={RADAR_CENTER - (RADAR_RADIUS * level) / 100 + 3} className="fill-slate-400 text-[8px] font-semibold">
                    {level}
                  </text>
                ))}
                {hasAnyValue ? (
                  <polygon
                    points={polygonPoints(values)}
                    fill="color-mix(in srgb, var(--primary) 22%, transparent)"
                    stroke="var(--primary)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                ) : null}
                {values.map((value, index) => {
                  if (value == null) return null;
                  const [x, y] = polarPoint(index, values.length, RADAR_RADIUS, Math.max(0, Math.min(100, value)) / 100);
                  return <circle key={languageSkillOrder[index]} cx={x} cy={y} r="5" fill="var(--card)" stroke="var(--primary)" strokeWidth="3" />;
                })}
                {languageSkillOrder.map((skill, index) => {
                  const [labelX, labelY] = polarPoint(index, languageSkillOrder.length, RADAR_RADIUS + 41);
                  const [iconX, iconY] = polarPoint(index, languageSkillOrder.length, RADAR_RADIUS + 18);
                  const presentation = languageSkillPresentation[skill];
                  const Icon = presentation.icon;
                  const textAnchor = labelX < RADAR_CENTER - 16 ? "end" : labelX > RADAR_CENTER + 16 ? "start" : "middle";
                  return (
                    <g key={skill}>
                      <circle cx={iconX} cy={iconY} r="13" fill={presentation.soft} stroke="var(--card)" strokeWidth="2" />
                      <Icon x={iconX - 8} y={iconY - 8} width={16} height={16} color={presentation.color} aria-hidden="true" />
                      <text x={labelX} y={labelY} textAnchor={textAnchor} dominantBaseline="middle" className="fill-slate-700 text-[12px] font-black">
                        {presentation.label}
                      </text>
                    </g>
                  );
                })}
                {!hasAnyValue ? (
                  <text x={RADAR_CENTER} y={RADAR_CENTER} textAnchor="middle" className="fill-slate-400 text-[12px] font-medium">
                    暂无有效能力数据
                  </text>
                ) : null}
              </svg>
              <table className="sr-only">
                <caption>六维能力分数</caption>
                <thead><tr><th>能力</th><th>分数</th></tr></thead>
                <tbody>
                  {skills.map((item) => (
                    <tr key={item.skill}><th>{languageSkillPresentation[item.skill].fullLabel}</th><td>{item.value == null ? "暂无数据" : `${item.value.toFixed(0)} 分`}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {skills.map((item) => {
              const presentation = languageSkillPresentation[item.skill];
              const Icon = presentation.icon;
              const tier = tierPresentation[item.tier ?? "待提升"];
              return (
                <article key={item.skill} className={`relative min-w-0 overflow-hidden rounded-2xl border bg-white p-3.5 pt-4 ${item.tier ? tier.border : "border-slate-200"}`}>
                  <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: presentation.color }} />
                  <div className="flex items-start gap-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ color: presentation.color, backgroundColor: presentation.soft }}>
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <CardTitleWithHint
                      headingLevel={3}
                      title={presentation.fullLabel}
                      titleClassName="pt-2 text-xs font-black text-slate-700"
                      description={item.description}
                      hintClassName="-mr-2"
                      hintLabel={`查看${presentation.fullLabel}说明`}
                    />
                  </div>
                  <p className="mt-3 text-2xl font-black tabular-nums text-slate-950">
                    {item.value == null ? "—" : item.value.toFixed(0)}<span className="ml-0.5 text-[10px] font-bold text-slate-400">/100</span>
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full" style={{ width: `${item.value ?? 0}%`, backgroundColor: presentation.color }} />
                  </div>
                  {item.tier ? <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${tier.badge}`}>{item.tier}</span> : null}
                </article>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div>
              <p className="text-sm font-black text-emerald-800">综合画像评分</p>
              <p className="mt-1 text-4xl font-black tabular-nums text-emerald-800">
                {insight.overallScore == null ? "—" : insight.overallScore}<span className="ml-1 text-sm font-bold text-emerald-600">/100</span>
              </p>
              <p className="mt-1 text-xs font-bold text-emerald-700">{insight.levelLabel}</p>
            </div>
            <GradeRing score={insight.overallScore} grade={insight.grade} />
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/45 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-black text-emerald-800"><Sparkles size={16} aria-hidden="true" />智能洞察</span>
              <span className="text-[10px] font-semibold text-emerald-700/75">更新于 {insight.updatedAtLabel}</span>
            </div>
            {insight.strengths.length > 0 ? (
              <div className="mt-3">
                <p className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 size={13} aria-hidden="true" />优势项</p>
                <ul className="mt-1.5 space-y-1.5">
                  {insight.strengths.map((item) => <li key={item.skill} className="text-xs leading-5 text-slate-600"><span className="font-bold text-slate-900">{item.label}</span> {item.description}</li>)}
                </ul>
              </div>
            ) : null}
            {insight.improvements.length > 0 ? (
              <div className="mt-3">
                <p className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700"><TriangleAlert size={13} aria-hidden="true" />待提升项</p>
                <ul className="mt-1.5 space-y-1.5">
                  {insight.improvements.map((item) => <li key={item.skill} className="text-xs leading-5 text-slate-600"><span className="font-bold text-slate-900">{item.label}</span> {item.description}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="mt-3 border-t border-emerald-100 pt-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700"><Target size={13} aria-hidden="true" />成长建议</p>
              <ul className="mt-1.5 space-y-1.5">
                {(insight.growthSuggestions.length > 0 ? insight.growthSuggestions : [insight.suggestion]).map((line, index) => <li key={index} className="text-xs leading-5 text-slate-600">{line}</li>)}
              </ul>
            </div>
          </div>

          {trend ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <span className="inline-flex items-center gap-2 text-sm font-black text-slate-900"><TrendingUp size={16} aria-hidden="true" className="text-emerald-700" />成长趋势（近 6 个月）</span>
              <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1">
                {languageSkillOrder.map((skill) => <span key={skill} className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500"><span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: languageSkillPresentation[skill].color }} />{languageSkillPresentation[skill].label}</span>)}
              </div>
              <svg viewBox="0 0 300 110" role="img" aria-label="六个维度近六个月的专项练习得分趋势折线图" className="mt-2 h-auto w-full">
                {[0, 0.5, 1].map((ratio) => {
                  const y = trendPlot.top + ratio * trendHeight;
                  return <g key={ratio}><line x1={trendPlot.left} x2={trendPlot.right} y1={y} y2={y} stroke="var(--border-subtle)" strokeDasharray={ratio === 1 ? undefined : "4 5"} /><text x={trendPlot.left - 6} y={y + 3} textAnchor="end" className="fill-slate-400 text-[9px] font-semibold">{Math.round(trendMax * (1 - ratio))}</text></g>;
                })}
                {trend.series.map((series, seriesIndex) => {
                  const points = series.values.map((value, index) => {
                    if (value == null) return null;
                    const x = trendPlot.left + (trend.months.length <= 1 ? trendWidth / 2 : (index / (trend.months.length - 1)) * trendWidth);
                    const y = trendPlot.bottom - (Math.min(value, trendMax) / trendMax) * trendHeight;
                    return [x, y] as const;
                  }).filter((point): point is readonly [number, number] => point != null);
                  if (points.length === 0) return null;
                  const path = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
                  const dashPattern = seriesIndex % 3 === 1 ? "6 3" : seriesIndex % 3 === 2 ? "2 3" : undefined;
                  return <g key={series.skill} opacity={0.9}><path d={path} fill="none" stroke={languageSkillPresentation[series.skill].color} strokeWidth="2" strokeDasharray={dashPattern} strokeLinecap="round" strokeLinejoin="round" />{points.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="2.5" fill={languageSkillPresentation[series.skill].color} />)}</g>;
                })}
                {trend.months.map((label, index) => {
                  const x = trendPlot.left + (trend.months.length <= 1 ? trendWidth / 2 : (index / (trend.months.length - 1)) * trendWidth);
                  return <text key={`${label}-${index}`} x={x} y={trendPlot.bottom + 14} textAnchor="middle" className="fill-slate-400 text-[9px] font-semibold">{label}</text>;
                })}
              </svg>
              <details className="mt-2 text-xs text-slate-600">
                <summary className="cursor-pointer font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">查看趋势数据</summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-[10px]">
                    <thead><tr><th className="py-1 pr-2">能力</th>{trend.months.map((month, index) => <th key={`${month}-${index}`} className="px-1 py-1">{month}</th>)}</tr></thead>
                    <tbody>{trend.series.map((series) => <tr key={series.skill}><th className="py-1 pr-2">{languageSkillPresentation[series.skill].label}</th>{series.values.map((value, index) => <td key={index} className="px-1 py-1 tabular-nums">{value == null ? "—" : value.toFixed(0)}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </details>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeCheck size={17} aria-hidden="true" className="text-emerald-700" />
              <span className="text-sm font-black text-slate-900">数据可信度</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{confidence.levelLabel}</span>
              <span className="ml-auto flex gap-0.5" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} className={index < confidence.stars ? "fill-amber-400 text-amber-400" : "text-slate-300"} />)}
              </span>
            </div>
            <p className="sr-only">数据可信度 {confidence.stars} / 5 星，{confidence.levelLabel}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5"><ClipboardList size={14} aria-hidden="true" className="text-slate-400" />{confidence.homeworkCount} 次作业</span>
              <span className="inline-flex items-center gap-1.5"><FlaskConical size={14} aria-hidden="true" className="text-slate-400" />{confidence.examCount} 次测试</span>
              <span className="inline-flex items-center gap-1.5"><Mic2 size={14} aria-hidden="true" className="text-slate-400" />{confidence.aiSpeakingCount} 次口语评估</span>
              <span className="inline-flex items-center gap-1.5"><Compass size={14} aria-hidden="true" className="text-slate-400" />{confidence.practiceSessionCount} 次专项练习</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950 px-5 py-4">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-6 text-slate-200">{insight.suggestion}</p>
        <Link href={toolboxHref} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
          查看个性化学习建议
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
