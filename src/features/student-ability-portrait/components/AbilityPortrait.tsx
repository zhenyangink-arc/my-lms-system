import { BadgeCheck, CircleAlert, Sparkles, Target } from "lucide-react";

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
      <circle cx="34" cy="34" r={radius} fill="var(--card)" stroke="var(--border)" strokeWidth="6" />
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
      <text x="34" y="35" textAnchor="middle" dominantBaseline="middle" fill="var(--foreground)" className="text-[16px] font-black">
        {grade}
      </text>
    </svg>
  );
}

export function AbilityPortrait({
  data,
  sourceLabel,
}: {
  data: AbilityPortraitData;
  /** 画像数据所属的学科应用名称。 */
  sourceLabel: string;
}) {
  const { skills, insight, confidence } = data;
  const values = skills.map((item) => item.value);
  const hasAnyValue = values.some((value) => value != null);
  const suggestion = insight.growthSuggestions[0] ?? insight.suggestion;

  return (
    <section className="app-card relative h-full overflow-hidden rounded-3xl border p-5 sm:p-6" data-card-level="1">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitleWithHint
            headingLevel={2}
            title="学习能力画像"
            titleClassName="text-xl font-bold tracking-tight"
            description="依据作业、测试、AI 口语评估和专项练习，呈现听说读写语词六个维度的当前水平。"
            hintLabel="查看能力画像说明"
          />
        </div>
        <p className="app-soft-card shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold app-muted-text">
          数据来源：<span className="font-bold" style={{ color: "var(--foreground)" }}>{sourceLabel}</span>
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(17rem,1fr)_minmax(14rem,0.72fr)]">
        <div className="app-soft-card relative flex min-h-72 items-center justify-center overflow-hidden rounded-[1.35rem] border p-2">
          <span className="absolute left-4 top-4 rounded-full border px-3 py-1 text-xs font-semibold app-muted-text" style={{ backgroundColor: "var(--card)" }}>
            六项能力分布
          </span>
          <svg
            viewBox="0 0 300 300"
            role="img"
            aria-label={`六维能力雷达图。${skills.map((item) => `${languageSkillPresentation[item.skill].fullLabel}${item.value == null ? "暂无数据" : `${item.value.toFixed(0)}分`}`).join("，")}`}
            className="relative aspect-square w-full max-w-[21rem]"
          >
            {[20, 40, 60, 80, 100].map((level) => (
              <polygon key={level} points={gridPoints(level)} fill={level === 100 ? "var(--card)" : "none"} stroke="var(--border)" strokeWidth="1" />
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
              return <circle key={skill} cx={x} cy={y} r="4" fill="var(--card)" stroke={portraitSkillColors[skill].color} strokeWidth="3" />;
            })}
            {languageSkillOrder.map((skill, index) => {
              const [x, y] = polarPoint(index, languageSkillOrder.length, 1.34);
              return (
                <text key={skill} x={x} y={y} textAnchor={x < CENTER - 12 ? "end" : x > CENTER + 12 ? "start" : "middle"} dominantBaseline="middle" fill="var(--foreground-secondary)" className="text-[12px] font-black">
                  {portraitSkillLabels[skill]}
                </text>
              );
            })}
            {!hasAnyValue ? <text x={CENTER} y={CENTER} textAnchor="middle" fill="var(--foreground-muted)" className="text-[12px]">暂无有效数据</text> : null}
          </svg>
        </div>

        <div className="grid content-start gap-3">
          <div className="relative overflow-hidden rounded-[1.35rem] border p-4" style={{ backgroundColor: "var(--status-success-surface)" }}>
            <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs font-bold" style={{ color: "var(--status-success)" }}>综合画像评分</p>
              <p className={`mt-1 font-bold tracking-tight ${insight.overallScore == null ? "text-lg" : "text-4xl"}`}>
                {insight.overallScore ?? "待积累"}{insight.overallScore != null ? <span className="ml-1 text-xs app-muted-text">/100</span> : null}
              </p>
              <p className="mt-1 text-xs font-bold" style={{ color: "var(--status-success)" }}>{insight.levelLabel}</p>
            </div>
            <GradeRing score={insight.overallScore} grade={insight.grade} />
            </div>
          </div>

          <div className="app-soft-card rounded-[1.35rem] border p-4">
            <p className="inline-flex items-center gap-2 text-sm font-black">
              <Sparkles size={16} style={{ color: "var(--status-success)" }} aria-hidden="true" />
              当前洞察
            </p>
            <p className="mt-2 text-sm leading-6 app-muted-text">
              {insight.strongestLabel ? `${insight.strongestLabel}表现突出。` : "能力数据正在积累。"}
              {insight.weakestLabel ? `${insight.weakestLabel}是当前可优先加强的方向。` : ""}
            </p>
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <p className="inline-flex items-center gap-1.5 text-xs font-black">
                <Target size={14} aria-hidden="true" />下一步建议
              </p>
              <p className="mt-1.5 text-xs leading-5 app-muted-text">{suggestion}</p>
            </div>
          </div>

          <div className="app-soft-card rounded-[1.35rem] border p-4">
            <div className="flex items-center gap-2">
              <BadgeCheck size={16} style={{ color: "var(--status-success)" }} aria-hidden="true" />
              <span className="text-sm font-bold">数据充分度</span>
              <span className="ml-auto text-xs font-semibold" style={{ color: "var(--status-success)" }}>{confidence.levelLabel}</span>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <span key={index} className="h-1.5 rounded-full" style={{ backgroundColor: index < confidence.stars ? "var(--status-success)" : "var(--border)" }} />
              ))}
            </div>
            <p className="sr-only">数据充分度 {confidence.stars} / 5</p>
            <p className="mt-2 text-xs font-medium app-muted-text">已汇总 {confidence.totalEvidence} 条有效学习数据</p>
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
              className="relative min-w-0 overflow-hidden rounded-[1.15rem] border p-3"
              style={{ backgroundColor: "var(--card)" }}
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
                <CardTitleWithHint headingLevel={3} title={portraitSkillLabels[item.skill]} titleClassName="pt-1 text-xs font-black" description={item.description} hintClassName="-mr-1" hintLabel={`查看${presentation.fullLabel}说明`} />
              </div>
              {item.value == null ? (
                <p className="mt-3 text-sm font-semibold app-muted-text">待积累</p>
              ) : (
                <>
                  <p className="mt-3 text-2xl font-bold tabular-nums">{item.value.toFixed(0)}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-soft)" }}>
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

/** 画像读取失败时的占位卡片，不影响页面其他区块。 */
export function AbilityPortraitLoadFailed({
  sourceLabel,
  reloadHref,
}: {
  sourceLabel: string;
  reloadHref: string;
}) {
  return (
    <section className="app-card flex h-full min-h-72 flex-col rounded-3xl border p-5 sm:p-6" data-card-level="1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitleWithHint
          headingLevel={2}
          title="学习能力画像"
          titleClassName="text-xl font-bold tracking-tight"
          description={`依据${sourceLabel}中的作业、测试和专项练习生成。`}
          hintLabel="查看能力画像说明"
        />
        <p className="app-soft-card rounded-full border px-3 py-1.5 text-xs font-semibold app-muted-text">
          数据来源：<span className="font-bold" style={{ color: "var(--foreground)" }}>{sourceLabel}</span>
        </p>
      </div>
      <div className="app-soft-card mt-5 flex flex-1 flex-col items-center justify-center rounded-[1.35rem] border p-6 text-center" role="alert">
        <CircleAlert size={24} style={{ color: "var(--status-warning)" }} aria-hidden="true" />
        <p className="mt-3 text-sm font-bold">
          能力数据暂时无法读取
        </p>
        <p className="mt-1 text-xs leading-5 app-muted-text">
          页面其他功能不受影响，可以稍后重新加载。
        </p>
        <a
          href={reloadHref}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
          style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}
        >
          重新加载
        </a>
      </div>
    </section>
  );
}
