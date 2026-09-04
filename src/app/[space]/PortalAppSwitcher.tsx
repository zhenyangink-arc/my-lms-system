"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calculator,
  ChevronDown,
  GraduationCap,
  Grid2X2,
  Languages,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { StudentAppKind, StudentAppSlug } from "@/lib/student-apps";

export type PortalSwitcherApp = {
  slug: StudentAppSlug;
  title: string;
  kind: StudentAppKind;
  href: string;
};

const appIcons = {
  korean: Languages,
  english: BookOpen,
  math: Calculator,
  university: GraduationCap,
  "study-abroad": Building2,
} satisfies Record<StudentAppSlug, typeof Languages>;

const appIconClasses = {
  korean: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  english: "bg-sky-50 text-sky-700 ring-sky-600/15",
  math: "bg-amber-50 text-amber-700 ring-amber-600/15",
  university: "bg-violet-50 text-violet-700 ring-violet-600/15",
  "study-abroad": "bg-rose-50 text-rose-700 ring-rose-600/15",
} satisfies Record<StudentAppSlug, string>;

export function PortalAppSwitcher({ apps }: { apps: PortalSwitcherApp[] }) {
  const available = apps.length > 0;

  return (
    <Popover>
      <PopoverTrigger
        disabled={!available}
        aria-label={available ? "选择要进入的应用" : "暂无可进入的应用"}
        className="group inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-100/90 px-3 text-xs font-bold text-emerald-950 ring-1 ring-emerald-600/10 transition-colors hover:bg-emerald-200/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:px-3.5"
      >
        <Grid2X2 size={17} aria-hidden="true" />
        <span className="hidden sm:inline">
          {available ? "选择应用" : "暂无应用"}
        </span>
        {available ? (
          <ChevronDown
            size={15}
            aria-hidden="true"
            className="hidden text-slate-700 transition-transform group-data-[popup-open]:rotate-180 sm:block"
          />
        ) : null}
      </PopoverTrigger>

      {available ? (
        <PopoverContent
          align="end"
          sideOffset={10}
          positionerClassName="max-w-[calc(100vw-2rem)]"
          className="w-72 overflow-hidden rounded-2xl border-slate-200 bg-white p-2 text-slate-950 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.45)]"
        >
          <PopoverTitle className="px-3 pb-2 pt-2 text-sm font-black text-slate-950">
            选择要进入的应用
          </PopoverTitle>
          <nav aria-label="可进入的学生应用" className="space-y-1">
            {apps.map((app) => {
              const Icon = appIcons[app.slug];

              return (
                <Link
                  key={app.slug}
                  href={app.href}
                  className="group/app flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${appIconClasses[app.slug]}`}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-900">
                      {app.title}
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                      {app.kind === "service" ? "服务应用" : "学习应用"}
                    </span>
                  </span>
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className="text-slate-400 transition-transform group-hover/app:translate-x-0.5 group-hover/app:text-slate-700"
                  />
                </Link>
              );
            })}
          </nav>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
