function LoadingBlock({ className }: { className: string }) {
  return <span aria-hidden="true" className={`route-loading-block ${className}`} />;
}

export function ManagementRouteLoading() {
  return (
    <div
      className="route-loading-shell management-page-shell"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">正在打开管理页面…</span>
      <div className="flex min-h-28 items-end gap-4 border-b border-[var(--border-subtle)] px-1 pb-6">
        <LoadingBlock className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-3">
          <LoadingBlock className="block h-3 w-24 rounded-full" />
          <LoadingBlock className="block h-8 w-full max-w-72 rounded-lg" />
          <LoadingBlock className="block h-3 w-full max-w-xl rounded-full" />
        </div>
      </div>
      <div className="mt-5 grid overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="min-h-24 space-y-3 border-b border-[var(--border)] px-5 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
          >
            <LoadingBlock className="block h-3 w-20 rounded-full" />
            <LoadingBlock className="block h-7 w-16 rounded-md" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="min-h-40 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
          >
            <LoadingBlock className="block size-9 rounded-lg" />
            <LoadingBlock className="mt-5 block h-4 w-28 rounded-full" />
            <LoadingBlock className="mt-3 block h-3 w-full rounded-full" />
            <LoadingBlock className="mt-2 block h-3 w-3/4 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentRouteLoading() {
  return (
    <div
      className="route-loading-shell mx-auto w-full max-w-[1500px] space-y-4 px-4 py-5 sm:px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">正在打开页面…</span>
      <div className="app-card space-y-3 rounded-2xl border p-5">
        <LoadingBlock className="block h-3 w-20 rounded-full" />
        <LoadingBlock className="block h-7 w-full max-w-64 rounded-lg" />
        <LoadingBlock className="block h-3 w-full max-w-lg rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="app-card min-h-36 rounded-2xl border p-5">
            <LoadingBlock className="block size-10 rounded-xl" />
            <LoadingBlock className="mt-4 block h-4 w-28 rounded-full" />
            <LoadingBlock className="mt-3 block h-3 w-full rounded-full" />
            <LoadingBlock className="mt-2 block h-3 w-2/3 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentCourseRouteLoading() {
  return (
    <div
      className="route-loading-shell fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center bg-[var(--background)] px-5 py-8 text-[var(--foreground)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="app-card w-full max-w-md rounded-[28px] border p-6 shadow-xl sm:p-8">
        <p className="text-center text-lg font-bold">正在加载课程数据</p>
        <p className="mt-2 text-center text-sm leading-6 text-[var(--foreground-secondary)]">
          教材、教学脚本和学习进度准备完成后，会自动显示学习界面。
        </p>
        <div
          className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--border-subtle)]"
          role="progressbar"
          aria-label="课程数据加载进度"
        >
          <span className="route-loading-progress block h-full w-2/5 rounded-full bg-[var(--support)]" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-[var(--foreground-muted)]">
          <span>读取章节</span>
          <span>载入学习记录</span>
          <span>准备界面</span>
        </div>
      </div>
    </div>
  );
}
