"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setHomeTreeVisibility } from "./actions";

type Props = {
  table: "courses" | "course_categories";
  id: string;
  checked: boolean;
  viewSlug: string;
};

/** 课程树视图展示开关（写入 course_tree_view_items）。 */
export function HomeTreeToggle({ table, id, checked, viewSlug }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={checked}
      title={checked ? "已在首页课程树展示" : "不在首页课程树展示"}
      onClick={() =>
        startTransition(async () => {
          const result = await setHomeTreeVisibility(table, id, !checked, viewSlug);
          if (!result.ok) {
            console.error("setHomeTreeVisibility failed:", result.error);
            window.alert(`操作失败：${result.error ?? "未知错误"}`);
            return;
          }
          router.refresh();
        })
      }
      className="relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50"
      style={{
        backgroundColor: checked
          ? "var(--primary)"
          : "color-mix(in srgb, var(--border) 60%, transparent)",
      }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}
