"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type LessonCollapsibleCardProps = {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: "white" | "gray" | "indigo" | "yellow" | "red" | "green";
};

/**
 * 课时页通用折叠卡片
 * 用于：
 * - 本课学习目标
 * - 本课任务
 * - 课程资料
 * - 老师提示
 * - 学习内容
 * - 本课重点
 * - 案例分析
 * - 常见错误
 * - 本课小结
 * - 课后思考
 */
export function LessonCollapsibleCard({
  title,
  icon,
  children,
  defaultOpen = true,
  tone = "white",
}: LessonCollapsibleCardProps) {
  const toneClassMap = {
    white: "border-gray-200 bg-white",
    gray: "border-gray-200 bg-gray-50",
    indigo: "border-indigo-100 bg-indigo-50",
    yellow: "border-yellow-100 bg-yellow-50",
    red: "border-red-100 bg-red-50",
    green: "border-green-100 bg-green-50",
  };

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <section
        className={`rounded-2xl border shadow-sm ${toneClassMap[tone]}`}
      >
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-gray-700 shadow-sm">
              {icon}
            </div>

            <h3 className="truncate text-sm font-bold text-gray-900">
              {title}
            </h3>
          </div>

          <ChevronDown
            size={17}
            className="shrink-0 text-gray-400 transition group-data-[state=open]:rotate-180"
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-black/5 px-5 py-4">
            {children}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}