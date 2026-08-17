import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Ear,
  Headphones,
  MessageSquare,
  Mic,
  NotebookPen,
  PenTool,
  Sparkles,
  Wrench,
} from "lucide-react";

import {
  SixDimensionRadar,
  type LanguageSkill,
} from "@/components/analytics/SixDimensionRadar";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";
import { withStudentAppSchemaFallback } from "@/lib/student-app-data";
import {
  getStudentAppBasePath,
  STUDENT_APP_IDS,
} from "@/lib/student-apps";

type ToolEntry = {
  id: string;
  skill: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
  soft: string;
  ability: number | null;
  practiceCount: number;
  courseCount: number;
  chapterCount: number;
  focus: string[];
};

type ToolboxProfileRow = {
  skill: LanguageSkill;
  ability_score: number | string | null;
  valid_sessions: number | string;
  valid_attempts: number | string;
};

type ExerciseCoverageRow = {
  skill: string;
  course_id: string | null;
  course_chapter_id: string | null;
};

const skillFocusMap: Record<string, string[]> = {
  listening: ["听音辨义", "关键信息", "语音反应"],
  speaking: ["情境表达", "朗读模仿", "口头反应"],
  reading: ["信息定位", "语境理解", "规则判断"],
  writing: ["句子书写", "结构运用", "准确表达"],
  grammar: ["句型结构", "助词规则", "语言运用"],
  vocabulary: ["核心词语", "字词辨认", "语境搭配"],
};

const iconMap: Record<string, LucideIcon> = {
  "notebook-pen": NotebookPen,
  mic: Mic,
  "book-open": BookOpen,
  ear: Ear,
  headphones: Headphones,
  "message-square": MessageSquare,
  "pen-tool": PenTool,
  wrench: Wrench,
  sparkles: Sparkles,
};

export async function ToolboxPage({
  skillsBasePath,
  showHero = true,
}: {
  skillsBasePath?: string;
  showHero?: boolean;
} = {}) {
  const { supabase, tenant, user } = await requireActiveUser();
  const dashboardBasePath = tenant?.slug
    ? getStudentAppBasePath(tenant.slug, "korean")
    : getDashboardBasePath(null);

  const [
    { data: rows },
    { data: profileRows },
    { data: exerciseCoverageRows },
  ] = await Promise.all([
    supabase
      .from("growth_toolbox_items")
      .select("id,slug,title,description,href,icon_name,accent,soft,sort_order,is_enabled")
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .order("sort_order", { ascending: true }),
    withStudentAppSchemaFallback(
      supabase
        .from("student_toolbox_skill_profiles")
        .select("skill,ability_score,valid_sessions,valid_attempts")
        .eq("student_id", user.id)
        .eq("student_app_id", STUDENT_APP_IDS.korean),
      () =>
        supabase
          .from("student_toolbox_skill_profiles")
          .select("skill,ability_score,valid_sessions,valid_attempts")
          .eq("student_id", user.id),
    ),
    supabase
      .from("growth_toolbox_exercises")
      .select("skill,course_id,course_chapter_id")
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .eq("status", "published")
      .not("course_chapter_id", "is", null),
  ]);

  const profiles = (profileRows ?? []) as ToolboxProfileRow[];
  const profileBySkill = new Map(profiles.map((profile) => [profile.skill, profile]));
  const coverageBySkill = new Map<
    string,
    { chapterIds: Set<string>; courseIds: Set<string> }
  >();

  for (const coverage of (exerciseCoverageRows ?? []) as ExerciseCoverageRow[]) {
    if (!coverage.course_id || !coverage.course_chapter_id) continue;
    const current = coverageBySkill.get(coverage.skill) ?? {
      chapterIds: new Set<string>(),
      courseIds: new Set<string>(),
    };
    current.chapterIds.add(coverage.course_chapter_id);
    current.courseIds.add(coverage.course_id);
    coverageBySkill.set(coverage.skill, current);
  }

  const tools: ToolEntry[] = (rows ?? [])
    .filter((row) => row.is_enabled)
    .map((row) => ({
      id: row.id,
      skill: row.slug,
      title: row.title,
      description: row.description,
      href: scopeDashboardPath(
        skillsBasePath ? `${skillsBasePath}/${encodeURIComponent(row.slug)}` : row.href,
        dashboardBasePath,
      ),
      icon: iconMap[row.icon_name] ?? Wrench,
      accent: row.accent,
      soft: row.soft,
      ability:
        profileBySkill.get(row.slug as LanguageSkill)?.ability_score == null
          ? null
          : Number(
              profileBySkill.get(row.slug as LanguageSkill)?.ability_score,
            ),
      practiceCount: Number(
        profileBySkill.get(row.slug as LanguageSkill)?.valid_sessions ?? 0,
      ),
      courseCount: coverageBySkill.get(row.slug)?.courseIds.size ?? 0,
      chapterCount: coverageBySkill.get(row.slug)?.chapterIds.size ?? 0,
      focus: skillFocusMap[row.slug] ?? ["章节训练", "独立记录", "能力成长"],
    }));

  const coveredChapterIds = new Set(
    [...coverageBySkill.values()].flatMap((coverage) => [...coverage.chapterIds]),
  );
  const coveredCourseIds = new Set(
    [...coverageBySkill.values()].flatMap((coverage) => [...coverage.courseIds]),
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* 旧入口继续自带说明；巩固中心由统一介绍卡承担这一层信息。 */}
      {showHero && <section
        className="relative overflow-hidden rounded-3xl border p-6 sm:p-8"
        style={{
          background:
            "linear-gradient(125deg, var(--card), var(--card), var(--accent))",
          borderColor: "var(--border)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full opacity-50 blur-3xl"
          style={{ backgroundColor: "var(--accent)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full opacity-40 blur-3xl"
          style={{ backgroundColor: "var(--status-warning-surface)" }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{
                color: "var(--primary)",
                backgroundColor: "var(--accent)",
              }}
            >
              <Wrench size={26} aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight">专项训练</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
              style={{
                color: "var(--primary)",
                backgroundColor: "var(--accent)",
              }}
            >
              <Sparkles size={13} aria-hidden="true" />
              {tools.length} 大练习
            </span>
          </div>
        </div>
      </section>}

      <SixDimensionRadar
        title="专项训练 · 六维练习能力"
        description="只统计最近 30 天的日常专项练习，与老师作业和正式考试完全分开"
        icon={Activity}
        color="var(--primary)"
        soft="var(--accent)"
        data={profiles.map((profile) => ({
          skill: profile.skill,
          value:
            profile.ability_score == null
              ? null
              : Number(profile.ability_score),
          evidenceCount: Number(profile.valid_attempts),
          activityCount: Number(profile.valid_sessions),
        }))}
        evidenceText={(item) =>
          item.evidenceCount
            ? `${item.evidenceCount} 次有效作答 · ${item.activityCount ?? 0} 轮练习`
            : "至少完成 5 次有效作答后形成能力值"
        }
        emptyMessage="还没有达到统计门槛的日常练习。完成阅读、写作等专项练习后，这里会形成独立的六边形能力画像。"
        insightLabel="练习建议"
      />

      <section
        className="app-card grid overflow-hidden rounded-2xl border sm:grid-cols-3"
        aria-label="专项训练课程覆盖"
      >
        {[
          [coveredCourseIds.size, "已对应课程"],
          [coveredChapterIds.size, "已对应章节"],
          [tools.length, "能力板块"],
        ].map(([value, label], index) => (
          <div
            key={String(label)}
            className="border-t p-4 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor:
                index === 0 ? "var(--surface-soft)" : "var(--card)",
            }}
          >
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="app-muted-text mt-1 text-xs font-bold">{label}</p>
          </div>
        ))}
      </section>

      {/* 练习入口卡片 */}
      {tools.length === 0 ? (
        <section
          className="app-soft-card flex min-h-52 flex-col items-center justify-center rounded-3xl border p-8 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <Wrench size={28} className="opacity-40" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold">暂时没有可用的练习</p>
          <p className="app-muted-text mt-1 text-xs">
            练习入口正在准备中，上线后会出现在这里。
          </p>
        </section>
      ) : (
        <section aria-label="选择今天要巩固的能力">
          <div className="mb-3 px-1">
            <CardTitleWithHint
              title="选择今天要巩固的能力"
              description="每项练习独立记录，时间不会直接增加能力分"
              headingLevel={2}
              titleClassName="text-lg font-bold tracking-tight"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                className="app-card group relative flex min-h-72 flex-col rounded-3xl border p-5 transition-[border-color,box-shadow] hover:shadow-md"
                style={{ borderColor: "var(--border)" }}
              >
                <Link
                  href={tool.href}
                  className="absolute inset-0 rounded-3xl focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
                  aria-label={tool.title}
                />
                <div className="pointer-events-none relative flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ color: tool.accent, backgroundColor: tool.soft }}
                    >
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold tabular-nums"
                      style={{ color: tool.accent, backgroundColor: tool.soft }}
                    >
                      {tool.ability == null
                        ? tool.practiceCount
                          ? `${tool.practiceCount} 轮 · 待积累`
                          : "尚未练习"
                        : `能力 ${tool.ability.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="mt-1">
                    <CardTitleWithHint
                      title={tool.title}
                      description={tool.description}
                      headingLevel={2}
                      hintClassName="pointer-events-auto relative z-10"
                      titleClassName="text-lg font-bold"
                    />
                  </div>

                  <ul className="flex flex-wrap gap-2" aria-label={`${tool.title}训练重点`}>
                    {tool.focus.map((focus) => (
                      <li
                        key={focus}
                        className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={{ color: tool.accent, backgroundColor: tool.soft }}
                      >
                        {focus}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto border-t pt-4" style={{ borderColor: "var(--border-subtle)" }}>
                    <div className="flex items-center justify-between gap-3 text-xs font-bold">
                      <span className="inline-flex items-center gap-1.5 app-muted-text">
                        <CheckCircle2 size={14} style={{ color: tool.accent }} aria-hidden="true" />
                        {tool.courseCount} 门课程 · {tool.chapterCount} 个章节
                      </span>
                      <span className="inline-flex min-h-11 items-center gap-1.5" style={{ color: tool.accent }}>
                        选择章节
                        <ArrowRight size={14} aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </section>
      )}
    </div>
  );
}

export default function LegacyToolboxPage() {
  return <ToolboxPage />;
}
