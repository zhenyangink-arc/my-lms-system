"use client";

import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookmarkCheck,
  BookOpenCheck,
  CheckCircle2,
  Dumbbell,
} from "lucide-react";

const introductions: Array<{
  slug: "course" | "skills" | "review";
  eyebrow: string;
  title: string;
  description: string;
  points: [string, string, string];
  icon: LucideIcon;
  color: string;
  soft: string;
}> = [
  {
    slug: "course",
    eyebrow: "跟着课程继续学",
    title: "课程巩固",
    description:
      "沿着已报名课程和章节继续精研，把电子书学习、章节理解与测试进度连成一条清晰路线。",
    points: ["按课程推进", "按章节巩固", "延续已有进度"],
    icon: BookOpenCheck,
    color: "var(--app-accent-strong)",
    soft: "var(--app-accent-soft)",
  },
  {
    slug: "skills",
    eyebrow: "针对薄弱能力多练",
    title: "专项训练",
    description:
      "从听、说、读、写、词汇和语法六个维度单独训练，帮助你看清并补强具体能力。",
    points: ["六维能力训练", "独立能力画像", "练习结果留痕"],
    icon: Dumbbell,
    color: "var(--app-secondary)",
    soft: "var(--app-secondary-soft)",
  },
  {
    slug: "review",
    eyebrow: "把不会的题真正弄懂",
    title: "错题复习",
    description:
      "集中查看章节测试中主动加入复习的题目，随时回到原测试重新理解和验证。",
    points: ["错题集中整理", "快速返回原章节", "掌握后随时移出"],
    icon: BookmarkCheck,
    color: "var(--app-success)",
    soft: "var(--app-success-soft)",
  },
];

export function PracticeSectionIntro({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const introduction = introductions.find(
    (item) => pathname === `${basePath}/${item.slug}`,
  );

  if (!introduction) return null;

  const Icon = introduction.icon;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-6 lg:px-8">
      <section
        className="app-card relative overflow-hidden rounded-[28px] border p-5 sm:p-6"
        aria-labelledby={`practice-intro-${introduction.slug}`}
        style={{
          background:
            "linear-gradient(135deg, var(--app-card-bg), var(--app-hero-end))",
        }}
      >
        <span
          className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full opacity-60 blur-3xl"
          style={{ backgroundColor: introduction.soft }}
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:items-center">
            <span
              className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14"
              style={{
                color: introduction.color,
                backgroundColor: introduction.soft,
              }}
            >
              <Icon size={25} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p
                className="text-[10px] font-black tracking-[0.14em]"
                style={{ color: introduction.color }}
              >
                巩固中心 · {introduction.eyebrow}
              </p>
              <h2
                id={`practice-intro-${introduction.slug}`}
                className="mt-1 text-xl font-black tracking-tight sm:text-2xl"
              >
                {introduction.title}
              </h2>
              <p className="app-muted-text mt-2 max-w-3xl text-sm font-bold leading-6">
                {introduction.description}
              </p>
            </div>
          </div>

          <ul className="grid shrink-0 gap-2 sm:grid-cols-3" aria-label="本区用途">
            {introduction.points.map((point) => (
              <li
                key={point}
                className="flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black"
                style={{
                  borderColor: "var(--app-border-soft)",
                  backgroundColor: "var(--app-soft-bg)",
                }}
              >
                <CheckCircle2
                  size={15}
                  className="shrink-0"
                  style={{ color: introduction.color }}
                  aria-hidden="true"
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
