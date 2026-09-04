"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookmarkCheck, BookOpenCheck, Dumbbell } from "lucide-react";

import { RouteLinkStatus } from "@/app/dashboard/RouteLinkStatus";

const sections = [
  {
    slug: "course",
    label: "课程巩固",
    description: "按课程和章节继续精研",
    icon: BookOpenCheck,
  },
  {
    slug: "skills",
    label: "专项训练",
    description: "听说读写词汇语法",
    icon: Dumbbell,
  },
  {
    slug: "review",
    label: "错题复习",
    description: "集中处理待复习题",
    icon: BookmarkCheck,
  },
] as const;

export function PracticeHubNavigation({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto w-full max-w-[1680px] px-4 pt-5 sm:px-6 lg:px-8">
      <nav
        className="app-card grid grid-cols-3 gap-1.5 rounded-2xl border p-1.5"
        aria-label="巩固中心功能"
      >
        {sections.map((section) => {
          const href = `${basePath}/${section.slug}`;
          const selected =
            pathname === href || pathname.startsWith(`${href}/`);
          const Icon = section.icon;

          return (
            <Link
              key={section.slug}
              href={href}
              aria-current={selected ? "page" : undefined}
              className="flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-center transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 sm:min-h-16 sm:px-4"
              style={
                selected
                  ? {
                      color: "var(--primary-hover)",
                      backgroundColor: "var(--accent)",
                      outlineColor: "var(--primary)",
                    }
                  : {
                      color: "var(--foreground-muted)",
                      outlineColor: "var(--primary)",
                    }
              }
            >
              <Icon size={18} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <strong className="block truncate text-xs font-bold sm:text-sm">
                  {section.label}
                </strong>
                <small className="mt-0.5 hidden truncate text-[10px] font-bold opacity-75 sm:block">
                  {section.description}
                </small>
              </span>
              <RouteLinkStatus className="hidden sm:inline-block" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
