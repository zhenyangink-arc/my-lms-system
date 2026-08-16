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
      <div className="flex min-h-28 items-end gap-4 border-b border-[var(--app-border-soft)] px-1 pb-6">
        <LoadingBlock className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-3">
          <LoadingBlock className="block h-3 w-24 rounded-full" />
          <LoadingBlock className="block h-8 w-full max-w-72 rounded-lg" />
          <LoadingBlock className="block h-3 w-full max-w-xl rounded-full" />
        </div>
      </div>
      <div className="mt-5 grid overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-card-bg)] sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="min-h-24 space-y-3 border-b border-[var(--app-border)] px-5 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
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
            className="min-h-40 rounded-lg border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5"
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
