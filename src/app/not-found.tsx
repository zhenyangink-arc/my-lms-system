import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[65vh] items-center justify-center px-4 py-16">
      <section className="w-full max-w-lg text-center">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-indigo-600">404</p>
        <h1 className="mt-3 text-3xl font-black text-gray-950">没有找到这个页面</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          页面可能已移动、被删除，或者链接地址不完整。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800"
          >
            返回首页
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            进入学习中心
          </Link>
        </div>
      </section>
    </div>
  );
}
