import { BadgeCheck, Sparkles, Target } from "lucide-react";

import {
  languageSkillOrder,
  languageSkillPresentation,
  type LanguageSkill,
} from "@/components/analytics/SixDimensionRadar";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import type {
  AbilityPortraitData,
  AbilitySkillTier,
} from "@/features/student-ability-portrait/api/service";

const CENTER = 150;
const RADIUS = 92;

const portraitSkillLabels = {
  listening: "听力",
  speaking: "说话",
  reading: "阅读",
  writing: "写作",
  grammar: "语法",
  vocabulary: "词汇",
} satisfies Record<LanguageSkill, string>;

const portraitSkillColors = {
  listening: { color: "#0f766e", soft: "#ccfbf1" },
  speaking: { color: "#2563eb", soft: "#dbeafe" },
  reading: { color: "#7c3aed", soft: "#ede9fe" },
  writing: { color: "#be185d", soft: "#fce7f3" },
  grammar: { color: "#b45309", soft: "#fef3c7" },
  vocabulary: { color: "#0e7490", soft: "#cffafe" },
} satisfies Record<LanguageSkill, { color: string; soft: string }>;

const tierClasses: Record<AbilitySkillTier, string> = {
  优势项: "bg-emerald-50 text-emerald-700",
  良好: "bg-sky-50 text-sky-700",
  中等: "bg-amber-50 text-amber-700",
  待提升: "bg-rose-50 text-rose-700",
};

function polarPoint(index: number, total: number, scale = 1) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / total;
  return [
    CENTER + Math.cos(angle) * RADIUS * scale,
    CENTER + Math.sin(angle) * RADIUS * scale,
  ] as const;
}

function polygonPoints(values: Array<number | null>) {
  return values
    .map((value, index) =>
      polarPoint(
        index,
        values.length,
        value == null ? 0 : Math.max(0, Math.min(100, value)) / 100,
      ),
    )
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

function gridPoints(level: number) {
  return languageSkillOrder
    .map((_, index) => polarPoint(index, languageSkillOrder.length, level / 100))
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

function GradeRing({ score, grade }: { score: number | null; grade: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const percentage = score == null ? 0 : Math.max(0, Math.min(100, score));

  return (
    <svg viewBox="0 0 68 68" className="size-16" role="img" aria-label={`综合评级 ${grade}`}>
      <circle cx="34" cy="34" r={radius} fill="rgba(255,255,255,0.72)" stroke="var(--border)" strokeWidth="6" />
      {score != null ? (
        <circle
          cx="34"
          cy="34"
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(percentage / 100) * circumference} ${circumference}`}
          transform="rotate(-90 34 34)"
        />
      ) : null}
      <text x="34" y="35" textAnchor="middle" dominantBaseline="middle" className="fill-slate-950 text-[16px] font-black">
        {grade}
      </text>
    </svg>
  );
}

export function AbilityPortrait({
  data,
}: {
  data: AbilityPortraitData;
}) {
  const { skills, insight, confidence } = data;
  const values = skills.map((item) => item.value);
  const hasAnyValue = values.some((value) => value != null);
  const suggestion = insight.growthSuggestions[0] ?? insight.suggestion;

  return (
    <section className="relative isolate h-full overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_22px_60px_-44px_rgba(15,23,42,0.38)] sm:p-6">
      <span aria-hidden="true" className="absolute -right-20 -top-20 -z-10 size-64 rounded-full bg-emerald-100/70 blur-3xl" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitleWithHint
            headingLevel={2}
            title="学习能力画像"
            titleClassName="text-2xl font-bold tracking-[-0.035em] text-slate-950"
            description="依据作业、测试、AI 口语评估和专项练习，呈现听说读写语词六个维度的当前水平。"
            hintLabel="查看能力画像说明"
          />
        </div>
        <p className="shrink-0 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200/80">
          数据来源：<span className="text-slate-800">韩语学习</span>
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(17rem,1fr)_minmax(14rem,0.72fr)]">
        <div className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-[1.35rem] bg-slate-50/80 p-2 ring-1 ring-slate-200/70">
          <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200/70">
            六项能力分布
          </span>
          <svg
            viewBox="0 0 300 300"
            role="img"
            aria-label={`六维能力雷达图。${skills.map((item) => `${languageSkillPresentation[item.skill].fullLabel}${item.value == null ? "暂无数据" : `${item.value.toFixed(0)}分`}`).join("，")}`}
            className="relative aspect-square w-full max-w-[21rem] drop-shadow-[0_12px_24px_rgba(16,185,129,0.08)]"
          >
            {[20, 40, 60, 80, 100].map((level) => (
              <polygon key={level} points={gridPoints(level)} fill={level === 100 ? "rgba(255,255,255,.55)" : "none"} stroke="var(--border)" strokeWidth="1" />
            ))}
            {languageSkillOrder.map((skill, index) => {
              const [x, y] = polarPoint(index, languageSkillOrder.length);
              return <line key={skill} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="var(--border)" />;
            })}
            {hasAnyValue ? (
              <polygon points={polygonPoints(values)} fill="color-mix(in srgb, var(--primary) 20%, transparent)" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" />
            ) : null}
            {values.map((value, index) => {
              if (value == null) return null;
              const [x, y] = polarPoint(index, values.length, value / 100);
              const skill = languageSkillOrder[index];
              return <circle key={skill} cx={x} cy={y} r="4" fill="white" stroke={portraitSkillColors[skill].color} strokeWidth="3" />;
            })}
            {languageSkillOrder.map((skill, index) => {
              const [x, y] = polarPoint(index, languageSkillOrder.length, 1.34);
              return (
                <text key={skill} x={x} y={y} textAnchor={x < CENTER - 12 ? "end" : x > CENTER + 12 ? "start" : "middle"} dominantBaseline="middle" className="fill-slate-700 text-[12px] font-black">
                  {portraitSkillLabels[skill]}
                </text>
              );
            })}
            {!hasAnyValue ? <text x={CENTER} y={CENTER} textAnchor="middle" className="fill-slate-400 text-[12px]">暂无有效数据</text> : null}
          </svg>
        </div>

        <div className="grid content-start gap-3">
          <div className="relative overflow-hidden rounded-[1.35rem] bg-emerald-50/80 p-4 ring-1 ring-emerald-200/70">
            <span aria-hidden="true" className="absolute -right-8 -top-10 size-28 rounded-full bg-white/55" />
            <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-800">综合画像评分</p>
              <p className={`mt-1 font-bold tracking-tight text-emerald-900 ${insight.overallScore == null ? "text-lg" : "text-4xl"}`}>
                {insight.overallScore ?? "待积累"}{insight.overallScore != null ? <span className="ml-1 text-xs text-emerald-700">/100</span> : null}
              </p>
              <p className="mt-1 text-xs font-bold text-emerald-700">{insight.levelLabel}</p>
            </div>
            <GradeRing score={insight.overallScore} grade={insight.grade} />
            </div>
          </div>

          <div className="rounded-[1.35rem] bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
            <p className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
              <Sparkles size={16} className="text-emerald-700" aria-hidden="true" />
              当前洞察
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {insight.strongestLabel ? `${insight.strongestLabel}表现突出。` : "能力数据正在积累。"}
              {insight.weakestLabel ? `${insight.weakestLabel}是当前可优先加强的方向。` : ""}
            </p>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-black text-slate-700">
                <Target size={14} aria-hidden="true" />下一步建议
              </p>
              <p className="mt-1.5 text-xs leading-5 text-slate-600">{suggestion}</p>
            </div>
          </div>

          <div className="rounded-[1.35rem] bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
            <div className="flex items-center gap-2">
              <BadgeCheck size={16} className="text-emerald-700" aria-hidden="true" />
              <span className="text-sm font-bold text-slate-900">数据充分度</span>
              <span className="ml-auto text-xs font-semibold text-emerald-700">{confidence.levelLabel}</span>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <span key={index} className={`h-1.5 rounded-full ${index < confidence.stars ? "bg-emerald-500" : "bg-slate-200"}`} />
              ))}
            </div>
            <p className="sr-only">数据充分度 {confidence.stars} / 5</p>
            <p className="mt-2 text-xs font-medium text-slate-500">已汇总 {confidence.totalEvidence} 条有效学习数据</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {skills.map((item) => {
          const presentation = languageSkillPresentation[item.skill];
          const skillColors = portraitSkillColors[item.skill];
          const Icon = presentation.icon;
          return (
            <article
              key={item.skill}
              className="relative min-w-0 overflow-hidden rounded-[1.15rem] bg-white p-3 ring-1 ring-slate-200/80"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: skillColors.color }}
              />
              <div className="flex items-start justify-between gap-1">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl" style={{ color: skillColors.color, backgroundColor: skillColors.soft }}>
                  <Icon size={16} aria-hidden="true" />
                </span>
                <CardTitleWithHint headingLevel={3} title={portraitSkillLabels[item.skill]} titleClassName="pt-1 text-xs font-black text-slate-700" description={item.description} hintClassName="-mr-1" hintLabel={`查看${presentation.fullLabel}说明`} />
              </div>
              {item.value == null ? (
                <p className="mt-3 text-sm font-semibold text-slate-400">待积累</p>
              ) : (
                <>
                  <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{item.value.toFixed(0)}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${item.value}%`,
                        backgroundColor: skillColors.color,
                      }}
                    />
                  </div>
                </>
              )}
              {item.tier ? <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tierClasses[item.tier]}`}>{item.tier}</span> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
