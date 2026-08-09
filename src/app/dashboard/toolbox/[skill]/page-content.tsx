import Link from "next/link";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, BookOpen, Ear, Mic } from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { ToolboxStudyTimer } from "@/app/dashboard/toolbox/StudyTimer";
import { requireActiveUser } from "@/lib/auth";

const skillMap: Record<
  string,
  { title: string; icon: LucideIcon; accent: string; soft: string }
> = {
  speaking: {
    title: "口语练习",
    icon: Mic,
    accent: "var(--app-warm)",
    soft: "var(--app-warm-soft)",
  },
  grammar: {
    title: "语法练习",
    icon: BookOpen,
    accent: "var(--app-secondary)",
    soft: "var(--app-secondary-soft)",
  },
  listening: {
    title: "听力练习",
    icon: Ear,
    accent: "var(--app-success)",
    soft: "var(--app-success-soft)",
  },
};

export default async function ToolboxSkillPage({
  params,
}: {
  params: Promise<{ skill: string }>;
}) {
  await requireActiveUser();
  const { skill } = await params;
  const entry = skillMap[skill];
  if (!entry) notFound();

  const Icon = entry.icon;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <ToolboxStudyTimer skill={skill} />
      <Link
        href="/dashboard/toolbox"
        className="app-muted-text inline-flex items-center gap-2 text-xs font-black"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        返回成长工具箱
      </Link>

      <section
        className="app-card rounded-3xl border p-8 text-center sm:p-10"
        style={{
          background:
            "linear-gradient(145deg, var(--app-card-bg), var(--app-hero-end))",
        }}
      >
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ color: entry.accent, backgroundColor: entry.soft }}
        >
          <Icon size={26} aria-hidden="true" />
        </span>
        <DashboardTitleWithHint
          className="mt-4"
          headingLevel={1}
          title={`${entry.title} · 即将上线`}
          description="这个练习板块正在打磨中，完成后会在这里开放，敬请期待。"
        />
      </section>
    </div>
  );
}
