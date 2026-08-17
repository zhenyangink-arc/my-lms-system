"use client";

import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookmarkCheck,
  BookOpenCheck,
  Dumbbell,
} from "lucide-react";

const introductions: Array<{
  slug: "course" | "skills" | "review";
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  soft: string;
}> = [
  {
    slug: "course",
    title: "课程巩固",
    description:
      "沿着已报名课程和章节继续精研，把电子书学习、章节理解与测试进度连成一条清晰路线。",
    icon: BookOpenCheck,
    color: "var(--primary-hover)",
    soft: "var(--accent)",
  },
  {
    slug: "skills",
    title: "专项训练",
    description:
      "从听、说、读、写、词汇和语法六个维度单独训练，帮助你看清并补强具体能力。",
    icon: Dumbbell,
    color: "var(--support)",
    soft: "var(--support-surface)",
  },
  {
    slug: "review",
    title: "错题复习",
    description:
      "集中查看章节测试中主动加入复习的题目，随时回到原测试重新理解和验证。",
    icon: BookmarkCheck,
    color: "var(--status-success)",
    soft: "var(--status-success-surface)",
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
            "linear-gradient(135deg, var(--card), var(--accent))",
        }}
      >
        <span
          className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full opacity-60 blur-3xl"
          style={{ backgroundColor: introduction.soft }}
          aria-hidden="true"
        />

        <div className="relative">
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
              <h2
                id={`practice-intro-${introduction.slug}`}
                className="text-xl font-bold tracking-tight sm:text-2xl"
              >
                {introduction.title}
              </h2>
              <p className="app-muted-text mt-2 max-w-3xl text-sm font-bold leading-6">
                {introduction.description}
              </p>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
