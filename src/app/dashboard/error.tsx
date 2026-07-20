"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-5">
      <section className="app-card w-full max-w-lg rounded-3xl border p-6 text-center shadow-sm">
        <p className="text-sm font-bold text-red-600">控制台加载失败</p>
        <h1 className="mt-2 text-2xl font-black">暂时无法读取这部分数据</h1>
        <p className="app-muted-text mt-3 text-sm leading-6">
          请重新加载当前区域。若问题持续出现，请联系平台管理员。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={unstable_retry}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            style={{ backgroundColor: "var(--app-accent)" }}
          >
            重新加载
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl border px-5 py-2.5 text-sm font-bold"
            style={{ borderColor: "var(--app-border)" }}
          >
            返回控制台
          </Link>
        </div>
      </section>
    </div>
  );
}
