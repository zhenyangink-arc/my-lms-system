import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
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

import { requireActiveUser } from "@/lib/auth";

type ToolEntry = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: string;
  soft: string;
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

type ToolboxRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  href: string;
  icon_name: string;
  accent: string;
  soft: string;
  sort_order: number;
  is_enabled: boolean;
};

export default async function ToolboxPage() {
  const { supabase } = await requireActiveUser();

  const { data: rows } = await supabase
    .from("growth_toolbox_items")
    .select("id,slug,title,description,href,icon_name,accent,soft,sort_order,is_enabled")
    .order("sort_order", { ascending: true });

  const tools: ToolEntry[] = (rows ?? [])
    .filter((row) => row.is_enabled)
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      href: row.href,
      icon: iconMap[row.icon_name] ?? Wrench,
      accent: row.accent,
      soft: row.soft,
    }));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
        <section className="grid gap-4 md:grid-cols-2">
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
                      className="rounded-full px-2.5 py-1 text-[10px] font-black"
                      style={{ color: tool.accent, backgroundColor: tool.soft }}
                    >
                      进入练习
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
        </section>
      )}
    </div>
  );
}
