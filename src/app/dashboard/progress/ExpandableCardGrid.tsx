"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * 待复习题之前没有分页，题目攒多了就是一整页超长列表。
 * 服务端还是照常渲染全部卡片（含各自绑定的 Server Action），
 * 这里只负责先只展示一部分、点击后再展开剩下的。
 */
export function ExpandableCardGrid({
  items,
  initialCount = 12,
  className,
}: {
  items: React.ReactNode[];
  initialCount?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, initialCount);
  const remaining = items.length - visibleItems.length;

  return (
    <>
      <div className={className}>{visibleItems}</div>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="app-soft-card mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border px-4 py-3 text-xs font-bold"
        >
          展开剩下的 {remaining} 道题
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      )}
    </>
  );
}
