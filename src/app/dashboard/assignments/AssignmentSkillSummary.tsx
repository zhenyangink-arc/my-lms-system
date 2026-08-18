import { BookOpen, Headphones, Languages, Mic2, PenLine, SpellCheck2 } from "lucide-react";

import type { AssignmentLanguageSkill } from "./AssignmentSubmissionForm";

const skillMeta = {
  vocabulary: { label: "词汇", icon: Languages },
  grammar: { label: "语法", icon: SpellCheck2 },
  listening: { label: "听力", icon: Headphones },
  speaking: { label: "口语", icon: Mic2 },
  reading: { label: "阅读", icon: BookOpen },
  writing: { label: "写作", icon: PenLine },
} satisfies Record<
  AssignmentLanguageSkill,
  { label: string; icon: typeof Languages }
>;

export type AssignmentSkillScore = {
  skill: AssignmentLanguageSkill;
  earned: number;
  maximum: number;
};

export function AssignmentSkillSummary({
  scores,
  title = "六项能力表现",
}: {
  scores: AssignmentSkillScore[];
  title?: string;
}) {
  const visibleScores = scores.filter((score) => score.maximum > 0);
  if (visibleScores.length === 0) return null;

  return (
    <section className="app-card rounded-3xl border p-4 sm:p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="app-muted-text mt-1 text-xs">
        数字是已获得分数与该项满分；进度条仅辅助比较，不代替具体分数。
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleScores.map((score) => {
          const meta = skillMeta[score.skill];
          const Icon = meta.icon;
          const percent = Math.max(
            0,
            Math.min(100, Math.round((score.earned / score.maximum) * 100))
          );
          return (
            <div key={score.skill} className="app-soft-card rounded-2xl border p-4">
              <div className="flex items-center gap-2">
                <Icon size={16} className="text-[var(--support)]" aria-hidden="true" />
                <strong className="text-sm">{meta.label}</strong>
                <span className="app-muted-text ml-auto text-xs tabular-nums">
                  {score.earned} / {score.maximum}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`${meta.label}得分 ${score.earned}，满分 ${score.maximum}`}
                aria-valuemin={0}
                aria-valuemax={score.maximum}
                aria-valuenow={score.earned}
                className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]"
              >
                <div
                  className="h-full rounded-full bg-[var(--support)]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
