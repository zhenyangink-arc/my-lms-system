"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setAllHomeTreeVisibility } from "./actions";

/** 学生端课程树展示配置页：一键全部开 / 全部关（作用于当前视图）。 */
export function HomeTreeBulkActions({ viewSlug }: { viewSlug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (show: boolean) =>
    startTransition(async () => {
      const result = await setAllHomeTreeVisibility(show, viewSlug);
      if (!result.ok) {
        console.error("setAllHomeTreeVisibility failed:", result.error);
        window.alert(`操作失败：${result.error ?? "未知错误"}`);
        return;
      }
      router.refresh();
    });

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(true)}
        className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white transition hover:opacity-85 disabled:opacity-50"
        style={{ backgroundColor: "var(--primary)" }}
      >
        一键全部开
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(false)}
        className="rounded-full px-3.5 py-1.5 text-xs font-bold transition hover:opacity-85 disabled:opacity-50"
        style={{
          backgroundColor: "color-mix(in srgb, var(--border) 60%, transparent)",
          color: "var(--foreground-muted)",
        }}
      >
        一键全部关
      </button>
    </div>
  );
}
