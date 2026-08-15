import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BookOpen,
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
};

type ToolboxProfileRow = {
  skill: LanguageSkill;
  ability_score: number | string | null;
  valid_sessions: number | string;
  valid_attempts: number | string;
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

export default async function ToolboxPage() {
  const { supabase, tenant, user } = await requireActiveUser();
  const dashboardBasePath = tenant?.slug
    ? getStudentAppBasePath(tenant.slug, "korean")
    : getDashboardBasePath(null);

  const [{ data: rows }, { data: profileRows }] = await Promise.all([
    supabase
      .from("growth_toolbox_items")
      .select("id,slug,title,description,href,icon_name,accent,soft,sort_order,is_enabled")
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
  ]);

  const profiles = (profileRows ?? []) as ToolboxProfileRow[];
  const profileBySkill = new Map(profiles.map((profile) => [profile.skill, profile]));

  const tools: ToolEntry[] = (rows ?? [])
    .filter((row) => row.is_enabled)
    .map((row) => ({
      id: row.id,
      skill: row.slug,
      title: row.title,
      description: row.description,
      href: scopeDashboardPath(row.href, dashboardBasePath),
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
    }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Hero 区 */}
      <section
        className="relative overflow-hidden rounded-3xl border p-6 sm:p-8"
        style={{
          background:
            "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg), var(--app-accent-soft))",
          borderColor: "var(--app-border)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full opacity-50 blur-3xl"
          style={{ backgroundColor: "var(--app-accent-soft)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full opacity-40 blur-3xl"
          style={{ backgroundColor: "var(--app-warm-soft)" }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{
                color: "var(--app-accent)",
                backgroundColor: "var(--app-accent-soft)",
              }}
            >
              <Wrench size={26} aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight">成长工具箱</h1>
              <p className="app-muted-text mt-1 text-sm font-bold">
                专项练习，巩固每一课的知识点。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black"
              style={{
                color: "var(--app-accent)",
                backgroundColor: "var(--app-accent-soft)",
              }}
            >
              <Sparkles size={13} aria-hidden="true" />
              {tools.length} 大练习
            </span>
          </div>
        </div>
      </section>

      <SixDimensionRadar
        eyebrow="日常练习能力画像"
        title="成长工具箱 · 六维练习能力"
        description="只统计最近 30 天的日常专项练习，与老师作业和正式考试完全分开"
        icon={Activity}
        color="var(--app-accent)"
        soft="var(--app-accent-soft)"
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

      {/* 练习入口卡片 */}
      {tools.length === 0 ? (
        <section
          className="app-soft-card flex min-h-52 flex-col items-center justify-center rounded-3xl border p-8 text-center"
          style={{ borderColor: "var(--app-border)" }}
        >
          <Wrench size={28} className="opacity-40" aria-hidden="true" />
          <p className="mt-3 text-sm font-black">暂时没有可用的练习</p>
          <p className="app-muted-text mt-1 text-xs">
            练习入口正在准备中，上线后会出现在这里。
          </p>
        </section>
      ) : (
        <section aria-labelledby="practice-modules-title">
          <div className="mb-3 px-1">
            <p className="text-[10px] font-black tracking-[0.12em] text-[var(--app-accent)]">
              六维专项练习
            </p>
            <h2 id="practice-modules-title" className="mt-1 text-lg font-black tracking-tight">
              选择今天要巩固的能力
            </h2>
            <p className="app-muted-text mt-1 text-xs font-bold">
              每项练习独立记录，时间不会直接增加能力分
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.id}
                href={tool.href}
                className="app-card group relative overflow-hidden rounded-3xl border p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{ borderColor: "var(--app-border)" }}
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-60 blur-2xl transition duration-300 group-hover:opacity-90"
                  style={{ backgroundColor: tool.soft }}
                />
                <div className="relative flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-2xl transition duration-300 group-hover:scale-110"
                      style={{ color: tool.accent, backgroundColor: tool.soft }}
                    >
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-black tabular-nums"
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
                    <h2 className="text-lg font-black">{tool.title}</h2>
                    <p className="app-muted-text mt-1.5 text-xs leading-5">
                      {tool.description}
                    </p>
                  </div>
                  <div
                    className="mt-auto flex items-center gap-1.5 text-xs font-black"
                    style={{ color: tool.accent }}
                  >
                    开始
                    <ArrowRight
                      size={14}
                      className="transition duration-300 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </Link>
            );
          })}
          </div>
        </section>
      )}
    </div>
  );
}
