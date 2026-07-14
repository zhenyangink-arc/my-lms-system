"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
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
    <div className="flex min-h-[65vh] items-center justify-center px-4 py-16">
      <section className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-red-600">
          页面加载失败
        </p>
        <h1 className="mt-3 text-2xl font-black text-gray-950">刚刚出现了一点问题</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          你的数据没有因此被修改。可以重新加载当前页面，或先返回首页。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={unstable_retry}
            className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800"
          >
            重新加载
          </button>
          <Link
            href="/"
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            返回首页
          </Link>
        </div>
      </section>
    </div>
  );
}
